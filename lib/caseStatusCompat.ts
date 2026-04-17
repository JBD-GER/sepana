import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient

const LEGACY_CASE_STATUS_FALLBACKS: Record<string, string> = {
  new: "draft",
  open: "comparison_ready",
  active: "comparison_ready",
  submitted: "comparison_ready",
  received: "comparison_ready",
  in_review: "comparison_ready",
  under_review: "comparison_ready",
  processing: "comparison_ready",
  needs_docs: "comparison_ready",
  missing_docs: "comparison_ready",
  waiting_customer: "comparison_ready",
  waiting_advisor: "comparison_ready",
  matching: "comparison_ready",
  prequalified: "comparison_ready",
  skag_submitted: "comparison_ready",
  documents_requested: "comparison_ready",
  correction_required: "comparison_ready",
  offer_created: "offers_ready",
  offer_open: "offers_ready",
  offer_sent: "offers_ready",
  approved: "offer_accepted",
  rejected: "closed",
  cancelled: "closed",
  completed: "closed",
}

export function getLegacyCompatibleCaseStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase()
  if (!normalized) return normalized
  return LEGACY_CASE_STATUS_FALLBACKS[normalized] ?? normalized
}

export function isCaseStatusConstraintError(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string } | null
  if (!err) return false
  const text = `${String(err.code ?? "")} ${String(err.message ?? "")} ${String(err.details ?? "")}`.toLowerCase()
  return text.includes("cases_status_allowed") || (text.includes("status") && text.includes("check constraint"))
}

export async function updateCaseStatusCompat(
  admin: AdminClient,
  input: {
    caseId: string
    status: string
    updatedAt?: string | null
  }
) {
  const preferredStatus = String(input.status ?? "").trim().toLowerCase()
  const fallbackStatus = getLegacyCompatibleCaseStatus(preferredStatus)
  const patchBase = input.updatedAt ? { updated_at: input.updatedAt } : {}

  let query = await admin
    .from("cases")
    .update({
      ...patchBase,
      status: preferredStatus,
    })
    .eq("id", input.caseId)

  if (!query.error) {
    return {
      appliedStatus: preferredStatus,
      fallbackApplied: false,
    }
  }

  if (!isCaseStatusConstraintError(query.error) || fallbackStatus === preferredStatus) {
    throw query.error
  }

  query = await admin
    .from("cases")
    .update({
      ...patchBase,
      status: fallbackStatus,
    })
    .eq("id", input.caseId)

  if (query.error) throw query.error

  return {
    appliedStatus: fallbackStatus,
    fallbackApplied: true,
  }
}
