import { NextResponse } from "next/server"
import { loadFinancialAnalysisPublicContext } from "@/lib/financial-analysis/data"
import { sendFinancialAnalysisActivatedEmail } from "@/lib/financial-analysis/email"
import {
  FINANCIAL_ANALYSIS_TERMS_VERSION,
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

export async function GET(req: Request) {
  const token = trimOrNull(new URL(req.url).searchParams.get("token"))
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing" }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const access = await loadFinancialAnalysisPublicContext(admin, token)
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
    }

    return NextResponse.json({
      ok: true,
      service: access.service,
      case: access.caseRow,
      applicantName: access.applicantName,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_public_failed" },
      { status: 400 }
    )
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = trimOrNull(body?.token)
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing" }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const access = await loadFinancialAnalysisPublicContext(admin, token)
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
    }

    if (isFinancialAnalysisTerminalStatus(access.service.service_status)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_not_available" }, { status: 409 })
    }

    const previousStatus = access.service.service_status
    const nowIso = new Date().toISOString()
    const patch = buildFinancialAnalysisServicePatch({
      row: access.service,
      nowIso,
      nextCustomerConfirmedAt: access.service.customer_confirmed_at ?? nowIso,
    })

    const result = await admin
      .from("case_financial_analysis_services")
      .update({
        ...patch,
        customer_confirmed_terms_version: FINANCIAL_ANALYSIS_TERMS_VERSION,
      })
      .eq("id", access.service.id)
      .select("*")
      .single()

    if (result.error) throw result.error

    const nextService = normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
    const siteOrigin = resolveSiteOrigin(req)
    let activationMailSent = false
    if (String(previousStatus ?? "").trim().toLowerCase() !== "active" && nextService?.service_status === "active") {
      const mailResult = await sendFinancialAnalysisActivatedEmail({
        caseId: access.caseRow.id,
        siteOrigin,
        service: nextService,
      })
      activationMailSent = mailResult.ok
    }

    await logCaseEvent({
      caseId: access.caseRow.id,
      actorId: null,
      actorRole: "public",
      type: nextService?.service_status === "active" ? "financial_analysis_activated" : "financial_analysis_customer_confirmed",
      title: nextService?.service_status === "active" ? "Finanzanalyse aktiviert" : "Finanzanalyse vom Kunden bestaetigt",
      body:
        nextService?.service_status === "active"
          ? "Die Bestaetigung liegt vor und die Finanzanalyse ist jetzt freigeschaltet."
          : "Der Kunde hat den Zusatzservice Finanzanalyse aktiv bestaetigt.",
      meta: {
        service_id: access.service.id,
        activation_email_sent: activationMailSent,
      },
      notifyCustomer: false,
      notifyAdvisor: true,
    })

    return NextResponse.json({
      ok: true,
      service: nextService,
      activationEmailSent: activationMailSent,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_confirm_failed" },
      { status: 400 }
    )
  }
}
