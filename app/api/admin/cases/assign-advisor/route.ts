// app/api/admin/cases/assign-advisor/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent, sendAdvisorAssignedEmail } from "@/lib/notifications/notify"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const caseId = body?.caseId as string | undefined
    const advisorId = (body?.advisorId as string | null | undefined) ?? null

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
    }

    const { data: existingCase } = await admin
      .from("cases")
      .select("id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle()
    if (!existingCase) {
      return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
    }

    const previousAdvisorId = existingCase.assigned_advisor_id ?? null

    const { error } = await admin
      .from("cases")
      .update({ assigned_advisor_id: advisorId })
      .eq("id", caseId)

    if (error) throw error

    const isChanged = previousAdvisorId !== advisorId
    let advisorMailSent = false
    if (isChanged && advisorId) {
      await logCaseEvent({
        caseId,
        actorRole: "admin",
        type: "advisor_assigned",
        title: "Ansprechpartner aktualisiert",
        body: "Ihr Ansprechpartner wurde aktualisiert.",
      })
      const mailRes = await sendAdvisorAssignedEmail({ caseId })
      advisorMailSent = !!mailRes.ok
    }

    return NextResponse.json({ ok: true, advisorMailSent, changed: isChanged })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
