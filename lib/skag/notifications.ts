import { buildEmailHtml, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { getSkagStatusMeta } from "@/lib/skag/status"

function siteUrl() {
  const fallback = "https://www.sepana.de"
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (!raw) return fallback
  try {
    return new URL(raw).origin
  } catch {
    return fallback
  }
}

export async function notifySkagStatusChange(input: {
  caseId: string
  alias: string | null | undefined
  description?: string | null
  customerEmail?: string | null
  advisorEmail?: string | null
  caseRef?: string | null
}) {
  const meta = getSkagStatusMeta(input.alias, input.description)
  await logCaseEvent({
    caseId: input.caseId,
    actorRole: "admin",
    type: "skag_status_update",
    title: `SEPANA Update: ${meta.title}`,
    body: input.description?.trim() || meta.customerMessage,
  })

  const base = siteUrl()
  const customerPortalUrl = `${base}/app/faelle/${input.caseId}`
  const advisorPortalUrl = `${base}/advisor/faelle/${input.caseId}`
  const subject = input.caseRef ? `Update zu Ihrem Fall ${input.caseRef}` : "Update zu Ihrem SEPANA-Fall"
  const description = input.description?.trim() || meta.customerMessage

  if (input.customerEmail) {
    const html = buildEmailHtml({
      title: meta.title,
      intro: description,
      steps: [
        "Sie finden den aktuellen Status und alle angeforderten Unterlagen direkt im Portal.",
        meta.caseStatus === "needs_docs"
          ? "Bitte laden Sie fehlende Dokumente so schnell wie moeglich hoch."
          : "Sobald sich etwas aendert, informieren wir Sie automatisch.",
      ],
      ctaLabel: "Zum Kundenportal",
      ctaUrl: customerPortalUrl,
      preheader: subject,
      eyebrow: "SEPANA - Status",
    })
    await sendEmail({
      to: input.customerEmail,
      subject,
      html,
    }).catch(() => null)
  }

  if (input.advisorEmail) {
    const html = buildEmailHtml({
      title: `Beraterupdate: ${meta.title}`,
      intro: input.description?.trim() || meta.advisorMessage,
      steps: [
        "Der Fall wurde automatisch aktualisiert.",
        meta.caseStatus === "needs_docs"
          ? "Bitte pruefen Sie die neuen Dokumentenanforderungen im Advisor-Portal."
          : "Weitere Folgeschritte koennen direkt im Advisor-Portal verfolgt werden.",
      ],
      ctaLabel: "Zum Advisor-Portal",
      ctaUrl: advisorPortalUrl,
      preheader: subject,
      eyebrow: "SEPANA - Advisor Update",
    })
    await sendEmail({
      to: input.advisorEmail,
      subject: `Beraterupdate: ${subject}`,
      html,
    }).catch(() => null)
  }
}
