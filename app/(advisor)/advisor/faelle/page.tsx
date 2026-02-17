import Link from "next/link"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"
import AdvisorCaseStatusSelect from "./ui/AdvisorCaseStatusSelect"

type CaseRow = {
  id: string
  case_ref: string | null
  advisor_case_ref: string | null
  advisor_status: string | null
  customer_name?: string | null
  customer_phone?: string | null
  status: string
  status_display?: string | null
  created_at: string
  assigned_advisor_id: string | null

  docsCount: number
  offersCount: number
  previewsCount: number
}

type CaseListResp = { cases: CaseRow[] }

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

const STATUS_TABS = [
  { value: "neu", label: "Neu" },
  { value: "kontaktaufnahme", label: "Kontaktaufnahme" },
  { value: "terminiert", label: "Terminiert" },
  { value: "angebot", label: "Angebot" },
  { value: "nachfrage", label: "Nachfrage" },
  { value: "abgelehnt", label: "Abgelehnt" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
] as const

const STATUS_SET = new Set<string>(STATUS_TABS.map((s) => s.value))

function normalizeAdvisorStatus(row: CaseRow) {
  const raw = String(row.advisor_status ?? "").trim().toLowerCase()
  if (raw && STATUS_SET.has(raw)) return raw
  const caseStatus = String(row.status ?? "").trim().toLowerCase()
  if (caseStatus === "closed" || caseStatus === "completed") return "abgeschlossen"
  return "neu"
}

function statusLabel(value: string) {
  return STATUS_TABS.find((s) => s.value === value)?.label ?? "Neu"
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: { tab?: string | string[] } | Promise<{ tab?: string | string[] }>
}) {
  await requireAdvisor()

  const resolvedSearchParams = await searchParams
  const [activeRes, confirmedRes] = await Promise.all([
    authFetch("/api/app/cases/list?advisorBucket=all&limit=1000").catch(() => null),
    authFetch("/api/app/cases/list?advisorBucket=confirmed&limit=1").catch(() => null),
  ])

  const data: CaseListResp = activeRes && activeRes.ok ? await activeRes.json() : { cases: [] }
  const confirmedMeta: { total?: number } = confirmedRes && confirmedRes.ok ? await confirmedRes.json() : {}
  const confirmedCount = Number(confirmedMeta?.total ?? 0)
  const enrichedCases = data.cases.map((c) => ({
    ...c,
    advisor_status: normalizeAdvisorStatus(c),
  }))
  const totalCases = enrichedCases.length
  const withComparison = enrichedCases.filter((c) => c.previewsCount > 0).length
  const withOffers = enrichedCases.filter((c) => c.offersCount > 0).length
  const activeTab = (() => {
    const rawParam = Array.isArray(resolvedSearchParams?.tab) ? resolvedSearchParams?.tab[0] : resolvedSearchParams?.tab
    const raw = String(rawParam ?? "").trim().toLowerCase()
    return STATUS_SET.has(raw) ? raw : "neu"
  })()

  const countsByStatus = new Map<string, number>()
  for (const row of enrichedCases) {
    const key = row.advisor_status ?? "neu"
    countsByStatus.set(key, (countsByStatus.get(key) ?? 0) + 1)
  }

  const scopedCases = enrichedCases.filter((c) => c.advisor_status === activeTab)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Faelle</h1>
          <Link
            href="/advisor/faelle/bestaetigt"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
          >
            Bestaetigte Faelle ({confirmedCount})
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Status wird pro Fall gepflegt. Bankseitig bestaetigte Faelle finden Sie auf der separaten Seite
          <span className="font-medium text-slate-900"> Bestaetigte Faelle</span>.
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

      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value
            const count = countsByStatus.get(tab.value) ?? 0
            return (
              <Link
                key={tab.value}
                href={`/advisor/faelle?tab=${tab.value}`}
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

      {/* Mobile-first: Cards */}
      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {scopedCases.map((c) => {
          const customerLabel = c.customer_name || "Kunde -"

          return (
            <div key={c.id} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/advisor/faelle/${c.id}`} className="text-sm font-semibold text-slate-900 truncate">
                    Fall {c.case_ref || c.id.slice(0, 8)}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">{customerLabel}</div>
                </div>
                <div className="text-xs text-slate-600">{dt(c.created_at)}</div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
                <div>
                  Vorgangsnummer:{" "}
                  <span className="font-medium text-slate-900">{c.advisor_case_ref || "-"}</span>
                </div>
                <div>
                  Status: <span className="font-medium text-slate-900">{statusLabel(c.advisor_status ?? "neu")}</span>
                </div>
              </div>
            </div>
          )
        })}

        {scopedCases.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Noch keine Faelle in diesem Status vorhanden.
          </div>
        ) : null}
      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Uebersicht</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall-ID</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Telefon</th>
                <th className="px-4 py-3 font-medium text-slate-700">Vorgangsnummer</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
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

                    <td className="px-4 py-3 text-slate-700">
                      {customerLabel}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {customerPhone}
                    </td>

                    <td className="px-4 py-3">
                      {c.advisor_case_ref || "-"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <AdvisorCaseStatusSelect caseId={c.id} value={c.advisor_status ?? "neu"} compact />
                    </td>
                  </tr>
                )
              })}

              {scopedCases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Noch keine Faelle in diesem Status vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-500">Tipp: Klicken Sie auf einen Fall fuer Details.</div>
      </div>
    </div>
  )
}
