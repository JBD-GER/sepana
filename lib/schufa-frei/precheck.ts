export type SchufaFreeNationalityGroup = "de" | "eu_ch" | "other"
export type SchufaFreeEmploymentMode = "salary" | "hourly"

export type SchufaFreePrecheckInput = {
  desiredAmount: number
  termMonths: number
  dependentChildrenCount: number
  nationalityGroup: SchufaFreeNationalityGroup
  sigmaExistingCustomer: boolean
  employmentMode: SchufaFreeEmploymentMode
  employmentMonthsCurrent?: number | null
  employmentStartDate?: string | null
  netIncomeMonthly?: number | null
}

export type SchufaFreeVariantKey =
  | "3500_40"
  | "5000_40"
  | "7500_40"
  | "10000_40"
  | "3500_58"
  | "5000_58"
  | "7500_58"

export type SchufaFreePrecheckResult = {
  eligible: boolean
  variantKey: SchufaFreeVariantKey | null
  normalizedAmount: number | null
  normalizedTermMonths: number | null
  employmentMonthsCurrent: number | null
  minimumIncomeRequired: number | null
  employmentRequirementText: string | null
  incomeCheckPending: boolean
  reason: string | null
}

export type SchufaFreePrecheckOptions = {
  requireIncomeCheck?: boolean
}

export const SCHUFA_FREE_AMOUNT_OPTIONS = [3500, 5000, 7500, 10000] as const
export const SCHUFA_FREE_TERM_OPTIONS = [40, 58] as const

const INCOME_MATRIX: Record<SchufaFreeVariantKey, number[]> = {
  "3500_40": [1870, 2360, 2740, 3160, 3670, 4530],
  "5000_40": [2000, 2460, 2860, 3310, 3900],
  "7500_40": [2220, 2610, 3050, 3570, 4290],
  "10000_40": [2450, 2770, 3250, 3830, 4670],
  "3500_58": [1680, 2310, 2680, 3070, 3530, 4260],
  "5000_58": [1890, 2380, 2760, 3190, 3710],
  "7500_58": [2060, 2490, 2910, 3380, 4010],
}

const RATE_MATRIX: Record<SchufaFreeVariantKey, number> = {
  "3500_40": 108.6,
  "5000_40": 155.1,
  "7500_40": 232.7,
  "10000_40": 310.25,
  "3500_58": 81.55,
  "5000_58": 116.55,
  "7500_58": 174.8,
}

function normalizeInteger(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.round(numeric))
}

function normalizeIsoDate(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null

  const [yearRaw, monthRaw, dayRaw] = raw.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null
  }

  return raw
}

export function getSchufaFreeEmploymentMonthsSince(value: unknown, referenceDate = new Date()) {
  const isoDate = normalizeIsoDate(value)
  if (!isoDate) return null

  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-")
  const startYear = Number(yearRaw)
  const startMonth = Number(monthRaw)
  const startDay = Number(dayRaw)
  const referenceYear = referenceDate.getUTCFullYear()
  const referenceMonth = referenceDate.getUTCMonth() + 1
  const referenceDay = referenceDate.getUTCDate()

  let diffMonths = (referenceYear - startYear) * 12 + (referenceMonth - startMonth)
  if (referenceDay < startDay) diffMonths -= 1

  return diffMonths >= 0 ? diffMonths : null
}

function resolveVariantKey(amount: number, termMonths: number): SchufaFreeVariantKey | null {
  const key = `${normalizeInteger(amount)}_${normalizeInteger(termMonths)}` as SchufaFreeVariantKey
  return key in INCOME_MATRIX ? key : null
}

function resolveEmploymentMonthsCurrent(input: SchufaFreePrecheckInput) {
  const employmentStartDate = String(input.employmentStartDate ?? "").trim()
  if (employmentStartDate) {
    return getSchufaFreeEmploymentMonthsSince(employmentStartDate)
  }

  const numeric = Number(input.employmentMonthsCurrent)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.round(numeric))
}

function employmentRequirementText(input: {
  variantKey: SchufaFreeVariantKey
  nationalityGroup: SchufaFreeNationalityGroup
  sigmaExistingCustomer: boolean
  employmentMode: SchufaFreeEmploymentMode
}) {
  const { variantKey, nationalityGroup, sigmaExistingCustomer, employmentMode } = input

  if (sigmaExistingCustomer) {
    if (variantKey === "10000_40") {
      return "Mindestens 12 Monate beim aktuellen Arbeitgeber."
    }
    return employmentMode === "hourly"
      ? "Mindestens 4 Monate beim aktuellen Arbeitgeber im Stundenlohn."
      : "Mindestens 7 Monate beim aktuellen Arbeitgeber im Gehalt."
  }

  if (variantKey.endsWith("_58")) {
    return "58 Monate sind nur fuer Sigma-Bestandskunden verfuegbar."
  }

  if (nationalityGroup === "de") {
    return variantKey === "10000_40"
      ? "Mindestens 36 Monate beim aktuellen Arbeitgeber."
      : "Mindestens 12 Monate beim aktuellen Arbeitgeber."
  }

  if (nationalityGroup === "eu_ch") {
    return "Mindestens 60 Monate beim aktuellen Arbeitgeber."
  }

  return "Diese Variante ist nur fuer DE- oder CH-/EU-Buerger pruefbar."
}

