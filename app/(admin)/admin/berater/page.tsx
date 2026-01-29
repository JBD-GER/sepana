import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import InviteAdvisorForm from "./ui/InviteAdvisorForm"

function eur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)
}

export default async function AdminAdvisorsPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  // Berater kommen aus profiles.role = advisor
  const { data: advisors } = await admin
    .from("profiles")
    .select("user_id,created_at")
    .eq("role", "advisor")
    .order("created_at", { ascending: false })

  const advisorIds = (advisors ?? []).map((a) => a.user_id)

  // Cases + Offer KPIs pro Berater
  const { data: cases } = advisorIds.length
    ? await admin.from("cases").select("id,assigned_advisor_id").in("assigned_advisor_id", advisorIds)
    : { data: [] as any[] }

  const { data: offers } = advisorIds.length
    ? await admin
        .from("case_offers")
        .select("id,provider_id,case_id,loan_amount,status")
        .in("status", ["sent", "accepted"])
    : { data: [] as any[] }

  const casesByAdvisor = new Map<string, number>()
  for (const c of cases ?? []) {
    if (!c.assigned_advisor_id) continue
    casesByAdvisor.set(c.assigned_advisor_id, (casesByAdvisor.get(c.assigned_advisor_id) ?? 0) + 1)
  }

  // Offer-Volume: wir summieren je Advisor über Cases (über case_id -> assigned_advisor_id)
  const caseToAdvisor = new Map<string, string>()
  for (const c of cases ?? []) if (c.assigned_advisor_id) caseToAdvisor.set(c.id, c.assigned_advisor_id)

  const offerVolByAdvisor = new Map<string, number>()
  const closedVolByAdvisor = new Map<string, number>()

  for (const o of offers ?? []) {
    const adv = caseToAdvisor.get(o.case_id)
    if (!adv) continue
    const amount = Number(o.loan_amount ?? 0)
    offerVolByAdvisor.set(adv, (offerVolByAdvisor.get(adv) ?? 0) + amount)
    if (o.status === "accepted") closedVolByAdvisor.set(adv, (closedVolByAdvisor.get(adv) ?? 0) + amount)
  }

  // Emails nur über Auth Admin API sinnvoll abrufbar
  // (Wir holen alles in einem Rutsch und mappen)
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
  const emailById = new Map<string, string>()
  for (const u of usersPage.users) emailById.set(u.id, u.email ?? "")

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Berater</h1>
        <p className="mt-1 text-sm text-slate-600">
          Berater per Einladung hinzufügen und KPIs je Berater ansehen.
        </p>
      </div>

      <InviteAdvisorForm />

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Beraterliste</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">E-Mail</th>
                <th className="px-4 py-3 font-medium text-slate-700">Zugewiesene Fälle</th>
                <th className="px-4 py-3 font-medium text-slate-700">Angebotsvolumen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Abgeschlossen</th>
              </tr>
            </thead>
            <tbody>
              {(advisors ?? []).map((a) => {
                const id = a.user_id
                return (
                  <tr key={id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-900">{emailById.get(id) || id}</td>
                    <td className="px-4 py-3 text-slate-700">{casesByAdvisor.get(id) ?? 0}</td>
                    <td className="px-4 py-3 text-slate-700">{eur(offerVolByAdvisor.get(id) ?? 0)}</td>
                    <td className="px-4 py-3 text-slate-700">{eur(closedVolByAdvisor.get(id) ?? 0)}</td>
                  </tr>
                )
              })}
              {(advisors ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Noch keine Berater vorhanden.
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
