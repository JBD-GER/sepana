import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import EditTippgeberForm from "./ui/EditTippgeberForm"

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function eur(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

export default async function AdminTippgeberEditPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  await requireAdmin()
  const { userId } = await params
  const admin = supabaseAdmin()

  const [{ data: profile }, { data: referrals }] = await Promise.all([
    admin
      .from("tippgeber_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("tippgeber_referrals")
      .select("id,created_at,commission_status,commission_gross_amount")
      .eq("tippgeber_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (!profile) notFound()

  const openCommission = (referrals ?? [])
    .filter((r) => String((r as { commission_status?: string | null }).commission_status ?? "") === "open")
    .reduce((sum, r) => sum + Number((r as { commission_gross_amount?: number | null }).commission_gross_amount ?? 0), 0)
  const paidCommission = (referrals ?? [])
    .filter((r) => String((r as { commission_status?: string | null }).commission_status ?? "") === "paid")
    .reduce((sum, r) => sum + Number((r as { commission_gross_amount?: number | null }).commission_gross_amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/tippgeber" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              {"<-"} Zurück zu Tippgeber
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{String(profile.company_name ?? "Tippgeber")}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Tippgeber-ID: <span className="font-mono text-slate-900">{userId}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-xs text-slate-600">Status</div>
            <div className="font-medium text-slate-900">{profile.is_active === false ? "Deaktiviert" : "Aktiv"}</div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tipps</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{(referrals ?? []).length}</div>
          <div className="mt-2 text-sm text-slate-600">Letzte 50 Tipps in dieser Übersicht.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Offene Provision</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{eur(openCommission)}</div>
          <div className="mt-2 text-sm text-slate-600">Summe aus offenen Provisionspositionen.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ausgezahlt</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{eur(paidCommission)}</div>
          <div className="mt-2 text-sm text-slate-600">Bereits freigegebene Provisionen.</div>
        </div>
      </section>

      <EditTippgeberForm
        userId={userId}
        initial={{
          companyName: String(profile.company_name ?? ""),
          street: String(profile.address_street ?? ""),
          houseNumber: String(profile.address_house_number ?? ""),
          zip: String(profile.address_zip ?? ""),
          city: String(profile.address_city ?? ""),
          email: String(profile.email ?? ""),
          phone: String(profile.phone ?? ""),
          logoPath: profile.logo_path ? String(profile.logo_path) : null,
          isActive: profile.is_active !== false,
        }}
      />

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Letzte Tipps</div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Tipp</th>
                <th className="px-4 py-3 font-medium text-slate-700">Eingang</th>
                <th className="px-4 py-3 font-medium text-slate-700">Provisionsstatus</th>
                <th className="px-4 py-3 font-medium text-slate-700">Provision brutto</th>
              </tr>
            </thead>
            <tbody>
              {(referrals ?? []).map((r) => {
                const row = r as {
                  id: string
                  created_at: string | null
                  commission_status: string | null
                  commission_gross_amount: number | null
                }
                return (
                  <tr key={row.id} className="border-b border-slate-200/60 last:border-0">
                    <td className="px-4 py-3 text-slate-900">{row.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-700">{dt(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.commission_status || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{eur(row.commission_gross_amount)}</td>
                  </tr>
                )
              })}
              {(referrals ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Noch keine Tipps vorhanden.
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
