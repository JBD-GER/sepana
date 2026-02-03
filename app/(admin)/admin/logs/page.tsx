import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d))
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { caseId?: string; type?: string; role?: string; q?: string; limit?: string }
}) {
  await requireAdmin()
  const admin = supabaseAdmin()

  const limitRaw = Number(searchParams?.limit || 200)
  const limit = Math.min(500, Math.max(20, Number.isFinite(limitRaw) ? limitRaw : 200))
  const caseId = String(searchParams?.caseId || "").trim()
  const type = String(searchParams?.type || "").trim()
  const role = String(searchParams?.role || "").trim()
  const q = String(searchParams?.q || "").trim()

  let query = admin
    .from("notification_log")
    .select("id,recipient_id,recipient_role,actor_id,actor_role,case_id,type,title,body,meta,created_at,read_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (caseId) query = query.eq("case_id", caseId)
  if (type) query = query.eq("type", type)
  if (role) query = query.eq("recipient_role", role)
  if (q) query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`)

  const { data: logs } = await query

  const caseIds = Array.from(new Set((logs ?? []).map((l) => l.case_id).filter(Boolean)))
  const [{ data: cases }, usersRes] = await Promise.all([
    caseIds.length
      ? admin.from("cases").select("id,case_ref").in("id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    admin.auth.admin.listUsers({ page: 1, perPage: 2000 }),
  ])

  const caseRefById = new Map<string, string>()
  for (const c of cases ?? []) caseRefById.set(c.id, c.case_ref ?? c.id.slice(0, 8))

  const emailById = new Map<string, string>()
  for (const u of usersRes?.data?.users ?? []) emailById.set(u.id, u.email ?? u.id)

  const actorLabel = (id?: string | null, role?: string | null) => {
    if (!id) return role ? role : "system"
    return emailById.get(id) ?? id
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Logs</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Benachrichtigungen & Events</h1>
            <p className="mt-1 text-sm text-slate-600">Zentrale Übersicht aller Aktionen (Dokumente, Angebote, Termine, Chat).</p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            {logs?.length ?? 0} Einträge
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-5" method="GET">
          <label className="text-xs text-slate-600">
            Case-ID
            <input
              name="caseId"
              defaultValue={caseId}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              placeholder="case_id"
            />
          </label>
          <label className="text-xs text-slate-600">
            Typ
            <input
              name="type"
              defaultValue={type}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              placeholder="offer_status, document_uploaded..."
            />
          </label>
          <label className="text-xs text-slate-600">
            Rolle
            <select
              name="role"
              defaultValue={role}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="">Alle</option>
              <option value="customer">Kunde</option>
              <option value="advisor">Berater</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Suche
            <input
              name="q"
              defaultValue={q}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              placeholder="Text durchsuchen..."
            />
          </label>
          <label className="text-xs text-slate-600">
            Limit
            <input
              name="limit"
              defaultValue={String(limit)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              placeholder="200"
            />
          </label>
          <div className="md:col-span-5">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm"
            >
              Filtern
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Log Einträge</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Zeit</th>
                <th className="px-4 py-3 font-medium text-slate-700">Titel / Inhalt</th>
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Empfaenger</th>
                <th className="px-4 py-3 font-medium text-slate-700">Akteur</th>
                <th className="px-4 py-3 font-medium text-slate-700">Typ</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l) => {
                const caseRef = l.case_id ? caseRefById.get(l.case_id) ?? l.case_id.slice(0, 8) : "â€”"
                return (
                  <tr key={l.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-3 text-slate-700">{dt(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{l.title}</div>
                      <div className="mt-1 text-xs text-slate-600">{l.body}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {l.case_id ? (
                        <Link
                          href={`/admin/faelle/${l.case_id}`}
                          className="text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                        >
                          {caseRef}
                        </Link>
                      ) : (
                        caseRef
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {actorLabel(l.recipient_id, l.recipient_role)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {actorLabel(l.actor_id, l.actor_role)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{l.type}</td>
                  </tr>
                )
              })}

              {(logs ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Keine Logs gefunden.
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
