import { NextResponse } from "next/server"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const caseRef = trimOrNull(body?.caseRef)
  const accessToken = trimOrNull(body?.access)

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
        ? "Diese Strecke ist nur fuer Privatkredit vorgesehen."
        : "Der Onlinekredit-Link ist ungueltig oder abgelaufen."
    return NextResponse.json({ ok: false, error }, { status: access.status })
  }

  const now = new Date().toISOString()
  const { error } = await admin.from("case_europace_sync_events").insert({
    case_id: caseId,
    direction: "inbound",
    operation: "accountCheckCompleted",
    request_payload: { source: "xs2a.finish" },
    response_payload: { finishedAt: now },
    success: true,
    error_message: null,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, finishedAt: now })
}
