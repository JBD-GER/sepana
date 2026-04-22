import Link from "next/link"
import { translateCaseStatus } from "@/lib/caseStatus"
import { requireInsurance } from "@/lib/insurance/requireInsurance"
import {
  formatEuro,
  getInsuranceRouteSourceLabel,
  getInsuranceRouteStatusLabel,
  isInsuranceInvoiceType,
} from "@/lib/insurance/invoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type InsuranceProfile = {
  partner_code: string | null
  company_name: string | null
  display_name: string | null
  photo_path: string | null
  email: string | null
  phone: string | null
}

type InsuranceRouteRow = {
  case_id: string
  route_source?: string | null
  route_status?: string | null
  routed_at?: string | null
  updated_at?: string | null
}

type CaseRow = {
  id: string
  case_ref: string | null
  status: string | null
  created_at: string | null
}

type ApplicantRow = {
  case_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
}

type InsuranceDashboardDetailsRow = {
  case_id: string
  loan_amount_requested: number | null
  term_months: number | null
  completed_application_at: string | null
  submitted_to_skag_at: string | null
  net_income_monthly: number | null
  additional_income_monthly: number | null
}

type DocumentRow = {
  id: string
  case_id: string
}

type InvoiceRow = {
  id: string
  case_id: string
  invoice_type: string | null
  invoice_number: string | null
  created_at: string | null
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function normalizeFilterValue(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return normalized || "all"
}

function numberOrNull(value: number | string | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function getIncomeDisplay(details: {
  net_income_monthly?: number | null
  additional_income_monthly?: number | null
} | null | undefined) {
  const netIncome = numberOrNull(details?.net_income_monthly)
  const additionalIncome = numberOrNull(details?.additional_income_monthly)

  if (netIncome === null && additionalIncome === null) {
    return {
      primary: "-",
      secondary: "Keine Angabe",
    }
  }

  if (netIncome !== null && additionalIncome !== null && additionalIncome !== 0) {
    return {
      primary: formatEuro(netIncome + additionalIncome),
      secondary: `Netto ${formatEuro(netIncome)} + Zusatz ${formatEuro(additionalIncome)}`,
    }
  }

  if (netIncome !== null) {
    return {
      primary: formatEuro(netIncome),
      secondary: "Netto / Monat",
    }
  }

  return {
    primary: formatEuro(additionalIncome),
    secondary: "Nur Zusatzeinkommen",
  }
}

export default async function InsuranceDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ caseStatus?: string | string[] }>
}) {
  const { user, role } = await requireInsurance()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedCaseStatus = normalizeFilterValue(resolvedSearchParams?.caseStatus)
  const admin = supabaseAdmin()

  const [profileResult, routesResult] = await Promise.all([
    role === "insurance"
      ? admin
          .from("insurance_partner_profiles")
          .select("partner_code,company_name,display_name,photo_path,email,phone")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as InsuranceProfile | null }),
    admin
      .from("case_insurance_routes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(300),
  ])

  const profile = (profileResult.data ?? null) as InsuranceProfile | null
  const routes = (routesResult.data ?? []) as InsuranceRouteRow[]
  const caseIds = Array.from(new Set(routes.map((route) => route.case_id).filter(Boolean)))

  const [caseRowsResult, applicantRowsResult, detailsRowsResult, documentRowsResult, invoiceRowsResult] = await Promise.all([
    caseIds.length
      ? admin
          .from("cases")
          .select("id,case_ref,status,created_at")
          .in("id", caseIds)
      : Promise.resolve({ data: [] as CaseRow[] }),
    caseIds.length
      ? admin
          .from("case_applicants")
          .select("case_id,first_name,last_name,email,phone")
          .in("case_id", caseIds)
          .eq("role", "primary")
      : Promise.resolve({ data: [] as ApplicantRow[] }),
    caseIds.length
      ? admin
          .from("case_schufa_free_details")
          .select(
            "case_id,loan_amount_requested,term_months,completed_application_at,submitted_to_skag_at,net_income_monthly,additional_income_monthly"
          )
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as InsuranceDashboardDetailsRow[] }),
    caseIds.length
      ? admin.from("documents").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as DocumentRow[] }),
    caseIds.length
      ? admin
          .from("case_invoices")
          .select("id,case_id,invoice_type,invoice_number,created_at")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as InvoiceRow[] }),
  ])

  const caseRows = (caseRowsResult.data ?? []) as CaseRow[]
  const applicantRows = (applicantRowsResult.data ?? []) as ApplicantRow[]
  const detailsRows = (detailsRowsResult.data ?? []) as InsuranceDashboardDetailsRow[]
  const documentRows = (documentRowsResult.data ?? []) as DocumentRow[]
  const invoiceRows = (invoiceRowsResult.data ?? []) as InvoiceRow[]

  const caseById = new Map(caseRows.map((row) => [row.id, row] as const))
  const applicantByCaseId = new Map(applicantRows.map((row) => [row.case_id, row] as const))
  const detailsByCaseId = new Map(detailsRows.map((row) => [row.case_id, row] as const))
  const documentCountByCaseId = new Map<string, number>()
  for (const row of documentRows) {
    documentCountByCaseId.set(row.case_id, (documentCountByCaseId.get(row.case_id) ?? 0) + 1)
  }
  const invoiceByCaseId = new Map<string, InvoiceRow>()
  for (const row of invoiceRows) {
    if (isInsuranceInvoiceType(row.invoice_type) && !invoiceByCaseId.has(row.case_id)) {
      invoiceByCaseId.set(row.case_id, row)
    }
  }

  const countsByStatus = new Map<string, number>()
  for (const route of routes) {
    const key = String(route.route_status ?? "new")
    countsByStatus.set(key, (countsByStatus.get(key) ?? 0) + 1)
  }

  const activeCount = routes.filter((route) => {
    const status = String(route.route_status ?? "").trim().toLowerCase()
    return status !== "completed" && status !== "rejected"
  }).length
  const caseStatusOptions = Array.from(
    new Set(
      routes
        .map((route) => String(caseById.get(route.case_id)?.status ?? "").trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => translateCaseStatus(a).localeCompare(translateCaseStatus(b), "de"))
  const filteredRoutes =
    selectedCaseStatus === "all"
      ? routes
      : routes.filter((route) => String(caseById.get(route.case_id)?.status ?? "").trim().toLowerCase() === selectedCaseStatus)

  const avatarPath = String(profile?.photo_path ?? "").trim()
  const avatarUrl = avatarPath
    ? `/api/baufi/logo?bucket=insurance_partner_avatars&width=192&height=192&resize=cover&path=${encodeURIComponent(avatarPath)}`
    : null

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),linear-gradient(135deg,#0f172a,#14532d)] p-5 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
              Versicherungs-Dashboard
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
              {profile?.company_name ?? profile?.display_name ?? "Versicherungsbereich"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-200/90">
              Alle intern weitergeleiteten Kredit-ohne-Schufa-Faelle mit kompletter Dateneinsicht, Notizen,
              Statuspflege, Dokumentdownloads und interner Provisionsrechnung.
            </p>
          </div>

          <div className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:w-auto">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-100">{profile?.partner_code ?? "VP"}</span>
              )}
            </div>
            <div className="min-w-0 text-xs text-slate-200/90">
              <div className="font-semibold text-white">{profile?.display_name ?? user.email ?? "Partner"}</div>
              <div className="break-all">{profile?.email ?? user.email ?? "-"}</div>
              <div>Partner-ID: {profile?.partner_code ?? "-"}</div>
              <div>{profile?.phone ?? "-"}</div>
            </div>
          </div>
        </div>
      </section>

      {role === "admin" ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
          Als Admin verwalten Sie Partner am besten unter{" "}
          <Link href="/admin/versicherungspartner" className="font-semibold underline underline-offset-4">
            /admin/versicherungspartner
          </Link>
          . Dieses Dashboard zeigt Ihnen trotzdem die intern weitergeleiteten Faelle.
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Weitergeleitete Faelle</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{routes.length}</div>
          <p className="mt-2 text-sm text-slate-600">Alle automatisch und manuell uebergebenen Faelle.</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktiv</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{activeCount}</div>
          <p className="mt-2 text-sm text-slate-600">Noch in Bearbeitung oder mit offener Rueckmeldung.</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Abgeschlossen</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{countsByStatus.get("completed") ?? 0}</div>
          <p className="mt-2 text-sm text-slate-600">Faelle mit final abgeschlossener Versicherungsbearbeitung.</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Abgelehnt</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{countsByStatus.get("rejected") ?? 0}</div>
          <p className="mt-2 text-sm text-slate-600">Faelle ohne Versicherungsabschluss.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Falluebersicht</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Alle uebergebenen Faelle</h2>
            <p className="mt-1 text-sm text-slate-600">
              Sichtbar sind negative Vorpruefungen und manuell weitergeleitete Kredit-ohne-Schufa-Faelle.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {selectedCaseStatus === "all" ? `${filteredRoutes.length} Eintraege` : `${filteredRoutes.length} von ${routes.length} Eintraegen`}
          </div>
        </div>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="insurance-case-status-filter" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Beratungsstatus filtern
            </label>
            <select
              id="insurance-case-status-filter"
              name="caseStatus"
              defaultValue={selectedCaseStatus}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="all">Alle Beratungsstatus</option>
              {caseStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {translateCaseStatus(status)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
          >
            Filtern
          </button>
          {selectedCaseStatus !== "all" ? (
            <Link
              href="/versicherung"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
            >
              Zuruecksetzen
            </Link>
          ) : null}
        </form>

        <div className="grid gap-3 md:hidden">
          {filteredRoutes.map((route) => {
            const caseRow = caseById.get(route.case_id)
            const applicant = applicantByCaseId.get(route.case_id)
            const details = detailsByCaseId.get(route.case_id)
            const documentCount = documentCountByCaseId.get(route.case_id) ?? 0
            const invoice = invoiceByCaseId.get(route.case_id)
            const customerName = [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ").trim() || "-"
            const loanAmount = Number(details?.loan_amount_requested ?? 0)
            const caseStatusLabel = translateCaseStatus(caseRow?.status)
            const income = getIncomeDisplay(details)

            return (
              <div key={route.case_id} className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{caseRow?.case_ref ?? route.case_id.slice(0, 8)}</div>
                    <div className="mt-1 text-xs text-slate-500">{customerName}</div>
                    <div className="mt-1 text-xs text-slate-500">{applicant?.phone ?? "-"}</div>
                  </div>
                  <span className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {getInsuranceRouteStatusLabel(route.route_status)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="uppercase tracking-[0.12em] text-slate-400">Variante</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {loanAmount > 0 ? loanAmount.toLocaleString("de-DE") : "-"} EUR
                    </div>
                    <div className="mt-1 text-slate-500">{details?.term_months ?? "-"} Monate</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="uppercase tracking-[0.12em] text-slate-400">Einkommen</div>
                    <div className="mt-1 font-medium text-slate-900">{income.primary}</div>
                    <div className="mt-1 text-slate-500">{income.secondary}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="uppercase tracking-[0.12em] text-slate-400">Beratung</div>
                    <div className="mt-1 font-medium text-slate-900">{caseStatusLabel}</div>
                    <div className="mt-1 text-slate-500">SEPANA-Fallstatus</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="uppercase tracking-[0.12em] text-slate-400">Unterlagen</div>
                    <div className="mt-1 font-medium text-slate-900">{documentCount} Datei(en)</div>
                    <div className="mt-1 text-slate-500">Uebergeben: {formatDateTime(route.routed_at)}</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">{getInsuranceRouteSourceLabel(route.route_source)}</div>
                {invoice ? (
                  <div className="mt-1 text-xs text-cyan-700">Rechnung {invoice.invoice_number ?? invoice.id.slice(0, 8)}</div>
                ) : null}

                <Link
                  href={`/versicherung/faelle/${route.case_id}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                >
                  Fall oeffnen
                </Link>
              </div>
            )
          })}

          {filteredRoutes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              {selectedCaseStatus === "all"
                ? "Noch keine uebergebenen Faelle vorhanden."
                : `Keine Faelle mit Beratungsstatus ${translateCaseStatus(selectedCaseStatus)} gefunden.`}
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200/70 md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Telefon</th>
                <th className="px-4 py-3 font-medium text-slate-700">Versicherungsstatus</th>
                <th className="px-4 py-3 font-medium text-slate-700">Beratungsstatus</th>
                <th className="px-4 py-3 font-medium text-slate-700">Einkommen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Variante</th>
                <th className="px-4 py-3 font-medium text-slate-700">Dokumente</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((route) => {
                const caseRow = caseById.get(route.case_id)
                const applicant = applicantByCaseId.get(route.case_id)
                const details = detailsByCaseId.get(route.case_id)
                const documentCount = documentCountByCaseId.get(route.case_id) ?? 0
                const invoice = invoiceByCaseId.get(route.case_id)
                const customerName = [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ").trim() || "-"
                const caseStatusLabel = translateCaseStatus(caseRow?.status)
                const income = getIncomeDisplay(details)
                return (
                  <tr key={route.case_id} className="border-b border-slate-200/60 align-top last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{caseRow?.case_ref ?? route.case_id.slice(0, 8)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Uebergeben: {formatDateTime(route.routed_at)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{getInsuranceRouteSourceLabel(route.route_source)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{customerName}</div>
                      <div className="mt-1 text-xs text-slate-500">{applicant?.email ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{applicant?.phone ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                        {getInsuranceRouteStatusLabel(route.route_status)}
                      </span>
                      {invoice ? (
                        <div className="mt-2 text-xs text-cyan-700">Rechnung {invoice.invoice_number ?? invoice.id.slice(0, 8)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{caseStatusLabel}</div>
                      <div className="mt-1 text-xs text-slate-500">SEPANA-Fallstatus</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{income.primary}</div>
                      <div className="mt-1 text-xs text-slate-500">{income.secondary}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{details?.loan_amount_requested?.toLocaleString("de-DE") ?? "-"} EUR</div>
                      <div className="mt-1 text-xs text-slate-500">{details?.term_months ?? "-"} Monate</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{documentCount} Datei(en)</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Vollantrag: {formatDateTime(details?.completed_application_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/versicherung/faelle/${route.case_id}`}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                      >
                        Fall oeffnen
                      </Link>
                    </td>
                  </tr>
                )
              })}

              {filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    {selectedCaseStatus === "all"
                      ? "Noch keine uebergebenen Faelle vorhanden."
                      : `Keine Faelle mit Beratungsstatus ${translateCaseStatus(selectedCaseStatus)} gefunden.`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
