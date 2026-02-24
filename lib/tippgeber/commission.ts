export const TIPPGEBER_DECLINED_FIXED_NET_EUR = 100
export const TIPPGEBER_APPROVED_PERCENT_RATE = 0.3 // 30 % der internen Provision
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

export function toMoney(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return round2(n)
}

export function calculateTippgeberCommission(
  outcome: TippgeberBankOutcome,
  baseAmountInput: number | null | undefined
): TippgeberCommissionBreakdown {
  const baseAmount = Math.max(0, toMoney(baseAmountInput ?? 0))
  const percentRate = outcome === "approved" ? TIPPGEBER_APPROVED_PERCENT_RATE : 0
  const fixedNetAmount = outcome === "declined" ? TIPPGEBER_DECLINED_FIXED_NET_EUR : 0
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
    reason: outcome === "approved" ? "bank_approved_30pct_of_internal_commission" : "bank_declined_100",
  }
}

export function formatEuro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value))
}
