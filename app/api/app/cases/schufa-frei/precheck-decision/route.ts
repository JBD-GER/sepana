import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent } from "@/lib/notifications/notify"
import { runSchufaFreePrecheckDecisionAutomation } from "@/lib/schufa-frei/precheckDecision"
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

  const siteOrigin = resolveSiteOrigin(req)
  let automation
  try {
    automation = await runSchufaFreePrecheckDecisionAutomation({
      admin,
      caseId,
      decision: decisionRaw,
      actorId: user.id,
      assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
      siteOrigin,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "precheck_decision_failed"
    const status = message === "customer_email_missing" ? 400 : message === "Fall-Metadaten nicht gefunden" ? 404 : 502
    return NextResponse.json({ ok: false, error: message }, { status })
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
      email_subject: automation.subject,
      insurance_route_source: automation.insuranceRoute ? String(automation.insuranceRoute.route_source ?? "") : null,
      financial_analysis_offer_sent: automation.financialAnalysisOffer?.sent ?? false,
      financial_analysis_offer_skipped: automation.financialAnalysisOffer?.skipped ?? false,
      financial_analysis_offer_error: automation.financialAnalysisOffer?.error ?? null,
      financial_analysis_service_id: automation.financialAnalysisOffer?.serviceId ?? null,
    },
    notifyAdvisor: false,
    notifyCustomer: false,
  })

  return NextResponse.json({
    ok: true,
    decision: decisionRaw,
    subject: automation.subject,
    sentTo: automation.sentTo,
    insuranceRoute: automation.insuranceRoute,
    financialAnalysisOffer: automation.financialAnalysisOffer,
  })
}
