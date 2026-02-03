// app/api/app/chat/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

async function canAccessCase(admin: any, caseId: string, userId: string, role: string | null) {
  const { data: c } = await admin
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return false
  if (role === "admin") return true
  if (role === "customer") return c.customer_id === userId
  if (role === "advisor") return c.assigned_advisor_id === userId
  return false
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const caseId = url.searchParams.get("caseId") || ""
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })

  const admin = supabaseAdmin()
  const allowed = await canAccessCase(admin, caseId, user.id, role)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await admin
    .from("case_notes")
    .select("id,case_id,author_id,visibility,body,created_at")
    .eq("case_id", caseId)
    .eq("visibility", "shared")
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const caseId = String(body?.caseId ?? "")
  const message = String(body?.message ?? "").trim()
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })
  if (message.length < 1) return NextResponse.json({ error: "Message too short" }, { status: 400 })

  const admin = supabaseAdmin()
  const allowed = await canAccessCase(admin, caseId, user.id, role)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await admin.from("case_notes").insert({
    case_id: caseId,
    author_id: user.id,
    visibility: "shared",
    body: message,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role ?? "customer",
    type: "chat_message",
    title: "Neue Nachricht",
    body: message.slice(0, 120),
  })

  return NextResponse.json({ ok: true })
}
