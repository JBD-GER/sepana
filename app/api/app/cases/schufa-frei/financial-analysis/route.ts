import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { loadLatestFinancialAnalysisService } from "@/lib/financial-analysis/data"
import { sendFinancialAnalysisActivatedEmail, sendFinancialAnalysisOfferEmail } from "@/lib/financial-analysis/email"
import {
  FINANCIAL_ANALYSIS_CURRENCY,
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  FINANCIAL_ANALYSIS_DURATION_DAYS,
  FINANCIAL_ANALYSIS_PRICE_GROSS_CENTS,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  FINANCIAL_ANALYSIS_TERMS_VERSION,
  buildFinancialAnalysisServicePatch,
  isFinancialAnalysisTerminalStatus,
  isMissingFinancialAnalysisTablesError,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
import { createFinancialAnalysisPublicToken } from "@/lib/financial-analysis/publicAccess"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type SupportedAction = "create_offer" | "send_offer_email" | "mark_payment_received" | "publish_results"

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fallback below
    }
  }
  return new URL(req.url).origin
}

function isSupportedAction(value: string): value is SupportedAction {
  return value === "create_offer" || value === "send_offer_email" || value === "mark_payment_received" || value === "publish_results"
}

function buildActivationUrl(siteOrigin: string, token: string) {
  return new URL(`/finanzanalyse/aktivieren?token=${encodeURIComponent(token)}`, siteOrigin).toString()
}

