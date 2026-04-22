export const SCHUFA_FREE_PROVISION_INVOICE_TYPE = "schufa_free_service_fee"
export const SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE = "schufa_free_service_fee_cancellation"
export const SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE = "schufa_free_provision_advance"
export const SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE = "schufa_free_provision_advance_cancellation"
export const SCHUFA_FREE_PROVISION_RATE = 0.05
export const SCHUFA_FREE_PROVISION_VAT_RATE = 0.19

export const SCHUFA_FREE_PROVISION_BANK = {
  accountHolder: "Flaaq Holding GmbH",
  iban: "DE28100101230768347516",
  bic: "QNTODEB2XXX",
} as const

export const SCHUFA_FREE_PROVISION_COMPANY = {
  name: "Flaaq Holding GmbH",
  street: "Dammstr. 6G",
  city: "30890 Barsinghausen",
  email: "info@sepana.de",
  phone: "+49 5761 8429660",
  vatId: "DE352217621",
  registrationNumber: "D-W-133-TNSL-07",
} as const

export type SchufaFreeProvisionInvoiceStatus = "sent" | "paid" | "refunded" | "cancelled"

const SCHUFA_FREE_MAIN_INVOICE_TYPES = new Set([
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE,
])

const SCHUFA_FREE_CANCELLATION_INVOICE_TYPES = new Set([
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE,
])

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export function getSchufaFreeProvisionInvoiceNumber(invoiceNumber: unknown) {
  return trimOrNull(invoiceNumber)
}

export function isSchufaFreeProvisionInvoiceType(invoiceType: unknown) {
  const normalized = trimOrNull(invoiceType)
  return normalized ? SCHUFA_FREE_MAIN_INVOICE_TYPES.has(normalized) : false
}

export function isSchufaFreeProvisionCancellationInvoiceType(invoiceType: unknown) {
  const normalized = trimOrNull(invoiceType)
  return normalized ? SCHUFA_FREE_CANCELLATION_INVOICE_TYPES.has(normalized) : false
}

export function isLegacySchufaFreeProvisionInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE
}

export function isLegacySchufaFreeProvisionCancellationInvoiceType(invoiceType: unknown) {
  return trimOrNull(invoiceType) === SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE
}

export function isInternalSchufaFreeProvisionInvoiceType(invoiceType: unknown) {
  const normalized = trimOrNull(invoiceType)
  return (
    normalized === SCHUFA_FREE_PROVISION_INVOICE_TYPE ||
    normalized === SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE
  )
}

export function buildSchufaFreeProvisionPaymentReference(
  invoiceNumber: string | null | undefined,
  caseRef: string | null | undefined
) {
  const normalizedInvoiceNumber = trimOrNull(invoiceNumber)
  const normalizedCaseRef = trimOrNull(caseRef)

  if (normalizedInvoiceNumber && normalizedCaseRef) {
    return `${normalizedInvoiceNumber} ${normalizedCaseRef}`
  }

  return normalizedInvoiceNumber ?? normalizedCaseRef
}

export function calculateSchufaFreeProvisionNetAmount(loanAmount: number | null | undefined) {
  const numericLoanAmount = Number(loanAmount ?? 0)
  if (!Number.isFinite(numericLoanAmount) || numericLoanAmount <= 0) return 0
  return roundCurrency(numericLoanAmount * SCHUFA_FREE_PROVISION_RATE)
}

export function calculateSchufaFreeProvisionVatAmount(loanAmount: number | null | undefined) {
  const netAmount = calculateSchufaFreeProvisionNetAmount(loanAmount)
  return roundCurrency(netAmount * SCHUFA_FREE_PROVISION_VAT_RATE)
}

export function calculateSchufaFreeProvisionGrossAmount(loanAmount: number | null | undefined) {
  const netAmount = calculateSchufaFreeProvisionNetAmount(loanAmount)
  const vatAmount = calculateSchufaFreeProvisionVatAmount(loanAmount)
  return roundCurrency(netAmount + vatAmount)
}

export function calculateSchufaFreeProvisionAmount(loanAmount: number | null | undefined) {
  return calculateSchufaFreeProvisionGrossAmount(loanAmount)
}

export function getSchufaFreeProvisionBreakdown(loanAmount: number | null | undefined) {
  const netAmount = calculateSchufaFreeProvisionNetAmount(loanAmount)
  const vatAmount = calculateSchufaFreeProvisionVatAmount(loanAmount)
  const grossAmount = roundCurrency(netAmount + vatAmount)

  return {
    netAmount,
    vatAmount,
    grossAmount,
  }
}

export function calculateSchufaFreeProvisionNetAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = Number(amountTotal ?? 0)
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return roundCurrency(grossAmount / (1 + SCHUFA_FREE_PROVISION_VAT_RATE))
}

export function calculateSchufaFreeProvisionVatAmountFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  const netAmount = calculateSchufaFreeProvisionNetAmountFromGrossAmount(grossAmount)
  return roundCurrency(grossAmount - netAmount)
}

