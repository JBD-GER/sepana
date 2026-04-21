export const INSURANCE_PARTNER_INVOICE_TYPE = "insurance_partner_commission"
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

export function isInsuranceInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === INSURANCE_PARTNER_INVOICE_TYPE
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
  const grossAmount = Number(amountTotal ?? 0)
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return roundCurrency(grossAmount / (1 + INSURANCE_PARTNER_VAT_RATE))
}

export function calculateInsuranceVatAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return roundCurrency(grossAmount - calculateInsuranceNetAmountFromGrossAmount(grossAmount))
}

export function getInsuranceInvoiceBreakdownFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
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

export function getInsuranceInvoiceTitle() {
  return "Versicherungsprovisionsrechnung"
}
