import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const ticketId = String(body?.ticketId ?? "").trim()
  if (!ticketId) return NextResponse.json({ ok: false, error: "missing_ticket" }, { status: 400 })

  if (role === "advisor") {
    const { data: profile } = await supabase
      .from("advisor_profiles")
      .select("is_online")
      .eq("user_id", user.id)
      .maybeSingle()
    if (!profile?.is_online) {
      return NextResponse.json({ ok: false, error: "not_online" }, { status: 400 })
    }

    const { data: busy } = await supabase
      .from("live_queue_tickets")
      .select("id")
      .eq("advisor_id", user.id)
      .eq("status", "active")
    if ((busy ?? []).length > 0) {
      return NextResponse.json({ ok: false, error: "busy" }, { status: 409 })
    }
  }

  const roomName = `live_${ticketId}`
  const admin = supabaseAdmin()
  const { data: updated, error } = await admin
    .from("live_queue_tickets")
    .update({
      status: "active",
      advisor_id: user.id,
      accepted_at: new Date().toISOString(),
      room_name: roomName,
    })
    .eq("id", ticketId)
    .eq("status", "waiting")
    .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token")
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ ok: false, error: "already_taken" }, { status: 409 })

  await admin
    .from("cases")
    .update({ assigned_advisor_id: user.id })
    .eq("id", updated.case_id)

  await admin
    .from("live_queue_tickets")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("case_id", updated.case_id)
    .eq("status", "waiting")
    .neq("id", updated.id)

  return NextResponse.json({ ok: true, ticket: updated })
}
