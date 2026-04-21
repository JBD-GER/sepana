import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import {
  INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE,
  INSURANCE_PARTNER_INVOICE_TYPE,
  buildInsuranceInvoiceCancellationDescription,
  buildInsuranceInvoiceDescription,
  extractInsurancePartnerCode,
  getInsuranceInvoiceTitle,
  isInsuranceCancellationInvoiceType,
  trimOrNull,
} from "@/lib/insurance/invoice"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type SupportedAction = "save" | "cancel"

type CaseInvoiceRow = {
  id: string
  invoice_type?: string | null
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | string | null
  currency?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  recipient_street?: string | null
  recipient_zipcode?: string | null
  recipient_city?: string | null
  description?: string | null
}

function isSupportedAction(value: string): value is SupportedAction {
  return value === "save" || value === "cancel"
}

function parseAmountTotal(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric * 100) / 100
}

export async function POST(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "insurance" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { caseId } = await context.params
  const body = await req.json().catch(() => null)
  const action = String(body?.action ?? "").trim().toLowerCase()
  if (!isSupportedAction(action)) {
    return NextResponse.json({ ok: false, error: "Ungueltige Aktion" }, { status: 400 })
  }
  if (action === "save" && role !== "insurance") {
    return NextResponse.json({ ok: false, error: "Nur Versicherungspartner duerfen Rechnungen anlegen" }, { status: 403 })
  }
  if (action === "cancel" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Nur Admin darf stornieren" }, { status: 403 })
  }

  const amountTotal = action === "save" ? parseAmountTotal(body?.amountTotal) : null
  if (action === "save" && !amountTotal) {
    return NextResponse.json({ ok: false, error: "amount_total_invalid" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access =
    role === "admin" ? { ok: true as const } : await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const [
    { data: caseRow, error: caseError },
    { data: profile, error: profileError },
    { data: invoiceRowsRaw, error: invoiceError },
  ] =
    await Promise.all([
      admin.from("cases").select("id,case_ref,case_type").eq("id", caseId).maybeSingle(),
      role === "insurance"
        ? admin
            .from("insurance_partner_profiles")
            .select("partner_code,company_name,display_name,email,street,zipcode,city")
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null as any, error: null as any }),
      admin
        .from("case_invoices")
        .select("*")
        .eq("case_id", caseId)
        .in("invoice_type", [INSURANCE_PARTNER_INVOICE_TYPE, INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE])
        .order("created_at", { ascending: false }),
    ])

  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  if (!caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (invoiceError) return NextResponse.json({ ok: false, error: invoiceError.message }, { status: 400 })
  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 })

  const invoiceRows = (invoiceRowsRaw ?? []) as CaseInvoiceRow[]
  const existingInvoice = invoiceRows.find((row) => row.invoice_type === INSURANCE_PARTNER_INVOICE_TYPE) ?? null
  const cancellationInvoice = invoiceRows.find((row) => isInsuranceCancellationInvoiceType(row.invoice_type)) ?? null
  const existingStatus = String(existingInvoice?.status ?? "").trim().toLowerCase()
  const invoiceCancelled = existingStatus === "cancelled" || Boolean(cancellationInvoice?.id)

  if (action === "save" && (!trimOrNull(profile?.street) || !trimOrNull(profile?.zipcode) || !trimOrNull(profile?.city))) {
    return NextResponse.json(
      { ok: false, error: "Bitte zuerst beim Versicherungspartner Adresse, PLZ und Ort hinterlegen." },
      { status: 409 }
    )
  }

  if (action === "save" && invoiceCancelled) {
    return NextResponse.json({ ok: false, error: "Rechnung wurde bereits storniert" }, { status: 409 })
  }
  if (action === "save" && existingInvoice && existingStatus !== "sent") {
    return NextResponse.json({ ok: false, error: "Rechnung kann nicht mehr geaendert werden" }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === "cancel") {
    if (!existingInvoice) {
      return NextResponse.json({ ok: false, error: "Rechnung noch nicht angelegt" }, { status: 404 })
    }
    if (invoiceCancelled) {
      return NextResponse.json({ ok: false, error: "Rechnung wurde bereits storniert" }, { status: 409 })
    }

    const absoluteAmountTotal = Math.abs(Number(existingInvoice.amount_total ?? 0))
    if (!Number.isFinite(absoluteAmountTotal) || absoluteAmountTotal <= 0) {
      return NextResponse.json({ ok: false, error: "Rechnung hat keinen stornierbaren Betrag" }, { status: 409 })
    }

    const partnerCode = extractInsurancePartnerCode(existingInvoice.description)
    const cancellationPayload = {
      case_id: caseId,
      case_type: "schufa_frei",
      invoice_type: INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE,
      title: getInsuranceInvoiceTitle(INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE),
      description: buildInsuranceInvoiceCancellationDescription({
        amountTotal: absoluteAmountTotal,
        caseRef: trimOrNull(caseRow.case_ref),
        partnerCode,
        originalInvoiceNumber: trimOrNull(existingInvoice.invoice_number),
      }),
      status: "cancelled",
      loan_amount: null,
      percentage_rate: null,
      amount_total: -absoluteAmountTotal,
      currency: trimOrNull(existingInvoice.currency) ?? "EUR",
      recipient_name: trimOrNull(existingInvoice.recipient_name),
      recipient_email: trimOrNull(existingInvoice.recipient_email),
      recipient_street: trimOrNull(existingInvoice.recipient_street),
      recipient_zipcode: trimOrNull(existingInvoice.recipient_zipcode),
      recipient_city: trimOrNull(existingInvoice.recipient_city),
      sent_at: null,
      paid_at: null,
      refunded_at: null,
      created_by: user.id,
      updated_at: now,
    }

    const { data: createdCancellationInvoice, error: cancellationError } = await admin
      .from("case_invoices")
      .insert(cancellationPayload)
      .select("*")
      .single()

    if (cancellationError) return NextResponse.json({ ok: false, error: cancellationError.message }, { status: 400 })

    const { data: updatedInvoice, error: updateError } = await admin
      .from("case_invoices")
      .update({
        status: "cancelled",
        paid_at: null,
        refunded_at: null,
        updated_at: now,
      })
      .eq("id", existingInvoice.id)
      .select("*")
      .single()

    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 })

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: "insurance_invoice_cancelled",
      title: "Versicherungsrechnung storniert",
      body: "Die interne Versicherungs-Provisionsrechnung wurde im Admin storniert.",
      meta: {
        invoice_id: updatedInvoice.id,
        cancellation_invoice_id: createdCancellationInvoice.id,
        partner_code: partnerCode,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, invoice: updatedInvoice, cancellationInvoice: createdCancellationInvoice })
  }

  const safeAmountTotal = amountTotal as number
  const description = buildInsuranceInvoiceDescription({
    amountTotal: safeAmountTotal,
    caseRef: trimOrNull(caseRow.case_ref),
    partnerCode: trimOrNull(profile?.partner_code),
  })

  const payload = {
    case_type: "schufa_frei",
    invoice_type: INSURANCE_PARTNER_INVOICE_TYPE,
    title: getInsuranceInvoiceTitle(INSURANCE_PARTNER_INVOICE_TYPE),
    description,
    status: "sent",
    loan_amount: null,
    percentage_rate: null,
    amount_total: safeAmountTotal,
    currency: "EUR",
    recipient_name: trimOrNull(profile?.company_name) ?? trimOrNull(profile?.display_name),
    recipient_email: trimOrNull(profile?.email),
    recipient_street: trimOrNull(profile?.street),
    recipient_zipcode: trimOrNull(profile?.zipcode),
    recipient_city: trimOrNull(profile?.city),
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
        amount_total: safeAmountTotal,
        partner_code: trimOrNull(profile?.partner_code),
      },
    notifyCustomer: false,
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true, invoice })
}
