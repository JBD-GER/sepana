function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export function normalizePhoneForProviders(value: unknown) {
  const raw = trimOrNull(value)
  if (!raw) return null

  let normalized = raw.replace(/[^\d+]/g, "")
  if (!normalized) return null

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`
  }

  if (normalized.startsWith("+49")) {
    const national = normalized.slice(3)
    return national ? `0${national}` : null
  }

  if (!normalized.startsWith("+") && !normalized.startsWith("0") && normalized.startsWith("49")) {
    const national = normalized.slice(2)
    return national ? `0${national}` : null
  }

  return normalized
}
