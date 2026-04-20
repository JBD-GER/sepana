import Link from "next/link"
import SchufaFreeApplicationLinkCopyButton from "@/components/schufa-frei/SchufaFreeApplicationLinkCopyButton"
import SchufaFreeApplicationReminderCard from "@/components/schufa-frei/SchufaFreeApplicationReminderCard"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { buildSchufaFreeApplicationHref, createPublicCaseAccessToken } from "@/lib/onlinekredit/publicAccess"
import {
  getSchufaFreeCompletedOtherApplicationsByCaseIds,
  type SchufaFreeCompletedOtherApplication,
} from "@/lib/schufa-frei/applicationReminder"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type ProductTab = "baufi" | "konsum" | "schufa_frei"

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

type LinkedCaseRow = {
  id: string
  case_ref: string | null
  status: string | null
  case_type: string | null
  customer_id: string | null
}

type SchufaDetailsRow = {
  case_id: string
  completed_application_at: string | null
  submitted_to_skag_at: string | null
}

type ReminderLogRow = {
  case_id: string | null
  created_at: string
}

function isMissingLeadCaseTypeColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("lead_case_type") && (msg.includes("column") || msg.includes("exist"))
}

function isMissingNotificationLogTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("notification_log") && (msg.includes("relation") || msg.includes("table") || msg.includes("exist"))
}

function normalizeProduct(raw: string | string[] | undefined): ProductTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "konsum") return "konsum"
  if (normalized === "schufa_frei" || normalized === "schufa-frei") return "schufa_frei"
  return "baufi"
}

function resolveSiteOrigin() {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (!configured) return "https://www.sepana.de"
  try {
    return new URL(configured).origin
  } catch {
    return "https://www.sepana.de"
  }
}

function resolveLeadType(lead: Pick<LeadRow, "lead_case_type" | "product_name">): ProductTab {
  const explicit = String(lead.lead_case_type ?? "").trim().toLowerCase()
  if (explicit === "schufa_frei" || explicit === "schufa-frei") return "schufa_frei"
  if (explicit === "konsum") return "konsum"
  if (explicit === "baufi") return "baufi"

  const product = String(lead.product_name ?? "").trim().toLowerCase()
  if (
    product.includes("ohne schufa") ||
    product.includes("schufa-frei") ||
    product.includes("schufafrei") ||
    product.includes("sigma")
  ) {
    return "schufa_frei"
  }
  if (product.includes("privatkredit") || product.includes("ratenkredit") || product.includes("konsum")) return "konsum"
  return "baufi"
}

