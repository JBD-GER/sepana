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

export const runtime = "nodejs"

function trim(value: unknown) {
  return String(value ?? "").trim()
}

function nextExternalLeadId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

async function insertLeadWithRetry(admin: ReturnType<typeof supabaseAdmin>, rowBase: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const externalLeadId = nextExternalLeadId()
    const first = await admin
      .from("webhook_leads")
      .insert({ ...rowBase, external_lead_id: externalLeadId })
      .select("id,external_lead_id")
      .single()
    if (!first.error) return first

    const isDuplicate = String((first.error as any)?.code ?? "") === "23505"
    const missingLeadCaseType = String((first.error as any)?.code ?? "") === "42703"
      || String((first.error as any)?.message ?? "").toLowerCase().includes("lead_case_type")

    if (missingLeadCaseType) {
      const fallbackPayload = { ...rowBase, external_lead_id: externalLeadId }
      delete (fallbackPayload as any).lead_case_type
      const second = await admin.from("webhook_leads").insert(fallbackPayload).select("id,external_lead_id").single()
      if (!second.error) return second
      if (String((second.error as any)?.code ?? "") !== "23505") return second
      continue
    }

    if (!isDuplicate) return first
  }
  return { data: null, error: new Error("duplicate_external_lead_id") } as any
}

function buildLeadFromReferral(referral: TippgeberReferralRow): LeadRow {
  return {
    id: "",
    linked_case_id: null,
    external_lead_id: 0,
    assigned_advisor_id: null,
    lead_case_type: "baufi",
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
    product_name: "Baufinanzierung",
    product_price: referral.manual_purchase_price,
    loan_purpose: "Tippgeber-Empfehlung",
    loan_amount_total: null,
    property_zip: referral.property_zip,
    property_city: referral.property_city,
    property_type: null,
    property_purchase_price: referral.manual_purchase_price,
    notes: "Lead aus Tippgeber-Bereich",
  }
}

function productLabel(caseType: CaseType) {
  return caseType === "konsum" ? "Privatkredit" : "Baufinanzierung"
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
        product_name: "Baufinanzierung",
        product_price: referral.manual_purchase_price,
        lead_case_type: "baufi",
        loan_purpose: "Tippgeber-Empfehlung",
        loan_amount_total: null,
        property_zip: referral.property_zip,
        property_city: referral.property_city,
        property_type: null,
        property_purchase_price: referral.manual_purchase_price,
        notes: `Tippgeber-Empfehlung von ${companyName}`,
        additional: {
          origin: "tippgeber",
          referral_id: referral.id,
          tippgeber_user_id: referral.tippgeber_user_id,
          expose_uploaded: Boolean(referral.expose_file_path),
          manual_broker_commission_percent: referral.manual_broker_commission_percent,
          property_address: {
            street: referral.property_street,
            house_number: referral.property_house_number,
            zip: referral.property_zip,
            city: referral.property_city,
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
      })
      invited = customer.invited
      existingAccount = customer.existingAccount
      passwordInviteSent = customer.passwordInviteSent

      const leadForCase = buildLeadFromReferral(referral)
      if (leadId) leadForCase.id = String(leadId)
      if (externalLeadId) leadForCase.external_lead_id = externalLeadId
      leadForCase.assigned_advisor_id = advisorId

      const created = await createCaseFromLead({
        admin,
        lead: leadForCase,
        customerId: customer.userId,
        advisorId,
        caseType: "baufi",
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
            lead_case_type: "baufi",
          })
          .eq("id", String(leadId))
      }

      const nextStepsHtml = buildEmailHtml({
        title: `Nächste Schritte zu Ihrem ${productLabel("baufi")}`,
        intro: "Vielen Dank. Ihre Anfrage wurde übernommen und wird nun durch einen Berater bearbeitet.",
        steps: [
          "Ihr Berater meldet sich zeitnah bei Ihnen.",
          "Sie können Unterlagen später direkt im Kundenportal hochladen.",
          "Bei Rückfragen sind wir telefonisch und per E-Mail erreichbar.",
        ],
      })
      const nextStepsMail = await sendEmail({
        to: referral.customer_email,
        subject: `Nächste Schritte zur ${productLabel("baufi")}`,
        html: nextStepsHtml,
      })
      nextStepsMailSent = !!nextStepsMail.ok

      if (caseId) {
        await logCaseEvent({
          caseId,
          actorRole: "admin",
          type: "tippgeber_referral_linked",
          title: "Tippgeber-Empfehlung verknüpft",
          body: `Empfohlen von ${companyName}.`,
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
      caseCreated,
      invited,
      existingAccount,
      passwordInviteSent,
      nextStepsMailSent,
      advisorMailSent,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
