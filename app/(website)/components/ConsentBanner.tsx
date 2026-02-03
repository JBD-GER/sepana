"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { CONSENT_UPDATED_EVENT, OPEN_CONSENT_EVENT } from "./consent-events"

const CONSENT_KEY = "sepana_consent_v2"

type ConsentState = "granted" | "denied"

type ConsentPreferences = {
  analytics: boolean
  marketing: boolean
  personalization: boolean
}

type StoredConsent = ConsentPreferences & {
  version: 2
  updatedAt: string
}

type ConsentPayload = {
  ad_storage: ConsentState
  analytics_storage: ConsentState
  ad_user_data: ConsentState
  ad_personalization: ConsentState
  personalization_storage: ConsentState
  functionality_storage: ConsentState
  security_storage: ConsentState
  wait_for_update?: number
}

type Gtag = (command: "consent", action: "default" | "update", params: ConsentPayload) => void

type BrowserWindow = Window & {
  dataLayer?: unknown[]
  gtag?: Gtag
}

const DEFAULT_PREFERENCES: ConsentPreferences = {
  analytics: false,
  marketing: false,
  personalization: false,
}

function extractPreferences(consent: StoredConsent): ConsentPreferences {
  return {
    analytics: consent.analytics,
    marketing: consent.marketing,
    personalization: consent.personalization,
  }
}

function parseStoredConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null

  if (raw === "accepted") {
    return {
      version: 2,
      updatedAt: new Date(0).toISOString(),
      analytics: true,
      marketing: true,
      personalization: true,
    }
  }

  if (raw === "declined") {
    return {
      version: 2,
      updatedAt: new Date(0).toISOString(),
      ...DEFAULT_PREFERENCES,
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    if (
      parsed.version === 2 &&
      typeof parsed.analytics === "boolean" &&
      typeof parsed.marketing === "boolean" &&
      typeof parsed.personalization === "boolean"
    ) {
      return {
        version: 2,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        personalization: parsed.personalization,
      }
    }
  } catch {
    return null
  }

  return null
}

function readStoredConsentRaw(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

function subscribeHydration(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const id = window.setTimeout(onStoreChange, 0)
  return () => window.clearTimeout(id)
}

function subscribeConsent(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}

  const handleChange = () => onStoreChange()
  window.addEventListener("storage", handleChange)
  window.addEventListener(CONSENT_UPDATED_EVENT, handleChange)

  return () => {
    window.removeEventListener("storage", handleChange)
    window.removeEventListener(CONSENT_UPDATED_EVENT, handleChange)
  }
}

function ensureGtag(win: BrowserWindow): Gtag {
  if (!Array.isArray(win.dataLayer)) {
    win.dataLayer = []
  }

  if (typeof win.gtag !== "function") {
    win.gtag = ((...args: Parameters<Gtag>) => {
      win.dataLayer!.push(args)
    }) as Gtag
  }

  return win.gtag
}

function toConsentPayload(preferences: ConsentPreferences | null): ConsentPayload {
  if (!preferences) {
    return {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      personalization_storage: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    }
  }

  const adPersonalizationGranted = preferences.marketing && preferences.personalization

  return {
    ad_storage: preferences.marketing ? "granted" : "denied",
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_user_data: preferences.marketing ? "granted" : "denied",
    ad_personalization: adPersonalizationGranted ? "granted" : "denied",
    personalization_storage: preferences.personalization ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  }
}

function applyConsentMode(action: "default" | "update", preferences: ConsentPreferences | null) {
  if (typeof window === "undefined") return

  const win = window as BrowserWindow
  const gtag = ensureGtag(win)
  const payload = toConsentPayload(preferences)

  if (action === "default") {
    gtag("consent", "default", { ...payload, wait_for_update: 500 })
    return
  }

  gtag("consent", "update", payload)
}

