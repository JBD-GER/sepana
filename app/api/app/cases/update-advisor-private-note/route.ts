import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const MAX_NOTE_LENGTH = 4000

function isMissingAdvisorPrivateNoteColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("advisor_private_note") && (msg.includes("column") || msg.includes("exist"))
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const rawNote = typeof body?.advisorPrivateNote === "string" ? body.advisorPrivateNote : ""
  const advisorPrivateNote = rawNote.trim() ? rawNote.trim() : null

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }

  if (advisorPrivateNote && advisorPrivateNote.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Notiz ist zu lang" }, { status: 400 })
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
    .update({ advisor_private_note: advisorPrivateNote, updated_at: new Date().toISOString() })
    .eq("id", caseId)

  if (error) {
    if (isMissingAdvisorPrivateNoteColumnError(error)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: Spalte advisor_private_note ist noch nicht vorhanden." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, advisor_private_note: advisorPrivateNote })
}
