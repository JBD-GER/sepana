import type { SupabaseClient } from "@supabase/supabase-js"
import { syncEuropaceDocumentStateForCase, syncEuropaceExportDocumentsForCase } from "@/lib/europace/documents"
import { exportEuropaceVorgang } from "@/lib/europace/export"
import type { EuropaceApplicationSummary, EuropaceExportResult } from "@/lib/europace/types"

type MinimalSupabase = Pick<SupabaseClient, "from" | "storage">

type RawEuropaceApplicationStatus =
  | string
  | {
      status?: string | null
      letzteAenderungAm?: string | null
      kommentar?: string | null
      hinweise?: string[] | null
    }
  | null
  | undefined

type RawEuropaceApplicationLike = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  antragstellerstatus?: RawEuropaceApplicationStatus
  produktanbieterstatus?: RawEuropaceApplicationStatus
  provisionsforderungsstatus?: RawEuropaceApplicationStatus
}

export type EuropaceApplicationStatusView = {
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  antragstellerstatus: string | null
  produktanbieterstatus: string | null
  provisionsforderungsstatus: string | null
  produktanbieterkommentar: string | null
  produktanbieterhinweise: string[]
}

export type EuropaceDocumentStateSummary = {
  remoteDocumentCount: number
  pageCount: number
  assignedPageCount: number
  releasedPageCount: number
}

export type EuropaceStatusMeta = {
  vorgangsnummer: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  sync_status: string | null
  last_sync_at: string | null
  letzte_aenderung_am: string | null
  letztes_ereignis_am: string | null
  last_error: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function extractStatusValue(
  value: RawEuropaceApplicationStatus
) {
  if (typeof value === "string") return trimOrNull(value)
  return trimOrNull(value?.status)
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.map((entry) => trimOrNull(entry)).filter(Boolean) as string[]
}

function firstApplication(snapshot: EuropaceExportResult | null | undefined) {
  const rows = sortEuropaceApplicationRows(Array.isArray(snapshot?.antraege) ? snapshot.antraege : [])
  return (rows[0] ?? null) as EuropaceApplicationSummary | null
}

function extractStatusChangedAt(value: RawEuropaceApplicationStatus) {
  if (!value || typeof value === "string") return 0
  const timestamp = trimOrNull(value.letzteAenderungAm)
  if (!timestamp) return 0
  const parsed = new Date(timestamp).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function extractApplicationChangedAt(row: RawEuropaceApplicationLike | null | undefined) {
  return Math.max(
    extractStatusChangedAt(row?.antragstellerstatus),
    extractStatusChangedAt(row?.produktanbieterstatus),
    extractStatusChangedAt(row?.provisionsforderungsstatus)
  )
}

function hasRejectedStatus(row: RawEuropaceApplicationLike | null | undefined) {
  return (
    isRejectedEuropaceStatus(extractStatusValue(row?.antragstellerstatus)) ||
    isRejectedEuropaceStatus(extractStatusValue(row?.produktanbieterstatus))
  )
}

function sortEuropaceApplicationRows<T extends RawEuropaceApplicationLike>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftRejected = hasRejectedStatus(left)
    const rightRejected = hasRejectedStatus(right)
    if (leftRejected !== rightRejected) {
      return leftRejected ? 1 : -1
    }

    const timestampDiff = extractApplicationChangedAt(right) - extractApplicationChangedAt(left)
    if (timestampDiff !== 0) return timestampDiff

    return 0
  })
}

function summarizeDocumentState(input: {
  documents?: Array<{ id?: string | null }> | null
  pages?: Array<{ assignment?: { category?: string | null; referenceId?: string | null } | null; shares?: unknown[] | null }> | null
}) {
  const documents = Array.isArray(input.documents) ? input.documents : []
  const pages = Array.isArray(input.pages) ? input.pages : []
  const assignedPageCount = pages.filter((page) => page.assignment?.category || page.assignment?.referenceId).length
  const releasedPageCount = pages.filter((page) => Array.isArray(page.shares) && page.shares.length > 0).length

  return {
    remoteDocumentCount: documents.length,
    pageCount: pages.length,
    assignedPageCount,
    releasedPageCount,
  }
}

