// app/(app)/advisor/faelle/page.tsx
import Link from "next/link"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"
import { translateCaseStatus } from "@/lib/caseStatus"

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
  assigned_advisor_id: string | null

  docsCount: number
  offersCount: number
  previewsCount: number

  comparison: ComparisonMini | null
  bestOffer: ComparisonMini | null
}

type CaseListResp = { cases: CaseRow[] }

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}
function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}
function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

/** ✅ robust: nimmt string ODER object und macht daraus einen sauberen Pfad-string */
function normalizeLogoPath(input: unknown): string | null {
  if (!input) return null
  if (typeof input === "string") {
    const s = input.trim()
    return s ? s : null
  }
  if (typeof input === "object") {
    const anyObj = input as any
    const candidate =
      anyObj?.path ??
      anyObj?.logo_path ??
      anyObj?.logoPath ??
      anyObj?.key ??
      anyObj?.name ??
      null
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return null
}

function logoSrc(pathLike?: unknown) {
  const path = normalizeLogoPath(pathLike)
  if (!path) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(path)}`
}

// ✅ Status-Übersetzung (Case)

export default async function CasesPage() {
  await requireAdvisor()

  const res = await authFetch("/api/app/cases/list").catch(() => null)
  const data: CaseListResp = res && res.ok ? await res.json() : { cases: [] }
  const totalCases = data.cases.length
  const withComparison = data.cases.filter((c) => c.previewsCount > 0).length
  const withOffers = data.cases.filter((c) => c.offersCount > 0).length

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Fälle</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hier sehen Sie Ihre Baufinanzierungs-Fälle. <span className="text-slate-900 font-medium">Vergleich bereit</span>{" "}
          bedeutet: der Startschuss (Snapshot) ist vorhanden.
        </p>
      </div>


      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Gesamt</div>
          <div className="text-lg font-semibold text-slate-900">{totalCases}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Vergleich bereit</div>
          <div className="text-lg font-semibold text-slate-900">{withComparison}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Angebote</div>
          <div className="text-lg font-semibold text-slate-900">{withOffers}</div>
        </div>
      </div>

      {/* ✅ Mobile-first: Cards */}
      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {data.cases.map((c) => {
          const s = c.bestOffer ?? c.comparison
          const hasComparison = !!c.comparison
          const bankLogo = s?.provider_logo_path ? logoSrc(s.provider_logo_path) : null

          return (
            <Link
              key={c.id}
              href={`/advisor/faelle/${c.id}`}
              className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm hover:bg-slate-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    Fall {c.case_ref || c.id.slice(0, 8)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {dt(c.created_at)} · Status: {translateCaseStatus(c.status_display ?? c.status)}
                  </div>
                </div>

                <div className="shrink-0 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                  {hasComparison ? "Vergleich bereit" : "Noch kein Vergleich"}
                </div>
              </div>

              {s ? (
                <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-600">Bank</div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {s.provider_name || (s.provider_id ? `Bank ${s.provider_id}` : "—")}
                      </div>
                    </div>

                    {/* ✅ kein src="" mehr */}
                    {bankLogo ? (
                      <img
                        src={bankLogo}
                        alt=""
                        className="h-8 w-auto max-w-[110px] object-contain"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Darlehen</div>
                      <div className="text-sm font-semibold text-slate-900">{formatEUR(s.loan_amount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Monatsrate</div>
                      <div className="text-sm font-semibold text-slate-900">{formatEUR(s.rate_monthly)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Effektivzins</div>
                      <div className="text-sm font-semibold text-slate-900">{formatPct(s.apr_effective)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Zinsbindung</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {s.zinsbindung_years ? `${s.zinsbindung_years} Jahre` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-500">Noch keine Vergleichswerte hinterlegt.</div>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Unterlagen: <span className="font-medium text-slate-900">{c.docsCount}</span>
                </div>
                <div>
                  Angebote: <span className="font-medium text-slate-900">{c.offersCount}</span>
                </div>
              </div>
            </Link>
          )
        })}

        {data.cases.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Noch keine Fälle vorhanden.
          </div>
        ) : null}
      </div>

      {/* ✅ Desktop: Table */}
      <div className="hidden lg:block rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Ihre Fälle</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Vergleich</th>
                <th className="px-4 py-3 font-medium text-slate-700">Darlehen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Rate</th>
                <th className="px-4 py-3 font-medium text-slate-700">Effektiv</th>
                <th className="px-4 py-3 font-medium text-slate-700">Zinsbindung</th>
                <th className="px-4 py-3 font-medium text-slate-700">Unterlagen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Angebote</th>
              </tr>
            </thead>

            <tbody>
              {data.cases.map((c) => {
                const s = c.bestOffer ?? c.comparison
                const hasComparison = !!c.comparison
                const bankLogo = s?.provider_logo_path ? logoSrc(s.provider_logo_path) : null

                return (
                  <tr key={c.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">{dt(c.created_at)}</div>
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {translateCaseStatus(c.status_display ?? c.status)}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <Link href={`/advisor/faelle/${c.id}`} className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs border ${
                            hasComparison
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {hasComparison ? "Vergleich bereit" : "—"}
                        </span>

                        {/* ✅ kein src="" mehr */}
                        {bankLogo ? (
                          <img
                            src={bankLogo}
                            alt=""
                            className="h-6 w-auto max-w-[110px] object-contain"
                            loading="lazy"
                          />
                        ) : null}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {formatEUR(s?.loan_amount ?? null)}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {formatEUR(s?.rate_monthly ?? null)}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {formatPct(s?.apr_effective ?? null)}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {s?.zinsbindung_years ? `${s.zinsbindung_years} J.` : "—"}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {c.docsCount}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        {c.offersCount}
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {data.cases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    Noch keine Fälle vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-500">Tipp: Klicken Sie auf einen Fall für Details.</div>
      </div>
    </div>
  )
}






