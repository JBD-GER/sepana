export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function buildCustomerName(primary: any) {
  const first = String(primary?.first_name || "").trim()
  const last = String(primary?.last_name || "").trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const caseId = String(url.searchParams.get("caseId") || "").trim()
  const upcoming = String(url.searchParams.get("upcoming") || "") === "1"
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 200)))

  const admin = supabaseAdmin()
  let query = admin
    .from("case_appointments")
    .select("id,case_id,advisor_id,customer_id,start_at,end_at,reason,status,created_at,created_by_role,advisor_waiting_at,customer_waiting_at")
    .order("start_at", { ascending: true })
    .limit(limit)

  if (role === "advisor") {
    query = query.eq("advisor_id", user.id)
  } else if (role === "customer") {
    query = query.eq("customer_id", user.id)
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (caseId) {
    const { data: c } = await admin
      .from("cases")
      .select("id,customer_id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle()
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (role === "customer" && c.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (role === "advisor" && c.assigned_advisor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    query = query.eq("case_id", caseId)
  }

  if (upcoming) {
    query = query.gte("start_at", new Date().toISOString())
  }

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const caseIds = Array.from(new Set((rows ?? []).map((r) => r.case_id).filter(Boolean)))
  const advisorIds = Array.from(new Set((rows ?? []).map((r) => r.advisor_id).filter(Boolean)))

  const [{ data: cases }, { data: applicants }, { data: advisors }] = await Promise.all([
    caseIds.length
      ? admin.from("cases").select("id,case_ref").in("id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? admin.from("case_applicants").select("case_id,first_name,last_name").in("case_id", caseIds).eq("role", "primary")
      : Promise.resolve({ data: [] as any[] }),
    advisorIds.length
      ? admin.from("advisor_profiles").select("user_id,display_name").in("user_id", advisorIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const caseRefMap = new Map<string, string | null>()
  for (const c of cases ?? []) caseRefMap.set(c.id, c.case_ref ?? null)

  const customerNameMap = new Map<string, string | null>()
  for (const a of applicants ?? []) {
    if (!customerNameMap.has(a.case_id)) {
      customerNameMap.set(a.case_id, buildCustomerName(a))
    }
  }

  const advisorNameMap = new Map<string, string | null>()
  for (const a of advisors ?? []) advisorNameMap.set(a.user_id, a.display_name ?? null)

  const items = (rows ?? []).map((r) => ({
    ...r,
    case_ref: caseRefMap.get(r.case_id) ?? null,
    customer_name: customerNameMap.get(r.case_id) ?? null,
    advisor_name: advisorNameMap.get(r.advisor_id) ?? null,
  }))

  return NextResponse.json({ items })
}
