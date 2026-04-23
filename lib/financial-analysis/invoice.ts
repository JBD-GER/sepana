import {
  SCHUFA_FREE_PROVISION_BANK,
  SCHUFA_FREE_PROVISION_COMPANY,
  SCHUFA_FREE_PROVISION_VAT_RATE,
  formatEuro,
  formatPercent,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"

export const FINANCIAL_ANALYSIS_INVOICE_TYPE = "financial_analysis_service"

export type FinancialAnalysisInvoiceRow = {
  id: string
  case_id?: string | null
  invoice_type?: string | null
  invoice_number?: string | null
  title?: string | null
  description?: string | null
  status?: string | null
  amount_total?: number | string | null
  currency?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  recipient_street?: string | null
  recipient_zipcode?: string | null
  recipient_city?: string | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  created_by?: string | null
}

type MinimalSupabase = {
  from: (table: string) => any
}

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

export function isMissingCaseInvoiceNumberMigrationError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false

  const code = String(anyError.code ?? "").trim()
  const msg = String(anyError.message ?? "").toLowerCase()

  if (code === "23502" && msg.includes("invoice_number")) return true
  if (code === "42704" && msg.includes("case_invoice_number_seq")) return true
  return msg.includes("case_invoice_number_seq") || (msg.includes("invoice_number") && msg.includes("default"))
}

export function isMissingFinancialAnalysisInvoiceAddressMigrationError(error: unknown) {
  const anyError = error as { code?: string; message?: string; details?: string } | null
  if (!anyError) return false

  const text = `${String(anyError.code ?? "")} ${String(anyError.message ?? "")} ${String(anyError.details ?? "")}`.toLowerCase()
  return (
    (text.includes("recipient_street") || text.includes("recipient_zipcode") || text.includes("recipient_city")) &&
    (text.includes("case_invoices") || text.includes("schema cache") || text.includes("column"))
  )
}

export function isMissingSchufaFreeAddressMigrationError(error: unknown) {
  const anyError = error as { code?: string; message?: string; details?: string } | null
  if (!anyError) return false

  const text = `${String(anyError.code ?? "")} ${String(anyError.message ?? "")} ${String(anyError.details ?? "")}`.toLowerCase()
  const addressColumnMissing =
    text.includes("house_number") || text.includes("zipcode") || text.includes("street") || text.includes("city")
  return addressColumnMissing && (text.includes("case_schufa_free_details") || text.includes("schema cache") || text.includes("column"))
}

export function isFinancialAnalysisInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === FINANCIAL_ANALYSIS_INVOICE_TYPE
}

export function getFinancialAnalysisInvoiceTitle() {
  return "Rechnung Finanzanalyse"
}

export function getFinancialAnalysisInvoiceStatusLabel(status: unknown) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "paid":
      return "Bezahlt"
    case "refunded":
      return "Erstattet"
    case "cancelled":
      return "Storniert"
    case "sent":
      return "Offen"
    default:
      return "Angelegt"
  }
}

export function calculateFinancialAnalysisNetAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = Number(amountTotal ?? 0)
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return roundCurrency(grossAmount / (1 + SCHUFA_FREE_PROVISION_VAT_RATE))
}

export function calculateFinancialAnalysisVatAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  const netAmount = calculateFinancialAnalysisNetAmountFromGrossAmount(grossAmount)
  return roundCurrency(grossAmount - netAmount)
}

export function getFinancialAnalysisInvoiceBreakdownFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return {
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
    }
  }

  const netAmount = calculateFinancialAnalysisNetAmountFromGrossAmount(grossAmount)
  const vatAmount = calculateFinancialAnalysisVatAmountFromGrossAmount(grossAmount)

  return {
    netAmount,
    vatAmount,
    grossAmount,
  }
}

export function buildFinancialAnalysisInvoiceDescription(amountTotal: number) {
  const { netAmount, vatAmount, grossAmount } = getFinancialAnalysisInvoiceBreakdownFromGrossAmount(amountTotal)

  return `Persönliche Finanzanalyse inklusive individuellem 90-Tage-Maßnahmenplan und bankenähnlicher Haushaltsrechnung (netto ${formatEuro(
    netAmount
  )}, zzgl. ${formatPercent(SCHUFA_FREE_PROVISION_VAT_RATE)} MwSt. ${formatEuro(vatAmount)}, Gesamtbetrag ${formatEuro(
    grossAmount
  )}).`
}

export function buildFinancialAnalysisPaymentReference(
  invoiceNumber: string | null | undefined,
  caseRef: string | null | undefined
) {
  const normalizedInvoiceNumber = trimOrNull(invoiceNumber)
  const normalizedCaseRef = trimOrNull(caseRef)

  if (normalizedInvoiceNumber && normalizedCaseRef) {
    return `RG ${normalizedInvoiceNumber} ${normalizedCaseRef}`
  }

  if (normalizedInvoiceNumber) return `RG ${normalizedInvoiceNumber}`
  return normalizedCaseRef
}

export async function loadLatestFinancialAnalysisInvoice(
  admin: MinimalSupabase,
  caseId: string,
  createdAfter?: string | null
) {
  const normalizedCaseId = trimOrNull(caseId)
  if (!normalizedCaseId) return null

  let query = admin
    .from("case_invoices")
    .select("*")
    .eq("case_id", normalizedCaseId)
    .eq("invoice_type", FINANCIAL_ANALYSIS_INVOICE_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)

  const createdAfterIso = trimOrNull(createdAfter)
  if (createdAfterIso) {
    query = query.gte("created_at", createdAfterIso)
  }

  const result = await query.maybeSingle()

  if (result.error) {
    if (isMissingCaseInvoicesTableError(result.error)) return null
    throw result.error
  }

  return (result.data ?? null) as FinancialAnalysisInvoiceRow | null
}

export async function loadFinancialAnalysisInvoiceRecipient(admin: MinimalSupabase, caseId: string) {
  const normalizedCaseId = trimOrNull(caseId)
  if (!normalizedCaseId) {
    return {
      street: null,
      houseNumber: null,
      zipcode: null,
      city: null,
    }
  }

  const result = await admin
    .from("case_schufa_free_details")
    .select("street,house_number,zipcode,city")
    .eq("case_id", normalizedCaseId)
    .maybeSingle()

  if (result.error) {
    if (isMissingSchufaFreeAddressMigrationError(result.error)) {
      return {
        street: null,
        houseNumber: null,
        zipcode: null,
        city: null,
      }
    }
    throw result.error
  }

  return {
    street: trimOrNull(result.data?.street),
    houseNumber: trimOrNull(result.data?.house_number),
    zipcode: trimOrNull(result.data?.zipcode),
    city: trimOrNull(result.data?.city),
  }
}

export const FINANCIAL_ANALYSIS_INVOICE_BANK = SCHUFA_FREE_PROVISION_BANK
export const FINANCIAL_ANALYSIS_INVOICE_COMPANY = SCHUFA_FREE_PROVISION_COMPANY
