import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import InviteAdvisorForm from "./ui/InviteAdvisorForm"
import AdvisorRowEditor from "./ui/AdvisorRowEditor"

function eur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)
}

export default async function AdminAdvisorsPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const { data: advisors } = await admin
    .from("profiles")
    .select("user_id,created_at")
    .eq("role", "advisor")
    .order("created_at", { ascending: false })

  const advisorIds = (advisors ?? []).map((a) => a.user_id)

  const { data: advisorProfiles } = advisorIds.length
    ? await admin
        .from("advisor_profiles")
        .select("user_id,display_name,bio,languages,photo_path,is_active,phone")
        .in("user_id", advisorIds)
    : { data: [] as any[] }

  const profileById = new Map<string, any>()
  for (const p of advisorProfiles ?? []) profileById.set(p.user_id, p)

  const { data: cases } = advisorIds.length
    ? await admin.from("cases").select("id,assigned_advisor_id").in("assigned_advisor_id", advisorIds)
    : { data: [] as any[] }

  const { data: offers } = advisorIds.length
    ? await admin
        .from("case_offers")
        .select("id,case_id,loan_amount,status")
        .in("status", ["sent", "accepted"])
    : { data: [] as any[] }

  const casesByAdvisor = new Map<string, number>()
  for (const c of cases ?? []) {
    if (!c.assigned_advisor_id) continue
    casesByAdvisor.set(c.assigned_advisor_id, (casesByAdvisor.get(c.assigned_advisor_id) ?? 0) + 1)
  }

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

  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
  const emailById = new Map<string, string>()
  for (const u of usersPage.users) emailById.set(u.id, u.email ?? "")

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Verwaltung</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Berater</h1>
            <p className="mt-1 text-sm text-slate-600">Berater per Einladung hinzufügen und KPIs je Berater ansehen.</p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            Admin Bereich
          </div>
        </div>
      </div>

      <InviteAdvisorForm />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">Beraterliste</div>
          <div className="text-xs text-slate-500">{(advisors ?? []).length} Berater</div>
        </div>

        <div className="mt-4 space-y-4">
          {(advisors ?? []).map((a) => {
            const id = a.user_id
            const profile = profileById.get(id) ?? {
              display_name: null,
              bio: null,
              languages: [],
              photo_path: null,
            }
            return (
              <div key={id} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                <AdvisorRowEditor userId={id} email={emailById.get(id) || id} initial={profile} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <div>
                    Zugewiesene Fälle:{" "}
                    <span className="font-medium text-slate-900">{casesByAdvisor.get(id) ?? 0}</span>
                  </div>
                  <div>
                    Angebotsvolumen:{" "}
                    <span className="font-medium text-slate-900">{eur(offerVolByAdvisor.get(id) ?? 0)}</span>
                  </div>
                  <div>
                    Abgeschlossen:{" "}
                    <span className="font-medium text-slate-900">{eur(closedVolByAdvisor.get(id) ?? 0)}</span>
                  </div>
                  <div>
                    ID: <span className="font-medium text-slate-900">{id.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>
            )
          })}

          {(advisors ?? []).length === 0 ? (
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-6 text-sm text-slate-500">
              Noch keine Berater vorhanden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