async function logStatusSyncEvent(admin: MinimalSupabase, input: {
  caseId: string
  operation: string
  success: boolean
  requestPayload?: unknown
  responsePayload?: unknown
  errorMessage?: string | null
}) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: "inbound",
    operation: input.operation,
    request_payload: input.requestPayload ?? null,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

export function normalizeEuropaceApplications(
  snapshot:
    | EuropaceExportResult
    | {
        antraege?: Array<{
          antragsnummer?: string | null
          produktanbieterantragsnummer?: string | null
          antragstellerstatus?: string | { status?: string | null } | null
          produktanbieterstatus?:
            | string
            | {
                status?: string | null
                kommentar?: string | null
                hinweise?: string[] | null
              }
            | null
          provisionsforderungsstatus?: string | { status?: string | null } | null
        }> | null
      }
    | null
    | undefined
) {
  const rows = sortEuropaceApplicationRows(Array.isArray(snapshot?.antraege) ? snapshot.antraege : [])
  return rows.map((row) => ({
    antragsnummer: trimOrNull(row?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(row?.produktanbieterantragsnummer),
    antragstellerstatus: extractStatusValue(row?.antragstellerstatus),
    produktanbieterstatus: extractStatusValue(row?.produktanbieterstatus),
    provisionsforderungsstatus: extractStatusValue(row?.provisionsforderungsstatus),
    produktanbieterkommentar:
      typeof row?.produktanbieterstatus === "string" ? null : trimOrNull(row?.produktanbieterstatus?.kommentar),
    produktanbieterhinweise:
      typeof row?.produktanbieterstatus === "string" ? [] : stringArray(row?.produktanbieterstatus?.hinweise),
  }))
}

export function firstEuropaceApplication(snapshot: EuropaceExportResult | null | undefined) {
  return firstApplication(snapshot)
}

export type EuropaceApplicationReference = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
}

export function isRejectedEuropaceStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (!normalized) return false
  return (
    normalized === "ABGELEHNT" ||
    normalized === "AUTOMATISCH_ABGELEHNT" ||
    normalized === "REJECTED" ||
    normalized === "DECLINED" ||
    normalized.includes("ABGELEHNT") ||
    normalized.includes("DECLIN") ||
    normalized.includes("REJECT")
  )
}

export function isCompletedEuropaceStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (!normalized) return false
  return (
    normalized === "ABGESCHLOSSEN" ||
    normalized === "AUSGEZAHLT" ||
    normalized === "ERLEDIGT" ||
    normalized === "SIGNIERT" ||
    normalized.includes("ABGESCHLOSSEN") ||
    normalized.includes("AUSGEZAHLT") ||
    normalized.includes("ERLEDIGT") ||
    normalized.includes("SIGNIERT") ||
    normalized.includes("UNTERSCHRIEBEN")
  )
}

