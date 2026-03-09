import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import {
  buildEmailHtml,
  logCaseEvent,
  sendAdvisorAssignedEmail,
  sendEmail,
} from "@/lib/notifications/notify"
import {
  CaseType,
  createCaseFromLead,
  ensureCustomerAccount,
  type LeadRow,
} from "@/lib/admin/leads"
import { getTippgeberProfileByUserId, isEmail, type TippgeberReferralRow } from "@/lib/tippgeber/service"
import { normalizeTippgeberKind, tippgeberKindLabel } from "@/lib/tippgeber/kinds"

export const runtime = "nodejs"

function trim(value: unknown) {
  return String(value ?? "").trim()
}

function nextExternalLeadId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

type LeadInsertResult = {
  data: { id: string; external_lead_id: number } | null
  error: Error | null
}

function toErrorLike(error: unknown) {
  return error as { code?: string; message?: string } | null
}

async function insertLeadWithRetry(
  admin: ReturnType<typeof supabaseAdmin>,
  rowBase: Record<string, unknown>
): Promise<LeadInsertResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const externalLeadId = nextExternalLeadId()
    const first = await admin
      .from("webhook_leads")
      .insert({ ...rowBase, external_lead_id: externalLeadId })
      .select("id,external_lead_id")
      .single()
    if (!first.error) {
      return {
        data: {
          id: String(first.data?.id ?? ""),
          external_lead_id: Number(first.data?.external_lead_id ?? externalLeadId),
        },
        error: null,
      }
    }

    const firstError = toErrorLike(first.error)
    const isDuplicate = String(firstError?.code ?? "") === "23505"
    const missingLeadCaseType = String(firstError?.code ?? "") === "42703"
      || String(firstError?.message ?? "").toLowerCase().includes("lead_case_type")

    if (missingLeadCaseType) {
      const fallbackPayload: Record<string, unknown> = { ...rowBase, external_lead_id: externalLeadId }
      delete fallbackPayload.lead_case_type
      const second = await admin.from("webhook_leads").insert(fallbackPayload).select("id,external_lead_id").single()
      if (!second.error) {
        return {
          data: {
            id: String(second.data?.id ?? ""),
            external_lead_id: Number(second.data?.external_lead_id ?? externalLeadId),
          },
          error: null,
        }
      }
      const secondError = toErrorLike(second.error)
      if (String(secondError?.code ?? "") !== "23505") {
        return {
          data: null,
          error: new Error(secondError?.message ?? "lead_insert_failed"),
        }
      }
      continue
    }

    if (!isDuplicate) {
      return {
        data: null,
        error: new Error(firstError?.message ?? "lead_insert_failed"),
      }
    }
  }
  return { data: null, error: new Error("duplicate_external_lead_id") }
}

function productLabel(caseType: CaseType) {
  return caseType === "konsum" ? "Privatkredit" : "Baufinanzierung"
}

function caseTypeFromReferral(referral: TippgeberReferralRow): CaseType {
  return normalizeTippgeberKind(referral.referral_kind) === "private_credit" ? "konsum" : "baufi"
}

function amountFromReferral(referral: TippgeberReferralRow, caseType: CaseType) {
  return caseType === "konsum" ? referral.private_credit_volume : referral.manual_purchase_price
}

function leadPurpose(caseType: CaseType) {
  return caseType === "konsum" ? "Tippgeber Privat-Empfehlung" : "Tippgeber-Empfehlung"
}

