import { NextResponse } from "next/server"
import { getAdvisorCaseStatusSet } from "@/lib/advisor/caseStatusOptions"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent } from "@/lib/notifications/notify"
import { runSchufaFreePrecheckDecisionAutomation } from "@/lib/schufa-frei/precheckDecision"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

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

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const rawStatus = String(body?.advisorStatus ?? "").trim().toLowerCase()
  const advisorStatus = rawStatus || null
  const nowIso = new Date().toISOString()

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,assigned_advisor_id,case_type,advisor_status")
    .eq("id", caseId)
    .maybeSingle()

  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }

  const allowedStatuses = getAdvisorCaseStatusSet(caseRow.case_type)
  if (advisorStatus && !allowedStatuses.has(advisorStatus)) {
    return NextResponse.json({ ok: false, error: "Ungültiger Status" }, { status: 400 })
  }

  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const previousAdvisorStatus = trimOrNull(caseRow.advisor_status)?.toLowerCase() ?? null
  const { error } = await admin
    .from("cases")
    .update({ advisor_status: advisorStatus, updated_at: nowIso })
    .eq("id", caseId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  const shouldTriggerRejectedAutomation =
    String(caseRow.case_type ?? "").trim().toLowerCase() === "schufa_frei" &&
    advisorStatus === "abgelehnt" &&
    previousAdvisorStatus !== "abgelehnt"

  let automation: Awaited<ReturnType<typeof runSchufaFreePrecheckDecisionAutomation>> | null = null
  let warning: string | null = null

  if (shouldTriggerRejectedAutomation) {
    try {
      automation = await runSchufaFreePrecheckDecisionAutomation({
        admin,
        caseId,
        decision: "rejected",
        actorId: user.id,
        assignedAdvisorId: trimOrNull(caseRow.assigned_advisor_id) ?? user.id,
        siteOrigin: resolveSiteOrigin(req),
      })

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: "schufa_free_precheck_rejected_sent",
        title: "Vorpruefung fehlgeschlagen versendet",
        body: "Die negative Rueckmeldung zur Vorpruefung wurde ueber den Bearbeitungsstatus an den Kunden versendet.",
        meta: {
          status_change_triggered: true,
          previous_advisor_status: previousAdvisorStatus,
          next_advisor_status: advisorStatus,
          email_subject: automation.subject,
          insurance_route_source: automation.insuranceRoute ? String(automation.insuranceRoute.route_source ?? "") : null,
          financial_analysis_offer_sent: automation.financialAnalysisOffer?.sent ?? false,
          financial_analysis_offer_skipped: automation.financialAnalysisOffer?.skipped ?? false,
          financial_analysis_offer_error: automation.financialAnalysisOffer?.error ?? null,
          financial_analysis_service_id: automation.financialAnalysisOffer?.serviceId ?? null,
        },
        notifyAdvisor: false,
        notifyCustomer: false,
      }).catch(() => null)

      if (automation.financialAnalysisOffer?.error) {
        warning = `Status gespeichert. Vorpruefung und Versicherungsrouting liefen, aber die Finanzanalyse-Mail konnte nicht automatisch versendet werden: ${automation.financialAnalysisOffer.error}`
      }
    } catch (automationError) {
      const message = automationError instanceof Error ? automationError.message : "rejection_automation_failed"
      warning = `Status gespeichert, aber die Ablehnungs-Automatik ist fehlgeschlagen: ${message}`

      await logCaseEvent({
        caseId,
        actorId: user.id,
        actorRole: role,
        type: "schufa_free_precheck_rejected_automation_failed",
        title: "Ablehnungs-Automatik fehlgeschlagen",
        body: "Der Bearbeitungsstatus wurde auf abgelehnt gesetzt, aber die automatische Folgeaktion konnte nicht komplett ausgefuehrt werden.",
        meta: {
          previous_advisor_status: previousAdvisorStatus,
          next_advisor_status: advisorStatus,
          error: message,
        },
        notifyAdvisor: false,
        notifyCustomer: false,
      }).catch(() => null)
    }
  }

  return NextResponse.json({
    ok: true,
    advisor_status: advisorStatus,
    automation,
    warning,
  })
}
