// app/api/app/documents/requests/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

async function canAccessCase(supabase: any, caseId: string, userId: string, role: string | null) {
  const { data: c } = await supabase
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return false
  if (role === "admin") return true
  if (role === "advisor") return c.assigned_advisor_id === userId
  return false
}

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const caseId = String(body?.caseId ?? "")
  const title = String(body?.title ?? "").trim()
  const required = body?.required !== false
  if (!caseId || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const allowed = await canAccessCase(supabase, caseId, user.id, role)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await supabase.from("document_requests").insert({
    case_id: caseId,
    title,
    required,
    created_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
