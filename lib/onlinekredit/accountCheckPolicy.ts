function normalizeValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

export function getOnlinekreditAccountCheckRestrictionReason(input: {
  purpose?: unknown
  employmentTypes?: unknown[]
}) {
  const purpose = normalizeValue(input.purpose)
  const employmentTypes = Array.isArray(input.employmentTypes)
    ? input.employmentTypes.map((entry) => normalizeValue(entry)).filter(Boolean)
    : []

  const isUmschuldung = purpose === "umschuldung"
  const isSelfEmployed = employmentTypes.includes("self_employed")

  if (isUmschuldung && isSelfEmployed) {
    return "Bei Selbststaendigkeit und Umschuldung/Kreditabloese laeuft dieser Abschluss aktuell nur mit SEPANA-Begleitung weiter."
  }

  if (isSelfEmployed) {
    return "Bei Selbststaendigkeit laeuft dieser Abschluss aktuell nur mit SEPANA-Begleitung weiter."
  }

  if (isUmschuldung) {
    return "Bei Umschuldung/Kreditabloese laeuft dieser Abschluss aktuell nur mit SEPANA-Begleitung weiter."
  }

  return null
}
