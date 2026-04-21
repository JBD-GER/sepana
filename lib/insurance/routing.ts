import type { SupabaseClient } from "@supabase/supabase-js"
import { trimOrNull } from "@/lib/insurance/invoice"

type AdminClient = SupabaseClient

export function isMissingInsuranceTablesError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return (
    msg.includes("case_insurance_routes") ||
    msg.includes("case_insurance_notes") ||
    msg.includes("insurance_partner_profiles")
  )
}

export async function ensureInsuranceRoute(
  admin: AdminClient,
  input: {
    caseId: string
    source: "precheck_rejected" | "advisor_manual"
    actorId?: string | null
    decisionSentAt?: string | null
  }
) {
  const now = new Date().toISOString()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_type,advisor_private_note")
    .eq("id", input.caseId)
    .maybeSingle()

  if (caseError) throw caseError
  if (!caseRow) throw new Error("Fall nicht gefunden")
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    throw new Error("case_type_not_supported")
  }

  const { data: existingRoute, error: routeError } = await admin
    .from("case_insurance_routes")
    .select("*")
    .eq("case_id", input.caseId)
    .maybeSingle()

  if (routeError) throw routeError

  const nextSource =
    input.source === "advisor_manual" ? "advisor_manual" : trimOrNull(existingRoute?.route_source) ?? "precheck_rejected"
  const payload = {
    route_source: nextSource,
    routed_by: input.actorId ?? existingRoute?.routed_by ?? null,
    routed_at: trimOrNull(existingRoute?.routed_at) ?? now,
    decision_sent_at: input.decisionSentAt ?? existingRoute?.decision_sent_at ?? null,
    advisor_private_note_snapshot:
      trimOrNull(existingRoute?.advisor_private_note_snapshot) ?? trimOrNull((caseRow as { advisor_private_note?: string | null }).advisor_private_note),
    updated_at: now,
  }

  if (existingRoute) {
    const { data: updatedRoute, error: updateError } = await admin
      .from("case_insurance_routes")
      .update(payload)
      .eq("case_id", input.caseId)
      .select("*")
      .single()

    if (updateError) throw updateError
    return updatedRoute
  }

  const { data: createdRoute, error: insertError } = await admin
    .from("case_insurance_routes")
    .insert({
      case_id: input.caseId,
      route_status: "new",
      created_at: now,
      last_status_at: now,
      ...payload,
    })
    .select("*")
    .single()

  if (insertError) throw insertError
  return createdRoute
}

export async function canAccessInsuranceCase(
  admin: AdminClient,
  input: {
    caseId: string
    userId: string
    role: string | null
  }
) {
  const role = String(input.role ?? "").trim().toLowerCase()
  if (role === "admin") return { ok: true as const }

  if (role === "insurance") {
    const { data: route } = await admin
      .from("case_insurance_routes")
      .select("case_id")
      .eq("case_id", input.caseId)
      .maybeSingle()

    return { ok: Boolean(route) as boolean }
  }

  return { ok: false as const }
}
