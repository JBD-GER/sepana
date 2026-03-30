type EuropaceOfferVisibilityRow = {
  angebot_id?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
  calculated_at?: string | null
  created_at?: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function offerTimestamp(value: string | null | undefined) {
  const timestamp = trimOrNull(value)
  if (!timestamp) return 0
  const parsed = new Date(timestamp).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function compareAcceptedOffersDesc<T extends EuropaceOfferVisibilityRow>(left: T, right: T) {
  const acceptedDiff = offerTimestamp(right.accepted_at) - offerTimestamp(left.accepted_at)
  if (acceptedDiff !== 0) return acceptedDiff

  const calculatedDiff = offerTimestamp(right.calculated_at) - offerTimestamp(left.calculated_at)
  if (calculatedDiff !== 0) return calculatedDiff

  const createdDiff = offerTimestamp(right.created_at) - offerTimestamp(left.created_at)
  if (createdDiff !== 0) return createdDiff

  return String(right.angebot_id ?? "").localeCompare(String(left.angebot_id ?? ""), "de", { sensitivity: "base" })
}

export function selectVisibleEuropaceOffers<T extends EuropaceOfferVisibilityRow>(
  offers: T[] | null | undefined,
  options?: {
    hasRejectedApplication?: boolean | null
  }
) {
  const rows = Array.isArray(offers) ? offers : []
  if (options?.hasRejectedApplication) return rows

  const acceptedCurrentOffers = rows.filter((offer) => trimOrNull(offer.accepted_at) && !trimOrNull(offer.superseded_at))
  if (acceptedCurrentOffers.length === 0) return rows

  const latestAcceptedOffer = [...acceptedCurrentOffers].sort(compareAcceptedOffersDesc)[0] ?? null
  return latestAcceptedOffer ? [latestAcceptedOffer] : rows
}
