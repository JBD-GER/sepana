function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

type EuropaceSyncEventRow = {
  operation?: string | null
  success?: boolean | null
  request_payload?: Record<string, unknown> | null
  response_payload?: Record<string, unknown> | null
}

function normalizeJobStatus(row: EuropaceSyncEventRow) {
  return trimOrNull(row.response_payload?.status) ?? trimOrNull((row.response_payload?.rawJob as { status?: unknown } | null)?.status)
}

function hasApplication(row: EuropaceSyncEventRow) {
  const explicit = row.response_payload?.hasApplication
  if (typeof explicit === "boolean") return explicit

  return Boolean(
    trimOrNull(row.response_payload?.antragsnummer) ||
      trimOrNull(row.response_payload?.produktanbieterantragsnummer) ||
      trimOrNull((row.response_payload?.rawJob as { antrag?: { antragsnummer?: unknown } } | null)?.antrag?.antragsnummer)
  )
}

function hasRejectedApplication(row: EuropaceSyncEventRow) {
  return row.response_payload?.hasRejectedApplication === true
}

function acceptedOfferIdForEvent(row: EuropaceSyncEventRow) {
  return trimOrNull(row.request_payload?.resolvedAngebotId) ?? trimOrNull(row.request_payload?.angebotId)
}

function acceptedJobIdForEvent(row: EuropaceSyncEventRow) {
  return trimOrNull(row.response_payload?.jobId)
}

function polledJobIdForEvent(row: EuropaceSyncEventRow) {
  return trimOrNull(row.request_payload?.jobId)
}

function isTechnicalAcceptanceFailure(row: EuropaceSyncEventRow) {
  const status = normalizeJobStatus(row)
  if (!status) return false
  if (hasRejectedApplication(row)) return false
  if (status === "FAILURE") return !hasApplication(row)
  if (status === "SUCCESS") return !hasApplication(row)
  return false
}

export function extractTechnicallyBlockedOfferIds(rows: EuropaceSyncEventRow[]) {
  const acceptedOfferIdsByJobId = new Map<string, string>()

  for (const row of rows) {
    if (row.operation !== "angebotAnnehmen" || row.success !== true) continue
    const offerId = acceptedOfferIdForEvent(row)
    const jobId = acceptedJobIdForEvent(row)
    if (!offerId || !jobId) continue
    acceptedOfferIdsByJobId.set(jobId, offerId)
  }

  const blockedOfferIds = new Set<string>()
  for (const row of rows) {
    if (row.operation !== "annahmeJob" || row.success !== true) continue
    if (!isTechnicalAcceptanceFailure(row)) continue
    const jobId = polledJobIdForEvent(row)
    if (!jobId) continue
    const offerId = acceptedOfferIdsByJobId.get(jobId)
    if (offerId) blockedOfferIds.add(offerId)
  }

  return Array.from(blockedOfferIds)
}
