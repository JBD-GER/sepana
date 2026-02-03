import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { AccessToken } from "livekit-server-sdk"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const ticketId = String(body?.ticketId ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!ticketId) return NextResponse.json({ ok: false, error: "missing_ticket" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: ticket } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token")
    .eq("id", ticketId)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  if (ticket.status !== "active") {
    return NextResponse.json({ ok: false, error: "not_active" }, { status: 409 })
  }

  if (user) {
    const allowed =
      role === "admin" || ticket.customer_id === user.id || (ticket.advisor_id && ticket.advisor_id === user.id)
    if (!allowed) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  } else {
    if (!guestToken || ticket.guest_token !== guestToken) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    }
  }

  const roomName = ticket.room_name || `live_${ticket.id}`
  if (!ticket.room_name) {
    await admin.from("live_queue_tickets").update({ room_name: roomName }).eq("id", ticket.id)
  }

  const livekitUrl = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!livekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: "livekit_not_configured" }, { status: 500 })
  }

  const identity = user?.id ?? `guest_${ticket.id}_${(guestToken || "x").slice(0, 8)}`
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user?.email ?? "Gast",
  })
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true })

  return NextResponse.json({ ok: true, url: livekitUrl, token: await token.toJwt(), roomName })
}
