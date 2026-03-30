import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getEuropaceAccessToken } from "@/lib/europace/auth"
import { getEuropaceConfig } from "@/lib/europace/config"
import { getBankApplicationDocuments } from "@/lib/europace/flow"
import type { EuropaceExportResult } from "@/lib/europace/types"

type MinimalSupabase = Pick<SupabaseClient, "from" | "storage">

export type EuropaceRemoteDocument = {
  id: string
  key: string | null
  displayName: string | null
  fileName: string | null
  createdAt: string | null
  mimeType: string | null
  sizeBytes: number | null
  caseId: string | null
  encrypted: boolean
  categorizationStatus: string | null
  selfUrl: string | null
  previewUrl: string | null
  downloadUrl: string | null
  publicDownloadUrl: string | null
}

export type EuropaceAvailableAssignmentReference = {
  id: string | null
  type: string | null
  name: string | null
  roleType: string | null
  roleName: string | null
}

export type EuropaceAvailableAssignment = {
  categoryId: string
  categoryName: string | null
  categoryDescription: string | null
  references: EuropaceAvailableAssignmentReference[]
}

export type EuropaceUploadTarget = {
  key: string
  title: string
  categoryId: string
  categoryName: string | null
  categoryDescription: string | null
  assignmentId: string | null
  assignmentType: string | null
  assignmentName: string | null
  assignmentRoleName: string | null
}

export type EuropacePageAssignment = {
  category: string | null
  referenceId: string | null
  status: string | null
}

export type EuropacePageShare = {
  applicationNo: string | null
  sharedAt: string | null
  retrievalStatus: string | null
  retrievalMessage: string | null
  category: string | null
  referenceId: string | null
}

export type EuropaceCasePage = {
  documentId: string
  pageNumber: number
  archived: boolean
  checkedAt: string | null
  categories: string[]
  neededProofIds: string[]
  assignment: EuropacePageAssignment | null
  shares: EuropacePageShare[]
}

export type EuropaceReleasedDocument = {
  id: string
  applicationNo: string | null
  displayName: string | null
  fileName: string | null
  sizeBytes: number | null
  sharedAt: string | null
  mediaType: string | null
  category: string | null
  assignmentId: string | null
  retrievalStatus: string | null
  retrievalMessage: string | null
}

export type EuropaceLocalDocumentSyncResult = {
  attempted: boolean
  ok: boolean
  reason: string | null
  europaceDocumentId: string | null
}

export type EuropaceExportDocumentSyncResult = {
  found: number
  imported: number
  existing: number
  failed: number
  errors: string[]
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
}

function getApplicantReferenceKey(reference: EuropaceAvailableAssignmentReference) {
  return (
    trimOrNull(reference.id) ??
    trimOrNull([normalizeSearchText(reference.roleName), normalizeSearchText(reference.name)].filter(Boolean).join("::"))
  )
}

function isApplicantReference(reference: EuropaceAvailableAssignmentReference) {
  const haystack = [
    normalizeSearchText(reference.type),
    normalizeSearchText(reference.roleType),
    normalizeSearchText(reference.roleName),
    normalizeSearchText(reference.name),
  ]
    .filter(Boolean)
    .join(" ")

  return (
    haystack.includes("antragsteller") ||
    haystack.includes("kreditnehmer") ||
    haystack.includes("darlehensnehmer")
  )
}

function extractApplicantSlot(reference: EuropaceAvailableAssignmentReference) {
  for (const source of [reference.roleName, reference.name]) {
    const normalized = normalizeSearchText(source)
    const match = normalized.match(/(?:antragsteller|kreditnehmer|darlehensnehmer)\s*([0-9]+)/)
    if (!match) continue
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function buildApplicantRoleLabelMap(assignments: EuropaceAvailableAssignment[]) {
  const roleLabelMap = new Map<string, string>()
  const reservedSlots = new Set<number>()
  const unresolvedKeys: string[] = []

  for (const assignment of assignments) {
    for (const reference of assignment.references) {
      if (!isApplicantReference(reference)) continue
      const referenceKey = getApplicantReferenceKey(reference)
      if (!referenceKey || roleLabelMap.has(referenceKey)) continue

      const explicitSlot = extractApplicantSlot(reference)
      if (explicitSlot) {
        roleLabelMap.set(referenceKey, `Kreditnehmer ${explicitSlot}`)
        reservedSlots.add(explicitSlot)
        continue
      }

      unresolvedKeys.push(referenceKey)
    }
  }

  let nextSlot = 1
  for (const referenceKey of unresolvedKeys) {
    if (roleLabelMap.has(referenceKey)) continue
    while (reservedSlots.has(nextSlot)) nextSlot += 1
    roleLabelMap.set(referenceKey, `Kreditnehmer ${nextSlot}`)
    reservedSlots.add(nextSlot)
    nextSlot += 1
  }

  return roleLabelMap
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildUnterlagenUrl(path: string, query?: Record<string, string | null | undefined>) {
  const config = getEuropaceConfig()
  const url = new URL(path, config.unterlagenApiUrl)
  for (const [key, value] of Object.entries(query ?? {})) {
    const trimmed = trimOrNull(value)
    if (!trimmed) continue
    url.searchParams.set(key, trimmed)
  }
  return url
}

function safeEuropaceBankFileName(name: string | null | undefined, fallbackKey: string) {
  const raw = String(name ?? "").trim()
  const normalized = raw.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_").slice(0, 160)
  if (normalized) return normalized
  return `bankdokument-${fallbackKey}.pdf`
}

function inferMimeTypeFromFileName(name: string | null | undefined) {
  const fileName = String(name ?? "").trim().toLowerCase()
  if (fileName.endsWith(".pdf")) return "application/pdf"
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg"
  if (fileName.endsWith(".png")) return "image/png"
  if (fileName.endsWith(".tif") || fileName.endsWith(".tiff")) return "image/tiff"
  if (fileName.endsWith(".doc")) return "application/msword"
  if (fileName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return "application/octet-stream"
}

const EUROPACE_DIRECT_UPLOAD_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "tif", "tiff"])
const EUROPACE_DIRECT_UPLOAD_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/tiff"])

function fileExtension(name: string | null | undefined) {
  const fileName = String(name ?? "").trim().toLowerCase()
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex < 0) return ""
  return fileName.slice(dotIndex + 1)
}

function isEuropaceDirectUploadSupported(fileName: string | null | undefined, mimeType: string | null | undefined) {
  const normalizedMimeType = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMimeType && EUROPACE_DIRECT_UPLOAD_MIME_TYPES.has(normalizedMimeType)) {
    return true
  }
  return EUROPACE_DIRECT_UPLOAD_EXTENSIONS.has(fileExtension(fileName))
}