export function getSchufaFreeProvisionBreakdownFromGrossAmount(amountTotal: number | null | undefined) {
  const grossAmount = roundCurrency(Number(amountTotal ?? 0))
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return {
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
    }
  }

  const netAmount = calculateSchufaFreeProvisionNetAmountFromGrossAmount(grossAmount)
  const vatAmount = calculateSchufaFreeProvisionVatAmountFromGrossAmount(grossAmount)

  return {
    netAmount,
    vatAmount,
    grossAmount,
  }
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

export function getSchufaFreeProvisionStatusLabel(status: string | null | undefined, invoiceType?: string | null | undefined) {
  const isInternalInvoice = isInternalSchufaFreeProvisionInvoiceType(invoiceType)

  switch (String(status ?? "").trim().toLowerCase()) {
    case "paid":
      return "Bezahlt"
    case "refunded":
      return "Erstattet"
    case "cancelled":
      return "Storniert"
    case "sent":
      return isInternalInvoice ? "Angelegt" : "Versendet"
    default:
      return "Noch nicht angelegt"
  }
}

export function getSchufaFreeProvisionInvoiceTitle(invoiceType: string | null | undefined) {
  if (isSchufaFreeProvisionCancellationInvoiceType(invoiceType)) {
    return "Stornorechnung"
  }
  return isLegacySchufaFreeProvisionInvoiceType(invoiceType) ? "Vorauszahlungsrechnung" : "Servicepauschalenrechnung"
}

export function isSchufaFreeProvisionPaid(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase() === "paid"
}

export function getSchufaFreeProvisionRefundLines() {
  return [
    "Die Vorauszahlung wird vollstaendig erstattet, wenn keine positive Rueckmeldung der SIGMA Kreditbank AG vorliegt und keine Auszahlung stattfindet.",
    "Die Vorauszahlung wird ebenfalls erstattet, wenn der Kreditvertrag fristgerecht widerrufen wurde.",
  ]
}

export function getSchufaFreeServiceFeeInfoLines() {
  return [
    "Die Servicepauschale wird intern im Fall angelegt und ist kein Blocker fuer Vertrag oder Signatur.",
    "Die Faelligkeit der Servicepauschale entsteht erst nach bestaetigter Kreditauszahlung.",
    "Der eingegebene Gesamtbetrag enthaelt 19 % MwSt. und wird nicht automatisch an den Kunden kommuniziert.",
  ]
}

export function buildSchufaFreeProvisionInvoiceTitle() {
  return "Servicepauschalenrechnung"
}

export function buildSchufaFreeProvisionCancellationInvoiceTitle() {
  return "Stornorechnung"
}

export function buildLegacySchufaFreeProvisionDescription(loanAmount: number) {
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdown(loanAmount)

  return `Vorauszahlung auf die Serviceprovision fuer Kredit ohne Schufa (${formatPercent(
    SCHUFA_FREE_PROVISION_RATE
  )} netto von ${formatEuro(loanAmount)} = ${formatEuro(netAmount)}, zzgl. ${formatPercent(
    SCHUFA_FREE_PROVISION_VAT_RATE
  )} MwSt. = ${formatEuro(vatAmount)}, Gesamtbetrag ${formatEuro(grossAmount)}).`
}

export function buildLegacySchufaFreeProvisionCancellationDescription(opts: {
  loanAmount: number
  originalInvoiceNumber?: string | null
}) {
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdown(opts.loanAmount)
  const originalInvoiceNumber = trimOrNull(opts.originalInvoiceNumber)
  const referencePart = originalInvoiceNumber ? ` zur Vorauszahlungsrechnung ${originalInvoiceNumber}` : ""

  return `Stornierung${referencePart} fuer Kredit ohne Schufa (${formatPercent(
    SCHUFA_FREE_PROVISION_RATE
  )} netto von ${formatEuro(opts.loanAmount)} = ${formatEuro(-netAmount)}, zzgl. ${formatPercent(
    SCHUFA_FREE_PROVISION_VAT_RATE
  )} MwSt. = ${formatEuro(-vatAmount)}, Gesamtbetrag ${formatEuro(-grossAmount)}).`
}

export function buildSchufaFreeProvisionDescription(amountTotal: number) {
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdownFromGrossAmount(amountTotal)

  return `Servicepauschale fuer Kredit ohne Schufa (netto ${formatEuro(netAmount)}, zzgl. ${formatPercent(
    SCHUFA_FREE_PROVISION_VAT_RATE
  )} MwSt. ${formatEuro(vatAmount)}, Gesamtbetrag ${formatEuro(grossAmount)}).`
}

export function buildSchufaFreeProvisionCancellationDescription(opts: {
  amountTotal: number
  originalInvoiceNumber?: string | null
}) {
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdownFromGrossAmount(opts.amountTotal)
  const originalInvoiceNumber = trimOrNull(opts.originalInvoiceNumber)
  const referencePart = originalInvoiceNumber ? ` zur Servicepauschalenrechnung ${originalInvoiceNumber}` : ""

  return `Stornierung${referencePart} fuer Kredit ohne Schufa (netto ${formatEuro(-netAmount)}, zzgl. ${formatPercent(
    SCHUFA_FREE_PROVISION_VAT_RATE
  )} MwSt. ${formatEuro(-vatAmount)}, Gesamtbetrag ${formatEuro(-grossAmount)}).`
}
