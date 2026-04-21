export const INSURANCE_PARTNER_INVOICE_TYPE = "insurance_partner_commission"
export const INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE = "insurance_partner_commission_cancellation"
export const INSURANCE_PARTNER_VAT_RATE = 0.19

export const INSURANCE_ROUTE_STATUS_OPTIONS = [
  { value: "new", label: "Neu" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "in_review", label: "In Pruefung" },
  { value: "quoted", label: "Angebot erstellt" },
  { value: "waiting_feedback", label: "Warten auf Rueckmeldung" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "rejected", label: "Abgelehnt" },
] as const

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export function isInsuranceMainInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === INSURANCE_PARTNER_INVOICE_TYPE
}

export function isInsuranceCancellationInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE
}

export function isInsuranceInvoiceType(invoiceType: unknown) {
  const normalized = trimOrNull(invoiceType)
  return normalized === INSURANCE_PARTNER_INVOICE_TYPE || normalized === INSURANCE_PARTNER_CANCELLATION_INVOICE_TYPE
}

export function formatEuro(value: number | null | undefined) {
  const numericValue = Number(value ?? 0)
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(numericValue) ? numericValue : 0
  )
}

export function formatPercent(rate: number) {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(rate * 100)} %`
}

export function calculateInsuranceNetAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount === 0) return 0

  const sign = grossAmount < 0 ? -1 : 1
  const absoluteGrossAmount = Math.abs(grossAmount)
  return roundCurrency((absoluteGrossAmount / (1 + INSURANCE_PARTNER_VAT_RATE)) * sign)
}

export function calculateInsuranceVatAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount === 0) return 0
  return roundCurrency(grossAmount - calculateInsuranceNetAmountFromGrossAmount(grossAmount))
}

export function getInsuranceInvoiceBreakdownFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount === 0) {
    return {
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
    }
  }

  return {
    netAmount: calculateInsuranceNetAmountFromGrossAmount(grossAmount),
    vatAmount: calculateInsuranceVatAmountFromGrossAmount(grossAmount),
    grossAmount,
  }
}

export function getInsuranceInvoiceStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "paid":
      return "Bezahlt"
    case "refunded":
      return "Erstattet"
    case "cancelled":
      return "Storniert"
    case "sent":
      return "Angelegt"
    default:
      return "Noch nicht angelegt"
  }
}

export function getInsuranceRouteStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase()
  return INSURANCE_ROUTE_STATUS_OPTIONS.find((entry) => entry.value === normalized)?.label ?? "Neu"
}

export function getInsuranceRouteSourceLabel(source: string | null | undefined) {
  const normalized = String(source ?? "").trim().toLowerCase()
  if (normalized === "precheck_rejected") return "Automatisch nach negativer Vorpruefung"
  if (normalized === "advisor_manual") return "Manuell durch Berater"
  return "-"
}

export function buildInsuranceInvoicePaymentReference(partnerCode: string | null | undefined, caseRef: string | null | undefined) {
  return [trimOrNull(partnerCode), trimOrNull(caseRef)].filter(Boolean).join(" ")
}

export function extractInsurancePartnerCode(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  const partnerIdMatch = raw.match(/partner-id\s+([a-z0-9-]+)/i)
  if (partnerIdMatch?.[1]) {
    return partnerIdMatch[1].trim().toUpperCase()
  }

  const referenceMatch = raw.match(/\b([a-z0-9-]+)\s+sf-[a-z0-9-]+\b/i)
  if (referenceMatch?.[1]) {
    return referenceMatch[1].trim().toUpperCase()
  }

  return null
}

export function buildInsuranceInvoiceDescription(opts: {
  amountTotal: number
  caseRef?: string | null
  partnerCode?: string | null
}) {
  const breakdown = getInsuranceInvoiceBreakdownFromGrossAmount(opts.amountTotal)
  const reference = buildInsuranceInvoicePaymentReference(opts.partnerCode, opts.caseRef)

  return [
    "Versicherungsprovision fuer Kredit ohne Schufa",
    opts.caseRef ? `Fall ${opts.caseRef}` : null,
    opts.partnerCode ? `Partner-ID ${opts.partnerCode}` : null,
    reference ? `Verwendungszweck ${reference}` : null,
    `(netto ${formatEuro(breakdown.netAmount)}, zzgl. ${formatPercent(INSURANCE_PARTNER_VAT_RATE)} MwSt. ${formatEuro(
      breakdown.vatAmount
    )}, Gesamtbetrag ${formatEuro(breakdown.grossAmount)})`,
  ]
    .filter(Boolean)
    .join(" - ")
}

export function buildInsuranceInvoiceCancellationDescription(opts: {
  amountTotal: number
  caseRef?: string | null
  partnerCode?: string | null
  originalInvoiceNumber?: string | null
}) {
  const grossAmount = -Math.abs(Number(opts.amountTotal ?? 0))
  const breakdown = getInsuranceInvoiceBreakdownFromGrossAmount(grossAmount)
  const reference = buildInsuranceInvoicePaymentReference(opts.partnerCode, opts.caseRef)

  return [
    "Stornierung der Versicherungsprovision fuer Kredit ohne Schufa",
    opts.caseRef ? `Fall ${opts.caseRef}` : null,
    opts.partnerCode ? `Partner-ID ${opts.partnerCode}` : null,
    opts.originalInvoiceNumber ? `Originalrechnung ${opts.originalInvoiceNumber}` : null,
    reference ? `Verwendungszweck ${reference}` : null,
    `(netto ${formatEuro(breakdown.netAmount)}, zzgl. ${formatPercent(INSURANCE_PARTNER_VAT_RATE)} MwSt. ${formatEuro(
      breakdown.vatAmount
    )}, Gesamtbetrag ${formatEuro(breakdown.grossAmount)})`,
  ]
    .filter(Boolean)
    .join(" - ")
}

export function getInsuranceInvoiceTitle(invoiceType?: unknown) {
  return isInsuranceCancellationInvoiceType(invoiceType) ? "Versicherungsstornorechnung" : "Versicherungsprovisionsrechnung"
}
