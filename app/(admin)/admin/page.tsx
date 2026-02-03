import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import MetricCard from "./ui/MetricCard"
import { translateCaseStatus } from "@/lib/caseStatus"

function eur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

export default async function AdminDashboard() {
  const { user } = await requireAdmin()
  const admin = supabaseAdmin()
  const nowIso = new Date().toISOString()
  const last7DaysIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: offers },
    { data: cases },
    { data: docs },
    { data: advisors },
    { data: recentCases },
    { count: upcomingAppointments },
    { count: recentLogs },
  ] = await Promise.all([
    admin.from("case_offers").select("loan_amount,status,created_at").in("status", ["sent", "accepted"]),
    admin.from("cases").select("id,status,case_type,created_at").order("created_at", { ascending: false }),
    admin.from("documents").select("id,size_bytes,created_at"),
    admin.from("advisor_profiles").select("user_id,is_active"),
    admin
      .from("cases")
      .select("id,case_ref,status,case_type,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("case_appointments")
      .select("id", { count: "exact", head: true })
      .gte("end_at", nowIso),
    admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last7DaysIso),
  ])

  const offerVolume = (offers ?? []).reduce((sum, o) => sum + Number(o.loan_amount ?? 0), 0)
  const closedVolume = (offers ?? [])
    .filter((o) => o.status === "accepted")
    .reduce((sum, o) => sum + Number(o.loan_amount ?? 0), 0)

  const openCases = (cases ?? []).filter((c) => c.status !== "closed").length
  const totalCases = (cases ?? []).length

  const docsCount = (docs ?? []).length
  const docsSize = (docs ?? []).reduce((sum, d) => sum + Number(d.size_bytes ?? 0), 0)

  const advisorsTotal = (advisors ?? []).length
  const advisorsActive = (advisors ?? []).filter((a) => a.is_active !== false).length
  const advisorsInactive = advisorsTotal - advisorsActive

  const baufiCases = (cases ?? []).filter((c) => c.case_type === "baufi").length
  const konsumCases = (cases ?? []).filter((c) => c.case_type === "konsum").length

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Uebersicht</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Eingeloggt als: <span className="font-medium text-slate-900">{user.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/banken"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Banken verwalten
            </Link>
            <Link
              href="/admin/berater"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Berater verwalten
            </Link>
            <Link
              href="/admin/faelle"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Faelle & Unterlagen
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Angebotsvolumen" value={eur(offerVolume)} hint="Summe gesendet + akzeptiert" />
        <MetricCard label="Abgeschlossenes Volumen" value={eur(closedVolume)} hint="Nur akzeptierte Angebote" />
        <MetricCard label="Faelle" value={`${openCases} offen`} hint={`${totalCases} gesamt`} />
        <MetricCard label="Unterlagen" value={`${docsCount} Dateien`} hint={`${Math.round(docsSize / 1024 / 1024)} MB`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Kommende Termine"
          value={`${upcomingAppointments ?? 0}`}
          hint="Alle zukuenftigen Buchungen"
        />
        <MetricCard
          label="Logs (7 Tage)"
          value={`${recentLogs ?? 0}`}
          hint="Benachrichtigungen & Events"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Berater Status</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Gesamt</div>
              <div className="text-lg font-semibold text-slate-900">{advisorsTotal}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs text-emerald-700">Aktiv</div>
              <div className="text-lg font-semibold text-emerald-800">{advisorsActive}</div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
              <div className="text-xs text-red-700">Inaktiv</div>
              <div className="text-lg font-semibold text-red-800">{advisorsInactive}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Faelle nach Typ</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Baufi</div>
              <div className="text-lg font-semibold text-slate-900">{baufiCases}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Konsum</div>
              <div className="text-lg font-semibold text-slate-900">{konsumCases}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Quick Actions</div>
          <div className="mt-3 grid gap-2">
            <Link
              href="/admin/berater"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Berater einladen
            </Link>
            <Link
              href="/admin/banken"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Banken verwalten
            </Link>
            <Link
              href="/admin/faelle"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Faelle zuteilen
            </Link>
            <Link
              href="/admin/termine"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Termine verwalten
            </Link>
            <Link
              href="/admin/logs"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
            >
              Logs oeffnen
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">Neueste Faelle</div>
          <Link href="/admin/faelle" className="text-xs font-semibold text-slate-700 hover:underline">
            Alle anzeigen
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Typ</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Datum</th>
              </tr>
            </thead>
            <tbody>
              {(recentCases ?? []).map((c) => (
                <tr key={c.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{c.case_ref || c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{c.case_type}</td>
                  <td className="px-4 py-3 text-slate-700">{translateCaseStatus(c.status)}</td>
                  <td className="px-4 py-3 text-slate-700">{dt(c.created_at)}</td>
                </tr>
              ))}
              {(recentCases ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Keine Faelle gefunden.
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
