import Link from "next/link"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type ProductTab = "baufi" | "konsum"

type LeadRow = {
  id: string
  external_lead_id: number | null
  lead_case_type: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  phone_work: string | null
  product_name: string | null
  product_price: number | null
  loan_purpose: string | null
  loan_amount_total: number | null
  status: string | null
  assigned_at: string | null
  linked_case_id: string | null
  created_at: string | null
  last_event_at: string | null
  notes: string | null
}

function isMissingLeadCaseTypeColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("lead_case_type") && (msg.includes("column") || msg.includes("exist"))
}

function normalizeProduct(raw: string | string[] | undefined): ProductTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  return String(value ?? "").trim().toLowerCase() === "konsum" ? "konsum" : "baufi"
}

function resolveLeadType(lead: Pick<LeadRow, "lead_case_type" | "product_name">): ProductTab {
  const explicit = String(lead.lead_case_type ?? "").trim().toLowerCase()
  if (explicit === "konsum") return "konsum"
  if (explicit === "baufi") return "baufi"

  const product = String(lead.product_name ?? "").trim().toLowerCase()
  if (product.includes("privatkredit") || product.includes("ratenkredit") || product.includes("konsum")) return "konsum"
  return "baufi"
}

function productLabel(type: ProductTab) {
  return type === "konsum" ? "Privatkredit" : "Baufinanzierung"
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function eur(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number(value)
  )
}

export default async function AdvisorLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ product?: string | string[] }>
}) {
  const { user } = await requireAdvisor()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const product = normalizeProduct(resolvedSearchParams?.product)
  const admin = supabaseAdmin()

  const selectBase =
    "id,external_lead_id,first_name,last_name,email,phone,phone_mobile,phone_work,product_name,product_price,loan_purpose,loan_amount_total,status,assigned_at,linked_case_id,created_at,last_event_at,notes"
  const selectWithCaseType = `${selectBase},lead_case_type`

  let error: { message?: string } | null = null
  let leadsRaw: LeadRow[] = []

  const primaryQuery = await admin
    .from("webhook_leads")
    .select(selectWithCaseType)
    .eq("assigned_advisor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300)

  if (primaryQuery.error && isMissingLeadCaseTypeColumnError(primaryQuery.error)) {
    const fallbackQuery = await admin
      .from("webhook_leads")
      .select(selectBase)
      .eq("assigned_advisor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300)
    error = fallbackQuery.error as { message?: string } | null
    leadsRaw = ((fallbackQuery.data ?? []) as Array<Omit<LeadRow, "lead_case_type">>).map((row) => ({
      ...row,
      lead_case_type: null,
    }))
  } else {
    error = primaryQuery.error as { message?: string } | null
    leadsRaw = (primaryQuery.data ?? []) as LeadRow[]
  }

  const typedLeads = leadsRaw.filter((lead) => resolveLeadType(lead) === product)
  const linkedCaseIds = Array.from(new Set(typedLeads.map((lead) => lead.linked_case_id).filter(Boolean))) as string[]
  const { data: linkedCases } = linkedCaseIds.length
    ? await admin.from("cases").select("id,case_ref,status,case_type").in("id", linkedCaseIds)
    : { data: [] as Array<{ id: string; case_ref: string | null; status: string | null; case_type: string | null }> }

  const caseById = new Map<string, { case_ref: string | null; status: string | null; case_type: string | null }>()
  for (const row of linkedCases ?? []) {
    caseById.set(row.id, { case_ref: row.case_ref ?? null, status: row.status ?? null, case_type: row.case_type ?? null })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              Zugewiesene Leads aus {productLabel(product)}. Verknuepfte Faelle koennen direkt geoeffnet werden.
            </p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            {typedLeads.length} zugewiesen
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/advisor/leads?product=baufi"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              product === "baufi"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Baufinanzierung
          </Link>
          <Link
            href="/advisor/leads?product=konsum"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              product === "konsum"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Privatkredit
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          Leads konnten nicht geladen werden: {error.message}
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
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
              </tr>
            </thead>
            <tbody>
              {typedLeads.map((lead) => {
                const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "-"
                const phone = lead.phone_mobile || lead.phone || lead.phone_work || "-"
                const caseMeta = lead.linked_case_id ? caseById.get(lead.linked_case_id) : null
                const caseRef = caseMeta?.case_ref ?? (lead.linked_case_id ? lead.linked_case_id.slice(0, 8) : null)

                return (
                  <tr key={lead.id} className="border-b border-slate-200/60 last:border-0 align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">#{lead.external_lead_id ?? "-"}</div>
                      <div className="text-xs text-slate-500">Eingang: {dt(lead.created_at)}</div>
                      <div className="text-xs text-slate-500">Zugeteilt: {dt(lead.assigned_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{fullName}</div>
                      <div className="text-xs text-slate-600">{lead.email || "-"}</div>
                      <div className="text-xs text-slate-600">{phone}</div>
                      {lead.notes ? <div className="mt-1 text-xs text-slate-500">Notiz: {lead.notes}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{lead.product_name || productLabel(product)}</div>
                      <div className="text-xs text-slate-600">{eur(lead.loan_amount_total ?? lead.product_price)}</div>
                      {lead.loan_purpose ? <div className="text-xs text-slate-500">{lead.loan_purpose}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{lead.status || "new"}</div>
                      <div className="text-xs text-slate-500">Letztes Event: {dt(lead.last_event_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {caseRef && lead.linked_case_id ? (
                        <div className="space-y-1">
                          <Link
                            href={`/advisor/faelle/${lead.linked_case_id}`}
                            className="inline-flex rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm"
                          >
                            {caseRef}
                          </Link>
                          {caseMeta?.status ? <div className="text-xs text-slate-500">{caseMeta.status}</div> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">Noch kein Fall verknuepft</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {typedLeads.length === 0 && !error ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Keine zugewiesenen Leads in {productLabel(product)} gefunden.
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
