import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const offerId = String(body?.offerId ?? "").trim()
  if (!offerId) return NextResponse.json({ ok: false, error: "missing_offer" }, { status: 400 })

  const { data: offer } = await supabase
    .from("case_offers")
    .select("id,case_id")
    .eq("id", offerId)
    .maybeSingle()
  if (!offer) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id,assigned_advisor_id")
    .eq("id", offer.case_id)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (role !== "admin" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { error } = await admin.from("case_offers").delete().eq("id", offerId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
