export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const appointmentId = String(body?.appointmentId || "").trim()
  const status = String(body?.status || "").trim()
  if (!appointmentId || (status !== "enter" && status !== "leave")) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: appt } = await admin
    .from("case_appointments")
    .select("id,advisor_id,customer_id")
    .eq("id", appointmentId)
    .maybeSingle()
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role === "advisor") {
    if (appt.advisor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } else if (role === "customer") {
    if (appt.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = status === "enter" ? new Date().toISOString() : null
  const patch =
    role === "advisor"
      ? { advisor_waiting_at: now }
      : role === "customer"
        ? { customer_waiting_at: now }
        : {}

  if (Object.keys(patch).length) {
    const { error } = await admin.from("case_appointments").update(patch).eq("id", appointmentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
