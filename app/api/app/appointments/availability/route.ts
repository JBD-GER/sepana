export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type DayInput = {
  day: number
  is_active: boolean
  start_time?: string | null
  end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
}

function toMinutes(v?: string | null) {
  if (!v) return null
  const [h, m] = v.split(":").map((p) => Number(p))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function isBreakOk(start?: string | null, end?: string | null) {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s == null && e == null) return true
  if (s == null || e == null) return false
  return e > s && e - s <= 60
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const caseId = String(url.searchParams.get("caseId") || "").trim()
  const advisorIdParam = String(url.searchParams.get("advisorId") || "").trim()

  const admin = supabaseAdmin()
  let advisorId = advisorIdParam || user.id

  if (role === "customer") {
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })
    const { data: c } = await admin
      .from("cases")
      .select("id,customer_id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle()
    if (!c || c.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!c.assigned_advisor_id) return NextResponse.json({ error: "advisor_missing" }, { status: 409 })
    advisorId = c.assigned_advisor_id
  } else if (role === "advisor") {
    if (advisorIdParam && advisorIdParam !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: rows } = await admin
    .from("advisor_availability")
    .select("day_of_week,is_active,start_time,end_time,break_start_time,break_end_time")
    .eq("advisor_id", advisorId)
    .order("day_of_week", { ascending: true })

  const { data: advisorProfile } = await admin
    .from("advisor_profiles")
    .select("display_name")
    .eq("user_id", advisorId)
    .maybeSingle()

  return NextResponse.json({
    advisor: { id: advisorId, display_name: advisorProfile?.display_name ?? null },
    availability: rows ?? [],
  })
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const days: DayInput[] = Array.isArray(body?.days) ? body.days : []
  if (!days.length) return NextResponse.json({ error: "Missing days" }, { status: 400 })

  for (const d of days) {
    if (typeof d.day !== "number" || d.day < 0 || d.day > 6) {
      return NextResponse.json({ error: "invalid_day" }, { status: 400 })
    }
    if (!isBreakOk(d.break_start_time, d.break_end_time)) {
      return NextResponse.json({ error: "invalid_break" }, { status: 400 })
    }
  }

  const admin = supabaseAdmin()
  const rows = days.map((d) => ({
    advisor_id: user.id,
    day_of_week: d.day,
    is_active: !!d.is_active,
    start_time: d.is_active ? d.start_time ?? null : null,
    end_time: d.is_active ? d.end_time ?? null : null,
    break_start_time: d.is_active ? d.break_start_time ?? null : null,
    break_end_time: d.is_active ? d.break_end_time ?? null : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from("advisor_availability")
    .upsert(rows, { onConflict: "advisor_id,day_of_week" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
