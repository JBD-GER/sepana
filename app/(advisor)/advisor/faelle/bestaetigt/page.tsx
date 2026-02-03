import Link from "next/link"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"

type Money = number | null

type ComparisonMini = {
  provider_id: string | null
  provider_name: string | null
  provider_logo_path: string | null
  loan_amount: Money
  rate_monthly: Money
  apr_effective: Money
  interest_nominal: Money
  zinsbindung_years: number | null
  special_repayment: string | null
}

type CaseRow = {
  id: string
  case_ref: string | null
  status: string
  status_display?: string | null
  created_at: string
  docsCount: number
  offersCount: number
  comparison: ComparisonMini | null
  bestOffer: ComparisonMini | null
  confirmed_at: string | null
  confirmed_loan_amount: number | null
}

type CaseListResp = {
  cases: CaseRow[]
  total?: number
}

const COMMISSION_RATE = 0.0025

function formatEUR(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function isCurrentMonth(value: string | null | undefined) {
  if (!value) return false
  const d = new Date(value)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default async function AdvisorConfirmedCasesPage() {
  await requireAdvisor()

  const res = await authFetch("/api/app/cases/list?advisorBucket=confirmed&limit=1000").catch(() => null)
  const data: CaseListResp = res && res.ok ? await res.json() : { cases: [] }
  const cases = data.cases ?? []

  const confirmedCases = Number(data.total ?? cases.length)
  const totalVolume = cases.reduce((sum, row) => sum + Number(row.confirmed_loan_amount ?? 0), 0)
  const monthVolume = cases.reduce(
    (sum, row) => sum + (isCurrentMonth(row.confirmed_at) ? Number(row.confirmed_loan_amount ?? 0) : 0),
    0
  )
  const totalCommission = totalVolume * COMMISSION_RATE
  const monthCommission = monthVolume * COMMISSION_RATE

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Bestaetigte Faelle</h1>
            <p className="mt-1 text-sm text-slate-600">
              Diese Faelle wurden von der Bank bestaetigt. Provisionsmodell v0.1: 0,25 % vom bestaetigten Volumen.
            </p>
          </div>
          <Link
            href="/advisor/faelle"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          >
            Aktive Faelle
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Bestaetigte Faelle</div>
          <div className="text-lg font-semibold text-slate-900">{confirmedCases}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Volumen (aktueller Monat)</div>
          <div className="text-lg font-semibold text-slate-900">{formatEUR(monthVolume)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Provision (aktueller Monat)</div>
          <div className="text-lg font-semibold text-slate-900">{formatEUR(monthCommission)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Volumen (gesamt)</div>
          <div className="text-lg font-semibold text-slate-900">{formatEUR(totalVolume)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Provision (gesamt)</div>
          <div className="text-lg font-semibold text-slate-900">{formatEUR(totalCommission)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {cases.map((row) => {
          const offer = row.bestOffer ?? row.comparison
          const providerName = offer?.provider_name || (offer?.provider_id ? `Bank ${offer.provider_id}` : "-")
          const provision = Number(row.confirmed_loan_amount ?? 0) * COMMISSION_RATE
          return (
            <Link
              key={row.id}
              href={`/advisor/faelle/${row.id}`}
              className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm hover:bg-slate-50/40"
            >
              <div className="text-sm font-semibold text-slate-900">Fall {row.case_ref || row.id.slice(0, 8)}</div>
              <div className="mt-1 text-xs text-slate-500">Bank bestaetigt: {formatDateTime(row.confirmed_at)}</div>
              <div className="mt-2 text-xs text-slate-600">Bank: {providerName}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-600">Volumen</div>
                  <div className="text-sm font-semibold text-slate-900">{formatEUR(row.confirmed_loan_amount)}</div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-600">Provision</div>
                  <div className="text-sm font-semibold text-slate-900">{formatEUR(provision)}</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm lg:block">
        <div className="text-sm font-medium text-slate-900">Uebersicht bestaetigter Faelle</div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Bestaetigt am</th>
                <th className="px-4 py-3 font-medium text-slate-700">Bank</th>
                <th className="px-4 py-3 font-medium text-slate-700">Volumen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Provision</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => {
                const offer = row.bestOffer ?? row.comparison
                const providerName = offer?.provider_name || (offer?.provider_id ? `Bank ${offer.provider_id}` : "-")
                const provision = Number(row.confirmed_loan_amount ?? 0) * COMMISSION_RATE
                return (
                  <tr key={row.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/advisor/faelle/${row.id}`}
                        className="font-medium text-slate-900 underline-offset-4 hover:underline"
                      >
                        {row.case_ref || row.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.confirmed_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{providerName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatEUR(row.confirmed_loan_amount)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatEUR(provision)}</td>
                  </tr>
                )
              })}
              {cases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Noch keine bestaetigten Faelle vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
