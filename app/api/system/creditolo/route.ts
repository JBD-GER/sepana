import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { processCreditoloDelivery } from "@/lib/creditolo/service"
import { notifyCreditoloConfirmation } from "@/lib/creditolo/notifications"

export const runtime = "nodejs"
export const maxDuration = 300
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ ok: false }, { status: 401 })
  const admin = supabaseAdmin()
  // Interrupted sends are ambiguous, never automatically replay them.
  const stale = await admin
    .from("creditolo_deliveries")
    .update({ status: "unknown", last_error: "interrupted_delivery_requires_review", lock_token: null })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - 10 * 60000).toISOString())
  if (stale.error) return NextResponse.json({ ok: false }, { status: 500 })
  const { data, error } = await admin
    .from("creditolo_deliveries")
    .select("case_id")
    .eq("status", "pending")
    .order("updated_at")
    .limit(8)
  if (error) return NextResponse.json({ ok: false }, { status: 500 })
  const results = []
  for (const row of data ?? []) results.push(await processCreditoloDelivery(admin, row.case_id))
  const emails = await admin
    .from("creditolo_deliveries")
    .select("case_id")
    .is("confirmation_email_sent_at", null)
    .is("confirmation_email_claimed_at", null)
    .not("consent_at", "is", null)
    .neq("status", "test_ok")
    .order("updated_at")
    .limit(8)
  if (emails.error) return NextResponse.json({ ok: false }, { status: 500 })
  for (const row of emails.data ?? []) await notifyCreditoloConfirmation(admin, row.case_id)
  return NextResponse.json({ ok: true, processed: results.length })
}