function buildLeadFromReferral(referral: TippgeberReferralRow, caseType: CaseType): LeadRow {
  const requestedAmount = amountFromReferral(referral, caseType)

  return {
    id: "",
    linked_case_id: null,
    external_lead_id: 0,
    assigned_advisor_id: null,
    lead_case_type: caseType,
    first_name: referral.customer_first_name,
    last_name: referral.customer_last_name,
    email: referral.customer_email,
    phone: referral.customer_phone,
    phone_mobile: referral.customer_phone,
    phone_work: null,
    birth_date: null,
    marital_status: null,
    employment_status: null,
    employment_type: null,
    net_income_monthly: null,
    address_street: null,
    address_zip: null,
    address_city: null,
    product_name: productLabel(caseType),
    product_price: requestedAmount,
    loan_purpose: leadPurpose(caseType),
    loan_amount_total: caseType === "konsum" ? requestedAmount : null,
    property_zip: caseType === "baufi" ? referral.property_zip : null,
    property_city: caseType === "baufi" ? referral.property_city : null,
    property_type: null,
    property_purchase_price: caseType === "baufi" ? referral.manual_purchase_price : null,
    notes: caseType === "konsum" ? "Lead aus Tippgeber-Privat-Bereich" : "Lead aus Tippgeber-Bereich",
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const referralId = trim(body?.referralId)
    const advisorId = trim(body?.advisorId)
    if (!referralId || !advisorId) {
      return NextResponse.json({ ok: false, error: "referralId/advisorId fehlt." }, { status: 400 })
    }

    const { data: advisorProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", advisorId)
      .eq("role", "advisor")
      .maybeSingle()
    if (!advisorProfile) {
      return NextResponse.json({ ok: false, error: "Berater nicht gefunden." }, { status: 400 })
    }

    const { data: referralRaw } = await admin
      .from("tippgeber_referrals")
      .select("*")
      .eq("id", referralId)
      .maybeSingle()
    const referral = (referralRaw as TippgeberReferralRow | null) ?? null
    if (!referral) {
      return NextResponse.json({ ok: false, error: "Tipp nicht gefunden." }, { status: 404 })
    }

    if (!isEmail(referral.customer_email)) {
      return NextResponse.json({ ok: false, error: "Kunden-E-Mail ist ungültig." }, { status: 400 })
    }

    const caseType = caseTypeFromReferral(referral)
    const referralKind = normalizeTippgeberKind(referral.referral_kind)
    const requestedAmount = amountFromReferral(referral, caseType)

    if (caseType === "konsum" && (!requestedAmount || requestedAmount <= 0)) {
      return NextResponse.json(
        { ok: false, error: "Kreditvolumen fehlt oder ist ungültig." },
        { status: 400 }
      )
    }

    const previousAdvisorId = referral.assigned_advisor_id ?? null
    const isAdvisorChanged = previousAdvisorId !== advisorId
    let caseId = referral.linked_case_id ?? null
    let leadId = referral.linked_lead_id ?? null
    let externalLeadId: number | null = null
    let caseCreated = false
    let invited = false
    let existingAccount = false
    let passwordInviteSent = false
    let advisorMailSent = false
    let nextStepsMailSent = false

    if (!caseId) {
      const tippgeberProfile = await getTippgeberProfileByUserId(referral.tippgeber_user_id)
      const companyName = tippgeberProfile?.company_name ?? "Tippgeber"
      const recommendationCompanyName = String(tippgeberProfile?.company_name ?? "").trim()
      const recommendationContact = recommendationCompanyName
        ? {
            companyName: recommendationCompanyName,
            phone: tippgeberProfile?.phone ?? null,
            logoPath: tippgeberProfile?.logo_path ?? null,
          }
        : null
      const now = new Date().toISOString()

      const leadInsertBase = {
        source: "tippgeber",
        event_type: "lead.new",
        status: "new",
        source_created_at: now,
        last_event_at: now,
        first_name: referral.customer_first_name,
        last_name: referral.customer_last_name,
        email: referral.customer_email,
        phone: referral.customer_phone,
        phone_mobile: referral.customer_phone,
        product_name: productLabel(caseType),
        product_price: requestedAmount,
        lead_case_type: caseType,
        loan_purpose: leadPurpose(caseType),
        loan_amount_total: caseType === "konsum" ? requestedAmount : null,
        property_zip: caseType === "baufi" ? referral.property_zip : null,
        property_city: caseType === "baufi" ? referral.property_city : null,
        property_type: null,
        property_purchase_price: caseType === "baufi" ? referral.manual_purchase_price : null,
        notes: `${leadPurpose(caseType)} von ${companyName}`,
        additional: {
          origin: "tippgeber",
          referral_id: referral.id,
          referral_kind: referralKind,
          product: productLabel(caseType),
          tippgeber_user_id: referral.tippgeber_user_id,
          expose_uploaded: caseType === "baufi" ? Boolean(referral.expose_file_path) : false,
          private_credit_volume: caseType === "konsum" ? requestedAmount : null,
          manual_broker_commission_percent: referral.manual_broker_commission_percent,
          property_address: {
            street: caseType === "baufi" ? referral.property_street : null,
            house_number: caseType === "baufi" ? referral.property_house_number : null,
            zip: caseType === "baufi" ? referral.property_zip : null,
            city: caseType === "baufi" ? referral.property_city : null,
          },
        },
      }

      const insertedLead = await insertLeadWithRetry(admin, leadInsertBase)
      if (insertedLead.error) throw insertedLead.error
      leadId = insertedLead.data?.id ?? null
      externalLeadId = Number(insertedLead.data?.external_lead_id ?? 0) || null

      const customer = await ensureCustomerAccount({
        admin,
        req,
        email: referral.customer_email,
        firstName: referral.customer_first_name,
        lastName: referral.customer_last_name,
        recommendedBy: recommendationContact,
      })
      invited = customer.invited
      existingAccount = customer.existingAccount
      passwordInviteSent = customer.passwordInviteSent

      const leadForCase = buildLeadFromReferral(referral, caseType)
      if (leadId) leadForCase.id = String(leadId)
      if (externalLeadId) leadForCase.external_lead_id = externalLeadId
      leadForCase.assigned_advisor_id = advisorId

      const created = await createCaseFromLead({
        admin,
        lead: leadForCase,
        customerId: customer.userId,
        advisorId,
        caseType,
        entryChannel: "tippgeber_referral",
      })

      caseId = created.caseId
      caseCreated = true

      if (leadId) {
        await admin
          .from("webhook_leads")
          .update({
            linked_case_id: caseId,
            assigned_advisor_id: advisorId,
            assigned_at: now,
            lead_case_type: caseType,
          })
          .eq("id", String(leadId))
      }

      const nextStepsHtml = buildEmailHtml({
        title: `Nächste Schritte zu Ihrem ${productLabel(caseType)}`,
        intro: "Vielen Dank. Ihre Anfrage wurde übernommen und wird nun durch einen Berater bearbeitet.",
        steps: [
          "Ihr Berater meldet sich zeitnah bei Ihnen.",
          "Sie können Unterlagen später direkt im Kundenportal hochladen.",
          "Bei Rückfragen sind wir telefonisch und per E-Mail erreichbar.",
        ],
      })
      const nextStepsMail = await sendEmail({
        to: referral.customer_email,
        subject: `Nächste Schritte zur ${productLabel(caseType)}`,
        html: nextStepsHtml,
      })
      nextStepsMailSent = !!nextStepsMail.ok

      if (caseId) {
        await logCaseEvent({
          caseId,
          actorRole: "admin",
          type: "tippgeber_referral_linked",
          title: "Tippgeber-Empfehlung verknüpft",
          body: `Empfohlen von ${companyName} (${tippgeberKindLabel(referralKind)}).`,
        })
      }
    }

    if (caseId) {
      const { error: caseUpdateError } = await admin.from("cases").update({ assigned_advisor_id: advisorId }).eq("id", caseId)
      if (caseUpdateError) throw caseUpdateError
    }

    if (leadId) {
      await admin
        .from("webhook_leads")
        .update({
          assigned_advisor_id: advisorId,
          assigned_at: new Date().toISOString(),
          linked_case_id: caseId,
          lead_case_type: caseType,
        })
        .eq("id", String(leadId))
    }

    const referralUpdatePayload = {
      assigned_advisor_id: advisorId,
      assigned_at: new Date().toISOString(),
      linked_case_id: caseId,
      linked_lead_id: leadId,
      status: caseId ? "case_created" : "assigned",
      updated_at: new Date().toISOString(),
    }

    const { error: referralUpdateError } = await admin
      .from("tippgeber_referrals")
      .update(referralUpdatePayload)
      .eq("id", referralId)
    if (referralUpdateError) throw referralUpdateError

    if (caseId && isAdvisorChanged) {
      const advisorMail = await sendAdvisorAssignedEmail({ caseId })
      advisorMailSent = !!advisorMail.ok
    }

    return NextResponse.json({
      ok: true,
      referralId,
      caseId,
      leadId,
      caseType,
      caseCreated,
      invited,
      existingAccount,
      passwordInviteSent,
      nextStepsMailSent,
      advisorMailSent,
    })
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}



