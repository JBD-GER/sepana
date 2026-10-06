export const CONSENT_KEY = "sepana_consent_v2"
export const CONSENT_UPDATED_EVENT = "sepana:consent-updated"

export type ConsentPreferences = { analytics: boolean; marketing: boolean; personalization: boolean }
export type StoredConsent = ConsentPreferences & { version: 2; updatedAt: string }
export const DEFAULT_PREFERENCES: ConsentPreferences = { analytics: false, marketing: false, personalization: false }

export function parseStoredConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null
  if (raw === "accepted" || raw === "declined") {
    const granted = raw === "accepted"
    return { version: 2, updatedAt: new Date(0).toISOString(), analytics: granted, marketing: granted, personalization: granted }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null
    if (parsed?.version !== 2 || typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean" || typeof parsed.personalization !== "boolean") return null
    return { version: 2, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(), analytics: parsed.analytics, marketing: parsed.marketing, personalization: parsed.personalization }
  } catch { return null }
}

export function readStoredConsentRaw(): string | null {
  if (typeof window === "undefined") return null
  try { return window.localStorage.getItem(CONSENT_KEY) } catch { return null }
}

export function toConsentPayload(preferences: ConsentPreferences) {
  return {
    ad_storage: preferences.marketing ? "granted" : "denied",
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_user_data: preferences.marketing ? "granted" : "denied",
    ad_personalization: preferences.marketing && preferences.personalization ? "granted" : "denied",
    personalization_storage: preferences.personalization ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  }
}

export function applyConsentUpdate(preferences: ConsentPreferences) {
  if (typeof window === "undefined") return
  const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
  win.dataLayer ??= []
  win.gtag ??= function (...args) { win.dataLayer!.push(args) }
  win.gtag("consent", "update", toConsentPayload(preferences))
}

export function applyStoredConsentUpdate() {
  applyConsentUpdate(parseStoredConsent(readStoredConsentRaw()) ?? DEFAULT_PREFERENCES)
}

export function hasMarketingConsent() {
  return parseStoredConsent(readStoredConsentRaw())?.marketing === true
}

export function subscribeMarketingConsent(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener(CONSENT_UPDATED_EVENT, listener)
  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(CONSENT_UPDATED_EVENT, listener)
  }
}
