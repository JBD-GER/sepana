export const SCHUFA_FREE_PROVISION_INVOICE_TYPE = "schufa_free_provision_advance"
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

export function buildSchufaFreeProvisionPaymentReference(
  invoiceNumber: string | null | undefined,
  caseId: string | null | undefined
) {
  const normalizedInvoiceNumber = trimOrNull(invoiceNumber)
  const normalizedCaseId = trimOrNull(caseId)

  if (normalizedInvoiceNumber && normalizedCaseId) {
    return `${normalizedInvoiceNumber} ${normalizedCaseId}`
  }

  return normalizedInvoiceNumber ?? normalizedCaseId
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

export function formatEuro(value: number | null | undefined) {
  const numericValue = Number(value ?? 0)
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(numericValue) ? numericValue : 0
  )
}

export function formatPercent(rate: number) {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(rate * 100)} %`
}

export function getSchufaFreeProvisionStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "paid":
      return "Bezahlt"
    case "refunded":
      return "Erstattet"
    case "cancelled":
      return "Storniert"
    case "sent":
      return "Versendet"
    default:
      return "Noch nicht angelegt"
  }
}

export function isSchufaFreeProvisionPaid(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase() === "paid"
}

export function getSchufaFreeProvisionRefundLines() {
  return [
    "Die Vorauszahlung wird vollständig erstattet, wenn keine positive Rückmeldung der SIGMA Kreditbank AG vorliegt und keine Auszahlung stattfindet.",
    "Die Vorauszahlung wird ebenfalls erstattet, wenn der Kreditvertrag fristgerecht widerrufen wurde.",
  ]
}

export function buildSchufaFreeProvisionInvoiceTitle() {
  return "Vorauszahlungsrechnung"
}

export function buildSchufaFreeProvisionDescription(loanAmount: number) {
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdown(loanAmount)

  return `Vorauszahlung auf die Serviceprovision für Kredit ohne Schufa (${formatPercent(
    SCHUFA_FREE_PROVISION_RATE
  )} netto von ${formatEuro(loanAmount)} = ${formatEuro(netAmount)}, zzgl. ${formatPercent(
    SCHUFA_FREE_PROVISION_VAT_RATE
  )} MwSt. = ${formatEuro(vatAmount)}, Gesamtbetrag ${formatEuro(grossAmount)}).`
}
