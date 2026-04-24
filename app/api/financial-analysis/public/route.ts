import { NextResponse } from "next/server"
import { loadFinancialAnalysisPublicContext } from "@/lib/financial-analysis/data"
import {
  FINANCIAL_ANALYSIS_INVOICE_TYPE,
  buildFinancialAnalysisInvoiceDescription,
  buildFinancialAnalysisPaymentReference,
  isMissingFinancialAnalysisInvoiceAddressMigrationError,
  isMissingCaseInvoiceNumberMigrationError,
  isMissingCaseInvoicesTableError,
  loadFinancialAnalysisInvoiceRecipient,
  loadLatestFinancialAnalysisInvoice,
  type FinancialAnalysisInvoiceRow,
} from "@/lib/financial-analysis/invoice"
import {
  sendFinancialAnalysisActivatedEmail,
  sendFinancialAnalysisCustomerConfirmedAdminEmail,
  sendFinancialAnalysisInvoiceEmail,
} from "@/lib/financial-analysis/email"
import { renderFinancialAnalysisInvoicePdf } from "@/lib/financial-analysis/renderFinancialAnalysisInvoicePdf"
import {
  FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS,
  FINANCIAL_ANALYSIS_TERMS_VERSION,
  buildFinancialAnalysisServicePatch,
  isFinancialAnalysisTerminalStatus,
  isMissingFinancialAnalysisTablesError,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
import { getCaseMeta, logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fallback below
    }
  }
  return new URL(req.url).origin
}

function isAdvisorStatusConstraintError(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string } | null
  const text = `${String(err?.code ?? "")} ${String(err?.message ?? "")} ${String(err?.details ?? "")}`.toLowerCase()
  return text.includes("cases_advisor_status_check") || (text.includes("advisor_status") && text.includes("check constraint"))
}

async function syncAdvisorStatusToFinancialAnalysis(input: {
  admin: ReturnType<typeof supabaseAdmin>
  caseId: string
  nowIso: string
}) {
  const caseResult = await input.admin
    .from("cases")
    .select("advisor_status,case_type")
    .eq("id", input.caseId)
    .maybeSingle()

  if (caseResult.error) throw caseResult.error

  const caseType = String(caseResult.data?.case_type ?? "").trim().toLowerCase()
  if (caseType !== "schufa_frei") {
    return { updated: false, reason: "case_type_not_supported" as const }
  }

  const currentStatus = trimOrNull(caseResult.data?.advisor_status)?.toLowerCase()
  if (currentStatus === "finanzanalyse") {
    return { updated: false, reason: "already_set" as const }
  }

  const updateResult = await input.admin
    .from("cases")
    .update({
      advisor_status: "finanzanalyse",
      updated_at: input.nowIso,
    })
    .eq("id", input.caseId)

  if (updateResult.error) {
    if (isAdvisorStatusConstraintError(updateResult.error)) {
      return { updated: false, reason: "advisor_status_constraint_missing" as const }
    }
    throw updateResult.error
  }

  return { updated: true, reason: "updated" as const }
}

function getFinancialAnalysisAmountTotal(servicePriceGrossCents: number | null | undefined) {
  const cents = Number(servicePriceGrossCents ?? FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS)
  if (!Number.isFinite(cents) || cents <= 0) {
    return FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS / 100
  }
  return Math.round(cents) / 100
}

