import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import AssignLeadAdvisorButton from "./ui/AssignLeadAdvisorButton"
import CreateLeadStartOfferButton from "./ui/CreateLeadStartOfferButton"

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function eur(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

function statusUi(status: string | null | undefined) {
  const v = String(status ?? "").trim()
  if (v === "complaint_accepted") return { label: "Reklamation akzeptiert", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" }
  if (v === "complaint_declined") return { label: "Reklamation abgelehnt", cls: "border-rose-200 bg-rose-50 text-rose-800" }
  return { label: "Neu", cls: "border-sky-200 bg-sky-50 text-sky-800" }
}

export default async function AdminLeadsPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const { data: leads, error: leadsError } = await admin
    .from("webhook_leads")
    .select(
      "id,external_lead_id,event_type,status,complaint_reason,first_name,last_name,email,phone,phone_mobile,phone_work,birth_date,marital_status,employment_status,address_street,address_zip,address_city,product_name,product_price,notes,assigned_advisor_id,assigned_at,linked_case_id,created_at,last_event_at,source_created_at"
    )
    .order("created_at", { ascending: false })
    .limit(300)

  const { data: advisors } = await admin
    .from("profiles")
    .select("user_id")
    .eq("role", "advisor")
    .order("created_at", { ascending: true })

  const advisorIds = (advisors ?? []).map((a) => a.user_id)

  const { data: advisorProfiles } = advisorIds.length
    ? await admin.from("advisor_profiles").select("user_id,display_name").in("user_id", advisorIds)
    : { data: [] as any[] }

  const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })

  const emailById = new Map<string, string>()
  for (const user of usersRes.data?.users ?? []) emailById.set(user.id, user.email ?? "")

  const displayNameById = new Map<string, string>()
  for (const row of advisorProfiles ?? []) {
    const displayName = String(row.display_name ?? "").trim()
    if (displayName) displayNameById.set(row.user_id, displayName)
  }

  const advisorOptions = advisorIds
    .map((id) => {
      const display = displayNameById.get(id)
      const email = emailById.get(id) || id
      const label = display ? `${display} (${email})` : email
      return { id, label }
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de"))

  const linkedCaseIds = Array.from(new Set((leads ?? []).map((l) => l.linked_case_id).filter(Boolean)))
  const { data: linkedCases } = linkedCaseIds.length
    ? await admin
        .from("cases")
        .select("id,case_ref,case_type,status")
        .in("id", linkedCaseIds as string[])
    : { data: [] as any[] }
  const caseById = new Map<string, { id: string; case_ref: string | null; case_type: string; status: string }>()
  for (const row of linkedCases ?? []) {
    caseById.set(row.id, row)
  }

  const { data: providers } = await admin
    .from("providers")
    .select("id,name")
    .eq("is_active", true)
    .order("name", { ascending: true })
  const startOfferProviders = (providers ?? []).map((p) => ({
    id: p.id,
    label: p.name ?? p.id,
  }))

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Webhook Inbox</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              Eingehende Leads aus externen Webhooks, getrennt vom Case-Flow.
            </p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            {(leads ?? []).length} Leads
          </div>
        </div>
      </div>

      {leadsError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Leads konnten nicht geladen werden: {leadsError.message}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Lead</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Produkt</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Berater</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((lead) => {
                const ui = statusUi(lead.status)
                const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "-"
                const phone = lead.phone_mobile || lead.phone || lead.phone_work || "-"
                const advisorEmail = lead.assigned_advisor_id ? emailById.get(lead.assigned_advisor_id) : null
                const advisorDisplay = lead.assigned_advisor_id ? displayNameById.get(lead.assigned_advisor_id) : null
                const advisorLabel = lead.assigned_advisor_id
                  ? advisorDisplay
                    ? `${advisorDisplay} (${advisorEmail || lead.assigned_advisor_id})`
                    : advisorEmail || lead.assigned_advisor_id
                  : "Nicht zugewiesen"
                const linkedCase = lead.linked_case_id ? caseById.get(lead.linked_case_id) : null
                const linkedCaseRef =
                  linkedCase?.case_ref ?? (lead.linked_case_id ? lead.linked_case_id.slice(0, 8) : null)

                return (
                  <tr key={lead.id} className="border-b border-slate-200/60 last:border-0 align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">#{lead.external_lead_id}</div>
                      <div className="text-xs text-slate-500">{lead.event_type}</div>
                      <div className="mt-1 text-xs text-slate-500">Webhook: {dt(lead.source_created_at)}</div>
                      <div className="text-xs text-slate-500">Empfangen: {dt(lead.created_at)}</div>
                      {linkedCaseRef ? (
                        <div className="mt-2 text-xs text-slate-700">
                          Fall:{" "}
                          <Link
                            href={`/admin/faelle/${lead.linked_case_id}`}
                            className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                          >
                            {linkedCaseRef}
                          </Link>
                          {linkedCase?.status ? <span className="ml-1 text-slate-500">({linkedCase.status})</span> : null}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-amber-700">Noch kein Fall verknuepft</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{fullName}</div>
                      <div className="text-xs text-slate-600">{lead.email || "-"}</div>
                      <div className="text-xs text-slate-600">{phone}</div>
                      {(lead.address_zip || lead.address_city || lead.address_street) ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {[lead.address_street, [lead.address_zip, lead.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                      {lead.marital_status ? (
                        <div className="text-xs text-slate-500">Familienstand: {lead.marital_status}</div>
                      ) : null}
                      {lead.employment_status ? (
                        <div className="text-xs text-slate-500">Beruf: {lead.employment_status}</div>
                      ) : null}
                      {lead.notes ? <div className="mt-1 text-xs text-slate-500">Notiz: {lead.notes}</div> : null}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{lead.product_name || "-"}</div>
                      <div className="text-xs text-slate-600">{eur(lead.product_price)}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${ui.cls}`}>
                        {ui.label}
                      </span>
                      {lead.complaint_reason ? (
                        <div className="mt-2 max-w-[280px] text-xs text-rose-700">{lead.complaint_reason}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-500">Letztes Event: {dt(lead.last_event_at)}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <div className="text-sm text-slate-900">{advisorLabel}</div>
                      <div className="text-xs text-slate-500">{lead.assigned_at ? `seit ${dt(lead.assigned_at)}` : "-"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <AssignLeadAdvisorButton
                        leadId={lead.id}
                        currentAdvisorId={lead.assigned_advisor_id}
                        advisorOptions={advisorOptions}
                      />
                      {linkedCase ? (
                        <div className="mt-2">
                          <Link
                            href={`/admin/faelle/${linkedCase.id}`}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm"
                          >
                            Fall oeffnen
                          </Link>
                          <CreateLeadStartOfferButton leadId={lead.id} providerOptions={startOfferProviders} />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}

              {(leads ?? []).length === 0 && !leadsError ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Noch keine Leads empfangen.
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
