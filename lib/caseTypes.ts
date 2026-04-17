export type SupportedCaseType = "baufi" | "konsum" | "schufa_frei"

export function normalizeSupportedCaseType(raw: unknown): SupportedCaseType | null {
  const value = String(raw ?? "").trim().toLowerCase()
  if (value === "baufi" || value === "baufinanzierung") return "baufi"
  if (value === "konsum" || value === "privatkredit" || value === "onlinekredit") return "konsum"
  if (
    value === "schufa_frei" ||
    value === "schufafrei" ||
    value === "kredit_ohne_schufa" ||
    value === "kredit-ohne-schufa" ||
    value === "ohne_schufa"
  ) {
    return "schufa_frei"
  }
  return null
}

export function getCaseTypeLabel(caseType: SupportedCaseType | null | undefined) {
  if (caseType === "konsum") return "Privatkredit"
  if (caseType === "schufa_frei") return "Kredit ohne Schufa"
  return "Baufinanzierung"
}

export function getCaseRefPrefix(caseType: SupportedCaseType) {
  if (caseType === "konsum") return "PK"
  if (caseType === "schufa_frei") return "SF"
  return "BF"
}

export function isEuropaceCaseType(caseType: SupportedCaseType | null | undefined) {
  return caseType === "konsum"
}

export function isSchufaFreeCaseType(caseType: SupportedCaseType | null | undefined) {
  return caseType === "schufa_frei"
}

export function isPropertyCaseType(caseType: SupportedCaseType | null | undefined) {
  return caseType === "baufi"
}
