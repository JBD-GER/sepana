export type AdvisorCaseProduct = "baufi" | "konsum" | "schufa_frei"

export type AdvisorCaseStatusValue =
  | "neu"
  | "kontaktaufnahme"
  | "terminiert"
  | "angebot"
  | "nachfrage"
  | "finanzanalyse"
  | "bankeinreichung"
  | "abgelehnt"
  | "abgeschlossen"

export type AdvisorCaseStatusOption = {
  value: AdvisorCaseStatusValue
  label: string
}

export type AdvisorCaseFilterValue = AdvisorCaseStatusValue | "lead" | "temp_finanzanalyse"

export type AdvisorCaseFilterOption = {
  value: AdvisorCaseFilterValue
  label: string
}

const BASE_STATUS_OPTIONS: AdvisorCaseStatusOption[] = [
  { value: "neu", label: "Neu" },
  { value: "kontaktaufnahme", label: "Kontaktaufnahme" },
  { value: "terminiert", label: "Terminiert" },
  { value: "angebot", label: "Angebot" },
  { value: "nachfrage", label: "Nachfrage" },
  { value: "abgelehnt", label: "Abgelehnt" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
]

const SCHUFA_FREI_EXTRA_STATUS_OPTIONS: AdvisorCaseStatusOption[] = [
  { value: "finanzanalyse", label: "Finanzanalyse" },
  { value: "bankeinreichung", label: "Bankeinreichung" },
]

const SCHUFA_FREI_SPECIAL_FILTER_OPTIONS: AdvisorCaseFilterOption[] = [
  { value: "lead", label: "Lead" },
  { value: "temp_finanzanalyse", label: "Temp. Finanzanalyse" },
]

export function normalizeAdvisorCaseProduct(value: string | null | undefined): AdvisorCaseProduct {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "konsum") return "konsum"
  if (raw === "schufa_frei" || raw === "schufafrei") return "schufa_frei"
  return "baufi"
}

export function getAdvisorCaseStatusOptions(caseType: string | null | undefined): AdvisorCaseStatusOption[] {
  const product = normalizeAdvisorCaseProduct(caseType)
  if (product === "schufa_frei") {
    return [
      ...BASE_STATUS_OPTIONS.slice(0, 5),
      ...SCHUFA_FREI_EXTRA_STATUS_OPTIONS,
      ...BASE_STATUS_OPTIONS.slice(5),
    ]
  }
  return BASE_STATUS_OPTIONS
}

export function getAdvisorCaseStatusSet(caseType: string | null | undefined) {
  return new Set<string>(getAdvisorCaseStatusOptions(caseType).map((option) => option.value))
}

export function getAdvisorCaseStatusLabel(value: string | null | undefined, caseType: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return "Neu"
  return getAdvisorCaseStatusOptions(caseType).find((option) => option.value === normalized)?.label ?? "Neu"
}

export function getAdvisorCaseFilterOptions(caseType: string | null | undefined): AdvisorCaseFilterOption[] {
  const product = normalizeAdvisorCaseProduct(caseType)
  if (product === "schufa_frei") {
    return [
      SCHUFA_FREI_SPECIAL_FILTER_OPTIONS[0],
      ...BASE_STATUS_OPTIONS.slice(0, 5),
      SCHUFA_FREI_SPECIAL_FILTER_OPTIONS[1],
      ...SCHUFA_FREI_EXTRA_STATUS_OPTIONS,
      ...BASE_STATUS_OPTIONS.slice(5),
    ]
  }

  return getAdvisorCaseStatusOptions(caseType)
}

export function getAdvisorCaseFilterSet(caseType: string | null | undefined) {
  return new Set<string>(getAdvisorCaseFilterOptions(caseType).map((option) => option.value))
}

export function getAdvisorCaseFilterLabel(value: string | null | undefined, caseType: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return "Neu"
  return getAdvisorCaseFilterOptions(caseType).find((option) => option.value === normalized)?.label ?? "Neu"
}
