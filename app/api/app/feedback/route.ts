export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (role !== "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const caseId = String(body?.caseId ?? "")
  const message = String(body?.message ?? "").trim()

  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })
  if (message.length < 5) return NextResponse.json({ error: "Message too short" }, { status: 400 })

  const admin = supabaseAdmin()

  // Security: case must belong to this customer.
  const { data: c, error: caseErr } = await admin
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("customer_id", user.id)
    .maybeSingle()

  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 400 })
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 })

  const { error } = await admin.from("case_notes").insert({
    case_id: caseId,
    author_id: user.id,
    visibility: "shared",
    body: message,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
