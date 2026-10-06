export const CONSENT_KEY = "sepana_consent_v2"
export const CONSENT_UPDATED_EVENT = "sepana:consent-updated"

export function hasMarketingConsent() {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (raw === "accepted") return true
    const stored = JSON.parse(raw || "null")
    return stored?.version === 2 && stored.marketing === true
  } catch { return false }
}

export function subscribeMarketingConsent(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener(CONSENT_UPDATED_EVENT, listener)
  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(CONSENT_UPDATED_EVENT, listener)
  }
}