function meetsEmploymentRequirement(input: {
  variantKey: SchufaFreeVariantKey
  nationalityGroup: SchufaFreeNationalityGroup
  sigmaExistingCustomer: boolean
  employmentMode: SchufaFreeEmploymentMode
  employmentMonthsCurrent: number
}) {
  const { variantKey, nationalityGroup, sigmaExistingCustomer, employmentMode } = input
  const months = normalizeInteger(input.employmentMonthsCurrent)

  if (sigmaExistingCustomer) {
    if (variantKey === "10000_40") return months >= 12
    return employmentMode === "hourly" ? months >= 4 : months >= 7
  }

  if (variantKey.endsWith("_58")) return false
  if (nationalityGroup === "de") {
    return variantKey === "10000_40" ? months >= 36 : months >= 12
  }
  if (nationalityGroup === "eu_ch") return months >= 60
  return false
}

export function getSchufaFreeMinimumIncome(amount: number, termMonths: number, dependentChildrenCount: number) {
  const variantKey = resolveVariantKey(amount, termMonths)
  if (!variantKey) return null

  const incomeTable = INCOME_MATRIX[variantKey]
  const index = normalizeInteger(dependentChildrenCount)
  return incomeTable[index] ?? null
}

export function getSchufaFreeMonthlyRate(amount: number, termMonths: number) {
  const variantKey = resolveVariantKey(amount, termMonths)
  if (!variantKey) return null
  return RATE_MATRIX[variantKey] ?? null
}

export function runSchufaFreePrecheck(
  input: SchufaFreePrecheckInput,
  options: SchufaFreePrecheckOptions = {},
): SchufaFreePrecheckResult {
  const desiredAmount = normalizeInteger(input.desiredAmount)
  const termMonths = normalizeInteger(input.termMonths)
  const dependentChildrenCount = normalizeInteger(input.dependentChildrenCount)
  const requireIncomeCheck = options.requireIncomeCheck !== false
  const netIncomeMonthly =
    input.netIncomeMonthly === null || input.netIncomeMonthly === undefined
      ? null
      : normalizeInteger(input.netIncomeMonthly)
  const variantKey = resolveVariantKey(desiredAmount, termMonths)
  const employmentMonthsCurrent = resolveEmploymentMonthsCurrent(input)

  if (!variantKey) {
    return {
      eligible: false,
      variantKey: null,
      normalizedAmount: null,
      normalizedTermMonths: null,
      employmentMonthsCurrent,
      minimumIncomeRequired: null,
      employmentRequirementText: null,
      incomeCheckPending: !requireIncomeCheck,
      reason: "Diese Kombination aus Kreditsumme und Laufzeit ist fuer Sigma derzeit nicht verfuegbar.",
    }
  }

  const minimumIncomeRequired = getSchufaFreeMinimumIncome(desiredAmount, termMonths, dependentChildrenCount)
  const employmentText = employmentRequirementText({
    variantKey,
    nationalityGroup: input.nationalityGroup,
    sigmaExistingCustomer: input.sigmaExistingCustomer,
    employmentMode: input.employmentMode,
  })

  if (minimumIncomeRequired === null) {
    return {
      eligible: false,
      variantKey,
      normalizedAmount: desiredAmount,
      normalizedTermMonths: termMonths,
      employmentMonthsCurrent,
      minimumIncomeRequired: null,
      employmentRequirementText: employmentText,
      incomeCheckPending: !requireIncomeCheck,
      reason: "Fuer diese Variante sind zu viele unterhaltspflichtige Kinder angegeben.",
    }
  }

  if (employmentMonthsCurrent === null) {
    return {
      eligible: false,
      variantKey,
      normalizedAmount: desiredAmount,
      normalizedTermMonths: termMonths,
      employmentMonthsCurrent: null,
      minimumIncomeRequired,
      employmentRequirementText: employmentText,
      incomeCheckPending: !requireIncomeCheck,
      reason: "Bitte das Eintrittsdatum beim aktuellen Arbeitgeber gueltig angeben.",
    }
  }

  if (!meetsEmploymentRequirement({
    variantKey,
    nationalityGroup: input.nationalityGroup,
    sigmaExistingCustomer: input.sigmaExistingCustomer,
    employmentMode: input.employmentMode,
    employmentMonthsCurrent,
  })) {
    return {
      eligible: false,
      variantKey,
      normalizedAmount: desiredAmount,
      normalizedTermMonths: termMonths,
      employmentMonthsCurrent,
      minimumIncomeRequired,
      employmentRequirementText: employmentText,
      incomeCheckPending: !requireIncomeCheck,
      reason: employmentText,
    }
  }

  if (requireIncomeCheck && netIncomeMonthly === null) {
    return {
      eligible: false,
      variantKey,
      normalizedAmount: desiredAmount,
      normalizedTermMonths: termMonths,
      employmentMonthsCurrent,
      minimumIncomeRequired,
      employmentRequirementText: employmentText,
      incomeCheckPending: false,
      reason: "Bitte das monatliche Nettoeinkommen fuer die Vorpruefung angeben.",
    }
  }

  if (requireIncomeCheck && netIncomeMonthly !== null && netIncomeMonthly < minimumIncomeRequired) {
    return {
      eligible: false,
      variantKey,
      normalizedAmount: desiredAmount,
      normalizedTermMonths: termMonths,
      employmentMonthsCurrent,
      minimumIncomeRequired,
      employmentRequirementText: employmentText,
      incomeCheckPending: false,
      reason: `Das benoetigte Nettoeinkommen liegt fuer diese Variante bei mindestens ${minimumIncomeRequired.toLocaleString("de-DE")} EUR.`,
    }
  }

  return {
    eligible: true,
    variantKey,
    normalizedAmount: desiredAmount,
    normalizedTermMonths: termMonths,
    employmentMonthsCurrent,
    minimumIncomeRequired,
    employmentRequirementText: employmentText,
    incomeCheckPending: !requireIncomeCheck,
    reason: null,
  }
}
