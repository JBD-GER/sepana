"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"

type Step = "start" | "details" | "contact" | "done"

type FormState = {
  financingNeed: number
  purpose: string
  propertyType: string
  firstName: string
  lastName: string
  email: string
  phone: string
  consentAccepted: boolean
  website: string
}

const MIN_AMOUNT = 50000
const MAX_AMOUNT = 2000000
const STEP_AMOUNT = 5000
const DEFAULT_AMOUNT = 350000

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gad_source",
  "gad_campaignid",
  "gbraid",
  "wbraid",
] as const

const PURPOSE_OPTIONS = [
  {
    id: "kauf",
    title: "Kauf",
    text: "Sie kaufen eine bestehende Immobilie.",
  },
  {
    id: "neubau",
    title: "Neubau",
    text: "Sie planen ein eigenes Bauvorhaben.",
  },
  {
    id: "umschuldung",
    title: "Umschuldung",
    text: "Sie wollen eine Anschlussfinanzierung prüfen.",
  },
  {
    id: "modernisierung",
    title: "Modernisierung",
    text: "Sie möchten Umbau oder Sanierung finanzieren.",
  },
] as const

const PROPERTY_TYPE_OPTIONS = [
  { id: "wohnung", title: "Wohnung" },
  { id: "haus", title: "Haus" },
  { id: "mehrfamilienhaus", title: "Mehrfamilienhaus" },
  { id: "grundstueck", title: "Grundstück" },
] as const

const QUICK_AMOUNTS = [200000, 300000, 400000, 600000, 800000]

const INITIAL_FORM: FormState = {
  financingNeed: DEFAULT_AMOUNT,
  purpose: PURPOSE_OPTIONS[0].id,
  propertyType: PROPERTY_TYPE_OPTIONS[0].id,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consentAccepted: false,
  website: "",
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function clampAmount(value: number) {
  return Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, Math.round(value / STEP_AMOUNT) * STEP_AMOUNT))
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function parseAmount(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  if (!Number.isFinite(num)) return null
  return num
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function StepMarker({ active, complete, number, label }: { active: boolean; complete: boolean; number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold",
          active && "border-slate-900 bg-slate-900 text-white",
          !active && complete && "border-emerald-300 bg-emerald-50 text-emerald-700",
          !active && !complete && "border-slate-300 bg-white text-slate-500"
        )}
      >
        {number}
      </div>
      <span className={cn("text-xs font-medium", active ? "text-slate-900" : "text-slate-500")}>{label}</span>
    </div>
  )
}

function OptionCard({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean
  title: string
  text?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3 text-left transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      {text ? <div className={cn("mt-1 text-xs", active ? "text-slate-200" : "text-slate-600")}>{text}</div> : null}
    </button>
  )
}