function safeEuropaceUploadFileName(name: string | null | undefined, fallbackKey: string) {
  const raw = String(name ?? "").trim()
  const ext = fileExtension(raw)
  const baseName = raw.replace(/\.[^.]+$/, "")
  const normalizedBase = baseName.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_").slice(0, 140)
  const normalizedExt = ext.replace(/[^\w]+/g, "").slice(0, 10)
  if (normalizedBase && normalizedExt) {
    return `${normalizedBase}.${normalizedExt}`
  }
  if (normalizedBase) {
    return normalizedBase
  }
  return `dokument-${fallbackKey}.${normalizedExt || "pdf"}`
}

function normalizeEuropaceRemoteDocument(input: unknown): EuropaceRemoteDocument | null {
  const row = (input ?? null) as
    | {
        id?: unknown
        schluessel?: unknown
        anzeigename?: unknown
        displayName?: unknown
        filename?: unknown
        erstellungsdatum?: unknown
        createdAt?: unknown
        type?: unknown
        mimeType?: unknown
        size?: unknown
        vorgangsNummer?: unknown
        caseId?: unknown
        verschluesselt?: unknown
        encrypted?: unknown
        kategorisierungsStatus?: { status?: unknown } | null
        _links?: {
          self?: { href?: unknown } | null
          preview?: { href?: unknown } | null
          download?: { href?: unknown } | null
          publicDownload?: { href?: unknown } | null
        } | null
      }
    | null

  const id = trimOrNull(row?.id)
  if (!id) return null

  return {
    id,
    key: trimOrNull(row?.schluessel),
    displayName: trimOrNull(row?.anzeigename ?? row?.displayName),
    fileName: trimOrNull(row?.filename),
    createdAt: trimOrNull(row?.erstellungsdatum ?? row?.createdAt),
    mimeType: trimOrNull(row?.type ?? row?.mimeType),
    sizeBytes: numberOrNull(row?.size),
    caseId: trimOrNull(row?.vorgangsNummer ?? row?.caseId),
    encrypted: Boolean(row?.verschluesselt ?? row?.encrypted),
    categorizationStatus: trimOrNull(row?.kategorisierungsStatus?.status),
    selfUrl: trimOrNull(row?._links?.self?.href),
    previewUrl: trimOrNull(row?._links?.preview?.href),
    downloadUrl: trimOrNull(row?._links?.download?.href),
    publicDownloadUrl: trimOrNull(row?._links?.publicDownload?.href),
  }
}

function normalizeEuropaceAvailableAssignment(input: unknown): EuropaceAvailableAssignment | null {
  const row = (input ?? null) as
    | {
        kategorie?: {
          id?: unknown
          name?: unknown
          beschreibung?: unknown
        } | null
        bezuege?: Array<{
          id?: unknown
          typ?: unknown
          name?: unknown
          rolle?: {
            typ?: unknown
            name?: unknown
          } | null
        }> | null
      }
    | null

  const categoryId = trimOrNull(row?.kategorie?.id)
  if (!categoryId) return null

  return {
    categoryId,
    categoryName: trimOrNull(row?.kategorie?.name),
    categoryDescription: trimOrNull(row?.kategorie?.beschreibung),
    references: Array.isArray(row?.bezuege)
      ? row.bezuege.map((reference) => ({
          id: trimOrNull(reference?.id),
          type: trimOrNull(reference?.typ),
          name: trimOrNull(reference?.name),
          roleType: trimOrNull(reference?.rolle?.typ),
          roleName: trimOrNull(reference?.rolle?.name),
        }))
      : [],
  }
}

export function flattenEuropaceAvailableAssignments(assignments: EuropaceAvailableAssignment[]): EuropaceUploadTarget[] {
  const applicantRoleLabelMap = buildApplicantRoleLabelMap(assignments)
  return assignments.flatMap((assignment) => {
    const categoryName = assignment.categoryName ?? assignment.categoryId
    if (!assignment.references.length) {
      return [
        {
          key: `${assignment.categoryId}::none`,
          title: categoryName,
          categoryId: assignment.categoryId,
          categoryName: assignment.categoryName,
          categoryDescription: assignment.categoryDescription,
          assignmentId: null,
          assignmentType: null,
          assignmentName: null,
          assignmentRoleName: null,
        } satisfies EuropaceUploadTarget,
      ]
    }

    return assignment.references.map((reference) => {
      const assignmentRoleName = (() => {
        const referenceKey = getApplicantReferenceKey(reference)
        if (referenceKey && applicantRoleLabelMap.has(referenceKey)) {
          return applicantRoleLabelMap.get(referenceKey) ?? null
        }
        return reference.roleName
      })()
      const assignmentLabel =
        [reference.roleName, reference.name].filter(Boolean).join(" - ") ||
        reference.name ||
        reference.id ||
        "Bezug"
      return {
        key: `${assignment.categoryId}::${reference.id ?? "none"}`,
        title: `${categoryName} - ${assignmentLabel}`,
        categoryId: assignment.categoryId,
        categoryName: assignment.categoryName,
        categoryDescription: assignment.categoryDescription,
        assignmentId: reference.id,
        assignmentType: reference.type,
        assignmentName: reference.name,
        assignmentRoleName: assignmentRoleName ?? null,
      } satisfies EuropaceUploadTarget
    })
  })
}

