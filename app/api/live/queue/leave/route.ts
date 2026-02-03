import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const ticketId = String(body?.ticketId ?? "").trim()
  const caseId = String(body?.caseId ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!ticketId) return NextResponse.json({ ok: false, error: "missing_ticket" }, { status: 400 })

  if (user) {
    if (role !== "customer") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    const admin = supabaseAdmin()
    const { error } = await admin
      .from("live_queue_tickets")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("customer_id", user.id)
      .eq("status", "waiting")

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!guestToken) {
    if (!caseId) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    const admin = supabaseAdmin()
    const { error } = await admin
      .from("live_queue_tickets")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("case_id", caseId)
      .is("guest_token", null)
      .eq("status", "waiting")
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const admin = supabaseAdmin()
  let query = admin
    .from("live_queue_tickets")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("guest_token", guestToken)
    .eq("status", "waiting")
  if (caseId) query = query.eq("case_id", caseId)
  const { error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
