import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { buildSchufaFreeApplicationHref, createPublicCaseAccessToken } from "@/lib/onlinekredit/publicAccess"
import { getSchufaFreeCompletedOtherApplicationsByCaseIds } from "@/lib/schufa-frei/applicationReminder"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  return new URL(req.url).origin
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const [{ data: caseRow, error: caseError }, { data: detailsRow, error: detailsError }] = await Promise.all([
    admin
      .from("cases")
      .select("id,case_ref,case_type,customer_id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle(),
    admin
      .from("case_schufa_free_details")
      .select("completed_application_at,submitted_to_skag_at")
      .eq("case_id", caseId)
      .maybeSingle(),
  ])

  if (caseError) {
    return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  }
  if (detailsError) {
    return NextResponse.json({ ok: false, error: detailsError.message }, { status: 400 })
  }
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  if (detailsRow?.completed_application_at || detailsRow?.submitted_to_skag_at) {
    return NextResponse.json({ ok: false, error: "application_already_completed" }, { status: 409 })
  }

  const otherCompletedApplicationByCaseId = await getSchufaFreeCompletedOtherApplicationsByCaseIds(admin, [caseId])
  const otherCompletedApplication = otherCompletedApplicationByCaseId.get(caseId) ?? null
  if (otherCompletedApplication) {
    return NextResponse.json(
      {
        ok: false,
        error: "application_already_completed_for_other_request",
        otherCase: otherCompletedApplication,
      },
      { status: 409 }
    )
  }

  const caseRef = trimOrNull(caseRow.case_ref)
  if (!caseRef) {
    return NextResponse.json({ ok: false, error: "case_ref_missing" }, { status: 409 })
  }

  const caseMeta = await getCaseMeta(caseId)
  if (!caseMeta?.customer_email) {
    return NextResponse.json({ ok: false, error: "customer_email_missing" }, { status: 409 })
  }

  const siteOrigin = resolveSiteOrigin(req)
  const accessToken = createPublicCaseAccessToken({
    caseId,
    caseRef,
    customerId: caseRow.customer_id ?? null,
  })
  const applicationUrl = new URL(
    buildSchufaFreeApplicationHref({
      caseId,
      caseRef,
      accessToken,
    }),
    siteOrigin
  ).toString()

  const subject = "Bitte Antrag vervollständigen"
  const html = buildEmailHtml({
    title: "Bitte Antrag vervollständigen",
    intro: caseRef
      ? `Für Ihren Fall ${caseRef} ist die erste Vorprüfung bereits positiv. Bitte vervollständigen Sie jetzt noch den Antrag.`
      : "Ihre erste Vorprüfung ist bereits positiv. Bitte vervollständigen Sie jetzt noch den Antrag.",
    bodyHtml: `
      <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
        Über den Button unten gelangen Sie direkt zurück in das zweite Formular. Ihre bisherigen Angaben aus der
        Vorprüfung sind bereits übernommen.
      </p>
      <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
        Ergänzen Sie nur noch die fehlenden Daten und senden Sie den Antrag danach vollständig an SEPANA ab.
      </p>
    `,
    steps: [
      "Link öffnen und direkt im zweiten Formular weitermachen.",
      "Fehlende Angaben ergänzen.",
      "Antrag vollständig absenden.",
    ],
    ctaLabel: "Antrag jetzt vervollständigen",
    ctaUrl: applicationUrl,
    preheader: "Bitte vervollständigen Sie jetzt den noch offenen Antrag.",
    eyebrow: "SEPANA - Antrag fortsetzen",
    supportNote: "Der Button führt direkt zurück in den noch offenen Schufa-frei-Antrag.",
  })

  const mailResult = await sendEmail({
    to: caseMeta.customer_email,
    subject,
    html,
  }).catch((error) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : "mail_failed",
  }))

  if (!mailResult?.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: mailResult?.error === "missing_resend_env" ? "mail_not_configured" : String(mailResult?.error ?? "mail_failed"),
      },
      { status: 502 }
    )
  }

  const sentAt = new Date().toISOString()

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "schufa_free_application_reminder_sent",
    title: "Erinnerung zum offenen Antrag versendet",
    body: "Dem Kunden wurde ein Direktlink zum noch offenen Schufa-frei-Antrag per E-Mail gesendet.",
    meta: {
      target: "/kredit-ohne-schufa/antrag",
      email_subject: subject,
    },
    notifyAdvisor: false,
  })

  return NextResponse.json({
    ok: true,
    sentTo: caseMeta.customer_email,
    sentAt,
  })
}
