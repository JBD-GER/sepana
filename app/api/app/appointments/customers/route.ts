export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function buildName(row: any) {
  const first = String(row?.first_name || "").trim()
  const last = String(row?.last_name || "").trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

export async function GET() {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { data: cases } = await admin
    .from("cases")
    .select("id,case_ref,customer_id,assigned_advisor_id")
    .eq("assigned_advisor_id", user.id)
    .order("created_at", { ascending: false })

  const caseIds = (cases ?? []).map((c) => c.id)
  const { data: applicants } = caseIds.length
    ? await admin
        .from("case_applicants")
        .select("case_id,first_name,last_name")
        .in("case_id", caseIds)
        .eq("role", "primary")
    : { data: [] as any[] }

  const nameMap = new Map<string, string | null>()
  for (const a of applicants ?? []) {
    if (!nameMap.has(a.case_id)) nameMap.set(a.case_id, buildName(a))
  }

  const items = (cases ?? []).map((c) => ({
    case_id: c.id,
    case_ref: c.case_ref ?? null,
    customer_id: c.customer_id,
    customer_name: nameMap.get(c.id) ?? null,
  }))

  return NextResponse.json({ items })
}
