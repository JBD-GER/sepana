import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const ticketId = String(body?.ticketId ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!ticketId) return NextResponse.json({ ok: false, error: "missing_ticket" }, { status: 400 })

  const { data: ticket } = await supabase
    .from("live_queue_tickets")
    .select("id,customer_id,advisor_id,status,guest_token")
    .eq("id", ticketId)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })

  if (user) {
    const isOwner = ticket.customer_id === user.id || ticket.advisor_id === user.id
    if (!isOwner && role !== "admin") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
  } else {
    if (!guestToken || ticket.guest_token !== guestToken) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    }
  }

  const nextStatus = ticket.status === "waiting" ? "cancelled" : "ended"
  const admin = supabaseAdmin()
  const { error } = await admin
    .from("live_queue_tickets")
    .update({ status: nextStatus, ended_at: new Date().toISOString() })
    .eq("id", ticketId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
