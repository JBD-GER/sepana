import Link from "next/link"
import {
  getAdvisorCaseFilterLabel,
  getAdvisorCaseFilterOptions,
  getAdvisorCaseFilterSet,
  getAdvisorCaseStatusLabel,
  getAdvisorCaseStatusSet,
  normalizeAdvisorCaseProduct,
  type AdvisorCaseFilterValue,
  type AdvisorCaseStatusValue,
} from "@/lib/advisor/caseStatusOptions"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"
import AdvisorCaseStatusSelect from "./ui/AdvisorCaseStatusSelect"
import AdvisorInsuranceForwardButton from "./ui/AdvisorInsuranceForwardButton"

type CaseRow = {
  id: string
  case_ref: string | null
  advisor_case_ref: string | null
  advisor_status: string | null
  case_type: string
  customer_name?: string | null
  customer_phone?: string | null
  status: string
  status_display?: string | null
  created_at: string
  assigned_advisor_id: string | null
  insurance_routed_at?: string | null
  schufa_completed_application_at?: string | null
  schufa_submitted_to_skag_at?: string | null
  financial_analysis_service_status?: string | null
  financial_analysis_customer_confirmed_at?: string | null
  financial_analysis_payment_received_at?: string | null
  docsCount: number
  offersCount: number
  previewsCount: number
}

type EnrichedCaseRow = Omit<CaseRow, "advisor_status"> & {
  advisor_status: AdvisorCaseStatusValue
  case_filter: AdvisorCaseFilterValue
  special_group_label: string | null
}

type CaseListResp = { cases: CaseRow[] }
type ProductTab = ReturnType<typeof normalizeAdvisorCaseProduct>

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function normalizeAdvisorStatus(row: CaseRow, product: ProductTab): AdvisorCaseStatusValue {
  const raw = String(row.advisor_status ?? "").trim().toLowerCase()
  if (raw && getAdvisorCaseStatusSet(product).has(raw)) return raw as AdvisorCaseStatusValue
  const caseStatus = String(row.status ?? "").trim().toLowerCase()
  if (caseStatus === "closed" || caseStatus === "completed") return "abgeschlossen"
  return "neu"
}

function resolveSchufaFreeCaseFilter(row: CaseRow & { advisor_status: AdvisorCaseStatusValue }): AdvisorCaseFilterValue {
  const stored = row.advisor_status
  const financialAnalysisStatus = String(row.financial_analysis_service_status ?? "").trim().toLowerCase()
  const hasFinancialAnalysisConfirmation =
    Boolean(row.financial_analysis_customer_confirmed_at) || financialAnalysisStatus === "customer_confirmed"
  const hasFinancialAnalysisPaymentOrActivation =
    Boolean(row.financial_analysis_payment_received_at) ||
    financialAnalysisStatus === "payment_received" ||
    financialAnalysisStatus === "active"
  const financialAnalysisStillOpen = financialAnalysisStatus !== "expired" && financialAnalysisStatus !== "cancelled"

  if (stored === "bankeinreichung" || stored === "abgelehnt" || stored === "abgeschlossen") {
    return stored
  }

  if (hasFinancialAnalysisConfirmation && !hasFinancialAnalysisPaymentOrActivation && financialAnalysisStillOpen) {
    return "temp_finanzanalyse"
  }

  if (stored === "finanzanalyse" || hasFinancialAnalysisPaymentOrActivation) {
    return "finanzanalyse"
  }

  const secondFormCompleted = Boolean(row.schufa_submitted_to_skag_at || row.schufa_completed_application_at)
  if (!secondFormCompleted) return "lead"

  return stored
}

function resolveCaseFilter(row: CaseRow & { advisor_status: AdvisorCaseStatusValue }, product: ProductTab): AdvisorCaseFilterValue {
  if (product === "schufa_frei") return resolveSchufaFreeCaseFilter(row)
  return row.advisor_status
}

function statusLabel(value: string, product: ProductTab) {
  return getAdvisorCaseStatusLabel(value, product)
}

function filterLabel(value: AdvisorCaseFilterValue, product: ProductTab) {
  return getAdvisorCaseFilterLabel(value, product)
}

