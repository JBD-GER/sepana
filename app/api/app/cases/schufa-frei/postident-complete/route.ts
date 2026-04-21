import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { updateCaseStatusCompat } from "@/lib/caseStatusCompat"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
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
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) {
    return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
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

  const now = new Date().toISOString()
  const syncUpdate = await admin.from("case_skag_sync").upsert(
    {
      case_id: caseId,
      last_status_alias: "postident_successfully_completed",
      last_status_description: "PostIdent erfolgreich abgeschlossen",
      updated_at: now,
    },
    { onConflict: "case_id" }
  )
  if (syncUpdate.error) {
    return NextResponse.json({ ok: false, error: syncUpdate.error.message }, { status: 400 })
  }

  await updateCaseStatusCompat(admin, {
    caseId,
    status: "processing",
    updatedAt: now,
  })

  const siteOrigin = resolveSiteOrigin(req)
  const customerDashboardUrl = new URL(`/app/faelle/${encodeURIComponent(caseId)}`, siteOrigin).toString()
  const caseMeta = await getCaseMeta(caseId)

  let emailSent = false
  let emailError: string | null = null

  if (caseMeta?.customer_email) {
    const html = buildEmailHtml({
      title: "PostIdent erfolgreich abgeschlossen",
      intro: caseMeta.case_ref
        ? `Ihr PostIdent für den Fall ${caseMeta.case_ref} wurde erfolgreich abgeschlossen.`
        : "Ihr PostIdent wurde erfolgreich abgeschlossen.",
      bodyHtml: `
        <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
          Die Legitimation liegt jetzt erfolgreich vor. Die Bank befindet sich damit in den finalen Zügen
          Ihres Falls. Wir informieren Sie automatisch, sobald die nächste Rückmeldung oder die Auszahlung vorliegt.
        </p>
      `,
      steps: [
        "Ihr PostIdent ist erfolgreich abgeschlossen.",
        "Die Bank bearbeitet den Fall jetzt in den finalen Zügen.",
        "Sobald es weitergeht, erhalten Sie automatisch die nächste Rückmeldung.",
      ],
      ctaLabel: "Zum Kundendashboard",
      ctaUrl: customerDashboardUrl,
      preheader: "Ihr PostIdent wurde erfolgreich abgeschlossen.",
      eyebrow: "SEPANA - PostIdent abgeschlossen",
      supportNote: "Den aktuellen Stand können Sie jederzeit auch in Ihrem Kundendashboard einsehen.",
    })

    const emailResult = await sendEmail({
      to: caseMeta.customer_email,
      subject: "PostIdent erfolgreich abgeschlossen",
      html,
    }).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "mail_failed",
    }))

    emailSent = Boolean(emailResult?.ok)
    emailError = emailSent ? null : String(emailResult?.error ?? "mail_failed")
  } else {
    emailError = "missing_customer_email"
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "schufa_free_postident_completed",
    title: "PostIdent erfolgreich abgeschlossen",
    body: "Ihr PostIdent ist erfolgreich abgeschlossen. Die Bank befindet sich jetzt in den finalen Zügen.",
    meta: {
      customer_dashboard_url: customerDashboardUrl,
      email_sent: emailSent,
    },
    notifyAdvisor: false,
  })

  return NextResponse.json({
    ok: true,
    status_alias: "postident_successfully_completed",
    emailSent,
    emailError,
  })
}
