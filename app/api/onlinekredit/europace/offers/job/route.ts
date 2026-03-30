import { NextResponse } from "next/server"
import { pollEuropaceOfferAcceptanceJob } from "@/lib/europace/offerSync"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    const caseRef = String(body?.caseRef ?? "").trim()
    const accessToken = String(body?.access ?? "").trim()
    if (!caseId || !caseRef || !accessToken) {
      return NextResponse.json({ ok: false, error: "caseId, caseRef oder access fehlt." }, { status: 400 })
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
