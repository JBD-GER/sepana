"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type FormEvent } from "react"
import { GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO } from "@/lib/ads/googleAds"

const MIN_LOAN_AMOUNT = 10000
const MAX_LOAN_AMOUNT = 250000
const STEP_LOAN_AMOUNT = 500
const DEFAULT_LOAN_AMOUNT = 25000

const MIN_TERM_YEARS = 5
const MAX_TERM_YEARS = 20
const DEFAULT_TERM_YEARS = 20
const QUICK_TERMS = [10, 12, 15, 20]

const MIN_APR = 3.27
const MAX_APR = 9.99
const DEFAULT_APR = 3.8

const MIN_CONSUMPTION_KWH = 1000
const MAX_CONSUMPTION_KWH = 20000
const STEP_CONSUMPTION_KWH = 100
const DEFAULT_CONSUMPTION_KWH = 4500

const MIN_FEED_IN_KWH = 0
const MAX_FEED_IN_KWH = 22000
const STEP_FEED_IN_KWH = 100
const DEFAULT_FEED_IN_KWH = 3000

const STROMPREIS_EUR_PER_KWH = 0.62
const FIXED_SELF_CONSUMPTION_SHARE = 0.95
const FIXED_EEG_EUR_PER_KWH = 0.18
const TURBO_BENEFIT_MULTIPLIER = 1.6
const TURBO_RATE_RELIEF_FACTOR = 0.68
const TURBO_FIXED_MONTHLY_BONUS = 120
const TARGET_CASHFLOW_BUFFER = 30

type LeadFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

const INITIAL_LEAD_FORM: LeadFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
}

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

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")} %`
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

function parseInteger(value: string) {
  const raw = String(value ?? "").trim().replace(/[^\d]/g, "")
  if (!raw) return null
  const num = Number(raw)
  if (!Number.isFinite(num)) return null
  return Math.round(num)
}

function monthlyPayment(principal: number, months: number, aprPercent: number) {
  const rateMonthly = aprPercent / 100 / 12
  if (rateMonthly <= 0) return principal / months
  return (principal * rateMonthly) / (1 - (1 + rateMonthly) ** -months)
}

function findShortestPositiveTermYears(
  principal: number,
  aprPercent: number,
  benefitMonthly: number,
  minYears: number,
  maxYears: number,
  rateReliefFactor: number,
  targetBuffer: number,
) {
  for (let years = minYears; years <= maxYears; years += 1) {
    const rawRate = monthlyPayment(principal, years * 12, aprPercent)
    const optimizedRate = rawRate * rateReliefFactor
    if (benefitMonthly - optimizedRate >= targetBuffer) return years
  }
  return null
}

function addMonths(base: Date, months: number) {
  const result = new Date(base)
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  return result
}

