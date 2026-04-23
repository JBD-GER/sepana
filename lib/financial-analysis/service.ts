export type FinancialAnalysisServiceStatus =
  | "offered"
  | "customer_confirmed"
  | "payment_received"
  | "active"
  | "expired"
  | "cancelled"

export type FinancialAnalysisAnalysisStatus = "not_started" | "documents_received" | "in_review" | "published"

export type FinancialAnalysisDocumentKind = "bank_statement" | "schufa_report" | "supporting_document"

export type FinancialAnalysisServiceRow = {
  id: string
  case_id?: string | null
  service_status?: string | null
  analysis_status?: string | null
  offered_by?: string | null
  assigned_advisor_id?: string | null
  price_gross_cents?: number | null
  currency?: string | null
  service_duration_days?: number | null
  offer_title?: string | null
  offer_summary?: string | null
  terms_version?: string | null
  customer_confirmed_terms_version?: string | null
  offer_email_sent_at?: string | null
  customer_confirmed_at?: string | null
  payment_received_at?: string | null
  activated_at?: string | null
  access_expires_at?: string | null
  expired_at?: string | null
  cancelled_at?: string | null
  published_household_overview?: string | null
  published_recommendations?: string | null
  published_action_plan?: string | null
  published_schufa_notes?: string | null
  published_at?: string | null
  published_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type FinancialAnalysisDocumentRow = {
  id: string
  service_id?: string | null
  case_id?: string | null
  document_kind?: string | null
  file_name?: string | null
  file_path?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  uploaded_by?: string | null
  processing_status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const FINANCIAL_ANALYSIS_SERVICE_TITLE = "Persoenliche Finanzanalyse"
export const FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS = 24900
export const FINANCIAL_ANALYSIS_CURRENCY = "EUR"
export const FINANCIAL_ANALYSIS_DURATION_DAYS = 90
export const FINANCIAL_ANALYSIS_TERMS_VERSION = "financial_analysis_2026_04_23_v1"
export const FINANCIAL_ANALYSIS_DEFAULT_SUMMARY =
  "Persoenliche Finanzanalyse inklusive individueller 90-Tage-Massnahmenplan und bankenaehnlicher Haushaltsrechnung."

export const FINANCIAL_ANALYSIS_FEATURES = [
  "Persoenliche Finanzanalyse mit bankenaehnlicher Haushaltsrechnung",
  "Individueller 90-Tage-Massnahmenplan zur Verbesserung der Finanzlage",
  "Hinweise zur Bonitaetsoptimierung und zu moeglichen naechsten Schritten bei Schufa-Themen",
] as const

export const FINANCIAL_ANALYSIS_LEGAL_NOTE =
  "Die Finanzanalyse ist ein gesonderter kostenpflichtiger Beratungsservice. Es wird kein Finanzierungserfolg garantiert."

export function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export function formatFinancialAnalysisPrice(cents: number | null | undefined) {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) / 100 : FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS / 100
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: FINANCIAL_ANALYSIS_CURRENCY }).format(amount)
}

export function getFinancialAnalysisServiceStatusLabel(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase()
  if (normalized === "customer_confirmed") return "Vom Kunden bestaetigt"
  if (normalized === "payment_received") return "Zahlung markiert"
  if (normalized === "active") return "Aktiv"
  if (normalized === "expired") return "Abgelaufen"
  if (normalized === "cancelled") return "Beendet"
  return "Angeboten"
}

export function getFinancialAnalysisAnalysisStatusLabel(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase()
  if (normalized === "documents_received") return "Unterlagen eingegangen"
  if (normalized === "in_review") return "In Bearbeitung"
  if (normalized === "published") return "Veroeffentlicht"
  return "Noch nicht gestartet"
}

export function getFinancialAnalysisDocumentKindLabel(kind: unknown) {
  const normalized = String(kind ?? "").trim().toLowerCase()
  if (normalized === "bank_statement") return "Kontoauszuege"
  if (normalized === "schufa_report") return "Aktuelle Schufa"
  if (normalized === "supporting_document") return "Zusatzdokument"
  return "Dokument"
}

export function isFinancialAnalysisTerminalStatus(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase()
  return normalized === "expired" || normalized === "cancelled"
}

