"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

const APR_PERCENT = 5.99
const QUICK_TERMS = [24, 36, 48, 60, 72]

function formatEUR(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function monthlyPayment(principal: number, months: number, aprPercent: number) {
  const rateMonthly = aprPercent / 100 / 12
  if (rateMonthly <= 0) return principal / months
  return (principal * rateMonthly) / (1 - (1 + rateMonthly) ** -months)
}

function shareOfTotal(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export default function WeddingBudgetCalculator() {
  const [guestCount, setGuestCount] = useState(70)
  const [venueCost, setVenueCost] = useState(4500)
  const [cateringPerGuest, setCateringPerGuest] = useState(95)
  const [outfitCost, setOutfitCost] = useState(2800)
  const [ringsCost, setRingsCost] = useState(2200)
  const [photoVideoCost, setPhotoVideoCost] = useState(2400)
  const [decorationCost, setDecorationCost] = useState(1600)
  const [musicCost, setMusicCost] = useState(1400)
  const [honeymoonCost, setHoneymoonCost] = useState(3500)
  const [otherCosts, setOtherCosts] = useState(1500)
  const [ownContribution, setOwnContribution] = useState(4000)
  const [termMonths, setTermMonths] = useState(48)

  const calc = useMemo(() => {
    const cateringTotal = guestCount * cateringPerGuest
    const totalBudget =
      venueCost +
      cateringTotal +
      outfitCost +
      ringsCost +
      photoVideoCost +
      decorationCost +
      musicCost +
      honeymoonCost +
      otherCosts

    const financingNeed = Math.max(0, totalBudget - ownContribution)
    const monthlyRate = monthlyPayment(financingNeed, termMonths, APR_PERCENT)
    const totalPayment = monthlyRate * termMonths
    const totalInterest = Math.max(0, totalPayment - financingNeed)
    const ownContributionShare = shareOfTotal(ownContribution, totalBudget)

    return {
      cateringTotal,
      totalBudget,
      financingNeed,
      monthlyRate,
      totalPayment,
      totalInterest,
      ownContributionShare,
    }
  }, [
    cateringPerGuest,
    decorationCost,
    guestCount,
    honeymoonCost,
    musicCost,
    otherCosts,
    outfitCost,
    ownContribution,
    photoVideoCost,
    ringsCost,
    termMonths,
    venueCost,
  ])

  const financingOptions = QUICK_TERMS.map((months) => {
    const monthly = monthlyPayment(calc.financingNeed, months, APR_PERCENT)
    return {
      months,
      monthly,
    }
  })

  return (
    <section className="rounded-[32px] border border-slate-200/70 bg-white p-4 shadow-[0_20px_58px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Budgetrechner</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Was kostet Ihre Hochzeit und welche Rate ist realistisch?
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
          Sie stellen Ihr Budget aus den typischen Kostenbausteinen zusammen. Daraus zeigt der Rechner direkt den
          möglichen Finanzierungsbedarf und passende Monatsraten.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4 rounded-3xl border border-rose-100 bg-[linear-gradient(145deg,#fff7f7_0%,#fff3ed_52%,#ffffff_100%)] p-4 shadow-sm sm:p-5">
          <div className="rounded-2xl border border-rose-100/80 bg-white/75 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">Budgetsteuerung</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Die großen Hebel zuerst einstellen</div>
              </div>
              <div className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                Live-Berechnung
              </div>
            </div>

            <div className="space-y-5">
              <label className="block">
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
                  <span>Gäste</span>
                  <span>{guestCount}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={180}
                  step={5}
                  value={guestCount}
                  onChange={(event) => setGuestCount(Number(event.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer accent-rose-600"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
                  <span>Location</span>
                  <span>{formatEUR(venueCost)}</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={12000}
                  step={250}
                  value={venueCost}
                  onChange={(event) => setVenueCost(Number(event.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer accent-rose-600"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
                  <span>Catering pro Gast</span>
                  <span>{formatEUR(cateringPerGuest)}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={220}
                  step={5}
                  value={cateringPerGuest}
                  onChange={(event) => setCateringPerGuest(Number(event.target.value))}
                  className="mt-3 h-2 w-full cursor-pointer accent-rose-600"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Outfits", value: outfitCost, setValue: setOutfitCost },
              { label: "Ringe", value: ringsCost, setValue: setRingsCost },
              { label: "Foto & Video", value: photoVideoCost, setValue: setPhotoVideoCost },
              { label: "Deko & Blumen", value: decorationCost, setValue: setDecorationCost },
              { label: "Musik & DJ", value: musicCost, setValue: setMusicCost },
              { label: "Flitterwochen", value: honeymoonCost, setValue: setHoneymoonCost },
              { label: "Sonstiges", value: otherCosts, setValue: setOtherCosts },
              { label: "Eigenmittel", value: ownContribution, setValue: setOwnContribution },
            ].map((item) => (
              <label key={item.label} className="block rounded-2xl border border-slate-200/80 bg-white/82 p-3 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                <input
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={item.value}
                  onChange={(event) => item.setValue(Number(event.target.value) || 0)}
                  className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-rose-100 bg-white/80 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">Catering gesamt</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatEUR(calc.cateringTotal)}</div>
            </article>
            <article className="rounded-2xl border border-rose-100 bg-white/80 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">Eigenmittel</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{calc.ownContributionShare}% vom Budget</div>
            </article>
            <article className="rounded-2xl border border-rose-100 bg-white/80 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">Offener Bedarf</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatEUR(calc.financingNeed)}</div>
            </article>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-900/80 bg-[linear-gradient(160deg,#0f172a_0%,#0b1635_100%)] p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] sm:p-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Gesamtbudget Hochzeit</div>
            <div className="mt-1 text-3xl font-semibold">{formatEUR(calc.totalBudget)}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Catering gesamt</div>
              <div className="mt-1 text-xl font-semibold">{formatEUR(calc.cateringTotal)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Finanzierungsbedarf</div>
              <div className="mt-1 text-xl font-semibold text-rose-200">{formatEUR(calc.financingNeed)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Laufzeit</div>
                <div className="mt-1 text-xl font-semibold">{termMonths} Monate</div>
              </div>
              <div className="text-right text-xs text-slate-300">Beispielzins {APR_PERCENT.toFixed(2).replace(".", ",")} % p.a.</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {QUICK_TERMS.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setTermMonths(months)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    termMonths === months
                      ? "border-rose-300 bg-rose-400/20 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {months}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-300/20 bg-[linear-gradient(145deg,rgba(76,29,149,0.25),rgba(190,24,93,0.16))] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-rose-100">Monatsrate</div>
            <div className="mt-1 text-4xl font-semibold">{formatEUR(calc.monthlyRate)}</div>
            <div className="mt-1 text-xs text-rose-100/80">bei {formatEUR(calc.financingNeed)} Finanzierungsbedarf</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Gesamtrückzahlung</div>
              <div className="mt-1 text-lg font-semibold">{formatEUR(calc.totalPayment)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Zinskosten</div>
              <div className="mt-1 text-lg font-semibold">{formatEUR(calc.totalInterest)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Ratenvergleich</div>
            <div className="mt-3 space-y-2">
              {financingOptions.map((option) => (
                <div key={option.months} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5">
                  <span className="text-sm text-slate-200">{option.months} Monate</span>
                  <span className="text-sm font-semibold text-white">{formatEUR(option.monthly)} / Monat</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            Hinweis: Orientierungsrechnung mit festem Beispielzins. Bonität, Bank und finale Laufzeit beeinflussen die
            tatsächlichen Konditionen.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="#kontakt"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:w-auto"
            >
              Finanzierung anfragen
            </Link>
            <Link
              href="#quick-start"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Schnellstart
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