function ToggleCard({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={onToggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
            checked ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-slate-100"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
          <span className="sr-only">{title}</span>
        </button>
      </div>
    </div>
  )
}

export default function ConsentBanner() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false)
  const storedConsentRaw = useSyncExternalStore(subscribeConsent, readStoredConsentRaw, () => null)
  const storedConsent = useMemo(() => parseStoredConsent(storedConsentRaw), [storedConsentRaw])
  const [preferences, setPreferences] = useState<ConsentPreferences>(DEFAULT_PREFERENCES)
  const [showSettings, setShowSettings] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const blockingMode = hydrated && storedConsent === null
  const open = hydrated && (blockingMode || manageOpen)

  useEffect(() => {
    applyConsentMode("default", null)
  }, [])

  useEffect(() => {
    if (!storedConsent) return
    applyConsentMode("update", extractPreferences(storedConsent))
  }, [storedConsent])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    const handleOpenSettings = () => {
      const latest = parseStoredConsent(readStoredConsentRaw())
      setPreferences(latest ? extractPreferences(latest) : DEFAULT_PREFERENCES)
      setShowSettings(true)
      setManageOpen(true)
    }

    window.addEventListener(OPEN_CONSENT_EVENT, handleOpenSettings)
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, handleOpenSettings)
    }
  }, [])

  function saveDecision(nextPreferences: ConsentPreferences) {
    const nextConsent: StoredConsent = {
      version: 2,
      updatedAt: new Date().toISOString(),
      analytics: nextPreferences.analytics,
      marketing: nextPreferences.marketing,
      personalization: nextPreferences.personalization,
    }

    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(nextConsent))
    } catch {
      // ignore storage errors
    }

    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify(nextConsent))}; Path=/; Max-Age=31536000; SameSite=Lax`
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT))
    setPreferences(nextPreferences)
    setShowSettings(false)
    setManageOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center sm:p-6">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(2,6,23,0.35)] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Consent Mode v2</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">Cookie-Einstellungen</h2>
          </div>
          {!blockingMode ? (
            <button
              type="button"
              onClick={() => {
                setManageOpen(false)
                setShowSettings(false)
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Schliessen
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Wir nutzen optionale Cookies fuer Analyse, Marketing und Personalisierung. Sie koennen alle optionalen
          Kategorien ablehnen, akzeptieren oder individuell einstellen.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Details finden Sie in unserer{" "}
          <Link href="/datenschutz" className="font-semibold text-slate-900 underline underline-offset-2">
            Datenschutzerklaerung
          </Link>
          , im{" "}
          <Link href="/impressum" className="font-semibold text-slate-900 underline underline-offset-2">
            Impressum
          </Link>{" "}
          und in den{" "}
          <Link href="/agb" className="font-semibold text-slate-900 underline underline-offset-2">
            AGB
          </Link>
          .
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notwendige Cookies</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Diese Cookies sind fuer Sicherheit, Login und technische Kernfunktionen erforderlich.
              </p>
            </div>
            <span className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-slate-100 px-3 text-xs font-semibold text-slate-700">
              Immer aktiv
            </span>
          </div>
        </div>

        {showSettings ? (
          <div className="mt-3 space-y-3">
            <ToggleCard
              title="Analyse"
              description="Hilft uns, Nutzungsmuster zu verstehen und den Funnel zu optimieren."
              checked={preferences.analytics}
              onToggle={() => setPreferences((prev) => ({ ...prev, analytics: !prev.analytics }))}
            />
            <ToggleCard
              title="Marketing"
              description="Erlaubt Conversion-Messung und Werbe-Attribution, z. B. fuer Google Ads."
              checked={preferences.marketing}
              onToggle={() => setPreferences((prev) => ({ ...prev, marketing: !prev.marketing }))}
            />
            <ToggleCard
              title="Personalisierung"
              description="Steuert personalisierte Inhalte und, falls Marketing aktiv ist, personalisierte Anzeigen."
              checked={preferences.personalization}
              onToggle={() => setPreferences((prev) => ({ ...prev, personalization: !prev.personalization }))}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Auswahl anpassen
          </button>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => saveDecision(DEFAULT_PREFERENCES)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Alle optionalen Cookies ablehnen
          </button>
          {showSettings ? (
            <button
              type="button"
              onClick={() => saveDecision(preferences)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-400 bg-slate-100 px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Auswahl speichern
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Einstellungen
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              saveDecision({
                analytics: true,
                marketing: true,
                personalization: true,
              })
            }
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Alle Cookies akzeptieren
          </button>
        </div>
      </div>
    </div>
  )
}
