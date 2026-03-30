import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { pollEuropaceOfferAcceptanceJob } from "@/lib/europace/offerSync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("id,customer_id,assigned_advisor_id,case_type")
      .eq("id", caseId)
      .maybeSingle()

    if (caseError) throw caseError
    if (!caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden." }, { status: 404 })
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "konsum") {
      return NextResponse.json({ ok: false, error: "Europace-Angebote sind nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }
    if (role === "customer" && caseRow.customer_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }
    if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }
    if (role !== "customer" && role !== "advisor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const job = await pollEuropaceOfferAcceptanceJob(admin, caseId)
    return NextResponse.json({
      ok: true,
      jobId: job.jobId,
      status: job.status,
      antragsnummer: job.antragsnummer,
      produktanbieterantragsnummer: job.produktanbieterantragsnummer,
      hasApplication: job.hasApplication,
      applications: job.applications,
      hasRejectedApplication: job.hasRejectedApplication,
      terminalMessage: job.terminalMessage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Annahmejob konnte nicht geladen werden."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
