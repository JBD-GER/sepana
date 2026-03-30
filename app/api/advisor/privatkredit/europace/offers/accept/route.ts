import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { EuropaceOfferValidationError } from "@/lib/europace/offerEligibility"
import { acceptEuropaceOfferForCase } from "@/lib/europace/offerSync"
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
    const angebotId = String(body?.angebotId ?? "").trim()
    if (!caseId || !angebotId) {
      return NextResponse.json({ ok: false, error: "caseId und angebotId sind Pflicht." }, { status: 400 })
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
      return NextResponse.json({ ok: false, error: "Europace-Angebotsannahme ist nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }

    const result = await acceptEuropaceOfferForCase(admin, caseId, { angebotId })
    return NextResponse.json({
      ok: true,
      vorgangsnummer: result.vorgangsnummer,
      angebotId: result.angebotId,
      jobId: result.jobId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Angebot konnte nicht angenommen werden."
    const status = error instanceof EuropaceOfferValidationError ? error.statusCode : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
