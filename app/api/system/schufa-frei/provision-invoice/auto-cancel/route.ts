import { NextResponse } from "next/server"
import { cancelSchufaFreeProvisionInvoice } from "@/lib/schufa-frei/cancelProvisionInvoice"
import { SCHUFA_FREE_PROVISION_INVOICE_TYPE, trimOrNull } from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type CandidateInvoiceRow = {
  id: string
  case_id: string
  invoice_number?: string | null
  sent_at?: string | null
  created_at?: string | null
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function parseBoolean(value: unknown, fallback: boolean) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return fallback
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true
  if (["0", "false", "no", "n", "off"].includes(raw)) return false
  return fallback
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

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  return new URL(req.url).origin
}

function getReferenceTimestamp(row: CandidateInvoiceRow) {
  const raw = trimOrNull(row.sent_at) ?? trimOrNull(row.created_at)
  if (!raw) return null
  const value = Date.parse(raw)
  return Number.isFinite(value) ? value : null
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
  const limit = parsePositiveInt(body?.limit ?? url.searchParams.get("limit"), 25)
  const ageDays = parsePositiveInt(body?.ageDays ?? url.searchParams.get("ageDays"), 14)
  const dryRun = parseBoolean(body?.dryRun ?? url.searchParams.get("dryRun"), false)

  const cutoffMs = Date.now() - ageDays * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()
  const queryLimit = Math.min(Math.max(limit * 5, 100), 1000)

  const admin = supabaseAdmin()
  const { data: invoiceRowsRaw, error: invoiceError } = await admin
    .from("case_invoices")
    .select("id,case_id,invoice_number,sent_at,created_at")
    .eq("case_type", "schufa_frei")
    .eq("invoice_type", SCHUFA_FREE_PROVISION_INVOICE_TYPE)
    .eq("status", "sent")
    .lte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(queryLimit)

  if (invoiceError) {
    return NextResponse.json({ ok: false, error: invoiceError.message }, { status: 400 })
  }

  const invoiceRows = (invoiceRowsRaw ?? []) as CandidateInvoiceRow[]
  const candidates = invoiceRows
    .filter((row) => {
      const referenceTs = getReferenceTimestamp(row)
      return referenceTs !== null && referenceTs <= cutoffMs
    })
    .slice(0, limit)

  const startedAt = new Date().toISOString()
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      startedAt,
      config: { limit, ageDays, dryRun },
      matchedCount: candidates.length,
      invoices: candidates.map((row) => ({
        invoiceId: row.id,
        caseId: row.case_id,
        invoiceNumber: row.invoice_number ?? null,
        referenceAt: trimOrNull(row.sent_at) ?? trimOrNull(row.created_at) ?? null,
      })),
    })
  }

  const siteOrigin = resolveSiteOrigin(req)
  const results: Array<Record<string, string | boolean | null>> = []
  let cancelledCount = 0
  let alreadyCancelledCount = 0
  let failedCount = 0

  for (const candidate of candidates) {
    const result = await cancelSchufaFreeProvisionInvoice({
      admin,
      caseId: candidate.case_id,
      actorId: null,
      actorRole: "system",
      siteOrigin,
      automatic: true,
      automaticReason: `nach ${ageDays} Tagen ohne Zahlung`,
    })

    if (!result.ok) {
      failedCount += 1
      results.push({
        invoiceId: candidate.id,
        caseId: candidate.case_id,
        invoiceNumber: candidate.invoice_number ?? null,
        status: "error",
        error: result.error,
      })
      continue
    }

    if (result.alreadyCancelled) {
      alreadyCancelledCount += 1
      results.push({
        invoiceId: candidate.id,
        caseId: candidate.case_id,
        invoiceNumber: candidate.invoice_number ?? null,
        status: "already_cancelled",
        emailSent: result.emailSent,
      })
      continue
    }

    cancelledCount += 1
    results.push({
      invoiceId: candidate.id,
      caseId: candidate.case_id,
      invoiceNumber: candidate.invoice_number ?? null,
      cancellationInvoiceId: result.cancellationInvoice.id,
      status: "cancelled",
      emailSent: result.emailSent,
    })
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    config: { limit, ageDays, dryRun },
    matchedCount: candidates.length,
    cancelledCount,
    alreadyCancelledCount,
    failedCount,
    results,
  })
}

export async function GET(req: Request) {
  try {
    return await handle(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-Storno fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    return await handle(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto-Storno fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
