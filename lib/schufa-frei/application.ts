export const SCHUFA_FREE_FAMILY_OPTIONS = [
  { value: "1", label: "Ledig" },
  { value: "2", label: "Verheiratet" },
  { value: "3", label: "Verwitwet" },
  { value: "4", label: "Geschieden" },
  { value: "5", label: "Getrennt lebend" },
  { value: "6", label: "Lebensgemeinschaft" },
] as const

export const SCHUFA_FREE_PROFESSION_OPTIONS = [
  { value: "1", label: "Arbeiter" },
  { value: "2", label: "Angestellter" },
  { value: "3", label: "Beamter/Pensionär" },
  { value: "4", label: "Rentner" },
  { value: "5", label: "Arbeitslos" },
  { value: "6", label: "Hausfrau/Hausmann" },
  { value: "7", label: "Selbstständig" },
  { value: "8", label: "Sonstiges" },
] as const

export const SCHUFA_FREE_RESIDENCE_OPTIONS = [
  { value: "1", label: "Miete" },
  { value: "2", label: "Eigenheim" },
  { value: "3", label: "Bei Eltern" },
] as const

export function getSchufaFreeFamilyLabel(value: unknown) {
  return SCHUFA_FREE_FAMILY_OPTIONS.find((entry) => entry.value === String(value ?? "").trim())?.label ?? null
}

export function getSchufaFreeProfessionLabel(value: unknown) {
  return SCHUFA_FREE_PROFESSION_OPTIONS.find((entry) => entry.value === String(value ?? "").trim())?.label ?? null
}

export function resolveSchufaFreeProfessionFromEmploymentMode(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "hourly" ? 1 : 2
}

export function requiresSchufaFreeEmployerData(value: unknown) {
  const normalized = String(value ?? "").trim()
  return ["1", "2", "3"].includes(normalized)
}
