import type { EuropaceOfferSummary } from "@/lib/europace/types"

type OfferMessage = {
  text?: string | null
  property?: string | null
  category?: string | null
  reason?: string | null
}

export type EuropaceOfferEligibilityInput = {
  angebot_snapshot?: EuropaceOfferSummary | null
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
} | null | undefined

export class EuropaceOfferValidationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 409) {
    super(message)
    this.name = "EuropaceOfferValidationError"
    this.statusCode = statusCode
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

function customerText(value: unknown) {
  return String(value ?? "").replace(/europace/gi, "SEPANA").trim()
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function hasExplicitFullStatus(offer: EuropaceOfferEligibilityInput) {
  return normalizeStatus(offer?.vollstaendigkeit_status) === "VOLLSTAENDIG"
}

function hasAccountCheckRequirement(offer: EuropaceOfferEligibilityInput) {
  const mode = normalizeStatus(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)
  const messages = Array.isArray(offer?.angebot_snapshot?.vollstaendigkeit?.messages)
    ? offer?.angebot_snapshot?.vollstaendigkeit?.messages ?? []
    : []

  return mode === "REQUIRED" || messages.some((entry) => isAccountCheckOfferMessage(entry))
}

export function isAccountCheckOfferMessage(entry: OfferMessage | null | undefined) {
  const haystack = [
    String(entry?.property ?? ""),
    String(entry?.text ?? ""),
    String(entry?.category ?? ""),
    String(entry?.reason ?? ""),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes("kontocheck") || haystack.includes("accountcheck") || haystack.includes("account check")
}

export function formatOfferRequirementMessage(entry: OfferMessage | null | undefined) {
  const text = String(entry?.text ?? "").trim()
  const property = String(entry?.property ?? "").trim()
  const category = String(entry?.category ?? "").trim()

  if (property && text) return customerText(`${property}: ${text}`)
  if (text) return customerText(text)
  if (property && category) return customerText(`${category}: ${property}`)
  return customerText(property || category || "")
}

export function getOfferBlockingMessages(offer: EuropaceOfferEligibilityInput) {
  const messages = Array.isArray(offer?.angebot_snapshot?.vollstaendigkeit?.messages)
    ? offer?.angebot_snapshot?.vollstaendigkeit?.messages ?? []
    : []

  return Array.from(
    new Set(
      messages
        .filter((entry) => !isAccountCheckOfferMessage(entry))
        .map((entry) => formatOfferRequirementMessage(entry))
        .filter(Boolean)
    )
  )
}

export function isOfferLocallyAcceptable(offer: EuropaceOfferEligibilityInput) {
  if (!offer || offer.accepted_at || offer.superseded_at) return false

  const machbarkeit = normalizeStatus(offer.machbarkeit_status)
  const machbar = machbarkeit === "MACHBAR" || machbarkeit === "MACHBAR_UNTER_VORBEHALT"

  return hasExplicitFullStatus(offer) && machbar
}

export function isOfferGreenSelectable(offer: EuropaceOfferEligibilityInput) {
  if (!offer || offer.accepted_at || offer.superseded_at) return false
  return normalizeStatus(offer.machbarkeit_status) === "MACHBAR" && hasExplicitFullStatus(offer)
}

export function getOfferValidationMessage(
  offer: EuropaceOfferEligibilityInput,
  options?: { greenOnly?: boolean }
) {
  if (!offer) {
    return "Fuer dieses Angebot liegt aktuell keine gueltige Variante vor. Bitte rufe die Angebote erneut ab."
  }

  if (offer.accepted_at) {
    return "Dieses Angebot wurde bereits angenommen."
  }

  if (offer.superseded_at) {
    return "Dieses Angebot ist nicht mehr aktuell. Bitte rufe die Angebote erneut ab."
  }

  const blockingMessages = getOfferBlockingMessages(offer)
  if (blockingMessages.length > 0) {
    const preview = blockingMessages.slice(0, 2).join(" | ")
    const suffix = blockingMessages.length > 2 ? ` | Weitere Punkte: ${blockingMessages.length - 2}` : ""
    return `Dieses Angebot ist noch unvollstaendig. Bitte ergaenze zuerst die offenen Pflichtangaben: ${preview}${suffix}`
  }

  if (!hasExplicitFullStatus(offer)) {
    if (hasAccountCheckRequirement(offer)) {
      return "Fuer dieses Angebot ist vor der finalen Annahme zuerst ein Kontocheck noetig. Danach kannst du die finalen Konditionen erneut pruefen."
    }

    return "Dieses Angebot ist aktuell noch unvollstaendig und kann deshalb noch nicht final angenommen werden."
  }

  const machbarkeit = normalizeStatus(offer.machbarkeit_status)
  if (options?.greenOnly) {
    if (machbarkeit !== "MACHBAR") {
      return "Dieses Angebot ist nach der finalen Aktualisierung nicht mehr gruen auswaehlbar. Bitte gehe zur Angebotsseite zurueck und waehle ein aktuelles Angebot."
    }
    return null
  }

  if (machbarkeit !== "MACHBAR" && machbarkeit !== "MACHBAR_UNTER_VORBEHALT") {
    return "Dieses Angebot ist aktuell nicht mehr annehmbar. Bitte rufe die Angebote erneut ab."
  }

  return null
}
