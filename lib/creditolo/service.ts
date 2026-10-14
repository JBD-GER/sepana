import { notifyCreditoloConfirmation } from "./notifications"
import { isIP } from "node:net"
import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendCreditolo } from "./client"
import { CREDITOLO_CONSENT_VERSION } from "./fields"
import {
  buildCreditoloPayload,
  creditoloTimestamp,
  type CreditoloPayload,
  type CreditoloVariant,
} from "./mapper"

type Row = Record<string, unknown>
export function creditoloRequestIp(req: Request) {
  // x-vercel-forwarded-for is overwritten by Vercel; do not trust browser-supplied IPs.
  const value =
    (process.env.VERCEL ? req.headers.get("x-vercel-forwarded-for") : req.headers.get("x-forwarded-for"))
      ?.split(",")[0]
      ?.trim() ?? ""
  const ip = value.startsWith("::ffff:") ? value.slice(7) : value
  return isIP(ip) ? ip : ""
}

export async function enqueueCreditolo(admin: SupabaseClient, caseId: string, req: Request, extra: Row) {
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_type")
    .eq("id", caseId)
    .single()
  if (caseError) throw caseError
  if (!["konsum", "schufa_frei"].includes(caseRow.case_type)) throw new Error("case_type_not_supported")
  const { data: existing, error: existingError } = await admin
    .from("creditolo_deliveries")
    .select("status,response_code,updated_at")
    .eq("case_id", caseId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing && ["delivered", "sending", "unknown"].includes(existing.status)) {
    await notifyCreditoloConfirmation(admin, caseId)
    return { status: existing.status, code: existing.response_code }
  }
  const variant: CreditoloVariant = caseRow.case_type === "schufa_frei" ? "schufa_free" : "standard"
  const [a, d, x, children] = await Promise.all([
    admin.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "primary").single(),
    admin
      .from(variant === "schufa_free" ? "case_schufa_free_details" : "case_baufi_details")
      .select("*")
      .eq("case_id", caseId)
      .single(),
    admin.from("case_additional_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("case_children").select("id", { count: "exact", head: true }).eq("case_id", caseId),
  ])
  if (a.error || d.error || x.error || children.error) throw a.error ?? d.error ?? x.error ?? children.error
  const now = new Date().toISOString()
  const payload = buildCreditoloPayload({
    variant,
    applicant: a.data,
    details: d.data,
    additional: { ...x.data, creditolo_children_count: children.count ?? 0 },
    extra,
    caseId,
    remote: creditoloRequestIp(req),
    timestamp: creditoloTimestamp(),
  })
  const prepared = {
    case_id: caseId,
    variant,
    status: "pending",
    payload,
    consent_version: CREDITOLO_CONSENT_VERSION,
    consent_at: now,
    schufa_consent: variant === "standard" && extra.schufaConsent === true,
    last_error: null,
    updated_at: now,
  }
  const { error } = await admin
    .from("creditolo_deliveries")
    .upsert(prepared, { onConflict: "case_id", ignoreDuplicates: true })
  if (error) throw error
  // Conditional update cannot reset a concurrent sending/delivered row.
  if (existing && ["awaiting_data", "failed", "test_ok"].includes(existing.status)) {
    const ready = await admin
      .from("creditolo_deliveries")
      .update(prepared)
      .eq("case_id", caseId)
      .eq("status", existing.status)
      .eq("updated_at", existing.updated_at)
    if (ready.error) throw ready.error
  }
  return processCreditoloDelivery(admin, caseId)
}

export async function processCreditoloDelivery(admin: SupabaseClient, caseId: string) {
  const token = randomUUID()
  const now = new Date().toISOString()
  // Atomic claim prevents parallel submits/cron runs from delivering the same lead twice.
  const { data: row, error } = await admin
    .from("creditolo_deliveries")
    .update({ status: "sending", lock_token: token, updated_at: now })
    .eq("case_id", caseId)
    .eq("status", "pending")
    .select("payload,variant")
    .maybeSingle()
  if (error) throw error
  if (!row) return { status: "already_processing" }
  let status: string
  let responseCode: number | null = null
  let clientId: string | null = null
  let loginUrl: string | null = null
  let lastError: string | null = null
  try {
    const result = await sendCreditolo(row.payload as CreditoloPayload, row.variant as CreditoloVariant)
    responseCode = result.code
    clientId = result.clientId
    loginUrl = result.loginUrl
    status = result.delivered ? "delivered" : result.code === 50 ? "test_ok" : "failed"
    lastError =
      result.delivered || result.code === 50
        ? null
        : `creditolo_${result.code}${result.fields.length ? ":" + result.fields.join(",") : ""}`
  } catch (error) {
    // A timeout or unreadable response can follow a successful provider write. Require reconciliation before a retry.
    const message = error instanceof Error ? error.message : "unknown"
    const beforeSend = ["creditolo_not_configured", "creditolo_preview_requires_test_names"].includes(message)
    status = beforeSend ? "pending" : "unknown"
    lastError = beforeSend ? message : "creditolo_delivery_outcome_unknown"
  }
  const { error: updateError } = await admin
    .from("creditolo_deliveries")
    .update({
      status,
      response_code: responseCode,
      client_id: clientId,
      login_url: loginUrl,
      last_error: lastError,
      payload: status === "delivered" || status === "test_ok" ? null : row.payload,
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      lock_token: null,
    })
    .eq("case_id", caseId)
    .eq("lock_token", token)
  if (updateError) throw updateError
  await notifyCreditoloConfirmation(admin, caseId)
  return { status, code: responseCode }
}
