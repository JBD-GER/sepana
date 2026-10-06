"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { CONSENT_UPDATED_EVENT, OPEN_CONSENT_EVENT } from "./consent-events"

import {
  applyConsentUpdate,
  CONSENT_KEY,
  DEFAULT_PREFERENCES,
  parseStoredConsent,
  readStoredConsentRaw,
  type ConsentPreferences,
  type StoredConsent,
} from "@/lib/ads/consent"

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

export default function ConsentBanner({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false)
  const storedConsentRaw = useSyncExternalStore(subscribeConsent, readStoredConsentRaw, () => null)
  const storedConsent = useMemo(() => parseStoredConsent(storedConsentRaw), [storedConsentRaw])
  const [preferences, setPreferences] = useState<ConsentPreferences>(DEFAULT_PREFERENCES)
  const [showSettings, setShowSettings] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const blockingMode = hydrated && storedConsent === null
  // Legal information must remain readable before a visitor decides.
  const legalPage = pathname === "/datenschutz" || pathname === "/impressum" || pathname === "/agb"
  const open = hydrated && (manageOpen || (blockingMode && !legalPage))

  useEffect(() => {
    // The default belongs in the root bootstrap, once per document.
    applyConsentUpdate(storedConsent ?? DEFAULT_PREFERENCES)
  }, [storedConsent])

  useEffect(() => {
    if (!open || (compact && !showSettings)) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, compact, showSettings])

  useEffect(() => {
    if (!open) return
    const panel = dialogRef.current
    if (!panel) return
    const previousFocus = document.activeElement as HTMLElement | null
    const background: Array<{ element: HTMLElement; inert: boolean }> = []
    let branch: HTMLElement = panel
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    panel.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        if (!blockingMode) { setManageOpen(false); setShowSettings(false) }
      }
      if (event.key !== "Tab") return
      const controls = Array.from(panel!.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]')).filter(element => element.offsetParent !== null)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) { event.preventDefault(); panel!.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus() }
    }
    panel.addEventListener("keydown", onKey)
    return () => {
      panel.removeEventListener("keydown", onKey)
      for (const item of background) item.element.inert = item.inert
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, blockingMode, showSettings])

  useEffect(() => {
    const handleOpenSettings = () => {
      const latest = parseStoredConsent(readStoredConsentRaw())
      setPreferences(latest ? latest : DEFAULT_PREFERENCES)
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
    // Update immediately, before subscribers can load a tag or send an event.
    applyConsentUpdate(nextPreferences)
    window.dispatchEvent(new Event(CONSENT_UPDATED_EVENT))
    setPreferences(nextPreferences)
    setShowSettings(false)
    setManageOpen(false)
  }

  if (!open) return null

  if (compact && !showSettings) return (
    <section aria-label="Cookie-Einstellungen" className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_30px_rgba(10,35,66,0.1)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="max-w-lg"><p className="text-sm font-semibold text-[#0a2342]">Deine Privatsphäre. Deine Entscheidung.</p><p className="mt-1 text-xs leading-relaxed text-slate-600">Optionale Cookies helfen uns, Werbung und Nutzung zu messen. Du kannst sie ablehnen und den Vergleich trotzdem nutzen. <Link href="/datenschutz" className="underline">Datenschutz</Link></p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => saveDecision(DEFAULT_PREFERENCES)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-[#0a2342]">Alle optionalen Cookies ablehnen</button>
          <button type="button" onClick={() => setShowSettings(true)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-[#0a2342]">Einstellungen</button>
          <button type="button" onClick={() => saveDecision({ analytics: true, marketing: true, personalization: true })} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-[#0a2342]">Alle Cookies akzeptieren</button>
        </div>
      </div>
    </section>
  )

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-description" tabIndex={-1} className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(2,6,23,0.35)] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ihre Privatsphäre</div>
            <h2 id="consent-title" className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">Deine Cookie-Einstellungen</h2>
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
              Schließen
            </button>
          ) : null}
        </div>

        <p id="consent-description" className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
          Mit deiner Zustimmung helfen uns optionale Cookies, unsere Website und Werbung zu verbessern. Wähle,
          welche Kategorien du erlauben möchtest. Du kannst alle optionalen Cookies akzeptieren, ablehnen oder
          individuell einstellen.
        </p>

        {showSettings ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          Details finden Sie in unserer{" "}
          <Link href="/datenschutz" className="font-semibold text-slate-900 underline underline-offset-2">
            Datenschutzerklärung
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
        </div> : null}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notwendige Cookies</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Diese Cookies sind für Sicherheit, Login und technische Kernfunktionen erforderlich.
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
              description="Erlaubt Conversion-Messung und Werbe-Attribution, z. B. für Google Ads."
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
