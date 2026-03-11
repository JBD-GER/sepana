export const PRIVATKREDIT_PURPOSE_OPTIONS = [
  { value: "freie_verwendung", label: "Freie Verwendung" },
  { value: "umschuldung", label: "Umschuldung" },
  { value: "auto", label: "Auto" },
  { value: "pv_anlage", label: "PV-Anlage" },
  { value: "hochzeitskredit", label: "Hochzeitskredit" },
  { value: "modernisierung", label: "Modernisierung" },
  { value: "sonstiges", label: "Sonstiges" },
] as const

const PURPOSE_LABELS: Record<string, string> = {
  freie_verwendung: "Freie Verwendung",
  umschuldung: "Umschuldung",
  auto: "Auto",
  autokredit: "Auto",
  pv_anlage: "PV-Anlage Finanzierung",
  pv: "PV-Anlage Finanzierung",
  photovoltaik: "PV-Anlage Finanzierung",
  solaranlage: "PV-Anlage Finanzierung",
  hochzeitskredit: "Hochzeitskredit",
  hochzeitkredit: "Hochzeitskredit",
  hochzeit: "Hochzeitskredit",
  wedding: "Hochzeitskredit",
  modernisierung: "Modernisierung",
  renovierung: "Modernisierung",
  moebel: "Möbel / Elektronik",
  sonstiges: "Sonstiges",
}

export function getPrivatkreditPurposeLabel(value: unknown, fallback = "Privatkredit") {
  const key = String(value ?? "").trim().toLowerCase()
  return PURPOSE_LABELS[key] || fallback
}

export function getPrivatkreditProductName(value: unknown) {
  const key = String(value ?? "").trim().toLowerCase()
  if (["pv_anlage", "pv", "photovoltaik", "solaranlage"].includes(key)) return "Privatkredit PV-Anlage"
  if (["hochzeitskredit", "hochzeitkredit", "hochzeit", "wedding"].includes(key)) return "Privatkredit Hochzeit"
  return "Privatkredit"
}
