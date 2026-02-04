export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

function normalizeSiteUrl(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = String(raw ?? "").trim()
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function parseMissingCount(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const normalized = Math.floor(n)
  if (normalized < 1) return null
  return Math.min(normalized, 999)
}

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const missingCount = parseMissingCount(body?.missingCount)
  if (!caseId || !missingCount) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const caseMeta = await getCaseMeta(caseId)
  if (!caseMeta?.customer_email) {
    return NextResponse.json({ ok: false, error: "customer_email_missing" }, { status: 409 })
  }

  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const portalUrl = `${siteUrl}/app/faelle/${caseId}`
  const caseLabel = caseMeta.case_ref ? ` für Ihren Fall ${caseMeta.case_ref}` : ""
  const singular = missingCount === 1
  const amountText = singular ? "1 offene Angabe" : `${missingCount} offene Angaben`
  const subject = `${amountText} für Ihr finales Angebot`

  const html = buildEmailHtml({
    title: "Bitte Falldaten vervollständigen",
    intro: `Für Ihr finales Angebot${caseLabel} fehlen aktuell noch ${singular ? "1 Angabe" : `${missingCount} Angaben`}.`,
    steps: [
      "Öffnen Sie Ihren Fall im Kundenportal.",
      "Ergänzen Sie die noch offenen Angaben.",
      "Danach kann Ihr Berater das finale Angebot für Sie vorbereiten.",
    ],
    ctaLabel: "Falldaten jetzt vervollständigen",
    ctaUrl: portalUrl,
    preheader: subject,
    eyebrow: "SEPANA - Falldaten",
  })

  const mail = await sendEmail({
    to: caseMeta.customer_email,
    subject,
    html,
  })

  if (!mail.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: mail.error === "missing_resend_env" ? "mail_not_configured" : "mail_send_failed",
      },
      { status: 500 }
    )
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "missing_data_reminder_sent",
    title: "Erinnerung zu offenen Falldaten",
    body: singular
      ? "Es fehlt aktuell noch 1 Angabe für das finale Angebot."
      : `Es fehlen aktuell noch ${missingCount} Angaben für das finale Angebot.`,
    meta: { missingCount },
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true })
}
