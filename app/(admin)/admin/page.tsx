import { requireAdmin } from "@/lib/admin/requireAdmin"
import MetricCard from "./ui/MetricCard"

function eur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)
}

export default async function AdminDashboard() {
  const { supabase, session } = await requireAdmin()

  const [{ data: offers }, { data: cases }, { data: docs }] = await Promise.all([
    supabase
      .from("case_offers")
      .select("loan_amount,status,created_at")
      .in("status", ["sent", "accepted"]),
    supabase.from("cases").select("id,status,case_type,created_at"),
    supabase.from("documents").select("id,size_bytes,created_at"),
  ])

  const offerVolume = (offers ?? []).reduce((sum, o) => sum + Number(o.loan_amount ?? 0), 0)
  const closedVolume = (offers ?? [])
    .filter((o) => o.status === "accepted")
    .reduce((sum, o) => sum + Number(o.loan_amount ?? 0), 0)

  const openCases = (cases ?? []).filter((c) => c.status !== "closed").length
  const totalCases = (cases ?? []).length

  const docsCount = (docs ?? []).length
  const docsSize = (docs ?? []).reduce((sum, d) => sum + Number(d.size_bytes ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Übersicht</h1>
        <p className="mt-1 text-sm text-slate-600">
          Eingeloggt als: <span className="font-medium text-slate-900">{session.user.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Angebotsvolumen" value={eur(offerVolume)} hint="Summe gesendet + akzeptiert" />
        <MetricCard label="Abgeschlossenes Volumen" value={eur(closedVolume)} hint="Nur akzeptierte Angebote" />
        <MetricCard label="Fälle" value={`${openCases} offen`} hint={`${totalCases} gesamt`} />
        <MetricCard label="Unterlagen" value={`${docsCount} Dateien`} hint={`${Math.round(docsSize / 1024 / 1024)} MB`} />
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Quick Actions</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/admin/berater"
            className="rounded-xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
          >
            Berater einladen
          </a>
          <a
            href="/admin/faelle"
            className="rounded-xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
          >
            Fälle verwalten
          </a>
        </div>
      </div>
    </div>
  )
}