function normalizeEuropaceCasePage(input: unknown): EuropaceCasePage | null {
  const row = (input ?? null) as
    | {
        dokumentId?: unknown
        seite?: unknown
        archiviert?: unknown
        geprueftAm?: unknown
        klassifizierung?: {
          kategorien?: unknown
          anforderungen?: unknown
          zuordnung?: {
            kategorie?: unknown
            bezug?: unknown
            status?: unknown
          } | null
        } | null
        freigaben?: Array<{
          antragsNummer?: unknown
          datum?: unknown
          abrufStatus?: {
            status?: unknown
            message?: unknown
          } | null
          zuordnung?: {
            kategorie?: unknown
            bezug?: unknown
          } | null
        }> | null
      }
    | null

  const documentId = trimOrNull(row?.dokumentId)
  const pageNumber = numberOrNull(row?.seite)
  if (!documentId || pageNumber === null) return null

  return {
    documentId,
    pageNumber,
    archived: Boolean(row?.archiviert),
    checkedAt: trimOrNull(row?.geprueftAm),
    categories: Array.isArray(row?.klassifizierung?.kategorien)
      ? row.klassifizierung.kategorien.map((value) => trimOrNull(value)).filter(Boolean) as string[]
      : [],
    neededProofIds: Array.isArray(row?.klassifizierung?.anforderungen)
      ? row.klassifizierung.anforderungen.map((value) => trimOrNull(value)).filter(Boolean) as string[]
      : [],
    assignment: row?.klassifizierung?.zuordnung
      ? {
          category: trimOrNull(row.klassifizierung.zuordnung.kategorie),
          referenceId: trimOrNull(row.klassifizierung.zuordnung.bezug),
          status: trimOrNull(row.klassifizierung.zuordnung.status),
        }
      : null,
    shares: Array.isArray(row?.freigaben)
      ? row.freigaben.map((share) => ({
          applicationNo: trimOrNull(share?.antragsNummer),
          sharedAt: trimOrNull(share?.datum),
          retrievalStatus: trimOrNull(share?.abrufStatus?.status),
          retrievalMessage: trimOrNull(share?.abrufStatus?.message),
          category: trimOrNull(share?.zuordnung?.kategorie),
          referenceId: trimOrNull(share?.zuordnung?.bezug),
        }))
      : [],
  }
}

function normalizeEuropaceReleasedDocument(input: unknown): EuropaceReleasedDocument | null {
  const row = (input ?? null) as
    | {
        id?: unknown
        antragsNummer?: unknown
        anzeigename?: unknown
        filename?: unknown
        size?: unknown
        freigabedatum?: unknown
        mediaType?: unknown
        zuordnung?: {
          kategorie?: unknown
          bezug?: {
            id?: unknown
          } | null
        } | null
        abrufstatus?: {
          status?: unknown
          message?: unknown
        } | null
      }
    | null

  const id = trimOrNull(row?.id)
  if (!id) return null

  return {
    id,
    applicationNo: trimOrNull(row?.antragsNummer),
    displayName: trimOrNull(row?.anzeigename),
    fileName: trimOrNull(row?.filename),
    sizeBytes: numberOrNull(row?.size),
    sharedAt: trimOrNull(row?.freigabedatum),
    mediaType: trimOrNull(row?.mediaType),
    category: trimOrNull(row?.zuordnung?.kategorie),
    assignmentId: trimOrNull(row?.zuordnung?.bezug?.id),
    retrievalStatus: trimOrNull(row?.abrufstatus?.status),
    retrievalMessage: trimOrNull(row?.abrufstatus?.message),
  }
}

async function logDocumentSyncEvent(admin: MinimalSupabase, input: {
  caseId: string
  direction: "inbound" | "outbound"
  operation: string
  success: boolean
  requestPayload?: unknown
  responsePayload?: unknown
  errorMessage?: string | null
}) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: input.direction,
    operation: input.operation,
    request_payload: input.requestPayload ?? null,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

async function upsertEuropaceDocumentMapping(admin: MinimalSupabase, input: {
  caseId: string
  localDocumentId: string
  europaceDocumentId?: string | null
  antragsnummer?: string | null
  category?: string | null
  assignmentId?: string | null
  releaseStatus?: string | null
  uploadStatus: string
  lastError?: string | null
}) {
  const now = new Date().toISOString()
  const { data: existing, error: existingError } = await admin
    .from("case_europace_documents")
    .select("id")
    .eq("case_id", input.caseId)
    .eq("local_document_id", input.localDocumentId)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    case_id: input.caseId,
    local_document_id: input.localDocumentId,
    europace_document_id: input.europaceDocumentId ?? null,
    antragsnummer: input.antragsnummer ?? null,
    category: input.category ?? null,
    assignment_id: input.assignmentId ?? null,
    release_status: input.releaseStatus ?? null,
    upload_status: input.uploadStatus,
    last_error: input.lastError ?? null,
    last_sync_at: now,
    updated_at: now,
  }

  if (existing?.id) {
    const { error } = await admin.from("case_europace_documents").update(payload).eq("id", existing.id)
    if (error) throw error
    return
  }

  const { error } = await admin.from("case_europace_documents").insert(payload)
  if (error) throw error
}

