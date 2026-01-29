import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import AssignAdvisorButton from "./ui/AssignAdvisorButton"
import UpdateOfferStatus from "./ui/UpdateOfferStatus"

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d))
}

export default async function AdminCasesPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const [{ data: cases }, { data: advisors }, { data: offers }, { data: docs }] = await Promise.all([
    admin
      .from("cases")
      .select("id,case_ref,case_type,status,customer_id,assigned_advisor_id,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("profiles").select("user_id").eq("role", "advisor"),
    admin
      .from("case_offers")
      .select("id,case_id,provider_id,product_type,status,loan_amount,notes_for_customer,created_at")
      .order("created_at", { ascending: false })
      .limit(400),
    admin
      .from("documents")
      .select("id,case_id,file_name,file_path,mime_type,size_bytes,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  const advisorIds = (advisors ?? []).map((a) => a.user_id)

  // Email mapping (admin list users)
  const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
  const emailById = new Map<string, string>()
  for (const u of usersPage.users) emailById.set(u.id, u.email ?? "")

  const offersByCase = new Map<string, any[]>()
  for (const o of offers ?? []) {
    offersByCase.set(o.case_id, [...(offersByCase.get(o.case_id) ?? []), o])
  }

  const docsByCase = new Map<string, any[]>()
  for (const d of docs ?? []) {
    docsByCase.set(d.case_id, [...(docsByCase.get(d.case_id) ?? []), d])
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Fälle & Unterlagen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Berater zuweisen, Vorgänge/Status bearbeiten, Unterlagen einsehen.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Fälle (letzte 200)</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Case</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Berater</th>
                <th className="px-4 py-3 font-medium text-slate-700">Unterlagen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(cases ?? []).map((c) => {
                const caseOffers = offersByCase.get(c.id) ?? []
                const caseDocs = docsByCase.get(c.id) ?? []
                const custEmail = emailById.get(c.customer_id) || c.customer_id
                const advEmail = c.assigned_advisor_id ? (emailById.get(c.assigned_advisor_id) || c.assigned_advisor_id) : "—"

                return (
                  <tr key={c.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500">
                        {c.case_type} • {dt(c.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{custEmail}</td>
                    <td className="px-4 py-3 text-slate-700">{c.status}</td>
                    <td className="px-4 py-3 text-slate-700">{advEmail}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="text-xs text-slate-500">{caseDocs.length} Datei(en)</div>
                      {caseDocs.slice(0, 2).map((d) => (
                        <div key={d.id} className="text-xs text-slate-700">
                          {d.file_name}
                        </div>
                      ))}
                      {caseDocs.length > 2 ? <div className="text-xs text-slate-500">…</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <AssignAdvisorButton
                          caseId={c.id}
                          currentAdvisorId={c.assigned_advisor_id}
                          advisorIds={advisorIds}
                          emailById={Object.fromEntries(emailById.entries())}
                        />

                        <UpdateOfferStatus
                          caseId={c.id}
                          offers={caseOffers}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(cases ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Keine Fälle gefunden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Alle Unterlagen (letzte 500)</div>
        <div className="mt-3 text-xs text-slate-500">
          (Download/Signed-URL hängt von deinem Storage-Bucket ab – hier zeigen wir Pfad + Metadaten.)
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Datei</th>
                <th className="px-4 py-3 font-medium text-slate-700">Case</th>
                <th className="px-4 py-3 font-medium text-slate-700">Typ</th>
                <th className="px-4 py-3 font-medium text-slate-700">Größe</th>
                <th className="px-4 py-3 font-medium text-slate-700">Zeit</th>
              </tr>
            </thead>
            <tbody>
              {(docs ?? []).map((d) => (
                <tr key={d.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{d.file_name}</div>
                    <div className="text-xs text-slate-500">{d.file_path}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.case_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{d.mime_type ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{Math.round(Number(d.size_bytes ?? 0) / 1024)} KB</td>
                  <td className="px-4 py-3 text-slate-700">{dt(d.created_at)}</td>
                </tr>
              ))}
              {(docs ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Keine Dokumente gefunden.
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
