import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const ticketId = String(body?.ticketId ?? "").trim()
  const caseId = String(body?.caseId ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!ticketId) return NextResponse.json({ ok: false, error: "missing_ticket" }, { status: 400 })

  const admin = supabaseAdmin()

  if (user) {
    if (role !== "customer") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    let query = admin
      .from("live_queue_tickets")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("customer_id", user.id)
      .eq("status", "waiting")
    query = caseId ? query.eq("case_id", caseId) : query.eq("id", ticketId)
    const { error } = await query

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })
  }

  const { data: ticket, error: ticketErr } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,status,guest_token")
    .eq("id", ticketId)
    .eq("case_id", caseId)
    .maybeSingle()
  if (ticketErr) return NextResponse.json({ ok: false, error: ticketErr.message }, { status: 500 })
  if (!ticket || ticket.status !== "waiting") return NextResponse.json({ ok: true })

  const ticketToken = ticket.guest_token ? String(ticket.guest_token).trim() : ""
  const bodyToken = guestToken ? String(guestToken).trim() : ""
  if (ticketToken && bodyToken && ticketToken !== bodyToken) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const { error } = await admin
    .from("live_queue_tickets")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("case_id", caseId)
    .eq("status", "waiting")

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