export default function BaufiLeadFunnel() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>("start")
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [amountInput, setAmountInput] = useState(() => formatAmount(DEFAULT_AMOUNT))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tracking = useMemo(() => {
    const payload: Record<string, string> = {}
    for (const key of TRACKING_KEYS) {
      const value = searchParams.get(key)
      if (!value) continue
      payload[key] = value
    }
    return payload
  }, [searchParams])

  const detailsStepActive = step === "details" || step === "contact" || step === "done"
  const contactStepActive = step === "contact" || step === "done"

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function applyAmount(nextAmount: number) {
    const clamped = clampAmount(nextAmount)
    patch("financingNeed", clamped)
    setAmountInput(formatAmount(clamped))
  }

  function goToDetails() {
    setError(null)
    setStep("details")
  }

  function goToContact() {
    setError(null)
    const parsed = parseAmount(amountInput)
    if (parsed === null) {
      setAmountInput(formatAmount(form.financingNeed))
    } else {
      applyAmount(parsed)
    }
    setStep("contact")
  }

  function goBackToDetails() {
    setError(null)
    setStep("details")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Bitte füllen Sie alle Pflichtfelder aus.")
      return
    }
    if (!isEmail(form.email)) {
      setError("Bitte geben Sie eine gültige E-Mail-Adresse ein.")
      return
    }
    if (!isPhone(form.phone)) {
      setError("Bitte geben Sie eine gültige Telefonnummer ein.")
      return
    }
    if (!form.consentAccepted) {
      setError("Bitte akzeptieren Sie den Datenschutz.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/baufi/lead-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          financingNeed: form.financingNeed,
          purpose: form.purpose,
          propertyType: form.propertyType,
          consentAccepted: form.consentAccepted,
          website: form.website,
          tracking,
        }),
      })

      const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !json?.ok) {
        setError(json?.error || "Anfrage konnte nicht gesendet werden.")
        return
      }

      setStep("done")
    } catch {
      setError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-white p-5 shadow-[0_24px_70px_rgba(2,6,23,0.12)] sm:p-8">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-emerald-200/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-4">
          <StepMarker active={step === "start"} complete={detailsStepActive} number={1} label="Start" />
          <StepMarker active={step === "details"} complete={contactStepActive} number={2} label="Finanzierungsbedarf" />
          <StepMarker active={step === "contact"} complete={step === "done"} number={3} label="Kontaktdaten" />
        </div>

        {step === "start" ? (
          <div className="mt-6">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Kostenlos & unverbindlich
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Kostenloses Angebot anfordern
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Starten Sie in unter zwei Minuten. Danach erhalten Sie eine erste Einschätzung und wir melden uns persönlich bei Ihnen.
            </p>

            <div className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">1. Bedarf erfassen</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">2. Daten bestätigen</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">3. Angebot erhalten</div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={goToDetails}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Kostenloses Angebot anfordern
              </button>
            </div>
          </div>
        ) : null}

        {step === "details" ? (
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Wie hoch ist Ihr Finanzierungsbedarf?</h3>
              <p className="mt-1 text-sm text-slate-600">Wählen Sie den voraussichtlichen Betrag. Sie können ihn später noch anpassen.</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Finanzierungsbedarf</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{formatAmount(form.financingNeed)}</div>

              <input
                type="range"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={STEP_AMOUNT}
                value={form.financingNeed}
                onChange={(e) => applyAmount(Number(e.target.value))}
                className="mt-4 h-2 w-full cursor-pointer accent-slate-900"
              />

              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{formatAmount(MIN_AMOUNT)}</span>
                <span>{formatAmount(MAX_AMOUNT)}</span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => applyAmount(amount)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm transition",
                      form.financingNeed === amount
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    {formatAmount(amount)}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600">Oder Betrag direkt eingeben</label>
                <input
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseAmount(amountInput)
                    if (parsed === null) {
                      setAmountInput(formatAmount(form.financingNeed))
                      return
                    }
                    applyAmount(parsed)
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Wofür ist die Finanzierung?</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PURPOSE_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    active={form.purpose === option.id}
                    title={option.title}
                    text={option.text}
                    onClick={() => patch("purpose", option.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Welche Immobilienart passt?</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.id}
                    active={form.propertyType === option.id}
                    title={option.title}
                    onClick={() => patch("propertyType", option.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep("start")}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={goToContact}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Weiter zu Kontaktdaten
              </button>
            </div>
          </div>
        ) : null}

        {step === "contact" ? (
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Fast geschafft: Ihre Kontaktdaten</h3>
              <p className="mt-1 text-sm text-slate-600">Nur die wichtigsten Angaben. Keine langen Formulare.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Vorname *</div>
                <input
                  value={form.firstName}
                  onChange={(e) => patch("firstName", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Nachname *</div>
                <input
                  value={form.lastName}
                  onChange={(e) => patch("lastName", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => patch("email", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Telefon *</div>
                <input
                  value={form.phone}
                  onChange={(e) => patch("phone", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </label>
            </div>

            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => patch("website", e.target.value)}
              className="hidden"
              aria-hidden
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Ihre Auswahl</div>
              <div className="mt-1">Finanzierungsbedarf: {formatAmount(form.financingNeed)}</div>
            </div>

            <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.consentAccepted}
                onChange={(e) => patch("consentAccepted", e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                required
              />
              <span>
                Ich stimme der Verarbeitung meiner Angaben zur Bearbeitung meiner Anfrage gemäß{" "}
                <Link href="/datenschutz" className="font-semibold underline underline-offset-2">
                  Datenschutz
                </Link>{" "}
                zu.
              </span>
            </label>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={goBackToDetails}
                disabled={busy}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sende Anfrage..." : "Kostenloses Angebot anfordern"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Erfolgreich</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Ihre Anfrage ist eingegangen</h3>
            <p className="mt-2 text-sm text-slate-700">
              Vielen Dank. Wir haben Ihnen eine Bestätigung per E-Mail gesendet und melden uns zeitnah mit den nächsten Schritten.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/baufinanzierung"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Zurück zur Baufinanzierung
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Zum Login
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
