"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"
import { GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO } from "@/lib/ads/googleAds"

const MIN_RESTSCHULD = 50_000
const MAX_RESTSCHULD = 1_000_000
const STEP_RESTSCHULD = 5_000
const DEFAULT_RESTSCHULD = 280_000

const FIXED_SOLLZINS = 3.29
const ZWEI_DRITTEL_SOLLZINS = 3.79
const ZINS_STAND = "März 2026"

const MIN_TILGUNG = 1
const MAX_TILGUNG = 5
const DEFAULT_TILGUNG = 2

const ZINSBINDUNG_OPTIONS = [5, 10, 15] as const
const DEFAULT_ZINSBINDUNG = 10

const MIN_FORWARD_MONATE = 0
const MAX_FORWARD_MONATE = 60
const DEFAULT_FORWARD_MONATE = 18

const MIN_FORWARD_AUFSCHLAG_MONAT = 0
const MAX_FORWARD_AUFSCHLAG_MONAT = 0.05
const DEFAULT_FORWARD_AUFSCHLAG_MONAT = 0.02

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatEUR(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
  }).format(value)
}

function formatPct(value: number, digits = 2) {
  return `${value.toFixed(digits).replace(".", ",")} %`
}

function formatSignedEUR(value: number, digits = 0) {
  const abs = formatEUR(Math.abs(value), digits)
  if (value === 0) return abs
  return `${value > 0 ? "+" : "-"}${abs}`
}

type Scenario = {
  monthlyRate: number
  remainingDebt: number
  totalInterest: number
}

type LeadFormState = {
  email: string
  phone: string
}

