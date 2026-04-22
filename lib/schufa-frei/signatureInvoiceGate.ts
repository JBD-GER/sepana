import type { SupabaseClient } from "@supabase/supabase-js"
import {
  SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
} from "@/lib/schufa-frei/provisionInvoice"

export type SchufaFreeInvoiceGateRow = {
  id: string
  invoice_type?: string | null
  invoice_number?: string | null
  amount_total?: number | string | null
  status?: string | null
  created_at?: string | null
}

export const SCHUFA_FREE_SIGNATURE_MAIN_INVOICE_TYPES = [
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE,
] as const

export const SCHUFA_FREE_SIGNATURE_CANCELLATION_INVOICE_TYPES = [
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE,
] as const

function pickPreferredInvoice(rows: SchufaFreeInvoiceGateRow[], preferredTypes: readonly string[]) {
  const preferredTypeSet = new Set(preferredTypes)
  const filtered = rows.filter((row) => preferredTypeSet.has(String(row.invoice_type ?? "").trim()))
  if (!filtered.length) return null

  return filtered.sort((a, b) => {
    const aType = String(a.invoice_type ?? "").trim()
    const bType = String(b.invoice_type ?? "").trim()
    const aPriority = preferredTypes.indexOf(aType)
    const bPriority = preferredTypes.indexOf(bType)
    if (aPriority !== bPriority) return aPriority - bPriority

    const aCreated = Date.parse(String(a.created_at ?? ""))
    const bCreated = Date.parse(String(b.created_at ?? ""))
    return (Number.isFinite(bCreated) ? bCreated : 0) - (Number.isFinite(aCreated) ? aCreated : 0)
  })[0]
}

export async function loadSchufaFreeSignatureInvoiceGate(admin: SupabaseClient, caseId: string) {
  const invoiceTypes = [
    ...SCHUFA_FREE_SIGNATURE_MAIN_INVOICE_TYPES,
    ...SCHUFA_FREE_SIGNATURE_CANCELLATION_INVOICE_TYPES,
  ]

  const { data, error } = await admin
    .from("case_invoices")
    .select("id,invoice_type,invoice_number,amount_total,status,created_at")
    .eq("case_id", caseId)
    .in("invoice_type", invoiceTypes)
    .order("created_at", { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as SchufaFreeInvoiceGateRow[]
  const invoice = pickPreferredInvoice(rows, SCHUFA_FREE_SIGNATURE_MAIN_INVOICE_TYPES)
  const cancellationInvoice = pickPreferredInvoice(rows, SCHUFA_FREE_SIGNATURE_CANCELLATION_INVOICE_TYPES)
  const invoiceCancelled =
    String(invoice?.status ?? "").trim().toLowerCase() === "cancelled" || Boolean(cancellationInvoice?.id)

  return {
    rows,
    invoice,
    cancellationInvoice,
    created: Boolean(invoice?.id),
    ready: Boolean(invoice?.id) && !invoiceCancelled,
    reason: !invoice?.id ? "missing_invoice" : invoiceCancelled ? "cancelled_invoice" : null,
  }
}

export function getSchufaFreeSignatureInvoiceGateMessage(
  reason: "missing_invoice" | "cancelled_invoice" | null | undefined
) {
  if (reason === "cancelled_invoice") {
    return "Die interne Servicepauschalenrechnung ist storniert. Bitte zuerst eine gültige Rechnung anlegen."
  }

  return "Bitte zuerst die interne Servicepauschalenrechnung anlegen. Erst danach wird der Vertragsbereich freigeschaltet."
}