export function findRelevantEuropaceApplication(
  applications: EuropaceApplicationStatusView[],
  reference?: EuropaceApplicationReference | null
) {
  const firstNonRejected =
    applications.find(
      (application) =>
        !isRejectedEuropaceStatus(application.produktanbieterstatus) &&
        !isRejectedEuropaceStatus(application.antragstellerstatus)
    ) ?? null
  const hasReference =
    Boolean(trimOrNull(reference?.antragsnummer)) || Boolean(trimOrNull(reference?.produktanbieterantragsnummer))

  const normalizedAntragsnummer = trimOrNull(reference?.antragsnummer)
  if (normalizedAntragsnummer) {
    const byAntragsnummer =
      applications.find((application) => trimOrNull(application.antragsnummer) === normalizedAntragsnummer) ?? null
    if (byAntragsnummer) {
      if (
        !isRejectedEuropaceStatus(byAntragsnummer.produktanbieterstatus) &&
        !isRejectedEuropaceStatus(byAntragsnummer.antragstellerstatus)
      ) {
        return byAntragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byAntragsnummer
    }
  }

  const normalizedProduktanbieterantragsnummer = trimOrNull(reference?.produktanbieterantragsnummer)
  if (normalizedProduktanbieterantragsnummer) {
    const byProduktanbieterantragsnummer =
      applications.find(
        (application) =>
          trimOrNull(application.produktanbieterantragsnummer) === normalizedProduktanbieterantragsnummer
      ) ?? null
    if (byProduktanbieterantragsnummer) {
      if (
        !isRejectedEuropaceStatus(byProduktanbieterantragsnummer.produktanbieterstatus) &&
        !isRejectedEuropaceStatus(byProduktanbieterantragsnummer.antragstellerstatus)
      ) {
        return byProduktanbieterantragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byProduktanbieterantragsnummer
    }
  }

  if (hasReference) {
    return firstNonRejected ?? null
  }

  return firstNonRejected ?? applications[0] ?? null
}

export function findExactEuropaceApplication(
  applications: EuropaceApplicationStatusView[],
  reference?: EuropaceApplicationReference | null
) {
  const normalizedAntragsnummer = trimOrNull(reference?.antragsnummer)
  if (normalizedAntragsnummer) {
    const byAntragsnummer =
      applications.find((application) => trimOrNull(application.antragsnummer) === normalizedAntragsnummer) ?? null
    if (byAntragsnummer) return byAntragsnummer
  }

  const normalizedProduktanbieterantragsnummer = trimOrNull(reference?.produktanbieterantragsnummer)
  if (normalizedProduktanbieterantragsnummer) {
    const byProduktanbieterantragsnummer =
      applications.find(
        (application) =>
          trimOrNull(application.produktanbieterantragsnummer) === normalizedProduktanbieterantragsnummer
      ) ?? null
    if (byProduktanbieterantragsnummer) return byProduktanbieterantragsnummer
  }

  return null
}

export function findRejectedEuropaceApplication(
  applications: EuropaceApplicationStatusView[],
  reference?: EuropaceApplicationReference | null
) {
  const application = findRelevantEuropaceApplication(applications, reference)
  if (!application) return null
  if (
    !isRejectedEuropaceStatus(application.produktanbieterstatus) &&
    !isRejectedEuropaceStatus(application.antragstellerstatus)
  ) {
    return null
  }
  return application
}

export function looksLikeTechnicalEuropaceDecisionMessage(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return false

  return (
    normalized.includes("technisch") ||
    normalized.includes("technik") ||
    normalized.includes("produktreferenz") ||
    normalized.includes("angebot nicht gepr") ||
    normalized.includes("konnte nicht gepr") ||
    normalized.includes("support-team") ||
    normalized.includes("helpdesk") ||
    normalized.includes("known problem")
  )
}

export function buildEuropaceApplicationDecisionMessage(application: EuropaceApplicationStatusView | null | undefined) {
  if (!application) return null
  if (
    !isRejectedEuropaceStatus(application.produktanbieterstatus) &&
    !isRejectedEuropaceStatus(application.antragstellerstatus)
  ) {
    return null
  }

  const detailParts = [
    trimOrNull(application.produktanbieterkommentar),
    ...stringArray(application.produktanbieterhinweise),
  ]
  const details = detailParts.join(" ").trim()

  return detailParts.length
    ? looksLikeTechnicalEuropaceDecisionMessage(details)
      ? `Der Produktanbieter konnte das Angebot technisch nicht final pruefen. ${details}`
      : `Der Produktanbieter hat den Antrag abgelehnt. ${details}`
    : "Der Produktanbieter hat den Antrag im Rahmen interner Vergaberichtlinien abgelehnt."
}

export async function syncCaseEuropaceSnapshot(
  admin: MinimalSupabase,
  caseId: string,
  exportSnapshot: EuropaceExportResult
) {
  const now = new Date().toISOString()
  const application = firstApplication(exportSnapshot)

  const { error } = await admin
    .from("case_europace")
    .update({
      vorgangsnummer: trimOrNull(exportSnapshot.vorgangsnummer),
      kundenbetreuer_partner_id: trimOrNull(exportSnapshot.kundenbetreuer?.partnerId),
      bearbeiter_partner_id: trimOrNull(exportSnapshot.bearbeiter?.partnerId),
      antragsnummer: trimOrNull(application?.antragsnummer),
      produktanbieterantragsnummer: trimOrNull(application?.produktanbieterantragsnummer),
      letzte_aenderung_am: exportSnapshot.letzteAenderungAm ?? null,
      letztes_ereignis_am: exportSnapshot.letztesEreignisAm ?? null,
      last_export_snapshot: exportSnapshot,
      last_sync_at: now,
      last_error: null,
      sync_status: "synced",
      updated_at: now,
    })
    .eq("case_id", caseId)

  if (error) throw error
}

export async function refreshEuropaceStatusForCase(
  admin: MinimalSupabase,
  caseId: string,
  options?: { includeDocuments?: boolean }
) {
  const now = new Date().toISOString()
  const { data: mapping, error: mappingError } = await admin
    .from("case_europace")
    .select("vorgangsnummer,antragsnummer")
    .eq("case_id", caseId)
    .maybeSingle()

  if (mappingError) throw mappingError

  const vorgangsnummer = trimOrNull(mapping?.vorgangsnummer)
  if (!vorgangsnummer) {
    throw new Error("Kein Europace-Vorgang vorhanden. Bitte zuerst synchronisieren.")
  }

  try {
    const exportSnapshot = await exportEuropaceVorgang(vorgangsnummer)
    await syncCaseEuropaceSnapshot(admin, caseId, exportSnapshot)

    const applications = normalizeEuropaceApplications(exportSnapshot)
    const primaryApplication = applications[0] ?? null
    const antragsnummer = primaryApplication?.antragsnummer ?? trimOrNull(mapping?.antragsnummer)

    let exportDocumentsImported = 0
    let exportDocumentsFound = 0
    let exportDocumentsError: string | null = null

    try {
      const exportDocumentSync = await syncEuropaceExportDocumentsForCase(admin, {
        caseId,
        exportSnapshot,
      })
      exportDocumentsImported = exportDocumentSync.imported
      exportDocumentsFound = exportDocumentSync.found
      exportDocumentsError = exportDocumentSync.errors[0] ?? null
    } catch (error) {
      exportDocumentsError =
        error instanceof Error ? error.message : "Bankdokumente aus dem Europace-Export konnten nicht uebernommen werden."
    }

    let documentSummary: EuropaceDocumentStateSummary | null = null
    let documentsSynchronized = false
    let documentsError: string | null = null

    if (options?.includeDocuments && antragsnummer) {
      try {
        const documentState = await syncEuropaceDocumentStateForCase(admin, {
          caseId,
          vorgangsnummer,
          antragsnummer,
        })
        documentSummary = summarizeDocumentState(documentState)
        documentsSynchronized = true
      } catch (error) {
        documentsError = error instanceof Error ? error.message : "Europace-Dokumentstatus konnte nicht aktualisiert werden."
      }
    }

    const europace: EuropaceStatusMeta = {
      vorgangsnummer: trimOrNull(exportSnapshot.vorgangsnummer),
      antragsnummer,
      produktanbieterantragsnummer: primaryApplication?.produktanbieterantragsnummer ?? null,
      sync_status: "synced",
      last_sync_at: now,
      letzte_aenderung_am: exportSnapshot.letzteAenderungAm ?? null,
      letztes_ereignis_am: exportSnapshot.letztesEreignisAm ?? null,
      last_error: documentsError ?? exportDocumentsError,
    }

    await logStatusSyncEvent(admin, {
      caseId,
      operation: "exportVorgang.statusRefresh",
      success: true,
      requestPayload: {
        vorgangsnummer,
        includeDocuments: Boolean(options?.includeDocuments),
      },
      responsePayload: {
        exportSnapshot,
        applications,
        documentSummary,
        documentsSynchronized,
        documentsError,
        exportDocumentsFound,
        exportDocumentsImported,
        exportDocumentsError,
      },
    })

    return {
      europace,
      applications,
      exportSnapshot,
      documentSummary,
      documentsSynchronized,
      documentsError,
      exportDocumentsFound,
      exportDocumentsImported,
      exportDocumentsError,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Status konnte nicht aktualisiert werden."

    await admin
      .from("case_europace")
      .update({
        last_error: message,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await logStatusSyncEvent(admin, {
      caseId,
      operation: "exportVorgang.statusRefresh",
      success: false,
      requestPayload: {
        vorgangsnummer,
        includeDocuments: Boolean(options?.includeDocuments),
      },
      responsePayload: null,
      errorMessage: message,
    })

    throw error
  }
}