const INITIAL_LEAD_FORM: LeadFormState = {
  email: "",
  phone: "",
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function calculateScenario({
  principal,
  annualRatePct,
  tilgungPct,
  fixedYears,
}: {
  principal: number
  annualRatePct: number
  tilgungPct: number
  fixedYears: number
}): Scenario {
  const P = Math.max(0, principal)
  const annualRate = Math.max(0, annualRatePct) / 100
  const annualTilgung = Math.max(0, tilgungPct) / 100
  const n = Math.max(0, Math.round(fixedYears * 12))
  const monthlyRate = (P * (annualRate + annualTilgung)) / 12
  const monthlyRatePct = annualRate / 12

  let remainingDebt = P
  if (n > 0) {
    if (monthlyRatePct <= 0) {
      remainingDebt = Math.max(0, P - monthlyRate * n)
    } else {
      const growth = (1 + monthlyRatePct) ** n
      remainingDebt = Math.max(0, P * growth - monthlyRate * ((growth - 1) / monthlyRatePct))
    }
  }

  const totalPaid = monthlyRate * n
  const totalInterest = Math.max(0, totalPaid - (P - remainingDebt))

  return {
    monthlyRate,
    remainingDebt,
    totalInterest,
  }
}

export default function AnschlussfinanzierungRechner() {
  const router = useRouter()
  const [restschuld, setRestschuld] = useState(DEFAULT_RESTSCHULD)
  const [tilgung, setTilgung] = useState(DEFAULT_TILGUNG)
  const [zinsbindung, setZinsbindung] = useState<number>(DEFAULT_ZINSBINDUNG)
  const [forwardMonate, setForwardMonate] = useState(DEFAULT_FORWARD_MONATE)
  const [forwardAufschlagMonat, setForwardAufschlagMonat] = useState(DEFAULT_FORWARD_AUFSCHLAG_MONAT)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadForm, setLeadForm] = useState<LeadFormState>(INITIAL_LEAD_FORM)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [leadBusy, setLeadBusy] = useState(false)
  const [leadError, setLeadError] = useState<string | null>(null)

  const calc = useMemo(() => {
    const standard = calculateScenario({
      principal: restschuld,
      annualRatePct: FIXED_SOLLZINS,
      tilgungPct: tilgung,
      fixedYears: zinsbindung,
    })

    const forwardGesamtAufschlag = forwardMonate * forwardAufschlagMonat
    const forwardSollzins = FIXED_SOLLZINS + forwardGesamtAufschlag
    const forward = calculateScenario({
      principal: restschuld,
      annualRatePct: forwardSollzins,
      tilgungPct: tilgung,
      fixedYears: zinsbindung,
    })

    return {
      standard,
      forward,
      forwardGesamtAufschlag,
      forwardSollzins,
      deltaRate: forward.monthlyRate - standard.monthlyRate,
      deltaInterest: forward.totalInterest - standard.totalInterest,
      deltaRestschuld: forward.remainingDebt - standard.remainingDebt,
    }
  }, [forwardAufschlagMonat, forwardMonate, restschuld, tilgung, zinsbindung])

  function patchLead<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setLeadForm((prev) => ({ ...prev, [key]: value }))
  }

  function openLeadModal() {
    setLeadError(null)
    setPrivacyAccepted(false)
    setShowLeadModal(true)
  }

  function closeLeadModal() {
    if (leadBusy) return
    setShowLeadModal(false)
  }

  async function submitLead(event: FormEvent) {
    event.preventDefault()
    setLeadError(null)

    const email = leadForm.email.trim().toLowerCase()
    const phone = leadForm.phone.trim()

    if (!email || !phone) {
      setLeadError("Bitte E-Mail und Telefonnummer eingeben.")
      return
    }
    if (!isEmail(email)) {
      setLeadError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!isPhone(phone)) {
      setLeadError("Bitte eine gültige Telefonnummer eingeben.")
      return
    }
    if (!privacyAccepted) {
      setLeadError("Bitte Datenschutz akzeptieren.")
      return
    }

    const calculationSummary = [
      "Anschlussfinanzierungs-Rechnerdaten",
      `Restschuld ${formatEUR(restschuld)}`,
      `Zinsbindung ${zinsbindung} Jahre`,
      `Anfängliche Tilgung ${formatPct(tilgung)} p.a.`,
      `Forward-Vorlauf ${forwardMonate} Monate`,
      `Forward-Aufschlag je Monat ${formatPct(forwardAufschlagMonat)}`,
      `Gesamtaufschlag ${formatPct(calc.forwardGesamtAufschlag)}`,
      `Monatsrate ohne Forward ${formatEUR(calc.standard.monthlyRate)}`,
      `Monatsrate mit Forward ${formatEUR(calc.forward.monthlyRate)}`,
      `Mehrkosten Zinsbindung ${formatSignedEUR(calc.deltaInterest)}`,
      `Restschuld Delta ${formatSignedEUR(calc.deltaRestschuld)}`,
    ].join(" | ")

    setLeadBusy(true)
    try {
      const response = await fetch("/api/baufi/quick-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          consentAccepted: true,
          pagePath: "/baufinanzierung/anschlussfinanzierung",
          calculationSummary,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; leadId?: string | number; externalLeadId?: string | number; existingAccount?: boolean }
        | null
      if (!response.ok || !json?.ok) {
        setLeadError(json?.error || "Anfrage konnte nicht gesendet werden.")
        return
      }

      setLeadForm(INITIAL_LEAD_FORM)
      setShowLeadModal(false)

      const params = new URLSearchParams({
        source: "baufi",
        conversion: GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      if (json?.existingAccount) params.set("existing", "1")
      router.push(`/erfolgreich?${params.toString()}`)
    } catch {
      setLeadError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setLeadBusy(false)
    }
  }

  return (
    <section
      id="rechner"
      className="scroll-mt-24 rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_58px_rgba(15,23,42,0.10)] sm:p-7 lg:p-8"
    >
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Anschlussfinanzierungsrechner</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Monatsrate und Forward-Darlehen direkt vergleichen
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Der Rechner zeigt Ihnen für Ihre Restschuld die Auswirkungen auf Monatsrate, Zinskosten und Restschuld nach der
          Zinsbindung: einmal ohne Forward-Darlehen und einmal mit Forward-Aufschlag.
        </p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Repräsentatives Beispiel mit fest integriertem Bauzins von <span className="font-semibold">{formatPct(FIXED_SOLLZINS)}</span> (Stand {ZINS_STAND}).
          Final hängt der Zinssatz von Bank, Bonität, Objekt und Zeitpunkt ab. 2/3 der Kundinnen und Kunden erhalten eher einen Zinssatz von{" "}
          <span className="font-semibold">{formatPct(ZWEI_DRITTEL_SOLLZINS)}</span>.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Restschuld</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{formatEUR(restschuld)}</div>
            <input
              type="range"
              min={MIN_RESTSCHULD}
              max={MAX_RESTSCHULD}
              step={STEP_RESTSCHULD}
              value={restschuld}
              onChange={(event) =>
                setRestschuld(clamp(Number(event.target.value), MIN_RESTSCHULD, MAX_RESTSCHULD))
              }
              className="mt-3 h-2 w-full cursor-pointer accent-cyan-700"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{formatEUR(MIN_RESTSCHULD)}</span>
              <span>{formatEUR(MAX_RESTSCHULD)}</span>
            </div>
            <input
              type="number"
              min={MIN_RESTSCHULD}
              max={MAX_RESTSCHULD}
              step={STEP_RESTSCHULD}
              value={restschuld}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                setRestschuld(clamp(value, MIN_RESTSCHULD, MAX_RESTSCHULD))
              }}
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fest integrierter Bauzins p.a.</div>
              <div className="mt-2 flex h-11 items-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900">
                {formatPct(FIXED_SOLLZINS)} (Stand {ZINS_STAND})
              </div>
              <div className="mt-1 text-xs text-slate-600">Repräsentatives Beispiel, nicht verbindlich.</div>
            </div>
            <label className="block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Anfängliche Tilgung p.a.</div>
              <input
                type="number"
                min={MIN_TILGUNG}
                max={MAX_TILGUNG}
                step={0.05}
                value={tilgung}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (!Number.isFinite(value)) return
                  setTilgung(clamp(value, MIN_TILGUNG, MAX_TILGUNG))
                }}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Zinsbindung</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ZINSBINDUNG_OPTIONS.map((years) => (
                <button
                  key={years}
                  type="button"
                  onClick={() => setZinsbindung(years)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    zinsbindung === years
                      ? "border-cyan-700 bg-cyan-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {years} Jahre
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">Forward-Darlehen</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs text-slate-700">Vorlauf bis Auszahlung (Monate)</div>
                <input
                  type="number"
                  min={MIN_FORWARD_MONATE}
                  max={MAX_FORWARD_MONATE}
                  step={1}
                  value={forwardMonate}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    setForwardMonate(clamp(value, MIN_FORWARD_MONATE, MAX_FORWARD_MONATE))
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-700">Aufschlag pro Monat (Prozentpunkte)</div>
                <input
                  type="number"
                  min={MIN_FORWARD_AUFSCHLAG_MONAT}
                  max={MAX_FORWARD_AUFSCHLAG_MONAT}
                  step={0.005}
                  value={forwardAufschlagMonat}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    setForwardAufschlagMonat(clamp(value, MIN_FORWARD_AUFSCHLAG_MONAT, MAX_FORWARD_AUFSCHLAG_MONAT))
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-cyan-900">
              Gesamtaufschlag im Beispiel: <span className="font-semibold">{formatPct(calc.forwardGesamtAufschlag)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Ohne Forward-Darlehen</div>
            <div className="mt-1 text-xs text-slate-600">Sollzins: {formatPct(FIXED_SOLLZINS)} (Stand {ZINS_STAND})</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatEUR(calc.standard.monthlyRate)}</div>
            <div className="mt-1 text-xs text-slate-600">Monatsrate</div>
            <div className="mt-2 text-sm text-slate-700">
              Restschuld nach {zinsbindung} Jahren:{" "}
              <span className="font-semibold text-slate-900">{formatEUR(calc.standard.remainingDebt)}</span>
            </div>
            <div className="text-sm text-slate-700">
              Zinskosten in der Bindung:{" "}
              <span className="font-semibold text-slate-900">{formatEUR(calc.standard.totalInterest)}</span>
            </div>
          </article>

          <article className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-cyan-700">Mit Forward-Darlehen</div>
            <div className="mt-1 text-xs text-cyan-900">Effektiver Sollzins: {formatPct(calc.forwardSollzins)}</div>
            <div className="mt-2 text-2xl font-semibold text-cyan-900">{formatEUR(calc.forward.monthlyRate)}</div>
            <div className="mt-1 text-xs text-cyan-900">Monatsrate</div>
            <div className="mt-2 text-sm text-cyan-900">
              Restschuld nach {zinsbindung} Jahren:{" "}
              <span className="font-semibold">{formatEUR(calc.forward.remainingDebt)}</span>
            </div>
            <div className="text-sm text-cyan-900">
              Zinskosten in der Bindung: <span className="font-semibold">{formatEUR(calc.forward.totalInterest)}</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Direkter Vergleich</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Mehrrate / Monat</div>
                <div className="mt-1 font-semibold text-slate-900">{formatSignedEUR(calc.deltaRate, 2)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Mehr Zinskosten</div>
                <div className="mt-1 font-semibold text-slate-900">{formatSignedEUR(calc.deltaInterest)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Delta Restschuld</div>
                <div className="mt-1 font-semibold text-slate-900">{formatSignedEUR(calc.deltaRestschuld)}</div>
              </div>
            </div>
          </article>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={openLeadModal}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Mit diesen Daten anfragen
            </button>
            <Link
              href="#partnerbanken"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Partnerbanken ansehen
            </Link>
          </div>
        </div>
      </div>

      {showLeadModal ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_30px_90px_rgba(2,6,23,0.35)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Anfrage mit Rechnerdaten
                </div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                  Anschlussfinanzierung jetzt anfragen
                </h3>
                <p className="mt-1 text-sm text-slate-600">Ihre Rechnerwerte werden automatisch mitgesendet.</p>
              </div>
              <button
                type="button"
                onClick={closeLeadModal}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2">
                <span>Restschuld</span>
                <span className="font-semibold text-slate-900">{formatEUR(restschuld)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Zinsbindung</span>
                <span className="font-semibold text-slate-900">{zinsbindung} Jahre</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Monatsrate ohne Forward</span>
                <span className="font-semibold text-slate-900">{formatEUR(calc.standard.monthlyRate)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Monatsrate mit Forward</span>
                <span className="font-semibold text-slate-900">{formatEUR(calc.forward.monthlyRate)}</span>
              </div>
            </div>

            <form onSubmit={submitLead} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={(event) => patchLead("email", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Telefonnummer *</div>
                <input
                  value={leadForm.phone}
                  onChange={(event) => patchLead("phone", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                  required
                />
              </label>

              <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                  required
                />
                <span>
                  Ich stimme der Verarbeitung meiner Angaben gemäß Datenschutz zu.
                  {" "}
                  <Link href="/datenschutz" className="font-semibold underline underline-offset-2" target="_blank" rel="noreferrer">
                    Datenschutz
                  </Link>
                </span>
              </label>

              {leadError ? (
                <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {leadError}
                </div>
              ) : null}

              <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeLeadModal}
                  disabled={leadBusy}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={leadBusy}
                  className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {leadBusy ? "Sende Anfrage..." : "Anfrage senden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
