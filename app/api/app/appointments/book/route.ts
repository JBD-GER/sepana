export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

function minutesDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId || "").trim()
  const startAt = String(body?.startAt || "").trim()
  const endAt = String(body?.endAt || "").trim()
  const reason = String(body?.reason || "").trim()

  if (!caseId || !startAt || !endAt) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 })
  }

  if (minutesDiff(startDate, endDate) !== 30) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: c } = await admin
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!c.assigned_advisor_id) return NextResponse.json({ error: "advisor_missing" }, { status: 409 })

  if (role === "customer") {
    if (c.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } else if (role === "advisor") {
    if (c.assigned_advisor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: conflicts } = await admin
    .from("case_appointments")
    .select("id")
    .eq("advisor_id", c.assigned_advisor_id)
    .neq("status", "cancelled")
    .lt("start_at", endAt)
    .gt("end_at", startAt)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 })
  }

  const { error } = await admin.from("case_appointments").insert({
    case_id: caseId,
    advisor_id: c.assigned_advisor_id,
    customer_id: c.customer_id,
    start_at: startAt,
    end_at: endAt,
    reason: reason || null,
    status: "booked",
    created_by: user.id,
    created_by_role: role ?? "customer",
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role ?? "customer",
    type: "appointment_booked",
    title: "Termin gebucht",
    body: `Termin: ${new Date(startAt).toLocaleString("de-DE")}`,
    meta: { start_at: startAt, end_at: endAt, reason: reason || null },
  })

  return NextResponse.json({ ok: true })
}
