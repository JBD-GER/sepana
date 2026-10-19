/** Handoff stays in this tab; contact details never become URL parameters. */
const STORAGE_KEY = "sepana-onlinekredit-prefill-v1"
const MAX_AGE = 30 * 60 * 1000

export type OnlinekreditPrefill = {
  note?: string
  purpose?: string | null
  loanAmount?: string | number | null
  termMonths?: string | number | null
  primary?: Record<string, string | number | null | undefined>
  additional?: Record<string, string | number | boolean | null | undefined>
  hasCoApplicant?: boolean
}

export function startOnlinekreditApplication(data: OnlinekreditPrefill) {
  // If storage is unavailable, keep the form and let the customer retry.
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, at: Date.now(), data }))
  window.location.assign("/onlinekredit#onlinekredit-wizard")
}

export function readOnlinekreditPrefill(): OnlinekreditPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (saved.version !== 1 || !Number.isFinite(saved.at) || Date.now() - saved.at > MAX_AGE || !saved.data || typeof saved.data !== "object") {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return saved.data
  } catch { return null }
}

export function clearOnlinekreditPrefill() {
  try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* The request already succeeded. */ }
}

export function normalizeCreditPurpose(value: unknown) {
  const purpose = String(value ?? "").trim()
  if (purpose === "autokredit") return "auto"
  if (purpose === "renovierung") return "modernisierung"
  if (purpose === "moebel") return "sonstiges"
  return purpose || "freie_verwendung"
}
