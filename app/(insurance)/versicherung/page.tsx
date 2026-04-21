import Link from "next/link"
import { requireInsurance } from "@/lib/insurance/requireInsurance"
import { getInsuranceRouteSourceLabel, getInsuranceRouteStatusLabel, isInsuranceInvoiceType } from "@/lib/insurance/invoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

export default async function InsuranceDashboardPage() {
  const { user, role } = await requireInsurance()
  const admin = supabaseAdmin()

  const [profileResult, routesResult] = await Promise.all([
    role === "insurance"
      ? admin
          .from("insurance_partner_profiles")
          .select("partner_code,company_name,display_name,photo_path,email,phone")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    admin
      .from("case_insurance_routes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(300),
  ])

  const profile = profileResult.data ?? null
  const routes = (routesResult.data ?? []) as Array<{
    case_id: string
    route_source?: string | null
    route_status?: string | null
    routed_at?: string | null
    updated_at?: string | null
  }>
  const caseIds = Array.from(new Set(routes.map((route) => route.case_id).filter(Boolean)))

  const [caseRowsResult, applicantRowsResult, detailsRowsResult, documentRowsResult, invoiceRowsResult] = await Promise.all([
    caseIds.length
      ? admin
          .from("cases")
          .select("id,case_ref,status,created_at")
          .in("id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin
          .from("case_applicants")
          .select("case_id,first_name,last_name,email,phone")
          .in("case_id", caseIds)
          .eq("role", "primary")
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin
          .from("case_schufa_free_details")
          .select("case_id,loan_amount_requested,term_months,completed_application_at,submitted_to_skag_at")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin.from("documents").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin
          .from("case_invoices")
          .select("id,case_id,invoice_type,invoice_number,created_at")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const caseById = new Map((caseRowsResult.data ?? []).map((row: any) => [row.id, row]))
  const applicantByCaseId = new Map((applicantRowsResult.data ?? []).map((row: any) => [row.case_id, row]))
  const detailsByCaseId = new Map((detailsRowsResult.data ?? []).map((row: any) => [row.case_id, row]))
  const documentCountByCaseId = new Map<string, number>()
  for (const row of documentRowsResult.data ?? []) {
    documentCountByCaseId.set(row.case_id, (documentCountByCaseId.get(row.case_id) ?? 0) + 1)
  }
  const invoiceByCaseId = new Map<string, any>()
  for (const row of invoiceRowsResult.data ?? []) {
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

  const avatarPath = String(profile?.photo_path ?? "").trim()
  const avatarUrl = avatarPath
    ? `/api/baufi/logo?bucket=insurance_partner_avatars&width=192&height=192&resize=cover&path=${encodeURIComponent(avatarPath)}`
    : null

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),linear-gradient(135deg,#0f172a,#14532d)] p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">
              Versicherungs-Dashboard
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile?.company_name ?? profile?.display_name ?? "Versicherungsbereich"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200/90">
              Alle intern weitergeleiteten Kredit-ohne-Schufa-Faelle mit kompletter Dateneinsicht, Notizen,
              Statuspflege, Dokumentdownloads und interner Provisionsrechnung.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-100">{profile?.partner_code ?? "VP"}</span>
              )}
            </div>
            <div className="text-xs text-slate-200/90">
              <div className="font-semibold text-white">{profile?.display_name ?? user.email ?? "Partner"}</div>
              <div>{profile?.email ?? user.email ?? "-"}</div>
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

      <section className="grid gap-4 md:grid-cols-4">
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
            {routes.length} Eintraege
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Variante</th>
                <th className="px-4 py-3 font-medium text-slate-700">Dokumente</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const caseRow = caseById.get(route.case_id)
                const applicant = applicantByCaseId.get(route.case_id)
                const details = detailsByCaseId.get(route.case_id)
                const documentCount = documentCountByCaseId.get(route.case_id) ?? 0
                const invoice = invoiceByCaseId.get(route.case_id)
                const customerName = [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ").trim() || "-"
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
                      <div className="text-xs text-slate-500">{applicant?.phone ?? "-"}</div>
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

              {routes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Noch keine uebergebenen Faelle vorhanden.
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
