export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const appointmentId = String(body?.appointmentId ?? "").trim()
  if (!appointmentId) return NextResponse.json({ ok: false, error: "missing_appointment" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: appt } = await admin
    .from("case_appointments")
    .select("id,case_id,advisor_id,customer_id,status,start_at")
    .eq("id", appointmentId)
    .maybeSingle()
  if (!appt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  if (appt.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "cancelled" }, { status: 409 })
  }
  if (role === "advisor" && appt.advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  if (role === "advisor") {
    const { data: busy } = await admin
      .from("live_queue_tickets")
      .select("id")
      .eq("advisor_id", user.id)
      .eq("status", "active")
    if ((busy ?? []).length > 0) {
      return NextResponse.json({ ok: false, error: "busy" }, { status: 409 })
    }
  }

  const now = new Date().toISOString()
  await admin
    .from("case_appointments")
    .update({ advisor_waiting_at: now })
    .eq("id", appointmentId)

  const { data: active } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token")
    .eq("case_id", appt.case_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active) {
    return NextResponse.json({ ok: true, ticket: active })
  }

  const { data: waiting } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,customer_id,status,room_name,guest_token")
    .eq("case_id", appt.case_id)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (waiting) {
    const roomName = waiting.room_name || `live_${waiting.id}`
    const { data: updated, error } = await admin
      .from("live_queue_tickets")
      .update({
        status: "active",
        advisor_id: user.id,
        accepted_at: now,
        room_name: roomName,
      })
      .eq("id", waiting.id)
      .eq("status", "waiting")
      .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token")
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!updated) return NextResponse.json({ ok: false, error: "already_taken" }, { status: 409 })

    await admin
      .from("live_queue_tickets")
      .update({ status: "cancelled", ended_at: now })
      .eq("case_id", appt.case_id)
      .eq("status", "waiting")
      .neq("id", updated.id)

    await logCaseEvent({
      caseId: appt.case_id,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "appointment_live_started",
      title: "Live-Termin gestartet",
      body: `Termin gestartet (${new Date(appt.start_at).toLocaleString("de-DE")}).`,
    })

    return NextResponse.json({ ok: true, ticket: updated })
  }

  const { data: created, error: createErr } = await admin
    .from("live_queue_tickets")
    .insert({
      case_id: appt.case_id,
      customer_id: appt.customer_id,
      advisor_id: user.id,
      status: "active",
      accepted_at: now,
    })
    .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token")
    .single()

  if (createErr || !created) {
    return NextResponse.json({ ok: false, error: createErr?.message ?? "create_failed" }, { status: 500 })
  }

  const roomName = created.room_name || `live_${created.id}`
  if (!created.room_name) {
    await admin.from("live_queue_tickets").update({ room_name: roomName }).eq("id", created.id)
  }

  await logCaseEvent({
    caseId: appt.case_id,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "appointment_live_started",
    title: "Live-Termin gestartet",
    body: `Termin gestartet (${new Date(appt.start_at).toLocaleString("de-DE")}).`,
  })

  return NextResponse.json({ ok: true, ticket: { ...created, room_name: roomName } })
}
