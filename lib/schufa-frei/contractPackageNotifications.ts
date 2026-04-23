import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import {
  getSchufaFreeSignatureRequestMeta,
  isSchufaFreeCompletionRelevantRequest,
  isSignatureRequestComplete,
} from "@/lib/schufa-frei/contractPackage"
import type { SupabaseClient } from "@supabase/supabase-js"

const TERMINAL_ADVISOR_STATUSES = new Set(["abgelehnt", "abgeschlossen"])

function resolveSiteUrl() {
  const fallback = "https://www.sepana.de"
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (!raw) return fallback
  try {
    return new URL(raw).origin
  } catch {
    return fallback
  }
}

async function syncSchufaFreeAdvisorStatusForBankSubmission(admin: SupabaseClient, caseId: string) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("advisor_status")
    .eq("id", caseId)
    .maybeSingle()

  const currentStatus = String(caseRow?.advisor_status ?? "").trim().toLowerCase()
  if (currentStatus === "bankeinreichung") {
    return { updated: false, reason: "already_set" as const }
  }

  if (TERMINAL_ADVISOR_STATUSES.has(currentStatus)) {
    return { updated: false, reason: "terminal_status" as const }
  }

  const { error } = await admin
    .from("cases")
    .update({ advisor_status: "bankeinreichung", updated_at: new Date().toISOString() })
    .eq("id", caseId)

  if (error) throw error

  await logCaseEvent({
    caseId,
    actorId: null,
    actorRole: "system",
    type: "schufa_free_bank_submission_ready",
    title: "Bereit für Bankeinreichung",
    body: "Das Schufa-frei-Vertragspaket ist vollständig unterschrieben und kann jetzt eingereicht werden.",
    meta: {
      advisor_status: "bankeinreichung",
    },
    notifyCustomer: false,
  }).catch(() => null)

  return { updated: true, reason: "updated" as const }
}

export async function maybeNotifyAdvisorAboutCompletedSchufaFreeContractPackage(opts: {
  admin: SupabaseClient
  caseId: string
  completedRequestId?: string | null
}) {
  const { admin, caseId, completedRequestId } = opts
  const { data: caseRow } = await admin.from("cases").select("case_type").eq("id", caseId).maybeSingle()
  if (String(caseRow?.case_type ?? "").trim().toLowerCase() !== "schufa_frei") return { sent: false, reason: "not_schufa_frei" as const }

  const { data: requests } = await admin
    .from("case_signature_requests")
    .select("id,title,status,requires_wet_signature,advisor_signed_at,customer_signed_at,fields")
    .eq("case_id", caseId)

  const relevant = (requests ?? []).filter((request) =>
    isSchufaFreeCompletionRelevantRequest({
      title: request.title,
      requiresWetSignature: request.requires_wet_signature,
      fields: Array.isArray(request.fields) ? request.fields : [],
    })
  )

  if (!relevant.length) return { sent: false, reason: "no_relevant_requests" as const }

  if (completedRequestId) {
    const current = relevant.find((request) => request.id === completedRequestId)
    if (!current) return { sent: false, reason: "request_not_relevant" as const }
    if (
      !isSignatureRequestComplete({
        fields: Array.isArray(current.fields) ? current.fields : [],
        requires_wet_signature: current.requires_wet_signature,
        advisor_signed_at: current.advisor_signed_at,
        customer_signed_at: current.customer_signed_at,
        status: current.status,
      })
    ) {
      return { sent: false, reason: "request_not_complete" as const }
    }
  }

  const allComplete = relevant.every((request) =>
    isSignatureRequestComplete({
      fields: Array.isArray(request.fields) ? request.fields : [],
      requires_wet_signature: request.requires_wet_signature,
      advisor_signed_at: request.advisor_signed_at,
      customer_signed_at: request.customer_signed_at,
      status: request.status,
    })
  )

  if (!allComplete) return { sent: false, reason: "package_incomplete" as const }

  await syncSchufaFreeAdvisorStatusForBankSubmission(admin, caseId)

  const caseMeta = await getCaseMeta(caseId)
  const siteUrl = resolveSiteUrl()
  const ctaUrl = new URL(`/advisor/faelle/${encodeURIComponent(caseId)}#schufa-signatur`, siteUrl).toString()

  if (caseMeta?.advisor_email) {
    const requiredSteps = relevant
      .map((request) =>
        getSchufaFreeSignatureRequestMeta({
          title: request.title,
          requiresWetSignature: request.requires_wet_signature,
          fields: Array.isArray(request.fields) ? request.fields : [],
        })
      )
      .sort((a, b) => a.order - b.order)
      .map((meta) => meta.stepLabel && meta.description ? `${meta.stepLabel}: ${meta.description}` : meta.description)
      .filter((value): value is string => Boolean(value))

    const html = buildEmailHtml({
      title: "Schufa-frei-Vertrag vollständig abgeschlossen",
      intro: "Alle Pflichtdokumente des Schufa-frei-Vertragspakets wurden vom Kunden abgeschlossen.",
      steps: requiredSteps.length
        ? requiredSteps
        : [
            "Öffnen Sie den Fall im Beraterbereich.",
            "Prüfen Sie die finalen PDFs im Signaturbereich.",
            "Leiten Sie die nächsten Auszahlungsschritte ein.",
          ],
      ctaLabel: "Fall öffnen",
      ctaUrl,
      preheader: "Alle Pflichtdokumente des Schufa-frei-Vertragspakets sind abgeschlossen.",
      eyebrow: "Schufa-frei Signaturstatus",
    })

    await sendEmail({
      to: caseMeta.advisor_email,
      subject: "Schufa-frei-Vertrag vollständig abgeschlossen",
      html,
    }).catch(() => null)
  }

  await logCaseEvent({
    caseId,
    actorId: null,
    actorRole: "system",
    type: "schufa_free_signature_package_completed",
    title: "Schufa-frei-Vertrag vollständig abgeschlossen",
    body: "Alle Pflichtdokumente des Vertragspakets wurden abgeschlossen.",
    meta: {
      completed_request_id: completedRequestId ?? null,
    },
    notifyCustomer: false,
  }).catch(() => null)

  return { sent: true, reason: "completed" as const }
}