function specialGroupBadgeClass(value: AdvisorCaseFilterValue) {
  if (value === "lead") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  if (value === "temp_finanzanalyse") {
    return "border-cyan-200 bg-cyan-50 text-cyan-900"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function shouldAlwaysShowTab(product: ProductTab, value: AdvisorCaseFilterValue) {
  if (product !== "schufa_frei") return false
  return value === "temp_finanzanalyse" || value === "finanzanalyse"
}

function normalizeProduct(value: string | string[] | undefined): ProductTab {
  const raw = Array.isArray(value) ? value[0] : value
  if (!String(raw ?? "").trim()) return "schufa_frei"
  return normalizeAdvisorCaseProduct(raw)
}

function productHref(product: ProductTab) {
  if (product === "konsum") return "/advisor/faelle?product=konsum"
  if (product === "schufa_frei") return "/advisor/faelle"
  return "/advisor/faelle?product=baufi"
}

function statusHref(product: ProductTab, status: AdvisorCaseFilterValue) {
  const params = new URLSearchParams()
  if (product !== "schufa_frei") params.set("product", product)
  params.set("tab", status)
  return `/advisor/faelle?${params.toString()}`
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams?:
    | { tab?: string | string[]; product?: string | string[] }
    | Promise<{ tab?: string | string[]; product?: string | string[] }>
}) {
  await requireAdvisor()

  const resolvedSearchParams = await searchParams
  const product = normalizeProduct(resolvedSearchParams?.product)
  const statusTabs = getAdvisorCaseFilterOptions(product)
  const statusSet = getAdvisorCaseFilterSet(product)
  const productLabel = product === "konsum" ? "Privatkredit" : product === "schufa_frei" ? "Kredit ohne Schufa" : "Baufinanzierung"
  const [activeRes, confirmedRes] = await Promise.all([
    authFetch(`/api/app/cases/list?advisorBucket=all&limit=1000&caseType=${product}`).catch(() => null),
    authFetch(`/api/app/cases/list?advisorBucket=confirmed&limit=1&caseType=${product}`).catch(() => null),
  ])

  const data: CaseListResp = activeRes && activeRes.ok ? await activeRes.json() : { cases: [] }
  const confirmedMeta: { total?: number } = confirmedRes && confirmedRes.ok ? await confirmedRes.json() : {}
  const confirmedCount = Number(confirmedMeta?.total ?? 0)
  const enrichedCases: EnrichedCaseRow[] = data.cases.map((c) => {
    const advisorStatus = normalizeAdvisorStatus(c, product)
    const caseFilter = resolveCaseFilter({ ...c, advisor_status: advisorStatus }, product)
    return {
      ...c,
      advisor_status: advisorStatus,
      case_filter: caseFilter,
      special_group_label:
        caseFilter === "lead" || caseFilter === "temp_finanzanalyse" ? filterLabel(caseFilter, product) : null,
    }
  })

  const totalCases = enrichedCases.length
  const withComparison = enrichedCases.filter((c) => c.previewsCount > 0).length
  const withOffers = enrichedCases.filter((c) => c.offersCount > 0).length
  const leadCount = enrichedCases.filter((c) => c.case_filter === "lead").length
  const tempFinancialAnalysisCount = enrichedCases.filter((c) => c.case_filter === "temp_finanzanalyse").length
  const bankSubmissionCount = enrichedCases.filter((c) => c.case_filter === "bankeinreichung").length

  const activeTab = (() => {
    const rawParam = Array.isArray(resolvedSearchParams?.tab) ? resolvedSearchParams?.tab[0] : resolvedSearchParams?.tab
    const raw = String(rawParam ?? "").trim().toLowerCase()
    if (statusSet.has(raw)) return raw as AdvisorCaseFilterValue
    return product === "schufa_frei" ? "lead" : "neu"
  })()

  const countsByStatus = new Map<AdvisorCaseFilterValue, number>()
  for (const row of enrichedCases) {
    countsByStatus.set(row.case_filter, (countsByStatus.get(row.case_filter) ?? 0) + 1)
  }

  const visibleTabs = statusTabs.filter(
    (tab) => (countsByStatus.get(tab.value) ?? 0) > 0 || tab.value === activeTab || shouldAlwaysShowTab(product, tab.value)
  )
  const scopedCases = enrichedCases.filter((c) => c.case_filter === activeTab)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Fälle</h1>
          <Link
            href={product === "schufa_frei" ? "/advisor/faelle/bestaetigt" : `/advisor/faelle/bestaetigt?product=${product}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          >
            Bestätigte Fälle ({confirmedCount})
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Bereich: <span className="font-medium text-slate-900">{productLabel}</span>.
          {product === "schufa_frei" ? (
            <>
              {" "}
              <span className="font-medium text-amber-700">Lead</span> zeigt offene Zweitformulare.
              {" "}
              <span className="font-medium text-cyan-700">Temp. Finanzanalyse</span> zeigt bestätigte
              Finanzanalyse-Fälle vor Zahlung bzw. Freischaltung.{" "}
              <span className="font-medium text-slate-900">Finanzanalyse</span> zeigt freigeschaltete oder aktiv bearbeitete Fälle.
            </>
          ) : (
            <>
              {" "}
              Bankseitig bestätigte Fälle finden Sie auf der separaten Seite
              <span className="font-medium text-slate-900"> Bestätigte Fälle</span>.
            </>
          )}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {([
            { id: "schufa_frei" as const, label: "Kredit ohne Schufa" },
            { id: "baufi" as const, label: "Baufinanzierung" },
            { id: "konsum" as const, label: "Privatkredit" },
          ] as const).map((tab) => {
            const active = product === tab.id
            return (
              <Link
                key={tab.id}
                href={productHref(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {product === "schufa_frei" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">Gesamt</div>
            <div className="text-lg font-semibold text-slate-900">{totalCases}</div>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 shadow-sm">
            <div className="text-xs text-amber-700">Lead</div>
            <div className="text-lg font-semibold text-amber-950">{leadCount}</div>
          </div>
          <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/60 p-4 shadow-sm">
            <div className="text-xs text-cyan-700">Temp. Finanzanalyse</div>
            <div className="text-lg font-semibold text-cyan-950">{tempFinancialAnalysisCount}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 shadow-sm">
            <div className="text-xs text-emerald-700">Bankeinreichung</div>
            <div className="text-lg font-semibold text-emerald-950">{bankSubmissionCount}</div>
          </div>
        </div>
      ) : (
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
      )}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.value
            const count = countsByStatus.get(tab.value) ?? 0
            return (
              <Link
                key={tab.value}
                href={statusHref(product, tab.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {scopedCases.map((c) => {
          const customerLabel = c.customer_name || "Kunde -"
          const isSchufaCase = product === "schufa_frei"

          return (
            <div key={c.id} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/advisor/faelle/${c.id}`} className="truncate text-sm font-semibold text-slate-900">
                    Fall {c.case_ref || c.id.slice(0, 8)}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">{customerLabel}</div>
                </div>
                <div className="text-xs text-slate-600">{dt(c.created_at)}</div>
              </div>

              {c.special_group_label ? (
                <div
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${specialGroupBadgeClass(c.case_filter)}`}
                >
                  {c.special_group_label}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
                {isSchufaCase ? (
                  <div>
                    <div className="mb-2">Versicherung</div>
                    <AdvisorInsuranceForwardButton caseId={c.id} initialRouted={Boolean(c.insurance_routed_at)} />
                  </div>
                ) : (
                  <div>
                    Vorgangsnummer:{" "}
                    <span className="font-medium text-slate-900">{c.advisor_case_ref || "-"}</span>
                  </div>
                )}
                <div>
                  Bearbeitung: <span className="font-medium text-slate-900">{statusLabel(c.advisor_status, product)}</span>
                </div>
              </div>
            </div>
          )
        })}

        {scopedCases.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Noch keine {productLabel}-Fälle in dieser Gruppe vorhanden.
          </div>
        ) : null}
      </div>

      <div className="hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm lg:block">
        <div className="text-sm font-medium text-slate-900">Übersicht</div>
        {product === "schufa_frei" ? (
          <div className="mt-1 text-xs text-slate-500">
            Gruppe trennt offene Zweitformulare, bestätigte Finanzanalyse vor Zahlung und die reguläre Finanzanalyse nach
            Freischaltung. Der Select bleibt der eigentliche Bearbeitungsstatus.
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall-ID</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Telefon</th>
                {product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Gruppe</th> : null}
                <th className="px-4 py-3 font-medium text-slate-700">{product === "schufa_frei" ? "Versicherung" : "Vorgangsnummer"}</th>
                <th className="px-4 py-3 font-medium text-slate-700">{product === "schufa_frei" ? "Bearbeitung" : "Status"}</th>
              </tr>
            </thead>

            <tbody>
              {scopedCases.map((c) => {
                const customerLabel = c.customer_name || "Kunde -"
                const customerPhone = String(c.customer_phone ?? "").trim() || "-"

                return (
                  <tr key={c.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/advisor/faelle/${c.id}`} className="block">
                        <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">{dt(c.created_at)}</div>
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{customerLabel}</td>

                    <td className="px-4 py-3 text-slate-700">{customerPhone}</td>

                    {product === "schufa_frei" ? (
                      <td className="px-4 py-3">
                        <div className="min-h-8">
                          {c.special_group_label ? (
                            <div
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${specialGroupBadgeClass(c.case_filter)}`}
                            >
                              {c.special_group_label}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                    ) : null}

                    <td className="px-4 py-3">
                      {product === "schufa_frei" ? (
                        <AdvisorInsuranceForwardButton caseId={c.id} initialRouted={Boolean(c.insurance_routed_at)} />
                      ) : (
                        c.advisor_case_ref || "-"
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <AdvisorCaseStatusSelect caseId={c.id} value={c.advisor_status} caseType={c.case_type} compact />
                    </td>
                  </tr>
                )
              })}

              {scopedCases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={product === "schufa_frei" ? 6 : 5}>
                    Noch keine {productLabel}-Fälle in dieser Gruppe vorhanden.
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
