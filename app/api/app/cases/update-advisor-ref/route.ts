import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const rawRef = String(body?.advisorCaseRef ?? "").trim()
  const advisorCaseRef = rawRef ? rawRef : null

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }

  if (advisorCaseRef && advisorCaseRef.length > 64) {
    return NextResponse.json({ ok: false, error: "Vorgangsnummer ist zu lang" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }

  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin
    .from("cases")
    .update({ advisor_case_ref: advisorCaseRef, updated_at: new Date().toISOString() })
    .eq("id", caseId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, advisor_case_ref: advisorCaseRef })
}
