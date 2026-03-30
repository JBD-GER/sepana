import { NextResponse } from "next/server"
import { runEuropaceStatusSweep } from "@/lib/europace/worker"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
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
  const staleMinutes = parsePositiveInt(body?.staleMinutes ?? url.searchParams.get("staleMinutes"), 30)
  const documentStaleMinutes = parsePositiveInt(
    body?.documentStaleMinutes ?? url.searchParams.get("documentStaleMinutes"),
    180
  )
  const includeDocuments = parseBoolean(body?.includeDocuments ?? url.searchParams.get("includeDocuments"), true)

  const admin = supabaseAdmin()
  const result = await runEuropaceStatusSweep(admin, {
    limit,
    staleMinutes,
    documentStaleMinutes,
    includeDocuments,
  })

  return NextResponse.json({
    startedAt: new Date().toISOString(),
    config: {
      limit,
      staleMinutes,
      documentStaleMinutes,
      includeDocuments,
    },
    ...result,
  })
}

export async function GET(req: Request) {
  try {
    return await handle(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Worker fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    return await handle(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Worker fehlgeschlagen."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
