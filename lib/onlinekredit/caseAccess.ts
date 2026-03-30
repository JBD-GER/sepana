import type { SupabaseClient } from "@supabase/supabase-js"
import { verifyPublicCaseAccessToken } from "@/lib/onlinekredit/publicAccess"

type MinimalSupabase = Pick<SupabaseClient, "from">

export type PublicOnlinekreditCase = {
  id: string
  case_ref: string | null
  case_type: string | null
  customer_id: string | null
  assigned_advisor_id: string | null
  status: string | null
  created_at: string | null
}

export type PublicCaseAccessResult =
  | { ok: true; caseRow: PublicOnlinekreditCase }
  | { ok: false; status: number; error: string }

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeCaseType(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

export async function resolvePublicOnlinekreditCaseAccess(
  admin: MinimalSupabase,
  input: {
    caseId: string
    caseRef: string
    accessToken: string
    expectedCaseType?: "konsum" | "baufi"
  }
): Promise<PublicCaseAccessResult> {
  const caseId = trimOrNull(input.caseId)
  const caseRef = trimOrNull(input.caseRef)
  const accessToken = trimOrNull(input.accessToken)
  if (!caseId || !caseRef || !accessToken) {
    return { ok: false, status: 400, error: "missing_public_case_access" }
  }

  const verified = verifyPublicCaseAccessToken({
    token: accessToken,
    caseId,
    caseRef,
  })

  if (!verified) {
    return { ok: false, status: 403, error: "invalid_public_case_access" }
  }

  const { data: caseRow, error } = await admin
    .from("cases")
    .select("id,case_ref,case_type,customer_id,assigned_advisor_id,status,created_at")
    .eq("id", caseId)
    .maybeSingle()

  if (error) throw error
  if (!caseRow) {
    return { ok: false, status: 404, error: "case_not_found" }
  }
  if (trimOrNull(caseRow.case_ref) !== caseRef) {
    return { ok: false, status: 403, error: "invalid_public_case_access" }
  }

  const actualCaseType = normalizeCaseType(caseRow.case_type)
  if (input.expectedCaseType && actualCaseType !== input.expectedCaseType) {
    return { ok: false, status: 409, error: "case_type_not_supported" }
  }

  return {
    ok: true,
    caseRow: {
      id: caseRow.id,
      case_ref: caseRow.case_ref ?? null,
      case_type: caseRow.case_type ?? null,
      customer_id: caseRow.customer_id ?? null,
      assigned_advisor_id: caseRow.assigned_advisor_id ?? null,
      status: caseRow.status ?? null,
      created_at: caseRow.created_at ?? null,
    },
  }
}
