import type { SupabaseClient } from "@supabase/supabase-js"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { CREDITOLO_NOTICE } from "./notice"

export async function notifyCreditoloConfirmation(admin: SupabaseClient, caseId: string) {
  const now = new Date().toISOString()
  const { data: claim, error } = await admin
    .from("creditolo_deliveries")
    .update({ confirmation_email_claimed_at: now })
    .eq("case_id", caseId)
    .is("confirmation_email_claimed_at", null)
    .not("consent_at", "is", null)
    .select("case_id")
    .maybeSingle()
  if (error || !claim) return
  try {
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("customer_id")
      .eq("id", caseId)
      .single()
    if (caseError) throw caseError
    const { data: applicant } = await admin
      .from("case_applicants")
      .select("email")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()
    const account = caseRow.customer_id ? await admin.auth.admin.getUserById(caseRow.customer_id) : null
    const email = account?.data?.user?.email ?? applicant?.email
    if (!email) throw new Error("missing_customer_email")
    const result = await sendEmail({
      to: email,
      subject: "Ihre Kreditanfrage ist eingegangen",
      idempotencyKey: `creditolo-confirmation-${caseId}`,
      html: buildEmailHtml({
        title: "Ihre Kreditanfrage ist eingegangen",
        intro: "Vielen Dank für Ihre vollständige Kreditanfrage bei SEPANA.",
        steps: [CREDITOLO_NOTICE, "Bei Rückfragen zu Ihren Angaben melden wir uns bei Ihnen."],
        eyebrow: "SEPANA · Kreditanfrage",
      }),
    })
    if (!result?.ok) throw new Error("confirmation_email_failed")
    await admin
      .from("creditolo_deliveries")
      .update({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null })
      .eq("case_id", caseId)
  } catch {
    await admin
      .from("creditolo_deliveries")
      .update({ confirmation_email_claimed_at: null, confirmation_email_error: "confirmation_email_failed" })
      .eq("case_id", caseId)
      .eq("confirmation_email_claimed_at", now)
  }
}
