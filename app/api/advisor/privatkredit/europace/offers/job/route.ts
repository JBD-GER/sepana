import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { pollEuropaceOfferAcceptanceJob } from "@/lib/europace/offerSync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    if (role !== "advisor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("id,assigned_advisor_id,case_type")
      .eq("id", caseId)
      .maybeSingle()

    if (caseError) throw caseError
    if (!caseRow) {
      return NextResponse.json({ ok: false, error: "Fall nicht gefunden." }, { status: 404 })
    }
    if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Nicht zugewiesen." }, { status: 403 })
    }
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "konsum") {
      return NextResponse.json({ ok: false, error: "Europace-Annahmejob ist nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }

    const result = await pollEuropaceOfferAcceptanceJob(admin, caseId)
    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      status: result.status,
      antragsnummer: result.antragsnummer,
      produktanbieterantragsnummer: result.produktanbieterantragsnummer,
      hasApplication: result.hasApplication,
      applications: result.applications,
      hasRejectedApplication: result.hasRejectedApplication,
      terminalMessage: result.terminalMessage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Annahmejob konnte nicht geladen werden."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
