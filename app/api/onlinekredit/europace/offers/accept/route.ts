import { NextResponse } from "next/server"
import { acceptEuropaceOfferForCase } from "@/lib/europace/offerSync"
import { EuropaceOfferValidationError } from "@/lib/europace/offerEligibility"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    const caseRef = String(body?.caseRef ?? "").trim()
    const accessToken = String(body?.access ?? "").trim()
    const angebotId = String(body?.angebotId ?? "").trim()
    if (!caseId || !caseRef || !accessToken || !angebotId) {
      return NextResponse.json({ ok: false, error: "caseId, caseRef, access oder angebotId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "konsum",
    })
    if (!access.ok) {
      const error =
        access.error === "case_type_not_supported"
          ? "Europace-Angebote sind nur fuer Privatkredit vorgesehen."
          : "Der Onlinekredit-Link ist ungueltig oder abgelaufen."
      return NextResponse.json({ ok: false, error }, { status: access.status })
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
