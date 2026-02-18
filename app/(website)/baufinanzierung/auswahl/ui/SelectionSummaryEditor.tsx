"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { clamp, formatEUR } from "@/lib/baufi/calc"

type Metrics = {
  income_monthly: number
  out_monthly: number
  surplus_monthly: number
}

type Primary = {
  net_income_monthly: number
  other_income_monthly: number
  expenses_monthly: number
  existing_loans_monthly: number
}

function parseMoney(v: string) {
  const raw = String(v ?? "").trim()
  if (!raw) return 0
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return 0
  let normalized = cleaned
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".")
  else normalized = normalized.replace(/\./g, "")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function formatMoneyInput(n: number) {
  const safe = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(safe)
}

export default function SelectionSummaryEditor({
  caseId,
  caseRef,
  caseRefDisplay,
  loanAmount,
  years,
  metrics,
  primary,
  disclaimer,
}: {
  caseId: string
  caseRef: string
  caseRefDisplay: string
  loanAmount: number
  years: number
  metrics: Metrics | null
  primary: Primary | null
  disclaimer: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [loanInput, setLoanInput] = useState(formatMoneyInput(loanAmount))
  const [yearsInput, setYearsInput] = useState(String(years))
  const [netInput, setNetInput] = useState(formatMoneyInput(primary?.net_income_monthly ?? metrics?.income_monthly ?? 0))
  const [otherInput, setOtherInput] = useState(formatMoneyInput(primary?.other_income_monthly ?? 0))
  const [expenseInput, setExpenseInput] = useState(formatMoneyInput(primary?.expenses_monthly ?? metrics?.out_monthly ?? 0))
  const [loansInput, setLoansInput] = useState(formatMoneyInput(primary?.existing_loans_monthly ?? 0))

  const gateRequired = Boolean(caseId && caseRef)
  const gateUnlocked = !gateRequired || gate.trim().toUpperCase() === caseRef.trim().toUpperCase()

  const preview = useMemo(() => {
    const income = parseMoney(netInput) + parseMoney(otherInput)
    const out = parseMoney(expenseInput) + parseMoney(loansInput)
    return {
      income,
      out,
      surplus: income - out,
    }
  }, [netInput, otherInput, expenseInput, loansInput])

  async function saveChanges() {
    if (!caseId || !caseRef) {
      setError("Bearbeiten ist nur mit gültiger Fall-Referenz möglich.")
      return
    }
    if (!gateUnlocked) {
      setError("Bitte zuerst die Fall-Referenz bestätigen.")
      return
    }

    setBusy(true)
    setError(null)
    setOkMsg(null)

    try {
      const res = await fetch("/api/baufi/case-metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          primary: {
            net_income_monthly: parseMoney(netInput),
            other_income_monthly: parseMoney(otherInput),
            expenses_monthly: parseMoney(expenseInput),
            existing_loans_monthly: parseMoney(loansInput),
          },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Speichern fehlgeschlagen.")
      }

      const nextLoanAmount = Math.max(50_000, Math.round(parseMoney(loanInput) || loanAmount))
      const nextYears = clamp(Math.round(parseMoney(yearsInput) || years), 5, 35)
      const params = new URLSearchParams(searchParams.toString())
      params.set("loanAmount", String(nextLoanAmount))
      params.set("years", String(nextYears))

      setOkMsg("Daten gespeichert. Die Vorschau wird neu berechnet.")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      router.refresh()
      setOpen(false)
    } catch (e: any) {
      setError(e?.message || "Speichern fehlgeschlagen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="text-xs text-slate-600">Fall-Referenz</div>
          <div className="mt-0.5 text-base font-semibold text-slate-900">{caseRefDisplay || "-"}</div>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="text-xs text-slate-600">Darlehen (Beispiel)</div>
          <div className="mt-0.5 text-base font-semibold text-slate-900">{formatEUR(loanAmount)}</div>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="text-xs text-slate-600">Laufzeit (Beispiel)</div>
          <div className="mt-0.5 text-base font-semibold text-slate-900">{years} Jahre</div>
        </div>
      </div>

      {metrics ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-slate-600">Einnahmen/Monat</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">{formatEUR(metrics.income_monthly)}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-slate-600">Ausgaben/Monat</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">{formatEUR(metrics.out_monthly)}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-slate-600">Puffer/Monat</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900">{formatEUR(metrics.surplus_monthly)}</div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            setError(null)
            setOkMsg(null)
          }}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40"
        >
          {open ? "Bearbeitung schliessen" : "Daten bearbeiten"}
        </button>
        <div className="text-xs text-slate-500">Smart Gate: Aendern nur mit Fall-Referenz-Bestaetigung.</div>
      </div>

      {open ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          {!gateUnlocked ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-900">Sicherheits-Gate</div>
              <div className="text-xs text-slate-600">
                Bitte geben Sie die Fall-Referenz ein, um die Werte zu entsperren.
              </div>
              <input
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                placeholder={caseRefDisplay || "BF-XXXXXX"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Darlehen (Beispiel)</div>
                  <input
                    value={loanInput}
                    onChange={(e) => setLoanInput(e.target.value)}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Laufzeit in Jahren</div>
                  <input
                    value={yearsInput}
                    onChange={(e) => setYearsInput(e.target.value)}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Nettoeinnahmen/Monat</div>
                  <input
                    value={netInput}
                    onChange={(e) => setNetInput(e.target.value)}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Weitere Einnahmen/Monat</div>
                  <input
                    value={otherInput}
                    onChange={(e) => setOtherInput(e.target.value)}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Fixkosten/Monat</div>
                  <input
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-slate-600">Bestehende Kredite/Monat</div>
                  <input
                    value={loansInput}
                    onChange={(e) => setLoansInput(e.target.value)}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:ring-slate-300"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Vorschau: Einnahmen {formatEUR(preview.income)} | Ausgaben {formatEUR(preview.out)} | Puffer{" "}
                {formatEUR(preview.surplus)}
              </div>

              <div className="text-xs text-slate-500">
                Hinweis: Diese Werte aktualisieren die Vergleichslogik sofort. Angaben zu weiteren Kreditnehmern bleiben
                unveraendert.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Speichere..." : "Aenderungen speichern"}
                </button>
                {error ? <div className="text-xs text-rose-700">{error}</div> : null}
                {okMsg ? <div className="text-xs text-emerald-700">{okMsg}</div> : null}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="text-xs text-slate-500">{disclaimer}</div>
    </div>
  )
}