async function ensureFinancialAnalysisInvoice(input: {
  admin: ReturnType<typeof supabaseAdmin>
  caseId: string
  caseRef: string | null | undefined
  customerName: string | null
  customerEmail: string | null
  service: FinancialAnalysisServiceRow
  nowIso: string
  createdBy: string | null
}) {
  const existingInvoice = await loadLatestFinancialAnalysisInvoice(input.admin, input.caseId, input.service.created_at ?? null)
  const existingStatus = String(existingInvoice?.status ?? "").trim().toLowerCase()
  const shouldCreateNewInvoice = !existingInvoice?.id || existingStatus === "cancelled" || existingStatus === "refunded"
  const invoicePaidAt = trimOrNull(input.service.payment_received_at)
  const recipientAddress = await loadFinancialAnalysisInvoiceRecipient(input.admin, input.caseId)
  const amountTotal = getFinancialAnalysisAmountTotal(input.service.price_gross_cents)

  const payload = {
    case_type: "schufa_frei",
    invoice_type: FINANCIAL_ANALYSIS_INVOICE_TYPE,
    title: "Rechnung Finanzanalyse",
    description: buildFinancialAnalysisInvoiceDescription(amountTotal),
    status: invoicePaidAt ? "paid" : "sent",
    loan_amount: null,
    percentage_rate: null,
    amount_total: amountTotal,
    currency: "EUR",
    recipient_name: input.customerName ?? trimOrNull(existingInvoice?.recipient_name),
    recipient_email: input.customerEmail ?? trimOrNull(existingInvoice?.recipient_email),
    paid_at: invoicePaidAt,
    refunded_at: null,
    updated_at: input.nowIso,
  }
  const addressPayload = {
    recipient_street: [recipientAddress.street, recipientAddress.houseNumber].filter(Boolean).join(" ").trim() || null,
    recipient_zipcode: recipientAddress.zipcode,
    recipient_city: recipientAddress.city,
  }

  const runInvoiceQuery = (includeAddressFields: boolean) => {
    const fullPayload = includeAddressFields ? { ...payload, ...addressPayload } : payload
    return shouldCreateNewInvoice
    ? input.admin
        .from("case_invoices")
        .insert({
          case_id: input.caseId,
          created_by: input.createdBy,
          sent_at: null,
          ...fullPayload,
        })
        .select("*")
        .single()
    : input.admin
        .from("case_invoices")
        .update({
          ...fullPayload,
          sent_at: trimOrNull(existingInvoice?.sent_at),
        })
        .eq("id", existingInvoice.id)
        .select("*")
        .single()
  }

  let result = await runInvoiceQuery(true)
  if (result.error && isMissingFinancialAnalysisInvoiceAddressMigrationError(result.error)) {
    result = await runInvoiceQuery(false)
  }
  if (result.error) throw result.error

  const invoice = (result.data ?? null) as FinancialAnalysisInvoiceRow | null
  const invoiceNumber = trimOrNull(invoice?.invoice_number) ?? trimOrNull(invoice?.id) ?? "-"
  const paymentReference = buildFinancialAnalysisPaymentReference(invoiceNumber, input.caseRef) ?? invoiceNumber

  return {
    invoice,
    amountTotal,
    paymentReference,
  }
}

