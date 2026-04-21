import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import {
  INSURANCE_PARTNER_INVOICE_TYPE,
  buildInsuranceInvoiceDescription,
  getInsuranceInvoiceTitle,
  trimOrNull,
} from "@/lib/insurance/invoice"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function parseAmountTotal(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric * 100) / 100
}

export async function POST(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "insurance") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { caseId } = await context.params
  const body = await req.json().catch(() => null)
  const action = String(body?.action ?? "").trim().toLowerCase()
  if (action !== "save") {
    return NextResponse.json({ ok: false, error: "Ungueltige Aktion" }, { status: 400 })
  }

  const amountTotal = parseAmountTotal(body?.amountTotal)
  if (!amountTotal) {
    return NextResponse.json({ ok: false, error: "amount_total_invalid" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access = await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const [{ data: caseRow, error: caseError }, { data: profile, error: profileError }, { data: existingInvoice, error: invoiceError }] =
    await Promise.all([
      admin.from("cases").select("id,case_ref,case_type").eq("id", caseId).maybeSingle(),
      admin
        .from("insurance_partner_profiles")
        .select("partner_code,company_name,display_name,email")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("case_invoices")
        .select("*")
        .eq("case_id", caseId)
        .eq("invoice_type", INSURANCE_PARTNER_INVOICE_TYPE)
        .maybeSingle(),
    ])

  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  if (!caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 })
  if (invoiceError) return NextResponse.json({ ok: false, error: invoiceError.message }, { status: 400 })

  if (existingInvoice && String(existingInvoice.status ?? "").trim().toLowerCase() !== "sent") {
    return NextResponse.json({ ok: false, error: "Rechnung kann nicht mehr geaendert werden" }, { status: 409 })
  }

  const now = new Date().toISOString()
  const description = buildInsuranceInvoiceDescription({
    amountTotal,
    caseRef: trimOrNull(caseRow.case_ref),
    partnerCode: trimOrNull(profile?.partner_code),
  })

  const payload = {
    case_type: "schufa_frei",
    invoice_type: INSURANCE_PARTNER_INVOICE_TYPE,
    title: getInsuranceInvoiceTitle(),
    description,
    status: "sent",
    loan_amount: null,
    percentage_rate: null,
    amount_total: amountTotal,
    currency: "EUR",
    recipient_name: trimOrNull(profile?.company_name) ?? trimOrNull(profile?.display_name),
    recipient_email: trimOrNull(profile?.email),
    sent_at: null,
    paid_at: null,
    refunded_at: null,
    updated_at: now,
  }

  const query = existingInvoice
    ? admin.from("case_invoices").update(payload).eq("id", existingInvoice.id).select("*").single()
    : admin
        .from("case_invoices")
        .insert({
          case_id: caseId,
          created_by: user.id,
          ...payload,
        })
        .select("*")
        .single()

  const { data: invoice, error: saveError } = await query
  if (saveError) return NextResponse.json({ ok: false, error: saveError.message }, { status: 400 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: existingInvoice ? "insurance_invoice_updated" : "insurance_invoice_created",
    title: existingInvoice ? "Versicherungsrechnung aktualisiert" : "Versicherungsrechnung angelegt",
    body: "Die interne Versicherungs-Provisionsrechnung wurde gespeichert.",
    meta: {
      invoice_id: invoice.id,
      amount_total: amountTotal,
      partner_code: trimOrNull(profile?.partner_code),
    },
    notifyCustomer: false,
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true, invoice })
}
