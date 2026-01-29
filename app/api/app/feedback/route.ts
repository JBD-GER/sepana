export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { caseId, message } = await req.json()
  if (!caseId || typeof caseId !== "string") return NextResponse.json({ error: "Missing caseId" }, { status: 400 })
  if (!message || typeof message !== "string" || message.trim().length < 5)
    return NextResponse.json({ error: "Message too short" }, { status: 400 })

  // Security: Case muss dem Customer gehören
  const { data: c } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("customer_id", session.user.id)
    .single()

  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 })

  const { error } = await supabase.from("case_notes").insert({
    case_id: caseId,
    author_id: session.user.id,
    visibility: "shared",
    body: message.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