export async function GET(req: Request) {
  const token = trimOrNull(new URL(req.url).searchParams.get("token"))
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing" }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const access = await loadFinancialAnalysisPublicContext(admin, token)
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
    }

    return NextResponse.json({
      ok: true,
      service: access.service,
      case: access.caseRow,
      applicantName: access.applicantName,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_public_failed" },
      { status: 400 }
    )
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = trimOrNull(body?.token)
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing" }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const access = await loadFinancialAnalysisPublicContext(admin, token)
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
    }

    if (isFinancialAnalysisTerminalStatus(access.service.service_status)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_not_available" }, { status: 409 })
    }

    const previousStatus = access.service.service_status
    const nowIso = new Date().toISOString()
    const patch = buildFinancialAnalysisServicePatch({
      row: access.service,
      nowIso,
      nextCustomerConfirmedAt: access.service.customer_confirmed_at ?? nowIso,
    })

    const result = await admin
      .from("case_financial_analysis_services")
      .update({
        ...patch,
        customer_confirmed_terms_version: FINANCIAL_ANALYSIS_TERMS_VERSION,
      })
      .eq("id", access.service.id)
      .select("*")
      .single()

    if (result.error) throw result.error

    const nextService = normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
    const isFirstCustomerConfirmation = !trimOrNull(access.service.customer_confirmed_at)
    const advisorStatusSync = await syncAdvisorStatusToFinancialAnalysis({
      admin,
      caseId: access.caseRow.id,
      nowIso,
    })
    const caseMeta = await getCaseMeta(access.caseRow.id)
    const invoiceResult = await ensureFinancialAnalysisInvoice({
      admin,
      caseId: access.caseRow.id,
      caseRef: access.caseRow.case_ref,
      customerName: caseMeta?.customer_name ?? access.applicantName,
      customerEmail: caseMeta?.customer_email ?? null,
      service: nextService ?? access.service,
      nowIso,
      createdBy:
        trimOrNull(access.caseRow.assigned_advisor_id) ??
        trimOrNull(access.service.assigned_advisor_id) ??
        trimOrNull(access.service.offered_by),
    })

    let invoiceEmailSent = false
    let invoiceEmailError: string | null = null
    const invoice = invoiceResult.invoice
    const shouldSendInvoiceEmail =
      Boolean(invoice?.id) &&
      String(invoice?.status ?? "").trim().toLowerCase() !== "paid" &&
      !trimOrNull(invoice?.sent_at)

    if (shouldSendInvoiceEmail && invoice?.id) {
      const invoiceNumber = trimOrNull(invoice.invoice_number) ?? invoice.id
      const pdfBytes = await renderFinancialAnalysisInvoicePdf({
        invoiceNumber,
        createdAt: invoice.created_at,
        caseRef: trimOrNull(access.caseRow.case_ref) ?? access.caseRow.id.slice(0, 8),
        paymentReference: invoiceResult.paymentReference,
        recipientName: trimOrNull(invoice.recipient_name) ?? caseMeta?.customer_name ?? access.applicantName,
        recipientEmail: trimOrNull(invoice.recipient_email) ?? caseMeta?.customer_email ?? null,
        recipientStreet: trimOrNull(invoice.recipient_street),
        recipientHouseNumber: null,
        recipientZipcode: trimOrNull(invoice.recipient_zipcode),
        recipientCity: trimOrNull(invoice.recipient_city),
        amountTotal: invoiceResult.amountTotal,
        status: trimOrNull(invoice.status),
        description: trimOrNull(invoice.description),
      })

      const invoiceMailResult = await sendFinancialAnalysisInvoiceEmail({
        caseId: access.caseRow.id,
        caseRef: access.caseRow.case_ref,
        invoice,
        invoicePdfBase64: Buffer.from(pdfBytes).toString("base64"),
        attachmentFileName: `Rechnung-${invoiceNumber}.pdf`,
      })

      invoiceEmailSent = invoiceMailResult.ok
      invoiceEmailError = invoiceMailResult.ok ? null : invoiceMailResult.error

      if (invoiceMailResult.ok) {
        const invoiceUpdateResult = await admin
          .from("case_invoices")
          .update({
            sent_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", invoice.id)
          .select("*")
          .single()

        if (!invoiceUpdateResult.error) {
          invoiceResult.invoice = (invoiceUpdateResult.data ?? invoice) as FinancialAnalysisInvoiceRow
        }
      }
    }

    const siteOrigin = resolveSiteOrigin(req)
    let activationMailSent = false
    let adminConfirmationMailSent = false
    let adminConfirmationMailError: string | null = null
    if (String(previousStatus ?? "").trim().toLowerCase() !== "active" && nextService?.service_status === "active") {
      const mailResult = await sendFinancialAnalysisActivatedEmail({
        caseId: access.caseRow.id,
        siteOrigin,
        service: nextService,
      })
      activationMailSent = mailResult.ok
    }

    if (isFirstCustomerConfirmation && nextService?.id) {
      const mailResult = await sendFinancialAnalysisCustomerConfirmedAdminEmail({
        caseId: access.caseRow.id,
        siteOrigin,
        service: nextService,
      })
      adminConfirmationMailSent = mailResult.ok
      adminConfirmationMailError = mailResult.ok ? null : mailResult.error
    }

    await logCaseEvent({
      caseId: access.caseRow.id,
      actorId: null,
      actorRole: "public",
      type: nextService?.service_status === "active" ? "financial_analysis_activated" : "financial_analysis_customer_confirmed",
      title: nextService?.service_status === "active" ? "Finanzanalyse aktiviert" : "Finanzanalyse vom Kunden bestätigt",
      body:
        nextService?.service_status === "active"
          ? "Die Bestätigung liegt vor und die Finanzanalyse ist jetzt freigeschaltet."
          : invoiceEmailSent
            ? "Der Kunde hat den Zusatzservice Finanzanalyse aktiv bestätigt. Die Rechnung wurde per E-Mail versendet."
            : "Der Kunde hat den Zusatzservice Finanzanalyse aktiv bestätigt.",
      meta: {
        service_id: access.service.id,
        invoice_id: invoiceResult.invoice?.id ?? null,
        advisor_status_updated: advisorStatusSync.updated,
        invoice_email_sent: invoiceEmailSent,
        invoice_email_error: invoiceEmailError,
        activation_email_sent: activationMailSent,
        admin_confirmation_email_sent: adminConfirmationMailSent,
        admin_confirmation_email_error: adminConfirmationMailError,
      },
      notifyCustomer: false,
      notifyAdvisor: true,
    })

    return NextResponse.json({
      ok: true,
      service: nextService,
      invoiceId: invoiceResult.invoice?.id ?? null,
      invoiceEmailSent,
      invoiceEmailError,
      activationEmailSent: activationMailSent,
      adminConfirmationMailSent,
      adminConfirmationMailError,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    if (isMissingCaseInvoicesTableError(error)) {
      return NextResponse.json({ ok: false, error: "case_invoices_missing" }, { status: 503 })
    }
    if (isMissingCaseInvoiceNumberMigrationError(error)) {
      return NextResponse.json({ ok: false, error: "case_invoice_number_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_confirm_failed" },
      { status: 400 }
    )
  }
}
