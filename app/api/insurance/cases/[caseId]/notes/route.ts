import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const MAX_NOTE_LENGTH = 4000

export async function POST(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "insurance" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { caseId } = await context.params
  const body = await req.json().catch(() => null)
  const message = String(body?.message ?? "").trim()

  if (!message) return NextResponse.json({ ok: false, error: "Notiz fehlt" }, { status: 400 })
  if (message.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Notiz ist zu lang" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access = await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { data: note, error } = await admin
    .from("case_insurance_notes")
    .insert({
      case_id: caseId,
      author_id: user.id,
      author_role: role === "admin" ? "admin" : "insurance",
      body: message,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "insurance_note_created",
    title: "Versicherungsnotiz gespeichert",
    body: message.slice(0, 140),
    notifyCustomer: false,
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true, note })
}
