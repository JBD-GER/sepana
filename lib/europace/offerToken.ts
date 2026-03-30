function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4
  if (padding === 0) return normalized
  return normalized.padEnd(normalized.length + (4 - padding), "=")
}

function decodeBase64Utf8(value: string) {
  const normalized = normalizeBase64(value)

  try {
    if (typeof globalThis.atob === "function") {
      const binary = globalThis.atob(normalized)
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    }
  } catch {
    // fall back to Buffer on the server
  }

  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf8")
    }
  } catch {
    return null
  }

  return null
}

function parseJson<T>(value: string | null | undefined) {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function extractEuropaceOfferRevision(angebotId: unknown) {
  const normalized = trimOrNull(angebotId)
  if (!normalized) return null

  const decodedOuter = decodeBase64Utf8(normalized)
  const outer = parseJson<{ token?: unknown }>(decodedOuter)

  const innerPayload =
    typeof outer?.token === "string"
      ? parseJson<{ vorgangsrevision?: unknown }>(outer.token)
      : parseJson<{ vorgangsrevision?: unknown }>(decodedOuter)

  const revision = Number(innerPayload?.vorgangsrevision)
  return Number.isFinite(revision) ? revision : null
}

export function compareEuropaceOfferRevisionsDesc(leftOfferId: unknown, rightOfferId: unknown) {
  const leftRevision = extractEuropaceOfferRevision(leftOfferId)
  const rightRevision = extractEuropaceOfferRevision(rightOfferId)

  if (leftRevision === null && rightRevision === null) return 0
  if (leftRevision === null) return 1
  if (rightRevision === null) return -1

  return rightRevision - leftRevision
}
