"use client"

import Link from "next/link"
import { useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO } from "@/lib/ads/googleAds"

const APR_PERCENT = 5.99
const MIN_AMOUNT = 1000
const MAX_AMOUNT = 100000
const STEP_AMOUNT = 500
const DEFAULT_AMOUNT = 25000

const MIN_TERM = 12
const MAX_TERM = 120
const DEFAULT_TERM = 72
const QUICK_TERMS = [24, 36, 60, 84]

type LeadRequestFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const INITIAL_LEAD_REQUEST_FORM: LeadRequestFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatEUR(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
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

function monthlyPayment(principal: number, months: number, aprPercent: number) {
  const rateMonthly = aprPercent / 100 / 12
  if (rateMonthly <= 0) return principal / months
  return (principal * rateMonthly) / (1 - (1 + rateMonthly) ** -months)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

export default function PrivatkreditRateCalculator() {
  const router = useRouter()
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [termMonths, setTermMonths] = useState(DEFAULT_TERM)
  const [amountInput, setAmountInput] = useState(() => formatEUR(DEFAULT_AMOUNT))
  const [hasInteracted, setHasInteracted] = useState(false)

  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showPrivacyPreview, setShowPrivacyPreview] = useState(false)
  const [requestForm, setRequestForm] = useState<LeadRequestFormState>(INITIAL_LEAD_REQUEST_FORM)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const calc = useMemo(() => {
    const principal = Math.max(0, amount)
    const months = Math.max(1, termMonths)
    const monthly = monthlyPayment(principal, months, APR_PERCENT)
    const interestMonthly = principal * (APR_PERCENT / 100 / 12)
    const principalMonthly = Math.max(0, monthly - interestMonthly)
    const totalPayment = monthly * months
    const totalInterest = Math.max(0, totalPayment - principal)

    return {
      monthly,
      interestMonthly,
      principalMonthly,
      totalPayment,
      totalInterest,
    }
  }, [amount, termMonths])

  function applyAmount(nextAmount: number) {
    setHasInteracted(true)
    const value = clamp(Math.round(nextAmount / STEP_AMOUNT) * STEP_AMOUNT, MIN_AMOUNT, MAX_AMOUNT)
    setAmount(value)
    setAmountInput(formatEUR(value))
  }

  function patchRequest<K extends keyof LeadRequestFormState>(key: K, value: LeadRequestFormState[K]) {
    setRequestForm((prev) => ({ ...prev, [key]: value }))
  }

  function openRequestModal() {
    setRequestError(null)
    setRequestSuccess(false)
    setPrivacyAccepted(false)
    setShowPrivacyPreview(false)
    setShowRequestModal(true)
  }

  function closeRequestModal() {
    if (requestBusy) return
    setShowRequestModal(false)
    setShowPrivacyPreview(false)
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault()
    setRequestError(null)

    if (
      !requestForm.firstName.trim() ||
      !requestForm.lastName.trim() ||
      !requestForm.email.trim() ||
      !requestForm.phone.trim()
    ) {
      setRequestError("Bitte alle Pflichtfelder ausfüllen.")
      return
    }
    if (!isEmail(requestForm.email)) {
      setRequestError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!isPhone(requestForm.phone)) {
      setRequestError("Bitte eine gültige Telefonnummer eingeben.")
      return
    }
    if (!privacyAccepted) {
      setRequestError("Bitte Datenschutz akzeptieren.")
      return
    }

    const summary = [
      `Rechnerdaten Privatkredit: Betrag ${formatEUR(amount)}`,
      `Laufzeit ${termMonths} Monate`,
      `Beispielzins ${APR_PERCENT.toFixed(2).replace(".", ",")} % p.a.`,
      `Monatsrate ${formatEUR(calc.monthly)}`,
      `Zinsanteil Monat 1 ${formatEUR(calc.interestMonthly)}`,
      `Tilgungsanteil Monat 1 ${formatEUR(calc.principalMonthly)}`,
    ].join(" | ")

    setRequestBusy(true)
    try {
      const response = await fetch("/api/privatkredit/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestType: "contact",
          firstName: requestForm.firstName,
          lastName: requestForm.lastName,
          email: requestForm.email.trim().toLowerCase(),
          phone: requestForm.phone,
          loanAmount: amount,
          purpose: "freie_verwendung",
          message: summary,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; leadId?: string | number; externalLeadId?: string | number }
        | null
      if (!response.ok || !json?.ok) {
        setRequestError(json?.error || "Anfrage konnte nicht gesendet werden.")
        return
      }

      const params = new URLSearchParams({
        source: "privatkredit",
        conversion: GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      router.push(`/erfolgreich?${params.toString()}`)
      return
    } catch {
      setRequestError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setRequestBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ratenrechner</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Ratenkredit-Rechner mit 5,99 % p.a.</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Sie sehen direkt die geschätzte Monatsrate sowie Zins- und Tilgungsanteil. Die Laufzeit können Sie in Monaten anpassen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kreditbetrag</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{formatEUR(amount)}</div>
          </div>

          <input
            type="range"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={STEP_AMOUNT}
            value={amount}
            onChange={(e) => applyAmount(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-slate-900"
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{formatEUR(MIN_AMOUNT)}</span>
            <span>{formatEUR(MAX_AMOUNT)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Oder Betrag direkt eingeben</label>
            <input
              value={amountInput}
              onChange={(e) => {
                setHasInteracted(true)
                setAmountInput(e.target.value)
              }}
              onBlur={() => {
                const parsed = parseAmount(amountInput)
                if (parsed === null) {
                  setAmountInput(formatEUR(amount))
                  return
                }
                applyAmount(parsed)
              }}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Laufzeit (Monate)</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{termMonths} Monate</div>
            <input
              type="range"
              min={MIN_TERM}
              max={MAX_TERM}
              step={1}
              value={termMonths}
              onChange={(e) => {
                setHasInteracted(true)
                setTermMonths(clamp(Number(e.target.value), MIN_TERM, MAX_TERM))
              }}
              className="mt-3 h-2 w-full cursor-pointer accent-slate-900"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{MIN_TERM} Monate</span>
              <span>{MAX_TERM} Monate</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_TERMS.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => {
                    setHasInteracted(true)
                    setTermMonths(months)
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    termMonths === months
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {months}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Monatsrate</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{formatEUR(calc.monthly)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Zinsanteil (Monat 1)</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(calc.interestMonthly)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Tilgungsanteil (Monat 1)</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(calc.principalMonthly)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Gesamtrückzahlung</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(calc.totalPayment)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Gesamtzinskosten</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(calc.totalInterest)}</div>
          </div>

          <p className="pt-1 text-xs text-slate-500">
            Hinweis: Beispielrechnung mit festem Sollzins von {APR_PERCENT.toFixed(2).replace(".", ",")} % p.a. Bonität und Anbieter können die finale Rate verändern.
          </p>

          {hasInteracted ? (
            <button
              type="button"
              onClick={openRequestModal}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Jetzt anfragen
            </button>
          ) : null}
        </div>
      </div>

      {showRequestModal ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_30px_90px_rgba(2,6,23,0.35)] sm:p-6">
            {!requestSuccess ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Anfrageübersicht</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Jetzt anfragen</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Prüfen Sie kurz Ihre Eingaben und ergänzen Sie Ihre Kontaktdaten.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    Schließen
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Kreditbetrag</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(amount)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Laufzeit</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{termMonths} Monate</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Monatsrate</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{formatEUR(calc.monthly)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Beispielzins</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {APR_PERCENT.toFixed(2).replace(".", ",")} % p.a.
                    </div>
                  </div>
                </div>

                <form onSubmit={submitRequest} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Vorname *</div>
                    <input
                      value={requestForm.firstName}
                      onChange={(e) => patchRequest("firstName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Nachname *</div>
                    <input
                      value={requestForm.lastName}
                      onChange={(e) => patchRequest("lastName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
                    <input
                      type="email"
                      value={requestForm.email}
                      onChange={(e) => patchRequest("email", e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Telefon *</div>
                    <input
                      value={requestForm.phone}
                      onChange={(e) => patchRequest("phone", e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      required
                    />
                  </label>

                  <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                      required
                    />
                    <span>
                      Ich stimme der Verarbeitung meiner Angaben gemäß Datenschutz zu.{' '}
                      <button
                        type="button"
                        onClick={() => setShowPrivacyPreview(true)}
                        className="font-semibold underline underline-offset-2"
                      >
                        Vorschau öffnen
                      </button>
                    </span>
                  </label>

                  {requestError ? (
                    <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {requestError}
                    </div>
                  ) : null}

                  <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeRequestModal}
                      disabled={requestBusy}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={requestBusy}
                      className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestBusy ? "Sende Anfrage..." : "Anfrage senden"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Erfolgreich</div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Ihre Anfrage ist eingegangen</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Vielen Dank. Wir haben Ihre Angaben erhalten und eine Bestätigung per E-Mail versendet.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            )}
          </div>

          {showPrivacyPreview ? (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-4">
              <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Datenschutz</div>
                    <h4 className="mt-1 text-lg font-semibold text-slate-900">Kurze Vorschau</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyPreview(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    Schließen
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>Wir verwenden Ihre Angaben ausschließlich zur Bearbeitung Ihrer Kreditanfrage.</p>
                  <p>Ihre Daten werden nicht für Werbezwecke an Dritte verkauft.</p>
                  <p>Sie können Auskunft, Korrektur oder Löschung Ihrer Daten jederzeit anfordern.</p>
                </div>

                <div className="mt-4">
                  <Link
                    href="/datenschutz"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Vollständige Datenschutzerklärung öffnen
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
