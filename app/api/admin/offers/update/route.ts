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

  const body = await req.json()
  const { offerId, status, loan_amount, notes_for_customer } = body

  if (!offerId) return NextResponse.json({ error: "Missing offerId" }, { status: 400 })

  const patch: any = {}
  if (status) patch.status = status
  if (typeof loan_amount !== "undefined") patch.loan_amount = loan_amount
  if (typeof notes_for_customer !== "undefined") patch.notes_for_customer = notes_for_customer

  const admin = supabaseAdmin ()
  const { error } = await admin.from("case_offers").update(patch).eq("id", offerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
