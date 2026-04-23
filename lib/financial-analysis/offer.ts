import { loadLatestFinancialAnalysisService } from "@/lib/financial-analysis/data"
import { sendFinancialAnalysisOfferEmail } from "@/lib/financial-analysis/email"
import { createFinancialAnalysisPublicToken } from "@/lib/financial-analysis/publicAccess"
import {
  FINANCIAL_ANALYSIS_CURRENCY,
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  FINANCIAL_ANALYSIS_DURATION_DAYS,
  FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  FINANCIAL_ANALYSIS_TERMS_VERSION,
  isFinancialAnalysisTerminalStatus,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type FinancialAnalysisAdmin = ReturnType<typeof supabaseAdmin>

export function buildFinancialAnalysisActivationUrl(siteOrigin: string, token: string) {
  return new URL(`/finanzanalyse/aktivieren?token=${encodeURIComponent(token)}`, siteOrigin).toString()
}

export async function upsertFinancialAnalysisOffer(input: {
  admin: FinancialAnalysisAdmin
  existingService: FinancialAnalysisServiceRow | null
  caseId: string
  userId: string | null
  assignedAdvisorId: string | null
  offerSummary?: string | null
}) {
  const nowIso = new Date().toISOString()
  const payload = {
    offer_title: FINANCIAL_ANALYSIS_SERVICE_TITLE,
    offer_summary: trimOrNull(input.offerSummary) ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
    assigned_advisor_id: input.assignedAdvisorId,
    price_gross_cents: FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS,
    currency: FINANCIAL_ANALYSIS_CURRENCY,
    service_duration_days: FINANCIAL_ANALYSIS_DURATION_DAYS,
    terms_version: FINANCIAL_ANALYSIS_TERMS_VERSION,
    updated_at: nowIso,
  }

  if (input.existingService?.id && !isFinancialAnalysisTerminalStatus(input.existingService.service_status)) {
    const result = await input.admin
      .from("case_financial_analysis_services")
      .update(payload)
      .eq("id", input.existingService.id)
      .select("*")
      .single()

    if (result.error) throw result.error
    return normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
  }

  const result = await input.admin
    .from("case_financial_analysis_services")
    .insert({
      case_id: input.caseId,
      offered_by: input.userId,
      ...payload,
      created_at: nowIso,
    })
    .select("*")
    .single()

  if (result.error) throw result.error
  return normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
}

export async function sendFinancialAnalysisOfferForCase(input: {
  admin: FinancialAnalysisAdmin
  caseId: string
  userId: string | null
  assignedAdvisorId: string | null
  siteOrigin: string
  offerSummary?: string | null
  existingService?: FinancialAnalysisServiceRow | null
  skipIfAlreadySent?: boolean
}) {
  const existingService =
    input.existingService === undefined
      ? await loadLatestFinancialAnalysisService(input.admin, input.caseId)
      : input.existingService

  const existingIsOpen = Boolean(existingService?.id) && !isFinancialAnalysisTerminalStatus(existingService?.service_status)
  const alreadyStartedOrSent =
    existingIsOpen &&
    (Boolean(trimOrNull(existingService?.offer_email_sent_at)) ||
      Boolean(trimOrNull(existingService?.customer_confirmed_at)) ||
      Boolean(trimOrNull(existingService?.payment_received_at)))

  if (input.skipIfAlreadySent && alreadyStartedOrSent) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "already_sent_or_started" as const,
      service: existingService,
      sentTo: null,
      activationUrl: null,
      subject: null,
    }
  }

  const service = await upsertFinancialAnalysisOffer({
    admin: input.admin,
    existingService,
    caseId: input.caseId,
    userId: input.userId,
    assignedAdvisorId: input.assignedAdvisorId,
    offerSummary: input.offerSummary ?? existingService?.offer_summary ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  })

  if (!service?.id) {
    return {
      ok: false as const,
      error: "financial_analysis_offer_missing",
      service: null,
      activationUrl: null,
    }
  }

  const token = createFinancialAnalysisPublicToken({
    serviceId: service.id,
    caseId: input.caseId,
  })
  const activationUrl = buildFinancialAnalysisActivationUrl(input.siteOrigin, token)

  const mailResult = await sendFinancialAnalysisOfferEmail({
    caseId: input.caseId,
    activationUrl,
    service,
  })

  if (!mailResult.ok) {
    return {
      ok: false as const,
      error: mailResult.error,
      service,
      activationUrl,
    }
  }

  const sentAt = new Date().toISOString()
  const result = await input.admin
    .from("case_financial_analysis_services")
    .update({
      offer_email_sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", service.id)
    .select("*")
    .single()

  if (result.error) throw result.error

  return {
    ok: true as const,
    skipped: false as const,
    reason: "sent" as const,
    service: normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null),
    sentTo: mailResult.to,
    activationUrl,
    subject: mailResult.subject,
  }
}
