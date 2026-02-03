import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import AppointmentStatusButton from "../ui/AppointmentStatusButton"

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d))
}

function buildName(row: any) {
  const first = String(row?.first_name || "").trim()
  const last = String(row?.last_name || "").trim()
  return `${first} ${last}`.trim() || null
}

export default async function AdminTerminePage({
  searchParams,
}: {
  searchParams: { scope?: string }
}) {
  await requireAdmin()
  const admin = supabaseAdmin()

  const scope = String(searchParams?.scope || "upcoming")
  const nowIso = new Date().toISOString()

  let query = admin
    .from("case_appointments")
    .select(
      "id,case_id,advisor_id,customer_id,start_at,end_at,reason,status,advisor_waiting_at,customer_waiting_at,created_at"
    )

  if (scope === "past") {
    query = query.lt("end_at", nowIso).order("start_at", { ascending: false })
  } else if (scope === "all") {
    query = query.order("start_at", { ascending: false })
  } else {
    query = query.gte("end_at", nowIso).order("start_at", { ascending: true })
  }

  const { data: appointments } = await query.limit(400)

  const caseIds = Array.from(new Set((appointments ?? []).map((a) => a.case_id).filter(Boolean)))
  const advisorIds = Array.from(new Set((appointments ?? []).map((a) => a.advisor_id).filter(Boolean)))
  const customerIds = Array.from(new Set((appointments ?? []).map((a) => a.customer_id).filter(Boolean)))

  const [{ data: cases }, { data: applicants }, { data: advisors }, usersRes] = await Promise.all([
    caseIds.length
      ? admin.from("cases").select("id,case_ref").in("id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin
          .from("case_applicants")
          .select("case_id,first_name,last_name")
          .eq("role", "primary")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    advisorIds.length
      ? admin.from("advisor_profiles").select("user_id,display_name").in("user_id", advisorIds)
      : Promise.resolve({ data: [] as any[] }),
    admin.auth.admin.listUsers({ page: 1, perPage: 2000 }),
  ])

  const caseRefById = new Map<string, string>()
  for (const c of cases ?? []) caseRefById.set(c.id, c.case_ref ?? c.id.slice(0, 8))

  const customerNameByCase = new Map<string, string>()
  for (const a of applicants ?? []) {
    if (!customerNameByCase.has(a.case_id)) {
      const name = buildName(a)
      if (name) customerNameByCase.set(a.case_id, name)
    }
  }

  const advisorNameById = new Map<string, string>()
  for (const a of advisors ?? []) if (a.user_id) advisorNameById.set(a.user_id, a.display_name ?? a.user_id)

  const emailById = new Map<string, string>()
  for (const u of usersRes?.data?.users ?? []) emailById.set(u.id, u.email ?? u.id)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Termine</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Alle Termine</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Buchungen inkl. Status, Wartezimmer und Grund.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/admin/termine?scope=upcoming"
              className={`rounded-full border px-3 py-1 ${scope === "upcoming" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              Kommend
            </Link>
            <Link
              href="/admin/termine?scope=past"
              className={`rounded-full border px-3 py-1 ${scope === "past" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              Vergangen
            </Link>
            <Link
              href="/admin/termine?scope=all"
              className={`rounded-full border px-3 py-1 ${scope === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              Alle
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Termine ({appointments?.length ?? 0})</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Zeit</th>
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Berater</th>
                <th className="px-4 py-3 font-medium text-slate-700">Grund</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {(appointments ?? []).map((a) => {
                const caseRef = caseRefById.get(a.case_id) ?? a.case_id.slice(0, 8)
                const customerName = customerNameByCase.get(a.case_id) ?? emailById.get(a.customer_id) ?? a.customer_id
                const advisorName = advisorNameById.get(a.advisor_id) ?? emailById.get(a.advisor_id) ?? a.advisor_id
                const status = a.status ?? "booked"
                return (
                  <tr key={a.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{dt(a.start_at)}</div>
                      <div className="text-xs text-slate-500">bis {dt(a.end_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{caseRef}</td>
                    <td className="px-4 py-3 text-slate-700">{customerName}</td>
                    <td className="px-4 py-3 text-slate-700">{advisorName}</td>
                    <td className="px-4 py-3 text-slate-700">{a.reason || "Termin"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            status === "cancelled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {status}
                        </span>
                        {a.customer_waiting_at ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Kunde wartet
                          </span>
                        ) : null}
                        {a.advisor_waiting_at ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Berater bereit
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AppointmentStatusButton appointmentId={a.id} status={status} />
                    </td>
                  </tr>
                )
              })}

              {(appointments ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Keine Termine gefunden.
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
