import { buildEmailHtml, getCaseMeta, sendEmail } from "@/lib/notifications/notify"
import {
  FINANCIAL_ANALYSIS_FEATURES,
  FINANCIAL_ANALYSIS_LEGAL_NOTE,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  buildFinancialAnalysisPortalUrl,
  formatFinancialAnalysisPrice,
  trimOrNull,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"

type MailResult =
  | {
      ok: true
      to: string
      subject: string
    }
  | {
      ok: false
      error: string
    }

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(value: string | null | undefined) {
  const normalized = trimOrNull(value)
  if (!normalized) return null
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(normalized))
}

function renderFeatureListHtml() {
  return FINANCIAL_ANALYSIS_FEATURES.map(
    (feature) =>
      `<li style="margin:0 0 8px 0; font-size:14px; line-height:22px; color:#334155;">${escapeHtml(feature)}</li>`
  ).join("")
}

function renderOfferSummaryHtml(service: FinancialAnalysisServiceRow) {
  const summary = trimOrNull(service.offer_summary) ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY
  const priceLabel = formatFinancialAnalysisPrice(service.price_gross_cents)

  return `
    <div style="margin:0 0 16px 0; border:1px solid #e2e8f0; border-radius:16px; background:#f8fafc; padding:16px;">
      <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Gesonderter Beratungsservice</div>
      <div style="margin-top:6px; font-size:20px; line-height:28px; font-weight:700; color:#0f172a;">${escapeHtml(trimOrNull(service.offer_title) ?? FINANCIAL_ANALYSIS_SERVICE_TITLE)}</div>
      <div style="margin-top:6px; font-size:14px; line-height:22px; color:#334155;">${escapeHtml(summary)}</div>
      <div style="margin-top:12px; font-size:15px; line-height:24px; font-weight:700; color:#0f172a;">Einmalig ${escapeHtml(priceLabel)} inkl. MwSt.</div>
      <ul style="margin:14px 0 0 18px; padding:0;">${renderFeatureListHtml()}</ul>
      <div style="margin-top:12px; font-size:12px; line-height:18px; color:#64748b;">${escapeHtml(FINANCIAL_ANALYSIS_LEGAL_NOTE)}</div>
    </div>
  `
}

export async function sendFinancialAnalysisOfferEmail(input: {
  caseId: string
  activationUrl: string
  service: FinancialAnalysisServiceRow
}) : Promise<MailResult> {
  const caseMeta = await getCaseMeta(input.caseId)
  if (!caseMeta?.customer_email) {
    return { ok: false, error: "customer_email_missing" }
  }

  const subject = "Finanzanalyse aktiv bestaetigen"
  const html = buildEmailHtml({
    title: "Finanzanalyse aktiv bestaetigen",
    intro: caseMeta.case_ref
      ? `Fuer Ihren Fall ${caseMeta.case_ref} koennen Sie jetzt die persoenliche Finanzanalyse gesondert bestaetigen.`
      : "Sie koennen die persoenliche Finanzanalyse jetzt gesondert bestaetigen.",
    bodyHtml: `
      ${renderOfferSummaryHtml(input.service)}
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Ueber den Button unten sehen Sie den Service noch einmal auf einer separaten Seite und bestaetigen die Beauftragung aktiv.
      </p>
      <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
        Der Bereich im Kundendashboard wird erst freigeschaltet, wenn Ihre Bestaetigung vorliegt und der Zahlungseingang intern markiert wurde.
      </p>
    `,
    steps: [
      "Leistungsseite aufrufen und Angebot noch einmal in Ruhe pruefen.",
      "Die Finanzanalyse aktiv bestaetigen.",
      "Nach Zahlungsmarkierung wird der Bereich im Dashboard freigeschaltet.",
    ],
    ctaLabel: "Finanzanalyse bestaetigen",
    ctaUrl: input.activationUrl,
    preheader: "Bitte bestaetigen Sie die Finanzanalyse aktiv auf der gesonderten Serviceseite.",
    eyebrow: "SEPANA - Finanzanalyse",
    supportNote: "Die Bestaetigung erfolgt separat. Ohne aktive Bestaetigung und Zahlungsmarkierung wird der Bereich nicht freigeschaltet.",
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
    return { ok: false, error: String(mailResult?.error ?? "mail_failed") }
  }

  return {
    ok: true,
    to: caseMeta.customer_email,
    subject,
  }
}

export async function sendFinancialAnalysisActivatedEmail(input: {
  caseId: string
  siteOrigin: string
  service: FinancialAnalysisServiceRow
}) : Promise<MailResult> {
  const caseMeta = await getCaseMeta(input.caseId)
  if (!caseMeta?.customer_email) {
    return { ok: false, error: "customer_email_missing" }
  }

  const subject = "Ihre Finanzanalyse ist jetzt freigeschaltet"
  const portalUrl = buildFinancialAnalysisPortalUrl(input.siteOrigin, input.caseId)
  const expiresLabel = formatDate(input.service.access_expires_at)

  const html = buildEmailHtml({
    title: "Ihre Finanzanalyse ist jetzt freigeschaltet",
    intro: caseMeta.case_ref
      ? `Der Zusatzservice fuer Ihren Fall ${caseMeta.case_ref} ist jetzt aktiv.`
      : "Ihr Zusatzservice ist jetzt aktiv.",
    bodyHtml: `
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Ihr Bereich <strong style="color:#0f172a;">${escapeHtml(FINANCIAL_ANALYSIS_SERVICE_TITLE)}</strong> steht jetzt im Kundendashboard bereit.
      </p>
      <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
        Laden Sie dort jetzt Ihre Kontoauszuege, Ihre aktuelle Schufa und weitere relevante Unterlagen hoch. Ihr Zugang bleibt${expiresLabel ? ` bis ${escapeHtml(expiresLabel)}` : ""} aktiv.
      </p>
    `,
    steps: [
      "Im Dashboard den Bereich Finanzanalyse oeffnen.",
      "Kontoauszuege, Schufa und Zusatzdokumente hochladen.",
      "Sobald die Auswertung veroeffentlicht ist, sehen Sie Haushaltsrechnung und Massnahmenplan direkt dort.",
    ],
    ctaLabel: "Zum Finanzanalyse-Bereich",
    ctaUrl: portalUrl,
    preheader: "Ihr Finanzanalyse-Bereich ist jetzt im Dashboard freigeschaltet.",
    eyebrow: "SEPANA - Aktivierung",
    supportNote: "Bei Rueckfragen begleitet Sie Ihr Ansprechpartner waehrend der aktiven Laufzeit.",
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
    return { ok: false, error: String(mailResult?.error ?? "mail_failed") }
  }

  return {
    ok: true,
    to: caseMeta.customer_email,
    subject,
  }
}
