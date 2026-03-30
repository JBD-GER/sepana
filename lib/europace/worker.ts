import type { SupabaseClient } from "@supabase/supabase-js"
import { pollEuropaceOfferAcceptanceJob } from "@/lib/europace/offerSync"
import { refreshEuropaceStatusForCase } from "@/lib/europace/status"

type MinimalSupabase = Pick<SupabaseClient, "from" | "storage">

type EuropaceWorkerRow = {
  case_id: string
  vorgangsnummer: string | null
  antragsnummer: string | null
  annahme_job_id: string | null
  last_sync_at: string | null
  last_error: string | null
}

export type EuropaceStatusSweepOptions = {
  limit?: number
  staleMinutes?: number
  documentStaleMinutes?: number
  includeDocuments?: boolean
}

export type EuropaceStatusSweepCaseResult = {
  caseId: string
  mode: "job" | "status"
  status: "processed" | "skipped" | "failed"
  message: string | null
  annahmeJobId: string | null
  antragsnummer: string | null
  documentsIncluded: boolean
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseDate(value: string | null | undefined) {
  const ts = value ? new Date(value).getTime() : NaN
  return Number.isFinite(ts) ? ts : null
}

function minutesSince(value: string | null | undefined, now: number) {
  const ts = parseDate(value)
  if (ts === null) return Number.POSITIVE_INFINITY
  return Math.max(0, (now - ts) / 60000)
}

function shouldRefreshStatus(row: EuropaceWorkerRow, now: number, staleMinutes: number) {
  if (trimOrNull(row.annahme_job_id)) return true
  if (!trimOrNull(row.vorgangsnummer)) return false
  if (trimOrNull(row.last_error)) return true
  return minutesSince(row.last_sync_at, now) >= staleMinutes
}

function shouldIncludeDocuments(row: EuropaceWorkerRow, now: number, documentStaleMinutes: number, includeDocuments: boolean) {
  if (!includeDocuments) return false
  if (!trimOrNull(row.antragsnummer)) return false
  return minutesSince(row.last_sync_at, now) >= documentStaleMinutes
}

export async function runEuropaceStatusSweep(admin: MinimalSupabase, options?: EuropaceStatusSweepOptions) {
  const limit = Math.max(1, Math.min(100, Number(options?.limit ?? 25) || 25))
  const staleMinutes = Math.max(1, Number(options?.staleMinutes ?? 30) || 30)
  const documentStaleMinutes = Math.max(staleMinutes, Number(options?.documentStaleMinutes ?? 180) || 180)
  const includeDocuments = options?.includeDocuments !== false
  const now = Date.now()

  const { data: mappings, error: mappingsError } = await admin
    .from("case_europace")
    .select("case_id,vorgangsnummer,antragsnummer,annahme_job_id,last_sync_at,last_error")
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(300)

  if (mappingsError) throw mappingsError

  const rawRows = (mappings ?? []) as EuropaceWorkerRow[]
  if (!rawRows.length) {
    return {
      ok: true as const,
      scanned: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      results: [] as EuropaceStatusSweepCaseResult[],
    }
  }

  const caseIds = rawRows.map((row) => row.case_id)
  const { data: cases, error: casesError } = await admin.from("cases").select("id,case_type").in("id", caseIds)
  if (casesError) throw casesError

  const konsumCaseIds = new Set(
    (cases ?? [])
      .filter((row) => String((row as { case_type?: unknown }).case_type ?? "").trim().toLowerCase() === "konsum")
      .map((row) => String((row as { id: unknown }).id))
  )

  const candidates = rawRows
    .filter((row) => konsumCaseIds.has(row.case_id))
    .filter((row) => shouldRefreshStatus(row, now, staleMinutes))
    .sort((left, right) => {
      const leftJob = trimOrNull(left.annahme_job_id) ? 0 : 1
      const rightJob = trimOrNull(right.annahme_job_id) ? 0 : 1
      if (leftJob !== rightJob) return leftJob - rightJob
      return minutesSince(right.last_sync_at, now) - minutesSince(left.last_sync_at, now)
    })
    .slice(0, limit)

  const results: EuropaceStatusSweepCaseResult[] = []

  for (const row of candidates) {
    const annahmeJobId = trimOrNull(row.annahme_job_id)
    const documentsIncluded = shouldIncludeDocuments(row, now, documentStaleMinutes, includeDocuments)

    try {
      if (annahmeJobId) {
        const job = await pollEuropaceOfferAcceptanceJob(admin, row.case_id)
        results.push({
          caseId: row.case_id,
          mode: "job",
          status: "processed",
          message: trimOrNull(job.status) ?? "Job gepollt.",
          annahmeJobId: trimOrNull(job.jobId),
          antragsnummer: trimOrNull(job.antragsnummer),
          documentsIncluded: false,
        })
        continue
      }

      const refreshed = await refreshEuropaceStatusForCase(admin, row.case_id, {
        includeDocuments: documentsIncluded,
      })

      results.push({
        caseId: row.case_id,
        mode: "status",
        status: "processed",
        message: refreshed.documentsError ? `Status aktualisiert; Dokumente: ${refreshed.documentsError}` : "Status aktualisiert.",
        annahmeJobId: null,
        antragsnummer: trimOrNull(refreshed.europace.antragsnummer),
        documentsIncluded,
      })
    } catch (error) {
      results.push({
        caseId: row.case_id,
        mode: annahmeJobId ? "job" : "status",
        status: "failed",
        message: error instanceof Error ? error.message : "Europace-Worker fehlgeschlagen.",
        annahmeJobId,
        antragsnummer: trimOrNull(row.antragsnummer),
        documentsIncluded,
      })
    }
  }

  return {
    ok: true as const,
    scanned: rawRows.filter((row) => konsumCaseIds.has(row.case_id)).length,
    processed: results.filter((row) => row.status === "processed").length,
    failed: results.filter((row) => row.status === "failed").length,
    skipped: Math.max(0, rawRows.filter((row) => konsumCaseIds.has(row.case_id)).length - candidates.length),
    results,
  }
}
