import { buildEmailHtml, getCaseMeta, sendEmail } from "@/lib/notifications/notify"
import { buildFinancialAnalysisPaymentReference, type FinancialAnalysisInvoiceRow } from "@/lib/financial-analysis/invoice"
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

  const subject = "Finanzanalyse aktiv bestätigen"
  const html = buildEmailHtml({
    title: "Finanzanalyse aktiv bestätigen",
    intro: caseMeta.case_ref
      ? `Für Ihren Fall ${caseMeta.case_ref} können Sie jetzt die persönliche Finanzanalyse gesondert bestätigen. Der Service richtet sich besonders an Personen mit starkem Kreditbedarf, wiederholten Ablehnungen oder einer sehr engen Haushaltsrechnung.`
      : "Sie können die persönliche Finanzanalyse jetzt gesondert bestätigen. Der Service richtet sich besonders an Personen mit starkem Kreditbedarf, wiederholten Ablehnungen oder einer sehr engen Haushaltsrechnung.",
    bodyHtml: `
      ${renderOfferSummaryHtml(input.service)}
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Auf Basis der bisherigen Rückmeldung vermuten wir, dass Ihre aktuelle finanzielle Situation an einer Kapazitätsgrenze angekommen sein könnte.
        Genau hier setzt die Finanzanalyse an: Wir ordnen Einnahmen, Ausgaben, bestehende Verpflichtungen und mögliche Schufa-Themen strukturiert ein und leiten daraus konkrete nächste Schritte ab.
      </p>
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Über den Button unten sehen Sie den Service noch einmal auf einer separaten Seite und bestätigen die Beauftragung aktiv.
      </p>
      <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
        Der Bereich im Kundendashboard wird erst freigeschaltet, wenn Ihre Bestätigung vorliegt und der Zahlungseingang intern markiert wurde.
      </p>
    `,
    steps: [
      "Leistungsseite aufrufen und Angebot noch einmal in Ruhe prüfen.",
      "Die Finanzanalyse aktiv bestätigen.",
      "Nach Zahlungsmarkierung wird der Bereich im Dashboard freigeschaltet.",
    ],
    ctaLabel: "Finanzanalyse bestätigen",
    ctaUrl: input.activationUrl,
    preheader: "Bitte bestätigen Sie die Finanzanalyse aktiv auf der gesonderten Serviceseite.",
    eyebrow: "SEPANA - Finanzanalyse",
    supportNote: "Die Bestätigung erfolgt separat. Ohne aktive Bestätigung und Zahlungsmarkierung wird der Bereich nicht freigeschaltet.",
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
      ? `Der Zusatzservice für Ihren Fall ${caseMeta.case_ref} ist jetzt aktiv.`
      : "Ihr Zusatzservice ist jetzt aktiv.",
    bodyHtml: `
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Ihr Bereich <strong style="color:#0f172a;">${escapeHtml(FINANCIAL_ANALYSIS_SERVICE_TITLE)}</strong> steht jetzt im Kundendashboard bereit.
      </p>
      <p style="margin:0; font-size:14px; line-height:22px; color:#334155;">
        Laden Sie dort jetzt Ihre Kontoauszüge, Ihre aktuelle Schufa und weitere relevante Unterlagen hoch. Ihr Zugang bleibt${expiresLabel ? ` bis ${escapeHtml(expiresLabel)}` : ""} aktiv.
      </p>
    `,
    steps: [
      "Im Dashboard den Bereich Finanzanalyse öffnen.",
      "Kontoauszüge, Schufa und Zusatzdokumente hochladen.",
      "Sobald die Auswertung veröffentlicht ist, sehen Sie Haushaltsrechnung und Maßnahmenplan direkt dort.",
    ],
    ctaLabel: "Zum Finanzanalyse-Bereich",
    ctaUrl: portalUrl,
    preheader: "Ihr Finanzanalyse-Bereich ist jetzt im Dashboard freigeschaltet.",
    eyebrow: "SEPANA - Aktivierung",
    supportNote: "Bei Rückfragen begleitet Sie Ihr Ansprechpartner während der aktiven Laufzeit.",
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

export async function sendFinancialAnalysisInvoiceEmail(input: {
  caseId: string
  caseRef: string | null | undefined
  invoice: FinancialAnalysisInvoiceRow
  invoicePdfBase64: string
  attachmentFileName: string
}) : Promise<MailResult> {
  const caseMeta = await getCaseMeta(input.caseId)
  if (!caseMeta?.customer_email) {
    return { ok: false, error: "customer_email_missing" }
  }

  const invoiceNumber = trimOrNull(input.invoice.invoice_number) ?? trimOrNull(input.invoice.id) ?? "-"
  const paymentReference = buildFinancialAnalysisPaymentReference(invoiceNumber, input.caseRef)
  const subject = "Ihre Rechnung zur Finanzanalyse"
  const priceLabel = formatFinancialAnalysisPrice(input.invoice.amount_total ? Number(input.invoice.amount_total) * 100 : null)

  const html = buildEmailHtml({
    title: "Ihre Rechnung zur Finanzanalyse",
    intro: caseMeta.case_ref
      ? `Vielen Dank für Ihre Bestätigung. Für Ihren Fall ${caseMeta.case_ref} wurde jetzt die Rechnung zur Finanzanalyse erstellt.`
      : "Vielen Dank für Ihre Bestätigung. Ihre Rechnung zur Finanzanalyse wurde jetzt erstellt.",
    bodyHtml: `
      <div style="margin:0 0 16px 0; border:1px solid #e2e8f0; border-radius:16px; background:#f8fafc; padding:16px;">
        <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Rechnungsdaten</div>
        <div style="margin-top:6px; font-size:18px; line-height:26px; font-weight:700; color:#0f172a;">Rechnung ${escapeHtml(invoiceNumber)}</div>
        <div style="margin-top:8px; font-size:14px; line-height:22px; color:#334155;">Betrag: <strong style="color:#0f172a;">${escapeHtml(priceLabel)}</strong></div>
        <div style="margin-top:4px; font-size:14px; line-height:22px; color:#334155;">Verwendungszweck: <strong style="color:#0f172a;">${escapeHtml(paymentReference ?? invoiceNumber)}</strong></div>
        <div style="margin-top:4px; font-size:14px; line-height:22px; color:#334155;">Bitte nutzen Sie die beigefügte Rechnung für die Überweisung.</div>
      </div>
      <p style="margin:0 0 14px 0; font-size:14px; line-height:22px; color:#334155;">
        Der Service wird erst nach intern markiertem Zahlungseingang freigeschaltet. Ab dann beginnt auch die 90-Tage-Laufzeit.
      </p>
      <p style="margin:0; font-size:12px; line-height:18px; color:#64748b;">
        ${escapeHtml(FINANCIAL_ANALYSIS_LEGAL_NOTE)}
      </p>
    `,
    steps: [
      "Die beigefügte Rechnung öffnen und prüfen.",
      `Den Betrag ${priceLabel} mit dem Verwendungszweck ${paymentReference ?? invoiceNumber} überweisen.`,
      "Nach Zahlungsmarkierung wird der Bereich im Dashboard freigeschaltet.",
    ],
    preheader: "Ihre Rechnung zur Finanzanalyse ist als PDF im Anhang enthalten.",
    eyebrow: "SEPANA - Rechnung",
    supportNote: "Sobald der Zahlungseingang intern markiert wurde, startet die Finanzanalyse und der Zugang wird freigeschaltet.",
  })

  const mailResult = await sendEmail({
    to: caseMeta.customer_email,
    subject,
    html,
    attachments: [
      {
        filename: input.attachmentFileName,
        content: input.invoicePdfBase64,
      },
    ],
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
