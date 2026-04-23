import { NextResponse } from "next/server"
import { logCaseEvent } from "@/lib/notifications/notify"
import { isMissingFinancialAnalysisTablesError, trimOrNull } from "@/lib/financial-analysis/service"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function getConfiguredSecret() {
  return trimOrNull(process.env.CRON_SECRET) ?? trimOrNull(process.env.SYSTEM_CRON_SECRET)
}

function isAuthorized(req: Request) {
  const secret = getConfiguredSecret()
  if (!secret) return { ok: false as const, reason: "missing_secret" as const }

  const auth = trimOrNull(req.headers.get("authorization"))
  const cronHeader = trimOrNull(req.headers.get("x-cron-secret"))
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null
  const provided = bearer ?? cronHeader
  if (!provided || provided !== secret) {
    return { ok: false as const, reason: "unauthorized" as const }
  }

  return { ok: true as const }
}

async function handle(req: Request) {
  const auth = isAuthorized(req)
  if (!auth.ok) {
    if (auth.reason === "missing_secret") {
      return NextResponse.json(
        { ok: false, error: "CRON_SECRET oder SYSTEM_CRON_SECRET ist nicht gesetzt." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const body = req.method === "POST" ? await req.json().catch(() => null) : null
  const limit = parsePositiveInt(body?.limit ?? url.searchParams.get("limit"), 50)
  const nowIso = new Date().toISOString()

  const admin = supabaseAdmin()

  try {
    const result = await admin
      .from("case_financial_analysis_services")
      .select("id,case_id,service_status,access_expires_at")
      .eq("service_status", "active")
      .lte("access_expires_at", nowIso)
      .order("access_expires_at", { ascending: true })
      .limit(limit)

    if (result.error) throw result.error

    const rows = (result.data ?? []) as Array<{
      id?: string | null
      case_id?: string | null
      service_status?: string | null
      access_expires_at?: string | null
    }>

    let expiredCount = 0
    for (const row of rows) {
      const serviceId = trimOrNull(row.id)
      const caseId = trimOrNull(row.case_id)
      if (!serviceId || !caseId) continue

      const updateResult = await admin
        .from("case_financial_analysis_services")
        .update({
          service_status: "expired",
          expired_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", serviceId)
        .eq("service_status", "active")
        .select("id")
        .maybeSingle()

      if (updateResult.error) throw updateResult.error
      if (!updateResult.data) continue

      expiredCount += 1

      await logCaseEvent({
        caseId,
        actorId: null,
        actorRole: "system",
        type: "financial_analysis_expired",
        title: "Finanzanalyse-Zugang abgelaufen",
        body: "Die 90-Tage-Laufzeit ist abgelaufen. Es kann jetzt bei Bedarf ein neuer Zyklus gestartet werden.",
        meta: {
          service_id: serviceId,
        },
        notifyCustomer: false,
        notifyAdvisor: true,
      })
    }

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      expired: expiredCount,
      limit,
      finishedAt: nowIso,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_sweep_failed" },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