function productLabel(type: ProductTab) {
  if (type === "konsum") return "Privatkredit"
  if (type === "schufa_frei") return "Kredit ohne Schufa"
  return "Baufinanzierung"
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

function resolveSchufaLeadProgress(
  lead: Pick<LeadRow, "linked_case_id" | "status">,
  details: SchufaDetailsRow | null | undefined,
  otherCompletedApplication: SchufaFreeCompletedOtherApplication | null | undefined,
) {
  const status = String(lead.status ?? "").trim().toLowerCase()

  if (!lead.linked_case_id) {
    if (status === "precheck_rejected") {
      return {
        label: "Vorprüfung negativ",
        hint: "Für diesen Lead wurde kein weiterer Schufa-frei-Fall angelegt.",
        toneClass: "border-rose-200 bg-rose-50 text-rose-900",
      }
    }

    return {
      label: "Noch kein Fall verknüpft",
      hint: "Die Vorprüfung hat noch keinen weiterführenden Fall erzeugt.",
      toneClass: "border-amber-200 bg-amber-50 text-amber-900",
    }
  }

  if (details?.submitted_to_skag_at) {
    return {
      label: "Antrag abgeschlossen",
      hint: `An SEPANA übermittelt: ${dt(details.submitted_to_skag_at)}`,
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    }
  }

  if (details?.completed_application_at) {
    return {
      label: "Zweitformular abgeschlossen",
      hint: `Vom Kunden ausgefüllt: ${dt(details.completed_application_at)}`,
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    }
  }

  if (otherCompletedApplication) {
    const finishedAt = otherCompletedApplication.submittedToSkagAt ?? otherCompletedApplication.completedApplicationAt ?? null
    return {
      label: "Bereits andere Anfrage abgeschlossen",
      hint: otherCompletedApplication.caseRef
        ? `Mit derselben E-Mail wurde ${otherCompletedApplication.caseRef}${finishedAt ? ` am ${dt(finishedAt)}` : ""} bereits abgeschlossen.`
        : `Mit derselben E-Mail wurde bereits eine andere Anfrage${finishedAt ? ` am ${dt(finishedAt)}` : ""} abgeschlossen.`,
      toneClass: "border-slate-200 bg-slate-100 text-slate-900",
    }
  }

  return {
    label: "Zweitformular offen",
    hint: "Der Kunde hat den Schufa-frei-Antrag nach der Vorprüfung noch nicht vervollständigt.",
    toneClass: "border-amber-200 bg-amber-50 text-amber-900",
  }
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
  const siteOrigin = resolveSiteOrigin()

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
    ? await admin.from("cases").select("id,case_ref,status,case_type,customer_id").in("id", linkedCaseIds)
    : { data: [] as LinkedCaseRow[] }

  const caseById = new Map<
    string,
    { case_ref: string | null; status: string | null; case_type: string | null; customer_id: string | null }
  >()
  for (const row of (linkedCases ?? []) as LinkedCaseRow[]) {
    caseById.set(row.id, {
      case_ref: row.case_ref ?? null,
      status: row.status ?? null,
      case_type: row.case_type ?? null,
      customer_id: row.customer_id ?? null,
    })
  }

  const [schufaDetailsResult, reminderLogResult, otherCompletedApplicationByCaseId] =
    product === "schufa_frei" && linkedCaseIds.length
      ? await Promise.all([
          admin
            .from("case_schufa_free_details")
            .select("case_id,completed_application_at,submitted_to_skag_at")
            .in("case_id", linkedCaseIds),
          admin
            .from("notification_log")
            .select("case_id,created_at")
            .eq("type", "schufa_free_application_reminder_sent")
            .in("case_id", linkedCaseIds)
            .order("created_at", { ascending: false }),
          getSchufaFreeCompletedOtherApplicationsByCaseIds(admin, linkedCaseIds),
        ])
      : [
          { data: [] as SchufaDetailsRow[], error: null as { message?: string } | null },
          { data: [] as ReminderLogRow[], error: null as { message?: string } | null },
          new Map<string, SchufaFreeCompletedOtherApplication>(),
        ]

  const schufaDetailsByCaseId = new Map<string, SchufaDetailsRow>()
  for (const row of (schufaDetailsResult.data ?? []) as SchufaDetailsRow[]) {
    schufaDetailsByCaseId.set(row.case_id, row)
  }

  const lastReminderByCaseId = new Map<string, string>()
  if (!reminderLogResult.error || isMissingNotificationLogTableError(reminderLogResult.error)) {
    for (const row of (reminderLogResult.data ?? []) as ReminderLogRow[]) {
      if (!row.case_id || lastReminderByCaseId.has(row.case_id)) continue
      lastReminderByCaseId.set(row.case_id, row.created_at)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
            <p className="mt-1 text-sm text-slate-600">
              Zugewiesene Leads aus {productLabel(product)}. Verknüpfte Fälle können direkt geöffnet werden.
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
          <Link
            href="/advisor/leads?product=schufa_frei"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              product === "schufa_frei"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            Kredit ohne Schufa
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
                {product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Link</th> : null}
                {product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Aktion</th> : null}
              </tr>
            </thead>
            <tbody>
              {typedLeads.map((lead) => {
                const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || "-"
                const phone = lead.phone_mobile || lead.phone || lead.phone_work || "-"
                const caseMeta = lead.linked_case_id ? caseById.get(lead.linked_case_id) : null
                const caseRef = caseMeta?.case_ref ?? (lead.linked_case_id ? lead.linked_case_id.slice(0, 8) : null)
                const schufaDetails = lead.linked_case_id ? schufaDetailsByCaseId.get(lead.linked_case_id) ?? null : null
                const otherCompletedApplication = lead.linked_case_id
                  ? otherCompletedApplicationByCaseId.get(lead.linked_case_id) ?? null
                  : null
                const schufaProgress =
                  product === "schufa_frei"
                    ? resolveSchufaLeadProgress(lead, schufaDetails, otherCompletedApplication)
                    : null
                const lastReminderAt = lead.linked_case_id ? lastReminderByCaseId.get(lead.linked_case_id) ?? null : null
                const applicationUrl =
                  product === "schufa_frei" && lead.linked_case_id && caseMeta?.case_ref
                    ? new URL(
                        buildSchufaFreeApplicationHref({
                          caseId: lead.linked_case_id,
                          caseRef: caseMeta.case_ref,
                          accessToken: createPublicCaseAccessToken({
                            caseId: lead.linked_case_id,
                            caseRef: caseMeta.case_ref,
                            customerId: caseMeta.customer_id ?? null,
                          }),
                        }),
                        siteOrigin
                      ).toString()
                    : null

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
                      <div className="font-medium text-slate-900">
                        {product === "schufa_frei" ? schufaProgress?.label ?? (lead.status || "new") : lead.status || "new"}
                      </div>
                      <div className="text-xs text-slate-500">Letztes Event: {dt(lead.last_event_at)}</div>
                      {schufaProgress ? (
                        <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${schufaProgress.toneClass}`}>
                          <div className="font-semibold">{schufaProgress.label}</div>
                          <div className="mt-1">{schufaProgress.hint}</div>
                        </div>
                      ) : null}
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
                        <span className="text-xs text-amber-700">Noch kein Fall verknüpft</span>
                      )}
                    </td>
                    {product === "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <SchufaFreeApplicationLinkCopyButton url={applicationUrl} />
                      </td>
                    ) : null}
                    {product === "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        {lead.linked_case_id ? (
                          <SchufaFreeApplicationReminderCard
                            caseId={lead.linked_case_id}
                            completedApplicationAt={schufaDetails?.completed_application_at ?? null}
                            submittedToSkagAt={schufaDetails?.submitted_to_skag_at ?? null}
                            lastSentAt={lastReminderAt}
                            otherCompletedApplication={otherCompletedApplication}
                            compact
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Keine Aktion möglich</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}

              {typedLeads.length === 0 && !error ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={product === "schufa_frei" ? 7 : 5}>
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
