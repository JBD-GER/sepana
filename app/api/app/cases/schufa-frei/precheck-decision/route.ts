import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { sendFinancialAnalysisOfferForCase } from "@/lib/financial-analysis/offer"
import { ensureInsuranceRoute } from "@/lib/insurance/routing"
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
    return NextResponse.json({ ok: false, error: "Ungueltige Entscheidung" }, { status: 400 })
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
  const customerPortalUrl = `${siteOrigin}/app/faelle/${caseId}#schufa-signatur`

  const subject = decisionRaw === "approved" ? "Vorpruefung erfolgreich" : "Vorpruefung fehlgeschlagen"

  const html =
    decisionRaw === "approved"
      ? buildEmailHtml({
          title: "Vorpruefung erfolgreich",
          intro: caseMeta.case_ref
            ? `Fuer Ihren Fall ${caseMeta.case_ref} war die Vorpruefung erfolgreich. Ihr Berater hat den Antrag genehmigt.`
            : "Ihre Vorpruefung war erfolgreich. Ihr Berater hat den Antrag genehmigt.",
          bodyHtml: `
            <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
              Damit geht Ihr Antrag jetzt in die naechsten verbindlichen Schritte. Die weitere Strecke laeuft digital und
              klar strukturiert weiter.
            </p>
          `,
          steps: ["Kreditvertrag unterzeichnen", "PostIdent abschliessen", "Geld erhalten"],
          ctaLabel: "Zum Kundendashboard",
          ctaUrl: customerPortalUrl,
          preheader: "Ihre Vorpruefung war erfolgreich.",
          eyebrow: "SEPANA - Vorpruefung erfolgreich",
          supportNote: "Die naechsten Schritte sehen Sie zusaetzlich jederzeit in Ihrem Kundendashboard.",
        })
      : buildEmailHtml({
          title: "Vorpruefung fehlgeschlagen",
          intro: caseMeta.case_ref
            ? `Fuer Ihren Fall ${caseMeta.case_ref} kam es leider zu keiner positiven Rueckmeldung.`
            : "Leider kam es zu keiner positiven Rueckmeldung.",
          bodyHtml: `
            <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
              Ihr Berater hat den Antrag aktuell abgelehnt. Dafuer kann es unterschiedliche Gruende geben, zum Beispiel
              Vorgaben des Produkts, Bonitaetskriterien oder die Gesamtkonstellation der Anfrage.
            </p>
            <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
              Sobald sich die Ausgangslage veraendert oder ergaenzende Informationen vorliegen, kann der Fall erneut
              bewertet werden.
            </p>
          `,
          preheader: "Leider liegt keine positive Rueckmeldung zur Vorpruefung vor.",
          eyebrow: "SEPANA - Vorpruefung",
          supportNote: "Bei Rueckfragen koennen Sie sich direkt an Ihren Ansprechpartner bei SEPANA wenden.",
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

  let insuranceRoute = null as Record<string, unknown> | null
  let financialAnalysisOffer = null as
    | {
        sent: boolean
        skipped: boolean
        error: string | null
        sentTo: string | null
        serviceId: string | null
      }
    | null

  if (decisionRaw === "rejected") {
    try {
      insuranceRoute = await ensureInsuranceRoute(admin, {
        caseId,
        source: "precheck_rejected",
        actorId: user.id,
        decisionSentAt: new Date().toISOString(),
      })
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "insurance_routing_failed" },
        { status: 400 }
      )
    }

    try {
      const offerResult = await sendFinancialAnalysisOfferForCase({
        admin,
        caseId,
        userId: user.id,
        assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
        siteOrigin,
        skipIfAlreadySent: true,
      })

      financialAnalysisOffer = {
        sent: Boolean(offerResult.ok && !offerResult.skipped),
        skipped: Boolean(offerResult.ok && offerResult.skipped),
        error: offerResult.ok ? null : offerResult.error,
        sentTo: offerResult.ok ? offerResult.sentTo : null,
        serviceId: offerResult.service?.id ?? null,
      }
    } catch (error) {
      financialAnalysisOffer = {
        sent: false,
        skipped: false,
        error: error instanceof Error ? error.message : "financial_analysis_offer_failed",
        sentTo: null,
        serviceId: null,
      }
      console.error("[financial-analysis:auto-offer] failed after rejected precheck", error)
    }
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: decisionRaw === "approved" ? "schufa_free_precheck_approved_sent" : "schufa_free_precheck_rejected_sent",
    title: decisionRaw === "approved" ? "Vorpruefung erfolgreich versendet" : "Vorpruefung fehlgeschlagen versendet",
    body:
      decisionRaw === "approved"
        ? "Die positive Rueckmeldung zur Vorpruefung wurde an den Kunden versendet."
        : "Die negative Rueckmeldung zur Vorpruefung wurde an den Kunden versendet.",
    meta: {
      decision: decisionRaw,
      email_subject: subject,
      insurance_route_source: insuranceRoute ? String(insuranceRoute.route_source ?? "") : null,
      financial_analysis_offer_sent: financialAnalysisOffer?.sent ?? false,
      financial_analysis_offer_skipped: financialAnalysisOffer?.skipped ?? false,
      financial_analysis_offer_error: financialAnalysisOffer?.error ?? null,
      financial_analysis_service_id: financialAnalysisOffer?.serviceId ?? null,
    },
    notifyAdvisor: false,
    notifyCustomer: false,
  })

  return NextResponse.json({
    ok: true,
    decision: decisionRaw,
    subject,
    sentTo: caseMeta.customer_email,
    insuranceRoute,
    financialAnalysisOffer,
  })
}
