function normalizeMessage(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeStatus(value: unknown) {
  return normalizeMessage(value).toUpperCase()
}

export function isGenericOfferAcceptanceFailureMessage(value: unknown) {
  const normalized = normalizeMessage(value).toLowerCase()
  if (!normalized) return true

  return (
    normalized.includes("angebotsannahme ist fehlgeschlagen") ||
    normalized.includes("success, aber ohne erzeugten antrag")
  )
}

export function buildOfferAcceptanceFailureMessage(input: {
  status?: string | null
  offerReloaded?: boolean
  replacementOfferChanged?: boolean
  currentOfferSelectable?: boolean
}) {
  const status = normalizeStatus(input.status)
  const offerReloaded = Boolean(input.offerReloaded)
  const replacementOfferChanged = Boolean(input.replacementOfferChanged)
  const currentOfferSelectable = Boolean(input.currentOfferSelectable)

  if (status === "SUCCESS") {
    if (replacementOfferChanged) {
      return "Der Produktanbieter konnte das ausgewaehlte Angebot nicht final bestaetigen. Die aktuell passende Variante wurde bereits neu geladen. Bitte pruefe die finalen Konditionen erneut."
    }
    if (offerReloaded && currentOfferSelectable) {
      return "Der Produktanbieter konnte das ausgewaehlte Angebot nicht final bestaetigen. Die Angebotsdaten wurden bereits neu geladen. Bitte pruefe die finalen Konditionen erneut."
    }
    if (offerReloaded) {
      return "Der Produktanbieter konnte das ausgewaehlte Angebot nicht final bestaetigen. Die Angebotsdaten wurden bereits neu geladen, sind aktuell aber nicht direkt final auswaehlbar. Bitte lade die Angebote erneut oder waehle eine andere Variante."
    }
    return "Der Produktanbieter konnte das ausgewaehlte Angebot nicht final bestaetigen. Bitte lade die Angebote erneut oder waehle eine andere Variante."
  }

  if (replacementOfferChanged) {
    return "Die finale Anfrage konnte technisch nicht bestaetigt werden. Die aktuell passende Angebotsvariante wurde bereits neu geladen. Bitte pruefe die finalen Konditionen erneut."
  }
  if (offerReloaded && currentOfferSelectable) {
    return "Die finale Anfrage konnte technisch nicht bestaetigt werden. Die Angebotsdaten wurden bereits neu geladen. Bitte pruefe die finalen Konditionen erneut."
  }
  if (offerReloaded) {
    return "Die finale Anfrage konnte technisch nicht bestaetigt werden. Die Angebotsdaten wurden bereits neu geladen, sind aktuell aber nicht direkt final auswaehlbar. Bitte lade die Angebote erneut oder waehle eine andere Variante."
  }
  return "Die finale Anfrage konnte technisch nicht bestaetigt werden. Bitte pruefe die finalen Konditionen erneut oder lade die Angebote neu."
}

export function toPublicOfferAcceptanceMessage(
  value: unknown,
  options?: { hasRejectedApplication?: boolean }
) {
  const raw = normalizeMessage(value)
  if (!raw) {
    return options?.hasRejectedApplication
      ? "Der Produktanbieter hat das Angebot abgelehnt."
      : "Die finale Anfrage konnte technisch nicht bestaetigt werden. Bitte pruefe die finalen Konditionen erneut."
  }

  if (!isGenericOfferAcceptanceFailureMessage(raw)) {
    return raw
  }

  const normalized = raw.toLowerCase()
  if (normalized.includes("success, aber ohne erzeugten antrag")) {
    return "Der Produktanbieter konnte das ausgewaehlte Angebot nicht final bestaetigen. Bitte pruefe die finalen Konditionen erneut oder waehle eine andere Variante."
  }

  return options?.hasRejectedApplication
    ? "Der Produktanbieter hat das Angebot abgelehnt."
    : "Die finale Anfrage konnte technisch nicht bestaetigt werden. Bitte pruefe die finalen Konditionen erneut oder lade die Angebote neu."
}
