export const TIPPGEBER_APPROVED_PERCENT_RATE = 0.25 // 25 % Auszahlung inkl. MwSt. (berechnet auf Netto-Basis)
export const TIPPGEBER_VAT_RATE = 0.19

export type TippgeberBankOutcome = "approved" | "declined"

export type TippgeberCommissionBreakdown = {
  outcome: TippgeberBankOutcome
  baseAmount: number
  percentRate: number
  fixedNetAmount: number
  netAmount: number
  vatRate: number
  vatAmount: number
  grossAmount: number
  reason: string
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function netFromGross(value: number, vatRate: number) {
  const divisor = 1 + vatRate
  if (!Number.isFinite(divisor) || divisor <= 0) return round2(value)
  return round2(value / divisor)
}

export function toMoney(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return round2(n)
}

export function calculateTippgeberCommission(
  outcome: TippgeberBankOutcome,
  baseAmountInput: number | null | undefined
): TippgeberCommissionBreakdown {
  const inputAmount = Math.max(0, toMoney(baseAmountInput ?? 0))
  // Interne Provision wird im Admin/Berater-Frontend inkl. MwSt. erfasst.
  // Fuer die Tippgeber-Berechnung bleibt die Basis netto; 25 % netto zzgl. MwSt.
  // entsprechen damit exakt 25 % des eingegebenen Bruttobetrags.
  const baseAmount =
    outcome === "approved"
      ? netFromGross(inputAmount, TIPPGEBER_VAT_RATE)
      : inputAmount
  const percentRate = outcome === "approved" ? TIPPGEBER_APPROVED_PERCENT_RATE : 0
  const fixedNetAmount = 0
  const variableNet = outcome === "approved" ? round2(baseAmount * percentRate) : 0
  const netAmount = round2(fixedNetAmount + variableNet)
  const vatAmount = round2(netAmount * TIPPGEBER_VAT_RATE)
  const grossAmount = round2(netAmount + vatAmount)

  return {
    outcome,
    baseAmount,
    percentRate,
    fixedNetAmount,
    netAmount,
    vatRate: TIPPGEBER_VAT_RATE,
    vatAmount,
    grossAmount,
    reason: outcome === "approved" ? "bank_approved_25pct_incl_vat" : "bank_declined_no_commission",
  }
}

export function formatEuro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value))
}