async function upsertEuropaceRemoteDocumentMapping(admin: MinimalSupabase, input: {
  caseId: string
  europaceDocumentId: string
  antragsnummer?: string | null
  category?: string | null
  assignmentId?: string | null
  releaseStatus?: string | null
}) {
  const now = new Date().toISOString()
  const { data: existing, error: existingError } = await admin
    .from("case_europace_documents")
    .select("id")
    .eq("case_id", input.caseId)
    .eq("europace_document_id", input.europaceDocumentId)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    case_id: input.caseId,
    europace_document_id: input.europaceDocumentId,
    antragsnummer: input.antragsnummer ?? null,
    category: input.category ?? null,
    assignment_id: input.assignmentId ?? null,
    release_status: input.releaseStatus ?? null,
    last_sync_at: now,
    last_error: null,
    updated_at: now,
  }

  if (existing?.id) {
    const { error } = await admin.from("case_europace_documents").update(payload).eq("id", existing.id)
    if (error) throw error
    return
  }

  const { error } = await admin.from("case_europace_documents").insert({
    ...payload,
    local_document_id: null,
    upload_status: "uploaded",
  })
  if (error) throw error
}

export async function syncEuropaceExportDocumentsForCase(admin: MinimalSupabase, input: {
  caseId: string
  exportSnapshot: EuropaceExportResult | null | undefined
}) {
  const exportDocuments = getBankApplicationDocuments(input.exportSnapshot)
  if (!exportDocuments.length) {
    return {
      found: 0,
      imported: 0,
      existing: 0,
      failed: 0,
      errors: [],
    } satisfies EuropaceExportDocumentSyncResult
  }

  let imported = 0
  let existing = 0
  let failed = 0
  const errors: string[] = []

  for (const document of exportDocuments) {
    const sourceUrl = trimOrNull(document.url)
    if (!sourceUrl) {
      failed += 1
      errors.push(`Bankdokument "${document.name ?? "ohne Titel"}" hat keine Download-URL.`)
      continue
    }

    const sourceKey = createHash("sha1").update(`${sourceUrl}|${document.name ?? ""}`).digest("hex").slice(0, 16)
    const fileName = safeEuropaceBankFileName(document.name, sourceKey)
    const path = `${input.caseId}/europace-bank/${sourceKey}_${fileName}`

    const { data: existingRow, error: existingError } = await admin
      .from("documents")
      .select("id")
      .eq("case_id", input.caseId)
      .eq("file_path", path)
      .maybeSingle()

    if (existingError) throw existingError
    if (existingRow?.id) {
      existing += 1
      continue
    }

    try {
      const response = await fetch(sourceUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
      })

      if (!response.ok) {
        throw new Error(`Bankdokument konnte nicht geladen werden (HTTP ${response.status}).`)
      }

      const buffer = await response.arrayBuffer()
      const sizeBytes = buffer.byteLength
      if (sizeBytes <= 0) {
        throw new Error("Bankdokument war leer.")
      }

      const mimeType = trimOrNull(response.headers.get("content-type")) || inferMimeTypeFromFileName(fileName)
      const { error: uploadError } = await admin.storage.from("case_documents").upload(path, buffer, {
        upsert: false,
        contentType: mimeType,
      })
      if (uploadError) throw uploadError

      const { error: insertError } = await admin.from("documents").insert({
        case_id: input.caseId,
        request_id: null,
        uploaded_by: null,
        file_path: path,
        file_name: trimOrNull(document.name) || fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      })
      if (insertError) throw insertError

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "bankDokumentImport",
        requestPayload: {
          sourceUrl,
          name: trimOrNull(document.name),
        },
        responsePayload: {
          fileName,
          filePath: path,
          sizeBytes,
        },
        success: true,
        errorMessage: null,
      })

      imported += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Bankdokument "${document.name ?? fileName}" konnte nicht importiert werden.`
      errors.push(message)
      failed += 1

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "bankDokumentImport",
        requestPayload: {
          sourceUrl,
          name: trimOrNull(document.name),
        },
        responsePayload: null,
        success: false,
        errorMessage: message,
      })
    }
  }

  return {
    found: exportDocuments.length,
    imported,
    existing,
    failed,
    errors,
  } satisfies EuropaceExportDocumentSyncResult
}

function selectDocumentAssignment(pages: EuropaceCasePage[]) {
  for (const page of pages) {
    if (page.assignment?.category || page.assignment?.referenceId) {
      return page.assignment
    }
  }
  return null
}

function selectDocumentReleaseStatus(pages: EuropaceCasePage[]) {
  const shares = pages
    .flatMap((page) => page.shares)
    .sort((left, right) => {
      const leftTs = left.sharedAt ? new Date(left.sharedAt).getTime() : 0
      const rightTs = right.sharedAt ? new Date(right.sharedAt).getTime() : 0
      return rightTs - leftTs
    })
  return shares[0]?.retrievalStatus ?? null
}

export async function markLocalEuropaceDocumentDeleted(admin: MinimalSupabase, input: {
  caseId: string
  localDocumentId: string
  fileName?: string | null
}) {
  const now = new Date().toISOString()
  const { data: rows, error } = await admin
    .from("case_europace_documents")
    .select("id,europace_document_id")
    .eq("case_id", input.caseId)
    .eq("local_document_id", input.localDocumentId)

  if (error) throw error

  const matches = (rows ?? []) as Array<{ id: string; europace_document_id?: string | null }>
  if (!matches.length) {
    return {
      updated: 0,
      europaceDocumentIds: [] as string[],
    }
  }

  const europaceDocumentIds = matches
    .map((row) => trimOrNull(row.europace_document_id))
    .filter(Boolean) as string[]

  const lastError =
    europaceDocumentIds.length > 0
      ? "Lokales Dokument wurde geloescht. Das Europace-Dokument wurde nicht automatisch entfernt."
      : "Lokales Dokument wurde geloescht, bevor ein finaler Europace-Dokumentlink vorlag."

  const { error: updateError } = await admin
    .from("case_europace_documents")
    .update({
      local_document_id: null,
      upload_status: "local_deleted",
      last_error: lastError,
      last_sync_at: now,
      updated_at: now,
    })
    .eq("case_id", input.caseId)
    .eq("local_document_id", input.localDocumentId)

  if (updateError) throw updateError

  await logDocumentSyncEvent(admin, {
    caseId: input.caseId,
    direction: "outbound",
    operation: "deleteLokalesDokument",
    success: true,
    requestPayload: {
      localDocumentId: input.localDocumentId,
      fileName: trimOrNull(input.fileName),
      europaceDocumentIds,
    },
    responsePayload: {
      remoteDeleteMirrored: false,
      markedAs: "local_deleted",
    },
    errorMessage: null,
  })

  return {
    updated: matches.length,
    europaceDocumentIds,
  }
}

export async function syncLocalDocumentToEuropace(admin: MinimalSupabase, input: {
  caseId: string
  localDocumentId: string
  filePath: string
  fileName: string
  siteOrigin: string
  category?: string | null
  assignmentId?: string | null
  antragsnummer?: string | null
}): Promise<EuropaceLocalDocumentSyncResult> {
  const { data: mapping, error: mappingError } = await admin
    .from("case_europace")
    .select("vorgangsnummer")
    .eq("case_id", input.caseId)
    .maybeSingle()

  if (mappingError) throw mappingError

  const vorgangsnummer = trimOrNull(mapping?.vorgangsnummer)
  if (!vorgangsnummer) {
    return {
      attempted: false as const,
      ok: false as const,
      reason: "missing_vorgang",
      europaceDocumentId: null,
    }
  }

  const config = getEuropaceConfig()

  const { data: storedFile, error: storedFileError } = await admin.storage.from("case_documents").download(input.filePath)
  if (storedFileError || !storedFile) {
    const message = storedFileError?.message ?? "Lokale Datei konnte nicht aus dem Speicher geladen werden."

    await upsertEuropaceDocumentMapping(admin, {
      caseId: input.caseId,
      localDocumentId: input.localDocumentId,
      antragsnummer: input.antragsnummer ?? null,
      category: trimOrNull(input.category),
      assignmentId: trimOrNull(input.assignmentId),
      uploadStatus: "error",
      lastError: message,
    })

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "uploadDokument",
      requestPayload: {
        vorgangsnummer,
        uploadMode: "direct-file",
        fileName: input.fileName,
        filePath: input.filePath,
      },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })

    return {
      attempted: true as const,
      ok: false as const,
      reason: message,
      europaceDocumentId: null,
    }
  }

  const arrayBuffer = await storedFile.arrayBuffer()
  const sizeBytes = arrayBuffer.byteLength
  if (sizeBytes <= 0) {
    const message = "Die Datei ist leer und konnte nicht an Europace übertragen werden."

    await upsertEuropaceDocumentMapping(admin, {
      caseId: input.caseId,
      localDocumentId: input.localDocumentId,
      antragsnummer: input.antragsnummer ?? null,
      category: trimOrNull(input.category),
      assignmentId: trimOrNull(input.assignmentId),
      uploadStatus: "error",
      lastError: message,
    })

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "uploadDokument",
      requestPayload: {
        vorgangsnummer,
        uploadMode: "direct-file",
        fileName: input.fileName,
        filePath: input.filePath,
      },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })

    return {
      attempted: true as const,
      ok: false as const,
      reason: message,
      europaceDocumentId: null,
    }
  }

  const mimeType = trimOrNull(storedFile.type) || inferMimeTypeFromFileName(input.fileName)
  if (!isEuropaceDirectUploadSupported(input.fileName, mimeType)) {
    const message = "Europace akzeptiert hier nur PDF, JPG, PNG oder TIFF."

    await upsertEuropaceDocumentMapping(admin, {
      caseId: input.caseId,
      localDocumentId: input.localDocumentId,
      antragsnummer: input.antragsnummer ?? null,
      category: trimOrNull(input.category),
      assignmentId: trimOrNull(input.assignmentId),
      uploadStatus: "error",
      lastError: message,
    })

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "uploadDokument",
      requestPayload: {
        vorgangsnummer,
        uploadMode: "direct-file",
        fileName: input.fileName,
        filePath: input.filePath,
        mimeType,
        sizeBytes,
      },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })

    return {
      attempted: true as const,
      ok: false as const,
      reason: message,
      europaceDocumentId: null,
    }
  }

  const uploadFileName = safeEuropaceUploadFileName(input.fileName, input.localDocumentId)

  try {
    const token = await getEuropaceAccessToken("unterlagen:dokument:schreiben")
    const formData = new FormData()
    formData.set("caseId", vorgangsnummer)
    formData.set("file", new Blob([arrayBuffer], { type: mimeType || "application/octet-stream" }), uploadFileName)
    formData.set("displayName", input.fileName)
    if (trimOrNull(input.category)) {
      formData.set("category", trimOrNull(input.category) as string)
    }
    if (trimOrNull(input.assignmentId)) {
      formData.set("assignmentId", trimOrNull(input.assignmentId) as string)
    }

    const res = await fetch(`${config.unterlagenApiUrl}/v2/dokumente`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
      },
      body: formData,
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as { id?: string | null; message?: string | null } | null
    const europaceDocumentId = trimOrNull(json?.id)

    if (!res.ok || !europaceDocumentId) {
      const message =
        trimOrNull(json?.message) || `Europace-Unterlagenupload fehlgeschlagen (HTTP ${res.status}).`

      await upsertEuropaceDocumentMapping(admin, {
        caseId: input.caseId,
        localDocumentId: input.localDocumentId,
        antragsnummer: input.antragsnummer ?? null,
        category: trimOrNull(input.category),
        assignmentId: trimOrNull(input.assignmentId),
        uploadStatus: "error",
        lastError: message,
      })

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "uploadDokument",
        requestPayload: {
          vorgangsnummer,
          uploadMode: "direct-file",
          displayName: input.fileName,
          fileName: uploadFileName,
          mimeType,
          sizeBytes,
          category: trimOrNull(input.category),
          assignmentId: trimOrNull(input.assignmentId),
        },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })

      return {
        attempted: true as const,
        ok: false as const,
        reason: message,
        europaceDocumentId: null,
      }
    }

      await upsertEuropaceDocumentMapping(admin, {
        caseId: input.caseId,
        localDocumentId: input.localDocumentId,
        europaceDocumentId,
        antragsnummer: input.antragsnummer ?? null,
        category: trimOrNull(input.category),
        assignmentId: trimOrNull(input.assignmentId),
        uploadStatus: "uploaded",
        lastError: null,
      })

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "uploadDokument",
      requestPayload: {
        vorgangsnummer,
        uploadMode: "direct-file",
        displayName: input.fileName,
        fileName: uploadFileName,
        mimeType,
        sizeBytes,
        category: trimOrNull(input.category),
        assignmentId: trimOrNull(input.assignmentId),
      },
      responsePayload: json,
      success: true,
      errorMessage: null,
    })

    return {
      attempted: true as const,
      ok: true as const,
      reason: null,
      europaceDocumentId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Unterlagenupload fehlgeschlagen."

    await upsertEuropaceDocumentMapping(admin, {
      caseId: input.caseId,
      localDocumentId: input.localDocumentId,
      antragsnummer: input.antragsnummer ?? null,
      category: trimOrNull(input.category),
      assignmentId: trimOrNull(input.assignmentId),
      uploadStatus: "error",
      lastError: message,
    })

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "uploadDokument",
      requestPayload: {
        vorgangsnummer,
        uploadMode: "direct-file",
        displayName: input.fileName,
        fileName: uploadFileName,
        mimeType,
        sizeBytes,
        category: trimOrNull(input.category),
        assignmentId: trimOrNull(input.assignmentId),
      },
      responsePayload: null,
      success: false,
      errorMessage: message,
    })

    return {
      attempted: true as const,
      ok: false as const,
      reason: message,
      europaceDocumentId: null,
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function syncLocalDocumentToEuropaceWithRetry(admin: MinimalSupabase, input: {
  caseId: string
  localDocumentId: string
  filePath: string
  fileName: string
  siteOrigin: string
  category?: string | null
  assignmentId?: string | null
  antragsnummer?: string | null
}, options?: {
  maxAttempts?: number
  retryDelayMs?: number
}): Promise<EuropaceLocalDocumentSyncResult> {
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(options?.maxAttempts ?? 3)))
  const retryDelayMs = Math.max(150, Math.floor(options?.retryDelayMs ?? 500))
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await syncLocalDocumentToEuropace(admin, input)
      if (result.ok || !result.attempted || attempt === maxAttempts) {
        return result
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Europace-Unterlagensync fehlgeschlagen.")
      if (attempt === maxAttempts) {
        throw lastError
      }
    }

    await wait(retryDelayMs * attempt)
  }

  throw lastError ?? new Error("Europace-Unterlagensync fehlgeschlagen.")
}

export async function listEuropaceDocumentsForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  if (!vorgangsnummer) {
    throw new Error("vorgangsnummer fehlt.")
  }

  const token = await getEuropaceAccessToken("unterlagen:dokument:lesen")
  const url = buildUnterlagenUrl("/v1/dokumente/", {
    vorgangsNummer: vorgangsnummer,
  })
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
      },
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const message =
        trimOrNull((json as { message?: unknown } | null)?.message) ||
        `Europace-Dokumente konnten nicht geladen werden (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "dokumenteAbrufen",
        requestPayload: { vorgangsnummer },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true

      throw new Error(message)
    }

    const rows = Array.isArray(json) ? json : []
    const documents = rows.map(normalizeEuropaceRemoteDocument).filter(Boolean) as EuropaceRemoteDocument[]

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "inbound",
      operation: "dokumenteAbrufen",
      requestPayload: { vorgangsnummer },
      responsePayload: rows,
      success: true,
      errorMessage: null,
    })

    return documents
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "dokumenteAbrufen",
        requestPayload: { vorgangsnummer },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function listEuropaceAvailableAssignments(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  antragsnummer?: string | null
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  if (!vorgangsnummer) throw new Error("vorgangsnummer fehlt.")

  const token = await getEuropaceAccessToken("unterlagen:unterlage:lesen")
  const url = buildUnterlagenUrl("/v1/dokumente/moeglichezuordnungen", {
    vorgangsNummer: vorgangsnummer,
    antragsNummer: input.antragsnummer ?? null,
  })
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
      },
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const message =
        trimOrNull((json as { message?: unknown } | null)?.message) ||
        `Europace-Zuordnungen konnten nicht geladen werden (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "zuordnungenAbrufen",
        requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true
      throw new Error(message)
    }

    const rows = Array.isArray(json) ? json : []
    const assignments = rows.map(normalizeEuropaceAvailableAssignment).filter(Boolean) as EuropaceAvailableAssignment[]

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "inbound",
      operation: "zuordnungenAbrufen",
      requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
      responsePayload: rows,
      success: true,
      errorMessage: null,
    })

    return assignments
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "zuordnungenAbrufen",
        requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function listEuropacePagesForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  antragsnummer?: string | null
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  if (!vorgangsnummer) throw new Error("vorgangsnummer fehlt.")

  const token = await getEuropaceAccessToken("unterlagen:unterlage:lesen")
  const url = buildUnterlagenUrl("/v1/dokumente/seiten", {
    vorgangsNummer: vorgangsnummer,
    antragsNummer: input.antragsnummer ?? null,
  })
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
      },
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as { seiten?: unknown[] } | unknown
    if (!res.ok) {
      const message =
        trimOrNull((json as { message?: unknown } | null)?.message) ||
        `Europace-Seiten konnten nicht geladen werden (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "seitenAbrufen",
        requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true
      throw new Error(message)
    }

    const rows = Array.isArray((json as { seiten?: unknown[] } | null)?.seiten)
      ? ((json as { seiten?: unknown[] }).seiten ?? [])
      : []
    const pages = rows.map(normalizeEuropaceCasePage).filter(Boolean) as EuropaceCasePage[]

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "inbound",
      operation: "seitenAbrufen",
      requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
      responsePayload: rows,
      success: true,
      errorMessage: null,
    })

    return pages
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "inbound",
        operation: "seitenAbrufen",
        requestPayload: { vorgangsnummer, antragsnummer: input.antragsnummer ?? null },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function createEuropaceReleaseForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  antragsnummer: string
  includeApplicationDocument?: boolean
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  const antragsnummer = trimOrNull(input.antragsnummer)
  if (!vorgangsnummer) throw new Error("vorgangsnummer fehlt.")
  if (!antragsnummer) throw new Error("antragsnummer fehlt.")

  const pages = await listEuropacePagesForCase(admin, {
    caseId: input.caseId,
    vorgangsnummer,
    antragsnummer,
  })

  const eligiblePages = pages
    .filter((page) => !page.archived)
    .filter((page) => {
      const status = String(page.assignment?.status ?? "").trim().toUpperCase()
      return status === "VOLLSTAENDIG" || (Boolean(page.assignment?.category) && Boolean(page.assignment?.referenceId))
    })
    .map((page) => ({
      dokumentId: page.documentId,
      seite: page.pageNumber,
    }))

  if (!eligiblePages.length) {
    throw new Error("Keine vollstaendig zugeordneten Europace-Seiten fuer die Freigabe vorhanden.")
  }

  const token = await getEuropaceAccessToken("unterlagen:unterlage:freigeben")
  const url = buildUnterlagenUrl("/v1/dokumente/freigabe")
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        antragsNummer: antragsnummer,
        antragsDokumentEnthalten: input.includeApplicationDocument ?? false,
        seiten: eligiblePages,
      }),
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as unknown
    if (!res.ok) {
      const message =
        trimOrNull((json as { message?: unknown } | null)?.message) ||
        `Europace-Freigabe fehlgeschlagen (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "freigabeErstellen",
        requestPayload: {
          vorgangsnummer,
          antragsnummer,
          seiten: eligiblePages,
          antragsDokumentEnthalten: input.includeApplicationDocument ?? false,
        },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true
      throw new Error(message)
    }

    const rows = Array.isArray(json) ? json : []
    const shares = rows.map(normalizeEuropaceReleasedDocument).filter(Boolean) as EuropaceReleasedDocument[]

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "freigabeErstellen",
      requestPayload: {
        vorgangsnummer,
        antragsnummer,
        seiten: eligiblePages,
        antragsDokumentEnthalten: input.includeApplicationDocument ?? false,
      },
      responsePayload: rows,
      success: true,
      errorMessage: null,
    })

    return {
      pagesShared: eligiblePages.length,
      shares,
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "freigabeErstellen",
        requestPayload: {
          vorgangsnummer,
          antragsnummer,
          antragsDokumentEnthalten: input.includeApplicationDocument ?? false,
        },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function deleteEuropaceDocumentForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  europaceDocumentId: string
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  const europaceDocumentId = trimOrNull(input.europaceDocumentId)
  if (!vorgangsnummer) throw new Error("vorgangsnummer fehlt.")
  if (!europaceDocumentId) throw new Error("europaceDocumentId fehlt.")

  const token = await getEuropaceAccessToken("unterlagen:dokument:schreiben")
  const url = buildUnterlagenUrl(`/v1/dokumente/${encodeURIComponent(europaceDocumentId)}`)
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
      },
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as { message?: unknown } | null
    if (!res.ok) {
      const message =
        trimOrNull(json?.message) || `Europace-Dokument konnte nicht geloescht werden (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "dokumentLoeschen",
        requestPayload: {
          vorgangsnummer,
          europaceDocumentId,
        },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true
      throw new Error(message)
    }

    const now = new Date().toISOString()
    const { data: mappings, error: mappingsError } = await admin
      .from("case_europace_documents")
      .select("id")
      .eq("case_id", input.caseId)
      .eq("europace_document_id", europaceDocumentId)

    if (mappingsError) throw mappingsError

    if ((mappings ?? []).length > 0) {
      const { error: updateError } = await admin
        .from("case_europace_documents")
        .update({
          upload_status: "deleted_remote",
          release_status: null,
          last_error: null,
          last_sync_at: now,
          updated_at: now,
        })
        .eq("case_id", input.caseId)
        .eq("europace_document_id", europaceDocumentId)

      if (updateError) throw updateError
    }

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "dokumentLoeschen",
      requestPayload: {
        vorgangsnummer,
        europaceDocumentId,
      },
      responsePayload: {
        deleted: true,
        updatedMappings: (mappings ?? []).length,
      },
      success: true,
      errorMessage: null,
    })

    return {
      deleted: true as const,
      updatedMappings: (mappings ?? []).length,
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "dokumentLoeschen",
        requestPayload: {
          vorgangsnummer,
          europaceDocumentId,
        },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function assignEuropaceDocumentForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  europaceDocumentId: string
  category: string
  assignmentId?: string | null
  antragsnummer?: string | null
}) {
  const vorgangsnummer = trimOrNull(input.vorgangsnummer)
  const europaceDocumentId = trimOrNull(input.europaceDocumentId)
  const category = trimOrNull(input.category)
  const assignmentId = trimOrNull(input.assignmentId)

  if (!vorgangsnummer) throw new Error("vorgangsnummer fehlt.")
  if (!europaceDocumentId) throw new Error("europaceDocumentId fehlt.")
  if (!category) throw new Error("category fehlt.")

  const pages = await listEuropacePagesForCase(admin, {
    caseId: input.caseId,
    vorgangsnummer,
    antragsnummer: input.antragsnummer ?? null,
  })

  const targetPages = pages
    .filter((page) => page.documentId === europaceDocumentId)
    .filter((page) => !page.archived)
    .map((page) => ({
      dokumentId: page.documentId,
      seite: page.pageNumber,
    }))

  if (!targetPages.length) {
    throw new Error("Keine zuordenbaren Europace-Seiten fuer dieses Dokument gefunden.")
  }

  const token = await getEuropaceAccessToken("unterlagen:unterlage:schreiben")
  const url = buildUnterlagenUrl(`/v1/dokumente/zuordnung/${encodeURIComponent(category)}`, {
    bezug: assignmentId,
  })
  let loggedFailure = false

  try {
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        accept: "application/json",
        authorization: `${token.tokenType} ${token.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(targetPages),
      cache: "no-store",
    })

    const json = (await res.json().catch(() => null)) as { message?: unknown } | null
    if (!res.ok) {
      const message =
        trimOrNull(json?.message) || `Europace-Zuordnung konnte nicht gesetzt werden (HTTP ${res.status}).`

      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "seitenZuordnen",
        requestPayload: {
          vorgangsnummer,
          europaceDocumentId,
          category,
          assignmentId,
          seiten: targetPages,
        },
        responsePayload: json,
        success: false,
        errorMessage: message,
      })
      loggedFailure = true
      throw new Error(message)
    }

    const now = new Date().toISOString()
    const { error: updateError } = await admin
      .from("case_europace_documents")
      .update({
        category,
        assignment_id: assignmentId,
        last_error: null,
        last_sync_at: now,
        updated_at: now,
      })
      .eq("case_id", input.caseId)
      .eq("europace_document_id", europaceDocumentId)

    if (updateError) throw updateError

    await logDocumentSyncEvent(admin, {
      caseId: input.caseId,
      direction: "outbound",
      operation: "seitenZuordnen",
      requestPayload: {
        vorgangsnummer,
        europaceDocumentId,
        category,
        assignmentId,
        seiten: targetPages,
      },
      responsePayload: {
        assignedPages: targetPages.length,
      },
      success: true,
      errorMessage: null,
    })

    return {
      assignedPages: targetPages.length,
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (!loggedFailure) {
      await logDocumentSyncEvent(admin, {
        caseId: input.caseId,
        direction: "outbound",
        operation: "seitenZuordnen",
        requestPayload: {
          vorgangsnummer,
          europaceDocumentId,
          category,
          assignmentId,
          antragsnummer: input.antragsnummer ?? null,
        },
        responsePayload: null,
        success: false,
        errorMessage: error.message,
      })
    }
    throw error
  }
}

export async function syncEuropaceDocumentStateForCase(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  antragsnummer?: string | null
}) {
  const documents = await listEuropaceDocumentsForCase(admin, input)
  const pages = await listEuropacePagesForCase(admin, input)

  const pagesByDocumentId = new Map<string, EuropaceCasePage[]>()
  for (const page of pages) {
    const rows = pagesByDocumentId.get(page.documentId) ?? []
    rows.push(page)
    pagesByDocumentId.set(page.documentId, rows)
  }

  for (const document of documents) {
    const relatedPages = pagesByDocumentId.get(document.id) ?? []
    const assignment = selectDocumentAssignment(relatedPages)
    const releaseStatus = selectDocumentReleaseStatus(relatedPages)

    await upsertEuropaceRemoteDocumentMapping(admin, {
      caseId: input.caseId,
      europaceDocumentId: document.id,
      antragsnummer: input.antragsnummer ?? null,
      category: assignment?.category ?? null,
      assignmentId: assignment?.referenceId ?? null,
      releaseStatus,
    })
  }

  return {
    documents,
    pages,
  }
}
