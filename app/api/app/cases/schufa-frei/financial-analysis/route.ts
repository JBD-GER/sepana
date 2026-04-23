import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { loadLatestFinancialAnalysisService } from "@/lib/financial-analysis/data"
import {
  isMissingCaseInvoicesTableError,
  loadLatestFinancialAnalysisInvoice,
} from "@/lib/financial-analysis/invoice"
import { sendFinancialAnalysisActivatedEmail } from "@/lib/financial-analysis/email"
import { sendFinancialAnalysisOfferForCase, upsertFinancialAnalysisOffer } from "@/lib/financial-analysis/offer"
import {
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  buildFinancialAnalysisServicePatch,
  isFinancialAnalysisTerminalStatus,
  isMissingFinancialAnalysisTablesError,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
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
        type:
          existingService?.id && !isFinancialAnalysisTerminalStatus(existingService.service_status)
            ? "financial_analysis_offer_updated"
            : "financial_analysis_offer_created",
        title:
          existingService?.id && !isFinancialAnalysisTerminalStatus(existingService.service_status)
            ? "Finanzanalyse-Angebot aktualisiert"
            : "Finanzanalyse-Angebot angelegt",
        body: "Der gesonderte Zusatzservice Finanzanalyse wurde für diesen Fall vorbereitet.",
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

      const offerResult = await sendFinancialAnalysisOfferForCase({
        admin,
        existingService,
        caseId,
        userId: user.id,
        assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
        offerSummary: trimOrNull(body?.offerSummary) ?? existingService.offer_summary ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
        siteOrigin,
      })

      if (!offerResult.ok) {
        const error =
          offerResult.error === "customer_email_missing"
            ? "customer_email_missing"
            : offerResult.error === "missing_resend_env"
              ? "mail_not_configured"
              : offerResult.error
        return NextResponse.json({ ok: false, error }, { status: 502 })
      }

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: "financial_analysis_offer_sent",
        title: "Finanzanalyse-Angebot versendet",
        body: "Dem Kunden wurde die separate Aktivierungsmail zur Finanzanalyse gesendet.",
        meta: {
          service_id: existingService.id,
          latest_service_id: offerResult.service?.id ?? existingService.id,
          sent_to: offerResult.sentTo,
        },
        notifyCustomer: false,
        notifyAdvisor: false,
      })

      return NextResponse.json({
        ok: true,
        service: offerResult.service,
        sentTo: offerResult.sentTo,
        activationUrl: offerResult.activationUrl,
      })
    }

    if (actionRaw === "mark_payment_received") {
      if (!trimOrNull(existingService.customer_confirmed_at)) {
        return NextResponse.json({ ok: false, error: "financial_analysis_customer_confirmation_missing" }, { status: 409 })
      }

      const relatedInvoice = await loadLatestFinancialAnalysisInvoice(admin, caseId, existingService.created_at ?? null)
      if (!relatedInvoice?.id) {
        return NextResponse.json({ ok: false, error: "financial_analysis_invoice_missing" }, { status: 409 })
      }

      const invoiceStatus = String(relatedInvoice.status ?? "").trim().toLowerCase()
      if (invoiceStatus === "cancelled" || invoiceStatus === "refunded") {
        return NextResponse.json({ ok: false, error: "financial_analysis_invoice_not_payable" }, { status: 409 })
      }

      const previousStatus = existingService.service_status
      const nowIso = new Date().toISOString()

      const invoiceUpdateResult = await admin
        .from("case_invoices")
        .update({
          status: "paid",
          paid_at: nowIso,
          refunded_at: null,
          updated_at: nowIso,
        })
        .eq("id", relatedInvoice.id)
        .select("*")
        .single()

      if (invoiceUpdateResult.error) throw invoiceUpdateResult.error

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
        title: nextService?.service_status === "active" ? "Finanzanalyse aktiviert" : "Zahlung für Finanzanalyse markiert",
        body:
          nextService?.service_status === "active"
            ? "Bestätigung und Zahlungsmarkierung liegen vor. Der Finanzanalyse-Bereich ist jetzt freigeschaltet."
            : "Der Zahlungseingang für die Finanzanalyse wurde markiert.",
        meta: {
          service_id: existingService.id,
          invoice_id: relatedInvoice.id,
          activation_email_sent: activationMail.sent,
          activation_email_error: activationMail.error,
        },
        notifyCustomer: false,
        notifyAdvisor: false,
      })

      return NextResponse.json({
        ok: true,
        service: nextService,
        invoice: invoiceUpdateResult.data ?? null,
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
      title: "Finanzanalyse veröffentlicht",
      body: "Die Auswertung wurde für den Kunden im Dashboard veröffentlicht.",
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
    if (isMissingCaseInvoicesTableError(error)) {
      return NextResponse.json({ ok: false, error: "case_invoices_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_failed" },
      { status: 400 }
    )
  }
}
