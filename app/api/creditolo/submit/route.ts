import { NextResponse } from "next/server"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { CreditoloValidationError } from "@/lib/creditolo/mapper"
import { enqueueCreditolo } from "@/lib/creditolo/service"

export const runtime = "nodejs"
export const maxDuration = 60
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.caseId || !body.caseRef || !body.access)
      return NextResponse.json({ ok: false, error: "Antragszugriff fehlt." }, { status: 400 })
    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId: body.caseId,
      caseRef: body.caseRef,
      accessToken: body.access,
      expectedCaseType: "konsum",
    })
    if (!access.ok)
      return NextResponse.json({ ok: false, error: "Antragszugriff ungültig." }, { status: access.status })
    if (body.creditolo?.consent !== true || body.creditolo?.schufaConsent !== true)
      return NextResponse.json(
        { ok: false, error: "Bitte Datenweitergabe und SCHUFA-Einwilligung bestätigen." },
        { status: 400 },
      )
    const result = await enqueueCreditolo(admin, body.caseId, req, body.creditolo)
    return NextResponse.json({ ok: true, creditolo: result })
  } catch (error) {
    if (error instanceof CreditoloValidationError)
      return NextResponse.json({ ok: false, error: error.message, fields: error.fields }, { status: 400 })
    console.error("[creditolo/submit] failed to persist delivery")
    return NextResponse.json(
      { ok: false, error: "Die Weiterleitung konnte nicht vorbereitet werden. Bitte erneut versuchen." },
      { status: 500 },
    )
  }
}