async function loadCaseForAction(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const result = await admin
    .from("cases")
    .select("id,case_ref,case_type,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (result.error) throw result.error
  return (result.data ?? null) as
    | {
        id?: string | null
        case_ref?: string | null
        case_type?: string | null
        customer_id?: string | null
        assigned_advisor_id?: string | null
      }
    | null
}

async function upsertFinancialAnalysisOffer(input: {
  admin: ReturnType<typeof supabaseAdmin>
  existingService: FinancialAnalysisServiceRow | null
  caseId: string
  userId: string
  assignedAdvisorId: string | null
  offerSummary: string
}) {
  const nowIso = new Date().toISOString()
  const payload = {
    offer_title: FINANCIAL_ANALYSIS_SERVICE_TITLE,
    offer_summary: input.offerSummary,
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

async function maybeSendActivationMail(input: {
  previousStatus: string | null | undefined
  nextService: FinancialAnalysisServiceRow | null
  caseId: string
  siteOrigin: string
}) {
  if (!input.nextService?.id) return { sent: false, error: null as string | null }
  if (String(input.previousStatus ?? "").trim().toLowerCase() === "active") {
    return { sent: false, error: null as string | null }
  }
  if (String(input.nextService.service_status ?? "").trim().toLowerCase() !== "active") {
    return { sent: false, error: null as string | null }
  }

  const mailResult = await sendFinancialAnalysisActivatedEmail({
    caseId: input.caseId,
    siteOrigin: input.siteOrigin,
    service: input.nextService,
  })

  if (!mailResult.ok) {
    return { sent: false, error: mailResult.error }
  }

  return { sent: true, error: null as string | null }
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const actionRaw = String(body?.action ?? "").trim().toLowerCase()

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }
  if (!isSupportedAction(actionRaw)) {
    return NextResponse.json({ ok: false, error: "ungueltige_aktion" }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const caseRow = await loadCaseForAction(admin, caseId)
    if (!caseRow?.id) {
      return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
    }
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
      return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
    }
    if (role === "advisor" && trimOrNull(caseRow.assigned_advisor_id) !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const existingService = await loadLatestFinancialAnalysisService(admin, caseId)
    const siteOrigin = resolveSiteOrigin(req)

    if (actionRaw === "create_offer") {
      const offerSummary = trimOrNull(body?.offerSummary) ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY
      const savedService = await upsertFinancialAnalysisOffer({
        admin,
        existingService,
        caseId,
        userId: user.id,
        assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
        offerSummary,
      })

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: existingService?.id && !isFinancialAnalysisTerminalStatus(existingService.service_status)
          ? "financial_analysis_offer_updated"
          : "financial_analysis_offer_created",
        title: existingService?.id && !isFinancialAnalysisTerminalStatus(existingService.service_status)
          ? "Finanzanalyse-Angebot aktualisiert"
          : "Finanzanalyse-Angebot angelegt",
        body: "Der gesonderte Zusatzservice Finanzanalyse wurde fuer diesen Fall vorbereitet.",
        meta: {
          service_id: savedService?.id ?? null,
        },
        notifyCustomer: false,
        notifyAdvisor: false,
      })

      return NextResponse.json({ ok: true, service: savedService })
    }

    if (!existingService?.id) {
      return NextResponse.json({ ok: false, error: "financial_analysis_missing" }, { status: 409 })
    }

    if (actionRaw === "send_offer_email") {
      if (isFinancialAnalysisTerminalStatus(existingService.service_status)) {
        return NextResponse.json({ ok: false, error: "financial_analysis_not_available" }, { status: 409 })
      }

      const serviceForEmail = await upsertFinancialAnalysisOffer({
        admin,
        existingService,
        caseId,
        userId: user.id,
        assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
        offerSummary: trimOrNull(body?.offerSummary) ?? existingService.offer_summary ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
      })

      const token = createFinancialAnalysisPublicToken({
        serviceId: serviceForEmail?.id ?? existingService.id,
        caseId,
      })
      const activationUrl = buildActivationUrl(siteOrigin, token)

      const mailResult = await sendFinancialAnalysisOfferEmail({
        caseId,
        activationUrl,
        service: serviceForEmail ?? existingService,
      })

      if (!mailResult.ok) {
        const error =
          mailResult.error === "customer_email_missing"
            ? "customer_email_missing"
            : mailResult.error === "missing_resend_env"
              ? "mail_not_configured"
              : mailResult.error
        return NextResponse.json({ ok: false, error }, { status: 502 })
      }

      const sentAt = new Date().toISOString()
      const result = await admin
        .from("case_financial_analysis_services")
        .update({
          offer_email_sent_at: sentAt,
          updated_at: sentAt,
        })
        .eq("id", serviceForEmail?.id ?? existingService.id)
        .select("*")
        .single()

      if (result.error) throw result.error

      const updatedService = normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: "financial_analysis_offer_sent",
        title: "Finanzanalyse-Angebot versendet",
        body: "Dem Kunden wurde die separate Aktivierungsmail zur Finanzanalyse gesendet.",
        meta: {
          service_id: existingService.id,
          latest_service_id: serviceForEmail?.id ?? existingService.id,
          sent_to: mailResult.to,
        },
        notifyCustomer: false,
        notifyAdvisor: false,
      })

      return NextResponse.json({
        ok: true,
        service: updatedService,
        sentTo: mailResult.to,
        activationUrl,
      })
    }

    if (actionRaw === "mark_payment_received") {
      const previousStatus = existingService.service_status
      const nowIso = new Date().toISOString()
      const patch = buildFinancialAnalysisServicePatch({
        row: existingService,
        nowIso,
        nextPaymentReceivedAt: nowIso,
      })

      const result = await admin
        .from("case_financial_analysis_services")
        .update(patch)
        .eq("id", existingService.id)
        .select("*")
        .single()

      if (result.error) throw result.error

      const nextService = normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
      const activationMail = await maybeSendActivationMail({
        previousStatus,
        nextService,
        caseId,
        siteOrigin,
      })

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: nextService?.service_status === "active" ? "financial_analysis_activated" : "financial_analysis_payment_received",
        title: nextService?.service_status === "active" ? "Finanzanalyse aktiviert" : "Zahlung fuer Finanzanalyse markiert",
        body:
          nextService?.service_status === "active"
            ? "Bestaetigung und Zahlungsmarkierung liegen vor. Der Finanzanalyse-Bereich ist jetzt freigeschaltet."
            : "Der Zahlungseingang fuer die Finanzanalyse wurde markiert.",
        meta: {
          service_id: existingService.id,
          activation_email_sent: activationMail.sent,
          activation_email_error: activationMail.error,
        },
        notifyCustomer: false,
        notifyAdvisor: false,
      })

      return NextResponse.json({
        ok: true,
        service: nextService,
        activationEmailSent: activationMail.sent,
      })
    }

    const currentStatus = String(existingService.service_status ?? "").trim().toLowerCase()
    if (currentStatus !== "active") {
      return NextResponse.json({ ok: false, error: "financial_analysis_not_active" }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const publishedHouseholdOverview = trimOrNull(body?.publishedHouseholdOverview)
    const publishedRecommendations = trimOrNull(body?.publishedRecommendations)
    const publishedActionPlan = trimOrNull(body?.publishedActionPlan)
    const publishedSchufaNotes = trimOrNull(body?.publishedSchufaNotes)

    if (!publishedHouseholdOverview && !publishedRecommendations && !publishedActionPlan && !publishedSchufaNotes) {
      return NextResponse.json({ ok: false, error: "financial_analysis_content_missing" }, { status: 400 })
    }

    const result = await admin
      .from("case_financial_analysis_services")
      .update({
        analysis_status: "published",
        published_household_overview: publishedHouseholdOverview,
        published_recommendations: publishedRecommendations,
        published_action_plan: publishedActionPlan,
        published_schufa_notes: publishedSchufaNotes,
        published_at: nowIso,
        published_by: user.id,
        updated_at: nowIso,
      })
      .eq("id", existingService.id)
      .select("*")
      .single()

    if (result.error) throw result.error

    const nextService = normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: "financial_analysis_published",
      title: "Finanzanalyse veroeffentlicht",
      body: "Die Auswertung wurde fuer den Kunden im Dashboard veroeffentlicht.",
      meta: {
        service_id: existingService.id,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, service: nextService })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_failed" },
      { status: 400 }
    )
  }
}