export function addDaysIso(dateIso: string, days: number) {
  const base = new Date(dateIso)
  base.setUTCDate(base.getUTCDate() + Math.max(1, Math.floor(days)))
  return base.toISOString()
}

export function deriveFinancialAnalysisServiceStatus(input: {
  customerConfirmedAt?: string | null
  paymentReceivedAt?: string | null
  accessExpiresAt?: string | null
  expiredAt?: string | null
  cancelledAt?: string | null
  now?: Date
}) {
  if (trimOrNull(input.cancelledAt)) return "cancelled" as const

  const now = input.now ?? new Date()
  const expiresAt = trimOrNull(input.accessExpiresAt)
  if (trimOrNull(input.expiredAt)) return "expired" as const
  if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) < now.getTime()) {
    return "expired" as const
  }
  if (trimOrNull(input.customerConfirmedAt) && trimOrNull(input.paymentReceivedAt)) return "active" as const
  if (trimOrNull(input.paymentReceivedAt)) return "payment_received" as const
  if (trimOrNull(input.customerConfirmedAt)) return "customer_confirmed" as const
  return "offered" as const
}

export function normalizeFinancialAnalysisServiceRow(row: FinancialAnalysisServiceRow | null | undefined, now = new Date()) {
  if (!row?.id) return null
  return {
    ...row,
    service_status: deriveFinancialAnalysisServiceStatus({
      customerConfirmedAt: row.customer_confirmed_at,
      paymentReceivedAt: row.payment_received_at,
      accessExpiresAt: row.access_expires_at,
      expiredAt: row.expired_at,
      cancelledAt: row.cancelled_at,
      now,
    }),
  } satisfies FinancialAnalysisServiceRow
}

export function buildFinancialAnalysisServicePatch(input: {
  row: FinancialAnalysisServiceRow
  nowIso: string
  nextCustomerConfirmedAt?: string | null
  nextPaymentReceivedAt?: string | null
  nextAnalysisStatus?: FinancialAnalysisAnalysisStatus | null
}) {
  const customerConfirmedAt =
    input.nextCustomerConfirmedAt === undefined ? trimOrNull(input.row.customer_confirmed_at) : trimOrNull(input.nextCustomerConfirmedAt)
  const paymentReceivedAt =
    input.nextPaymentReceivedAt === undefined ? trimOrNull(input.row.payment_received_at) : trimOrNull(input.nextPaymentReceivedAt)

  const nextStatus = deriveFinancialAnalysisServiceStatus({
    customerConfirmedAt,
    paymentReceivedAt,
    accessExpiresAt: input.row.access_expires_at,
    expiredAt: input.row.expired_at,
    cancelledAt: input.row.cancelled_at,
    now: new Date(input.nowIso),
  })

  let activatedAt = trimOrNull(input.row.activated_at)
  let accessExpiresAt = trimOrNull(input.row.access_expires_at)

  if (nextStatus === "active" && !activatedAt) {
    activatedAt = input.nowIso
    accessExpiresAt = addDaysIso(input.nowIso, Number(input.row.service_duration_days ?? FINANCIAL_ANALYSIS_DURATION_DAYS))
  }

  return {
    service_status: nextStatus,
    customer_confirmed_at: customerConfirmedAt,
    payment_received_at: paymentReceivedAt,
    activated_at: activatedAt,
    access_expires_at: accessExpiresAt,
    analysis_status:
      input.nextAnalysisStatus ?? (trimOrNull(input.row.analysis_status) as FinancialAnalysisAnalysisStatus | null) ?? "not_started",
    updated_at: input.nowIso,
  }
}

export function isFinancialAnalysisActive(row: FinancialAnalysisServiceRow | null | undefined, now = new Date()) {
  if (!row) return false
  const status = deriveFinancialAnalysisServiceStatus({
    customerConfirmedAt: row.customer_confirmed_at,
    paymentReceivedAt: row.payment_received_at,
    accessExpiresAt: row.access_expires_at,
    expiredAt: row.expired_at,
    cancelledAt: row.cancelled_at,
    now,
  })
  return status === "active"
}

export function isMissingFinancialAnalysisTablesError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_financial_analysis_services") || msg.includes("case_financial_analysis_documents")
}

export function buildFinancialAnalysisPortalUrl(siteOrigin: string, caseId: string) {
  return `${siteOrigin}/app/faelle/${encodeURIComponent(caseId)}#schufa-finanzanalyse`
}
