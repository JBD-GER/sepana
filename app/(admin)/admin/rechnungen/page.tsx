import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import {
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  formatEuro,
  getSchufaFreeProvisionInvoiceTitle,
  getSchufaFreeProvisionStatusLabel,
} from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import AdminInvoiceCancelButton from "./ui/AdminInvoiceCancelButton"

type SearchParams = {
  month?: string | string[]
}

type InvoiceRow = {
  id: string
  case_id: string
  case_type?: string | null
  invoice_type?: string | null
  invoice_number?: string | null
  title?: string | null
  status?: string | null
  amount_total?: number | null
  currency?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  created_at: string
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
}

function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

function normalizeMonth(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalized = String(value ?? "").trim()
  if (/^\d{4}-\d{2}$/.test(normalized)) return normalized
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit" }).format(new Date())
}

function getMonthBounds(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function statusClass(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase()
  if (normalized === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (normalized === "refunded") return "border-amber-200 bg-amber-50 text-amber-900"
  if (normalized === "cancelled") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-cyan-200 bg-cyan-50 text-cyan-800"
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  await requireAdmin()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const month = normalizeMonth(resolvedSearchParams?.month)
  const { startIso, endIso } = getMonthBounds(month)
  const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`))

  const admin = supabaseAdmin()
  const { data: invoices, error: invoicesError } = await admin
    .from("case_invoices")
    .select("id,case_id,case_type,invoice_type,invoice_number,title,status,amount_total,currency,recipient_name,recipient_email,created_at,sent_at,paid_at,refunded_at")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(500)

  if (invoicesError) {
    if (isMissingCaseInvoicesTableError(invoicesError)) {
      return (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Rechnungen</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Rechnungsuebersicht</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Die Tabelle <code>case_invoices</code> fehlt noch. Fuehren Sie zuerst die Migration
              <code> sql/2026-04-16_case_invoices.sql</code> aus, damit Rechnungen hier angezeigt werden koennen.
            </p>
          </div>
        </div>
      )
    }

    throw new Error(invoicesError.message)
  }

  const invoiceRows = (invoices ?? []) as InvoiceRow[]
  const caseIds = Array.from(new Set(invoiceRows.map((row) => row.case_id).filter(Boolean)))
  const { data: caseRows } = caseIds.length
    ? await admin.from("cases").select("id,case_ref").in("id", caseIds)
    : { data: [] as Array<{ id: string; case_ref?: string | null }> }

  const caseRefById = new Map((caseRows ?? []).map((row) => [row.id, row.case_ref ?? row.id.slice(0, 8)]))
  const invoiceCount = invoiceRows.length
  const paidCount = invoiceRows.filter((row) => String(row.status ?? "").trim().toLowerCase() === "paid").length
  const refundedCount = invoiceRows.filter((row) => String(row.status ?? "").trim().toLowerCase() === "refunded").length
  const cancelledCount = invoiceRows.filter((row) => String(row.status ?? "").trim().toLowerCase() === "cancelled").length
  const openCount = invoiceRows.filter((row) => {
    const normalized = String(row.status ?? "").trim().toLowerCase()
    return normalized !== "paid" && normalized !== "refunded" && normalized !== "cancelled"
  }).length
  const totalAmount = invoiceRows.reduce((sum, row) => sum + Number(row.amount_total ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Rechnungen</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Rechnungsuebersicht</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Alle erzeugten Fall-Rechnungen mit Monatsfilter, Status, Admin-Stornierung und direktem PDF-Download.
            </p>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="month">
              Monat
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={month}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Filtern
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Monat</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">{monthLabel}</div>
          <div className="mt-1 text-sm text-slate-500">{invoiceCount} Rechnung(en)</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Gesamtvolumen</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">{formatEuro(totalAmount)}</div>
          <div className="mt-1 text-sm text-slate-500">Netto ueber alle erfassten Rechnungen und Stornos</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Offen / bezahlt</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {openCount} / {paidCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">Aktive Rechnungen oder bereits als bezahlt markiert</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Erstattet / storniert</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {refundedCount} / {cancelledCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">Rueckabwicklung und Stornierungen im ausgewaehlten Monat</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Alle Rechnungen</div>
            <div className="mt-1 text-sm text-slate-500">Gefiltert nach Erstellungsmonat {monthLabel}.</div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Rechnung</th>
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Empfaenger</th>
                <th className="px-4 py-3 font-medium text-slate-700">Betrag</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Datum</th>
                <th className="px-4 py-3 font-medium text-slate-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((invoice) => {
                const invoiceType = String(invoice.invoice_type ?? "").trim().toLowerCase()
                const caseRef = caseRefById.get(invoice.case_id) ?? invoice.case_id.slice(0, 8)
                const isProvisionInvoice = invoiceType === SCHUFA_FREE_PROVISION_INVOICE_TYPE
                const isCancelled = String(invoice.status ?? "").trim().toLowerCase() === "cancelled"

                return (
                  <tr key={invoice.id} className="border-b border-slate-200/60 align-top last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{invoice.invoice_number ?? invoice.id.slice(0, 8)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {invoice.title ?? getSchufaFreeProvisionInvoiceTitle(invoice.invoice_type)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/faelle/${invoice.case_id}`} className="font-medium text-slate-900 underline underline-offset-4">
                        {caseRef}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">
                        {isProvisionInvoice ? "Kredit ohne Schufa" : invoice.case_type ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{invoice.recipient_name ?? "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">{invoice.recipient_email ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{formatEuro(invoice.amount_total ?? 0)}</div>
                      <div className="mt-1 text-xs text-slate-500">{invoice.currency ?? "EUR"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}>
                        {getSchufaFreeProvisionStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{formatDateTime(invoice.created_at)}</div>
                      <div className="mt-1 text-xs text-slate-500">Versendet: {formatDateTime(invoice.sent_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <a
                          href={`/api/app/cases/invoices/${invoice.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                        >
                          PDF herunterladen
                        </a>
                        {isProvisionInvoice && !isCancelled ? <AdminInvoiceCancelButton caseId={invoice.case_id} /> : null}
                        <Link
                          href={`/admin/faelle/${invoice.case_id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                        >
                          Zum Fall
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {invoiceRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={7}>
                    Fuer den ausgewaehlten Monat wurden keine Rechnungen gefunden.
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
