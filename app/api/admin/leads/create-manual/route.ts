import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, logCaseEvent, sendAdvisorAssignedEmail, sendEmail } from "@/lib/notifications/notify"
import {
  createCaseFromLead,
  ensureCustomerAccount,
  isEmail,
  CaseType,
  LeadRow,
} from "@/lib/admin/leads"

export const runtime = "nodejs"

function normalizeMoneyString(v?: string) {
  if (!v) return ""
  const raw = String(v).trim()
  if (!raw) return ""
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return ""
  if (cleaned.includes(",")) {
    return cleaned.replace(/\./g, "").replace(",", ".")
  }
  return cleaned.replace(/\./g, "")
}

function parseNumber(value: any) {
  if (value === null || value === undefined) return null
  const raw = normalizeMoneyString(String(value))
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

function pickString(value: any) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeCaseType(value: any): CaseType {
  const raw = String(value ?? "").trim().toLowerCase()
  return raw === "konsum" || raw === "privatkredit" ? "konsum" : "baufi"
}

function productLabel(caseType: CaseType) {
  return caseType === "konsum" ? "Privatkredit" : "Baufinanzierung"
}

function isMissingLeadCaseTypeColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("lead_case_type") && (msg.includes("column") || msg.includes("exist"))
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const caseType = normalizeCaseType(body?.productType)
    const advisorId = pickString(body?.advisorId)

    const firstName = pickString(body?.firstName)
    const lastName = pickString(body?.lastName)
    const email = pickString(body?.email)
    const phone = pickString(body?.phone)
    const birthDate = pickString(body?.birthDate)
    const addressStreet = pickString(body?.addressStreet)
    const addressZip = pickString(body?.addressZip)
    const addressCity = pickString(body?.addressCity)
    const employmentType = pickString(body?.employmentType)
    const netIncomeMonthly = parseNumber(body?.netIncomeMonthly)
    const loanPurpose = pickString(body?.loanPurpose)
    const loanAmountTotal = parseNumber(body?.loanAmountTotal)
    const propertyZip = pickString(body?.propertyZip)
    const propertyCity = pickString(body?.propertyCity)
    const propertyType = pickString(body?.propertyType)
    const propertyPurchasePrice = parseNumber(body?.propertyPurchasePrice)
    const notes = pickString(body?.notes)

    if (!advisorId) {
      return NextResponse.json({ ok: false, error: "Bitte Berater auswaehlen." }, { status: 400 })
    }

    const missingCommonFields =
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !birthDate ||
      !addressStreet ||
      !addressZip ||
      !addressCity ||
      !employmentType ||
      netIncomeMonthly === null ||
      !loanPurpose ||
      loanAmountTotal === null

    const missingBaufiOnly =
      caseType === "baufi" &&
      (
        !propertyZip ||
        !propertyCity ||
        !propertyType ||
        propertyPurchasePrice === null
      )

    if (missingCommonFields || missingBaufiOnly) {
      return NextResponse.json(
        { ok: false, error: "Bitte alle Pflichtfelder ausfuellen." },
        { status: 400 }
      )
    }

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-Mail ist ungueltig." }, { status: 400 })
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

    const now = new Date().toISOString()
    const leadPayloadBase = {
      source: "admin",
      event_type: "lead.new",
      status: "new",
      source_created_at: now,
      last_event_at: now,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      birth_date: birthDate,
      address_street: addressStreet,
      address_zip: addressZip,
      address_city: addressCity,
      employment_type: employmentType,
      net_income_monthly: netIncomeMonthly,
      loan_purpose: loanPurpose,
      loan_amount_total: loanAmountTotal,
      property_zip: propertyZip,
      property_city: propertyCity,
      property_type: propertyType,
      property_purchase_price: propertyPurchasePrice,
      product_name: productLabel(caseType),
      product_price: loanAmountTotal,
      notes,
      assigned_advisor_id: advisorId,
      assigned_at: now,
    }
    const leadPayloadWithCaseType = { ...leadPayloadBase, lead_case_type: caseType }
    const leadSelectBase =
      "id,linked_case_id,external_lead_id,assigned_advisor_id,first_name,last_name,email,phone,phone_mobile,phone_work,birth_date,marital_status,employment_status,employment_type,net_income_monthly,address_street,address_zip,address_city,product_name,product_price,loan_purpose,loan_amount_total,property_zip,property_city,property_type,property_purchase_price,notes"
    const leadSelectWithCaseType = `${leadSelectBase},lead_case_type`

    let lead: LeadRow | null = null
    const primaryInsert = await admin
      .from("webhook_leads")
      .insert(leadPayloadWithCaseType)
      .select(leadSelectWithCaseType)
      .single()

    if (primaryInsert.error && isMissingLeadCaseTypeColumnError(primaryInsert.error)) {
      const fallbackInsert = await admin
        .from("webhook_leads")
        .insert(leadPayloadBase)
        .select(leadSelectBase)
        .single()
      if (fallbackInsert.error) throw fallbackInsert.error
      lead = fallbackInsert.data ? ({ ...fallbackInsert.data, lead_case_type: null } as LeadRow) : null
    } else {
      if (primaryInsert.error) throw primaryInsert.error
      lead = (primaryInsert.data as LeadRow | null) ?? null
    }

    if (!lead) throw new Error("Lead konnte nicht angelegt werden.")

    const customer = await ensureCustomerAccount({
      admin,
      req,
      email: lead.email ?? email,
      firstName: lead.first_name ?? firstName,
      lastName: lead.last_name ?? lastName,
    })

    const created = await createCaseFromLead({
      admin,
      lead,
      customerId: customer.userId,
      advisorId,
      caseType,
      entryChannel: "admin_manual",
    })

    const caseId = created.caseId

    const nextStepsHtml = buildEmailHtml({
      title: `Naechste Schritte zu Ihrem ${productLabel(caseType)}`,
      intro: "Vielen Dank. Ihre Anfrage wurde uebernommen und wir starten jetzt mit der Bearbeitung.",
      steps: [
        "Ihr Berater meldet sich zeitnah bei Ihnen.",
        "Sie koennen Unterlagen direkt im Kundenportal hochladen.",
        "Bei Rueckfragen erreichen Sie uns jederzeit per E-Mail oder Telefon.",
      ],
    })
    const nextStepsMail = await sendEmail({
      to: customer.email,
      subject: `Naechste Schritte zum ${productLabel(caseType)}`,
      html: nextStepsHtml,
    })

    await admin
      .from("webhook_leads")
      .update({
        linked_case_id: caseId,
        assigned_advisor_id: advisorId,
        assigned_at: now,
      })
      .eq("id", lead.id)

    await logCaseEvent({
      caseId,
      actorRole: "admin",
      type: "advisor_assigned",
      title: "Ansprechpartner gesetzt",
      body: "Ihr Ansprechpartner wurde gesetzt.",
    })

    const advisorMail = await sendAdvisorAssignedEmail({ caseId })

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      caseId,
      caseRef: created.caseRef,
      invited: customer.invited,
      existingAccount: customer.existingAccount,
      passwordInviteSent: customer.passwordInviteSent,
      nextStepsMailSent: !!nextStepsMail.ok,
      advisorMailSent: !!advisorMail.ok,
      message: `Lead angelegt, ${productLabel(caseType)}-Fall erstellt und Einladung versendet.`,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
