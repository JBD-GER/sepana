export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin  } from "@/lib/supabase/supabaseAdmin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return false
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", session.user.id).single()
  return profile?.role === "admin"
}

export async function POST(req: Request) {
  const ok = await assertAdmin()
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { caseId, advisorId } = await req.json()
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })

  const admin = supabaseAdmin ()

  const { error } = await admin
    .from("cases")
    .update({ assigned_advisor_id: advisorId ?? null })
    .eq("id", caseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
