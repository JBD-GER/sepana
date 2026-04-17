import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type SupportedDecision = "approved" | "rejected"

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

function isSupportedDecision(value: string): value is SupportedDecision {
  return value === "approved" || value === "rejected"
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const decisionRaw = String(body?.decision ?? "").trim().toLowerCase()

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }
  if (!isSupportedDecision(decisionRaw)) {
    return NextResponse.json({ ok: false, error: "Ungültige Entscheidung" }, { status: 400 })
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

  const caseMeta = await getCaseMeta(caseId)
  if (!caseMeta) {
    return NextResponse.json({ ok: false, error: "Fall-Metadaten nicht gefunden" }, { status: 404 })
  }
  if (!caseMeta.customer_email) {
    return NextResponse.json({ ok: false, error: "customer_email_missing" }, { status: 400 })
  }

  const siteOrigin = resolveSiteOrigin(req)
  const customerPortalUrl = `${siteOrigin}/app/faelle/${caseId}#schufa-vorauszahlung`

  const subject =
    decisionRaw === "approved" ? "Vorprüfung erfolgreich" : "Vorprüfung fehlgeschlagen"

  const html =
    decisionRaw === "approved"
      ? buildEmailHtml({
          title: "Vorprüfung erfolgreich",
          intro: caseMeta.case_ref
            ? `Für Ihren Fall ${caseMeta.case_ref} war die Vorprüfung erfolgreich. Ihr Berater hat den Antrag genehmigt.`
            : "Ihre Vorprüfung war erfolgreich. Ihr Berater hat den Antrag genehmigt.",
          bodyHtml: `
            <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
              Damit geht Ihr Antrag jetzt in die nächsten verbindlichen Schritte. Die weitere Strecke läuft digital und
              klar strukturiert weiter.
            </p>
          `,
          steps: [
            "Vorauszahlung der Serviceprovision",
            "Kreditvertrag unterzeichnen",
            "Geld erhalten",
          ],
          ctaLabel: "Zum Kundendashboard",
          ctaUrl: customerPortalUrl,
          preheader: "Ihre Vorprüfung war erfolgreich.",
          eyebrow: "SEPANA - Vorprüfung erfolgreich",
          supportNote: "Die nächsten Schritte sehen Sie zusätzlich jederzeit in Ihrem Kundendashboard.",
        })
      : buildEmailHtml({
          title: "Vorprüfung fehlgeschlagen",
          intro: caseMeta.case_ref
            ? `Für Ihren Fall ${caseMeta.case_ref} kam es leider zu keiner positiven Rückmeldung.`
            : "Leider kam es zu keiner positiven Rückmeldung.",
          bodyHtml: `
            <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
              Ihr Berater hat den Antrag aktuell abgelehnt. Dafür kann es unterschiedliche Gründe geben, zum Beispiel
              Vorgaben des Produkts, Bonitätskriterien oder die Gesamtkonstellation der Anfrage.
            </p>
            <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
              Sobald sich die Ausgangslage verändert oder ergänzende Informationen vorliegen, kann der Fall erneut
              bewertet werden.
            </p>
          `,
          preheader: "Leider liegt keine positive Rückmeldung zur Vorprüfung vor.",
          eyebrow: "SEPANA - Vorprüfung",
          supportNote: "Bei Rückfragen können Sie sich direkt an Ihren Ansprechpartner bei SEPANA wenden.",
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
    return NextResponse.json({ ok: false, error: String(mailResult?.error ?? "mail_failed") }, { status: 502 })
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: decisionRaw === "approved" ? "schufa_free_precheck_approved_sent" : "schufa_free_precheck_rejected_sent",
    title: decisionRaw === "approved" ? "Vorprüfung erfolgreich versendet" : "Vorprüfung fehlgeschlagen versendet",
    body:
      decisionRaw === "approved"
        ? "Die positive Rückmeldung zur Vorprüfung wurde an den Kunden versendet."
        : "Die negative Rückmeldung zur Vorprüfung wurde an den Kunden versendet.",
    meta: {
      decision: decisionRaw,
      email_subject: subject,
    },
    notifyAdvisor: false,
  })

  return NextResponse.json({
    ok: true,
    decision: decisionRaw,
    subject,
    sentTo: caseMeta.customer_email,
  })
}
