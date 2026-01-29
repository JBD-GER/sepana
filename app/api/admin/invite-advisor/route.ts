export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin  } from "@/lib/supabase/supabaseAdmin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .single()

  if (!profile || profile.role !== "admin") return null
  return session.user.id
}

export async function POST(req: Request) {
  const adminUserId = await assertAdmin()
  if (!adminUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email } = await req.json()
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 })
  }

  const admin = supabaseAdmin ()

  // Invite User (Supabase sends email)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: "advisor" },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const userId = data.user?.id
  if (!userId) return NextResponse.json({ error: "No user id returned" }, { status: 500 })

  // Ensure profiles row
  await admin.from("profiles").upsert({ user_id: userId, role: "advisor" })

  return NextResponse.json({ ok: true, userId })
}
