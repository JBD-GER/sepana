import { sendFinancialAnalysisOfferForCase } from "@/lib/financial-analysis/offer"
import { ensureInsuranceRoute } from "@/lib/insurance/routing"
import { buildEmailHtml, getCaseMeta, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export type SchufaFreePrecheckDecision = "approved" | "rejected"

type AdminClient = ReturnType<typeof supabaseAdmin>

export type SchufaFreePrecheckDecisionAutomationResult = {
  subject: string
  sentTo: string
  insuranceRoute: Record<string, unknown> | null
  financialAnalysisOffer:
    | {
        sent: boolean
        skipped: boolean
        error: string | null
        sentTo: string | null
        serviceId: string | null
      }
    | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export async function runSchufaFreePrecheckDecisionAutomation(input: {
  admin: AdminClient
  caseId: string
  decision: SchufaFreePrecheckDecision
  actorId: string | null
  assignedAdvisorId: string | null
  siteOrigin: string
}) : Promise<SchufaFreePrecheckDecisionAutomationResult> {
  const caseMeta = await getCaseMeta(input.caseId)
  if (!caseMeta) {
    throw new Error("Fall-Metadaten nicht gefunden")
  }
  if (!caseMeta.customer_email) {
    throw new Error("customer_email_missing")
  }

  const customerPortalUrl = `${input.siteOrigin}/app/faelle/${input.caseId}#schufa-signatur`
  const restartRequestUrl = `${input.siteOrigin}/kredit-ohne-schufa`
  const subject = input.decision === "approved" ? "Vorpruefung erfolgreich" : "Vorpruefung fehlgeschlagen"

  const html =
    input.decision === "approved"
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
            <div style="margin-top:16px; border:1px solid #fcd34d; background:#fffbeb; border-radius:16px; padding:14px 16px;">
              <div style="margin:0 0 6px 0; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#b45309;">
                Tipp
              </div>
              <p style="margin:0; font-size:14px; line-height:22px; color:#92400e;">
                Bei verheirateten Paaren ist es oft sinnvoll, die Person mit dem hoeheren Nettoeinkommen als ersten
                Kreditnehmer einzutragen, weil Banken sich primaer den ersten Kreditnehmer anschauen. Wenn Sie das
                aendern moechten, starten Sie bitte eine neue Anfrage ueber
                <a href="${restartRequestUrl}" style="color:#92400e; font-weight:700; text-decoration:underline;"> kredit-ohne-schufa</a>.
              </p>
            </div>
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
    throw new Error(String(mailResult?.error ?? "mail_failed"))
  }

  let insuranceRoute = null as Record<string, unknown> | null
  let financialAnalysisOffer = null as SchufaFreePrecheckDecisionAutomationResult["financialAnalysisOffer"]

  if (input.decision === "rejected") {
    insuranceRoute = await ensureInsuranceRoute(input.admin, {
      caseId: input.caseId,
      source: "precheck_rejected",
      actorId: input.actorId,
      decisionSentAt: new Date().toISOString(),
    })

    try {
      const offerResult = await sendFinancialAnalysisOfferForCase({
        admin: input.admin,
        caseId: input.caseId,
        userId: input.actorId,
        assignedAdvisorId: trimOrNull(input.assignedAdvisorId) ?? input.actorId,
        siteOrigin: input.siteOrigin,
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

  return {
    subject,
    sentTo: caseMeta.customer_email,
    insuranceRoute,
    financialAnalysisOffer,
  }
}
