"use client"

import { startOnlinekreditApplication } from "@/lib/onlinekredit/prefill"

import CreditoloNotice from "@/components/creditolo/CreditoloNotice"

import { useMemo, useState, type FormEvent } from "react"
import { getPrivatkreditPurposeLabel, PRIVATKREDIT_PURPOSE_OPTIONS } from "@/lib/privatkredit/purposes"

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  loanAmount: string
  purpose: string
  callbackTime: string
  message: string
  privacyAccepted: boolean
}

const DEFAULT_FORM_STATE: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  loanAmount: "",
  purpose: "freie_verwendung",
  callbackTime: "",
  message: "",
  privacyAccepted: false,
}

type PrivatkreditContactFormProps = {
  eyebrow?: string
  title?: string
  description?: string
  submitLabel?: string
  initialPurpose?: string
  lockPurpose?: boolean
  successSource?: string
  pagePath?: string
  continuePathBase?: string | null
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function createInitialState(initialPurpose: string): FormState {
  return {
    ...DEFAULT_FORM_STATE,
    purpose: initialPurpose || DEFAULT_FORM_STATE.purpose,
  }
}

export default function PrivatkreditContactForm({
  eyebrow = "Sichere Anfrage",
  title = "Persönliche Kreditanfrage starten",
  description = "Starten Sie mit Ihren Kontaktdaten. Im nächsten Schritt ergänzen Sie alle Pflichtangaben. Erst danach wird Ihre Kreditanfrage an Creditolo gesendet.",
  initialPurpose = "freie_verwendung",
  lockPurpose = false,
}: PrivatkreditContactFormProps) {
  const initialState = useMemo(() => createInitialState(initialPurpose), [initialPurpose])
  const [form, setForm] = useState<FormState>(initialState)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lockedPurposeLabel = useMemo(() => getPrivatkreditPurposeLabel(initialPurpose), [initialPurpose])

  const amountHint = useMemo(() => {
    const cleaned = form.loanAmount.replace(/[^\d,.-]/g, "")
    if (!cleaned) return null
    if (cleaned.includes(",")) {
      const n = Number(cleaned.replace(/\./g, "").replace(",", "."))
      return Number.isFinite(n) ? n : null
    }
    const n = Number(cleaned.replace(/\./g, ""))
    return Number.isFinite(n) ? n : null
  }, [form.loanAmount])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Bitte alle Pflichtfelder ausfüllen.")
      return
    }
    if (!isEmail(form.email)) {
      setError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!form.privacyAccepted) {
      setError("Bitte Datenschutz akzeptieren.")
      return
    }

    setBusy(true)
    try {
      startOnlinekreditApplication({purpose: form.purpose, loanAmount: amountHint,
        primary: {first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone},
        note: [form.callbackTime ? `Beste Erreichbarkeit: ${form.callbackTime}` : "", form.message].filter(Boolean).join("\n")})
    } catch { setError("Der Antrag konnte nicht geöffnet werden. Bitte Browser-Speicher erlauben und erneut versuchen.") }
    finally { setBusy(false) }
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-14 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-14 -bottom-16 h-44 w-44 rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative">
        {eyebrow ? (
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {eyebrow}
          </div>
        ) : null}
        {title ? <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2> : null}
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">{description}</p> : null}

        <form onSubmit={submit} className={`${eyebrow || title || description ? "mt-6" : ""} grid gap-3 sm:grid-cols-2`}>
        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Vorname *</div>
          <input
            value={form.firstName}
            onChange={(e) => patch("firstName", e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            required
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Nachname *</div>
          <input
            value={form.lastName}
            onChange={(e) => patch("lastName", e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            required
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
          <input
            type="email"
            value={form.email}
            onChange={(e) => patch("email", e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            required
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Telefon *</div>
          <input
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            required
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Gewünschte Kreditsumme</div>
          <input
            value={form.loanAmount}
            onChange={(e) => patch("loanAmount", e.target.value)}
            placeholder="z. B. 25.000"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
          />
          {amountHint !== null ? (
            <div className="mt-1 text-xs text-slate-500">
              Erkannt:{" "}
              {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
                amountHint
              )}
            </div>
          ) : null}
        </label>

        {lockPurpose ? (
          <div className="block">
            <div className="mb-1 text-xs font-medium text-slate-700">Verwendungszweck</div>
            <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800">
              {lockedPurposeLabel}
            </div>
          </div>
        ) : (
          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-700">Verwendungszweck</div>
            <select
              value={form.purpose}
              onChange={(e) => patch("purpose", e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            >
              {PRIVATKREDIT_PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block sm:col-span-2">
          <div className="mb-1 text-xs font-medium text-slate-700">Beste Erreichbarkeit</div>
          <input
            value={form.callbackTime}
            onChange={(e) => patch("callbackTime", e.target.value)}
            placeholder="z. B. werktags 17:00-19:00 Uhr"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <div className="mb-1 text-xs font-medium text-slate-700">Nachricht</div>
          <textarea
            value={form.message}
            onChange={(e) => patch("message", e.target.value)}
            rows={4}
            placeholder="Optional: kurze Infos zur Anfrage"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
          />
        </label>

        <label className="sm:col-span-2 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={form.privacyAccepted}
            onChange={(e) => patch("privacyAccepted", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
            required
          />
          <span>
            Ich stimme der Verarbeitung meiner Angaben zur Bearbeitung meiner Anfrage gemäß Datenschutz zu.
          </span>
        </label>

        {error ? (
          <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-900 px-5 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Antrag wird geöffnet..." : "Weiter zum vollständigen Kreditantrag"}
          </button>
        </div>
        <div className="sm:col-span-2"><CreditoloNotice /></div>
        </form>
      </div>
    </section>
  )
}