function formatMonthYear(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(value)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function formatKwh(value: number) {
  return new Intl.NumberFormat("de-DE").format(value)
}

export default function PvCashflowCalculator() {
  const router = useRouter()
  const [loanAmount, setLoanAmount] = useState(DEFAULT_LOAN_AMOUNT)
  const [loanAmountInput, setLoanAmountInput] = useState(() => formatEUR(DEFAULT_LOAN_AMOUNT))
  const [termYears, setTermYears] = useState(DEFAULT_TERM_YEARS)
  const [apr, setApr] = useState(DEFAULT_APR)

  const [annualConsumptionKwh, setAnnualConsumptionKwh] = useState(DEFAULT_CONSUMPTION_KWH)
  const [annualConsumptionInput, setAnnualConsumptionInput] = useState(String(DEFAULT_CONSUMPTION_KWH))
  const [annualFeedInKwh, setAnnualFeedInKwh] = useState(DEFAULT_FEED_IN_KWH)
  const [annualFeedInInput, setAnnualFeedInInput] = useState(String(DEFAULT_FEED_IN_KWH))

  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadForm, setLeadForm] = useState<LeadFormState>(INITIAL_LEAD_FORM)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [leadBusy, setLeadBusy] = useState(false)
  const [leadError, setLeadError] = useState<string | null>(null)

  const calc = useMemo(() => {
    const months = termYears * 12
    const rawRate = monthlyPayment(loanAmount, months, apr)
    const rate = rawRate * TURBO_RATE_RELIEF_FACTOR
    const totalPayment = rawRate * months
    const totalInterest = Math.max(0, totalPayment - loanAmount)

    const rawMonthlySavings = (annualConsumptionKwh * FIXED_SELF_CONSUMPTION_SHARE * STROMPREIS_EUR_PER_KWH) / 12
    const rawMonthlyFeedIn = (annualFeedInKwh * FIXED_EEG_EUR_PER_KWH) / 12
    const monthlySavings = rawMonthlySavings * TURBO_BENEFIT_MULTIPLIER
    const monthlyFeedIn = rawMonthlyFeedIn * TURBO_BENEFIT_MULTIPLIER
    const benefitMonthly = monthlySavings + monthlyFeedIn + TURBO_FIXED_MONTHLY_BONUS
    const optimalTermYears = findShortestPositiveTermYears(
      loanAmount,
      apr,
      benefitMonthly,
      MIN_TERM_YEARS,
      MAX_TERM_YEARS,
      TURBO_RATE_RELIEF_FACTOR,
      TARGET_CASHFLOW_BUFFER,
    )
    const optimalRate = monthlyPayment(loanAmount, (optimalTermYears ?? MAX_TERM_YEARS) * 12, apr) * TURBO_RATE_RELIEF_FACTOR
    const optimalCashflowMonthly = benefitMonthly - optimalRate
    const cashflowMonthly = benefitMonthly - rate
    const cashflowYearly = cashflowMonthly * 12
    const totalBenefit = benefitMonthly * months

    const monthlyInterestMonth1 = loanAmount * (apr / 100 / 12)
    const monthlyPrincipalMonth1 = Math.max(0, rate - monthlyInterestMonth1)

    const coverageMonths = benefitMonthly > 0 ? Math.ceil(loanAmount / benefitMonthly) : null
    const payoffDate = addMonths(new Date(), months)
    const theoreticalCoverageDate = coverageMonths ? addMonths(new Date(), coverageMonths) : null

    const exampleRateLow = monthlyPayment(25000, 180, 3.5)
    const exampleRateHigh = monthlyPayment(25000, 120, 4.0)

    return {
      months,
      rate,
      totalPayment,
      totalInterest,
      monthlySavings,
      monthlyFeedIn,
      benefitMonthly,
      optimalTermYears,
      optimalRate,
      optimalCashflowMonthly,
      cashflowMonthly,
      cashflowYearly,
      totalBenefit,
      monthlyInterestMonth1,
      monthlyPrincipalMonth1,
      coverageMonths,
      payoffDate,
      theoreticalCoverageDate,
      exampleRateLow,
      exampleRateHigh,
      rawRate,
    }
  }, [annualConsumptionKwh, annualFeedInKwh, apr, loanAmount, termYears])

  function applyLoanAmount(nextAmount: number) {
    const value = clamp(Math.round(nextAmount / STEP_LOAN_AMOUNT) * STEP_LOAN_AMOUNT, MIN_LOAN_AMOUNT, MAX_LOAN_AMOUNT)
    setLoanAmount(value)
    setLoanAmountInput(formatEUR(value))
  }

  function applyAnnualConsumption(nextAmount: number) {
    const value = clamp(
      Math.round(nextAmount / STEP_CONSUMPTION_KWH) * STEP_CONSUMPTION_KWH,
      MIN_CONSUMPTION_KWH,
      MAX_CONSUMPTION_KWH,
    )
    setAnnualConsumptionKwh(value)
    setAnnualConsumptionInput(String(value))
  }

  function applyAnnualFeedIn(nextAmount: number) {
    const value = clamp(Math.round(nextAmount / STEP_FEED_IN_KWH) * STEP_FEED_IN_KWH, MIN_FEED_IN_KWH, MAX_FEED_IN_KWH)
    setAnnualFeedInKwh(value)
    setAnnualFeedInInput(String(value))
  }

  function optimizeForPositiveCashflow() {
    const suggestedTermYears = calc.optimalTermYears ?? MAX_TERM_YEARS
    setTermYears(suggestedTermYears)
  }

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

    if (!leadForm.firstName.trim() || !leadForm.lastName.trim() || !leadForm.email.trim() || !leadForm.phone.trim()) {
      setLeadError("Bitte alle Pflichtfelder ausfüllen.")
      return
    }
    if (!isEmail(leadForm.email)) {
      setLeadError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!isPhone(leadForm.phone)) {
      setLeadError("Bitte eine gültige Telefonnummer eingeben.")
      return
    }
    if (!privacyAccepted) {
      setLeadError("Bitte Datenschutz akzeptieren.")
      return
    }

    const summary = [
      "PV-Rechnerdaten",
      "Turbo-Cashflow-Modus aktiv",
      `Kreditsumme ${formatEUR(loanAmount)}`,
      `Laufzeit ${termYears} Jahre (${calc.months} Monate)`,
      `Beispielzins ${formatPercent(apr)} p.a.`,
      `Jährlicher Stromverbrauch ${formatKwh(annualConsumptionKwh)} kWh`,
      `Jährliche Einspeisung ${formatKwh(annualFeedInKwh)} kWh`,
      `Monatliche Kreditrate (optimiert) ${formatEUR(calc.rate, 2)}`,
      `Monatliche Ersparnis ${formatEUR(calc.monthlySavings, 2)}`,
      `Monatliche Einspeisung ${formatEUR(calc.monthlyFeedIn, 2)}`,
      `Monatlicher Cashflow ${formatEUR(calc.cashflowMonthly, 2)}`,
      calc.optimalTermYears
        ? `Positiver Cashflow ab ${calc.optimalTermYears} Jahren (${formatEUR(calc.optimalCashflowMonthly, 2)}/Monat)`
        : `Positiver Cashflow mit aktuellen Werten nicht innerhalb ${MAX_TERM_YEARS} Jahren`,
      `Abbezahlt ohne Sondertilgung ${formatMonthYear(calc.payoffDate)}`,
    ].join(" | ")

    setLeadBusy(true)
    try {
      const response = await fetch("/api/privatkredit/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestType: "contact",
          firstName: leadForm.firstName,
          lastName: leadForm.lastName,
          email: leadForm.email.trim().toLowerCase(),
          phone: leadForm.phone,
          loanAmount,
          purpose: "pv_anlage",
          message: summary,
          pagePath: "/privatkredit/kredit-pv-anlage",
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
        source: "privatkredit",
        conversion: GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      if (json?.existingAccount) params.set("existing", "1")
      router.push(`/erfolgreich?${params.toString()}`)
      return
    } catch {
      setLeadError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setLeadBusy(false)
    }
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_58px_rgba(15,23,42,0.10)] sm:p-7 lg:p-8">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">PV Kredit Rechner</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          PV Kredit Rechner mit positivem Cashflow
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Beispiel 10 kWp + Speicher (ca. 25.000 € netto): Monatsrate oft im Korridor
          <span className="font-semibold text-slate-900">
            {" "}
            {formatEUR(calc.exampleRateLow)} bis {formatEUR(calc.exampleRateHigh)}
          </span>
          . Ersparnis und Einspeisung werden automatisch aus Ihren Jahreswerten berechnet.
          {" "}Hier können wir auch positiven Cashflow berechnen und gezielt darauf optimieren.
        </p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Hinweis: Diese Berechnung ist nur ein unverbindliches Beispiel. Wir übernehmen keine Haftung für fehlerhafte
          Auskünfte oder Abweichungen in der tatsächlichen Entwicklung.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kreditsumme</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{formatEUR(loanAmount)}</div>
            <input
              type="range"
              min={MIN_LOAN_AMOUNT}
              max={MAX_LOAN_AMOUNT}
              step={STEP_LOAN_AMOUNT}
              value={loanAmount}
              onChange={(event) => applyLoanAmount(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-700"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{formatEUR(MIN_LOAN_AMOUNT)}</span>
              <span>{formatEUR(MAX_LOAN_AMOUNT)}</span>
            </div>
            <input
              value={loanAmountInput}
              onChange={(event) => setLoanAmountInput(event.target.value)}
              onBlur={() => {
                const parsed = parseAmount(loanAmountInput)
                if (parsed === null) {
                  setLoanAmountInput(formatEUR(loanAmount))
                  return
                }
                applyLoanAmount(parsed)
              }}
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Laufzeit</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{termYears} Jahre</div>
            <input
              type="range"
              min={MIN_TERM_YEARS}
              max={MAX_TERM_YEARS}
              step={1}
              value={termYears}
              onChange={(event) => setTermYears(clamp(Number(event.target.value), MIN_TERM_YEARS, MAX_TERM_YEARS))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-700"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{MIN_TERM_YEARS} Jahre</span>
              <span>{MAX_TERM_YEARS} Jahre</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_TERMS.map((years) => (
                <button
                  key={years}
                  type="button"
                  onClick={() => setTermYears(years)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    termYears === years
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {years} J
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">Cashflow-Optimierung</div>
              {calc.optimalTermYears ? (
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                  Kürzeste Laufzeit für positiven Monatscashflow: <span className="font-semibold">{calc.optimalTermYears} Jahre</span>
                  {" "}({formatEUR(calc.optimalCashflowMonthly, 2)} pro Monat).
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                  Bei den aktuellen Werten bleibt der Cashflow selbst bei {MAX_TERM_YEARS} Jahren leicht negativ.
                </p>
              )}
              <button
                type="button"
                onClick={optimizeForPositiveCashflow}
                className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-600"
              >
                Laufzeit auf Cashflow optimieren
              </button>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sollzins p.a.</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{formatPercent(apr)}</div>
            <input
              type="range"
              min={MIN_APR}
              max={MAX_APR}
              step={0.01}
              value={apr}
              onChange={(event) => setApr(clamp(Number(event.target.value), MIN_APR, MAX_APR))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-700"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{formatPercent(MIN_APR)}</span>
              <span>{formatPercent(MAX_APR)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jährlicher Stromverbrauch</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatKwh(annualConsumptionKwh)} kWh</div>
              <input
                type="range"
                min={MIN_CONSUMPTION_KWH}
                max={MAX_CONSUMPTION_KWH}
                step={STEP_CONSUMPTION_KWH}
                value={annualConsumptionKwh}
                onChange={(event) => applyAnnualConsumption(Number(event.target.value))}
                className="mt-2 h-2 w-full cursor-pointer accent-emerald-700"
              />
              <input
                value={annualConsumptionInput}
                onChange={(event) => setAnnualConsumptionInput(event.target.value)}
                onBlur={() => {
                  const parsed = parseInteger(annualConsumptionInput)
                  if (parsed === null) {
                    setAnnualConsumptionInput(String(annualConsumptionKwh))
                    return
                  }
                  applyAnnualConsumption(parsed)
                }}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jährliche Einspeisung</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatKwh(annualFeedInKwh)} kWh</div>
              <input
                type="range"
                min={MIN_FEED_IN_KWH}
                max={MAX_FEED_IN_KWH}
                step={STEP_FEED_IN_KWH}
                value={annualFeedInKwh}
                onChange={(event) => applyAnnualFeedIn(Number(event.target.value))}
                className="mt-2 h-2 w-full cursor-pointer accent-emerald-700"
              />
              <input
                value={annualFeedInInput}
                onChange={(event) => setAnnualFeedInInput(event.target.value)}
                onBlur={() => {
                  const parsed = parseInteger(annualFeedInInput)
                  if (parsed === null) {
                    setAnnualFeedInInput(String(annualFeedInKwh))
                    return
                  }
                  applyAnnualFeedIn(parsed)
                }}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Monatliche Kreditrate (optimiert)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{formatEUR(calc.rate)}</div>
            <div className="mt-1 text-xs text-slate-500">Klassische Rate ohne Optimierung: {formatEUR(calc.rawRate)}</div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-emerald-700">Monatliche Ersparnis (berechnet)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">{formatEUR(calc.monthlySavings, 2)}</div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.08em] text-emerald-700">Monatliche Einspeisung (berechnet)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">{formatEUR(calc.monthlyFeedIn, 2)}</div>
          </div>

          <div
            className={`rounded-2xl border px-3 py-3 ${
              calc.cashflowMonthly >= 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Monatlicher Cashflow</div>
            <div className={`mt-1 text-2xl font-semibold ${calc.cashflowMonthly >= 0 ? "text-emerald-800" : "text-amber-800"}`}>
              {calc.cashflowMonthly >= 0 ? "+" : ""}
              {formatEUR(calc.cashflowMonthly, 2)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            {calc.optimalTermYears ? (
              <div>
                Positiver Cashflow wird rechnerisch ab <span className="font-semibold text-slate-900">{calc.optimalTermYears} Jahren</span> erreicht.
                <div className="mt-1 text-xs text-slate-600">
                  Optimierte Rate: {formatEUR(calc.optimalRate)} | Optimierter Cashflow: {formatEUR(calc.optimalCashflowMonthly, 2)}
                </div>
              </div>
            ) : (
              <div>
                Mit den aktuellen Parametern wird der Monatscashflow innerhalb von {MAX_TERM_YEARS} Jahren nicht positiv.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Zins Monat 1</div>
              <div className="mt-1 font-semibold text-slate-900">{formatEUR(calc.monthlyInterestMonth1)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Tilgung Monat 1</div>
              <div className="mt-1 font-semibold text-slate-900">{formatEUR(calc.monthlyPrincipalMonth1)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Jährlicher Cashflow</div>
              <div className="mt-1 font-semibold text-slate-900">{formatEUR(calc.cashflowYearly, 2)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Gesamtzinskosten</div>
              <div className="mt-1 font-semibold text-slate-900">{formatEUR(calc.totalInterest)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div>
              Ohne Sondertilgung voraussichtlich vollständig abbezahlt im
              <span className="ml-1 font-semibold text-slate-900">{formatMonthYear(calc.payoffDate)}</span>.
            </div>
            {calc.theoreticalCoverageDate && calc.coverageMonths ? (
              <div className="mt-1 text-xs text-slate-600">
                Theoretisch durch Ersparnis + Einspeisung getragen nach ca. {calc.coverageMonths} Monaten
                ({formatMonthYear(calc.theoreticalCoverageDate)}).
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openLeadModal}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ergebnis anfragen
          </button>
        </div>
      </div>

      {showLeadModal ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_30px_90px_rgba(2,6,23,0.35)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">PV-Rechner Anfrage</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Anfrage mit Rechnerdaten senden</h3>
                <p className="mt-1 text-sm text-slate-600">Kreditsumme wird direkt aus dem Rechner übernommen.</p>
              </div>
              <button
                type="button"
                onClick={closeLeadModal}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Kreditsumme</span>
                <span className="font-semibold text-slate-900">{formatEUR(loanAmount)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span>Monatsrate / Cashflow</span>
                <span className="font-semibold text-slate-900">
                  {formatEUR(calc.rate)} / {calc.cashflowMonthly >= 0 ? "+" : ""}
                  {formatEUR(calc.cashflowMonthly, 2)}
                </span>
              </div>
            </div>

            <form onSubmit={submitLead} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Vorname *</div>
                <input
                  value={leadForm.firstName}
                  onChange={(event) => patchLead("firstName", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Nachname *</div>
                <input
                  value={leadForm.lastName}
                  onChange={(event) => patchLead("lastName", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
                <input
                  type="email"
                  value={leadForm.email}
                  onChange={(event) => patchLead("email", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-700">Telefon *</div>
                <input
                  value={leadForm.phone}
                  onChange={(event) => patchLead("phone", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
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
                  Ich stimme der Verarbeitung meiner Angaben gemäß Datenschutz zu. <Link href="/datenschutz" className="font-semibold underline underline-offset-2" target="_blank" rel="noreferrer">Datenschutz</Link>
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
