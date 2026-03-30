import { NextResponse } from "next/server"
import { buildOnlinekreditDocumentPinEmail, getOnlinekreditDocumentPin } from "@/lib/onlinekredit/documentPin"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeSiteUrl(raw: string | undefined, fallbackOrigin: string) {
  const input = String(raw ?? "").trim()
  if (!input) return fallbackOrigin
  try {
    return new URL(input).origin
  } catch {
    return fallbackOrigin
  }
}

function parseBool(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

async function wasAlreadySent(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data, error } = await admin
    .from("case_europace_sync_events")
    .select("case_id")
    .eq("case_id", caseId)
    .eq("operation", "onlinekreditPinMail")
    .eq("success", true)
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

async function logPinMailEvent(
  admin: ReturnType<typeof supabaseAdmin>,
  input: {
    caseId: string
    success: boolean
    requestPayload: unknown
    responsePayload?: unknown
    errorMessage?: string | null
  }
) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: "outbound",
    operation: "onlinekreditPinMail",
    request_payload: input.requestPayload,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const caseId = trimOrNull(body?.caseId)
    const caseRef = trimOrNull(body?.caseRef)
    const accessToken = trimOrNull(body?.access)
    const existingAccount = parseBool(body?.existing)
    const auto = parseBool(body?.auto)

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
          ? "Diese Strecke ist nur für Privatkredit vorgesehen."
          : "Der Onlinekredit-Link ist ungültig oder abgelaufen."
      return NextResponse.json({ ok: false, error }, { status: access.status })
    }

    if (auto && (await wasAlreadySent(admin, caseId))) {
      return NextResponse.json({ ok: true, sent: false, skipped: true })
    }

    const [{ data: applicant }, { data: europace }] = await Promise.all([
      admin
        .from("case_applicants")
        .select("first_name,email")
        .eq("case_id", caseId)
        .eq("role", "primary")
        .maybeSingle(),
      admin.from("case_europace").select("vorgangsnummer").eq("case_id", caseId).maybeSingle(),
    ])

    const email = trimOrNull((applicant as { email?: string | null } | null)?.email)?.toLowerCase() ?? null
    const firstName = trimOrNull((applicant as { first_name?: string | null } | null)?.first_name)
    const vorgangsnummer = trimOrNull((europace as { vorgangsnummer?: string | null } | null)?.vorgangsnummer)
    const pin = getOnlinekreditDocumentPin(vorgangsnummer)

    if (!email) {
      return NextResponse.json({ ok: false, error: "Es ist keine E-Mail-Adresse für diesen Vorgang hinterlegt." }, { status: 409 })
    }

    if (!pin) {
      return NextResponse.json({ ok: false, error: "Für diesen Vorgang liegt noch keine Dokumenten-PIN vor." }, { status: 409 })
    }

    const fallbackOrigin = new URL(req.url).origin
    const baseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, fallbackOrigin)
    const params = new URLSearchParams({
      caseId,
      caseRef,
      access: accessToken,
    })
    if (existingAccount) params.set("existing", "1")
    const confirmationUrl = `${baseUrl}/onlinekredit/bestaetigung?${params.toString()}`

    const mail = buildOnlinekreditDocumentPinEmail({
      firstName,
      pin,
      confirmationUrl,
    })

    const result = await sendEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
    })

    await logPinMailEvent(admin, {
      caseId,
      success: Boolean(result?.ok),
      requestPayload: { email, auto, existingAccount, vorgangsnummer, pin },
      responsePayload: { ok: Boolean(result?.ok) },
      errorMessage: result?.ok ? null : String((result as { error?: unknown } | null)?.error ?? "mail_send_failed"),
    })

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: String((result as { error?: unknown } | null)?.error ?? "mail_send_failed") },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, sent: true, pin })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PIN-E-Mail konnte nicht versendet werden." },
      { status: 500 }
    )
  }
}
