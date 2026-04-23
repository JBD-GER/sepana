"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { isImportedBankDocumentPath } from "@/lib/europace/flow"
import { deriveConcreteUploadRequirements } from "@/lib/europace/uploadRequirements"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

const UPLOAD_ACCEPT = "image/*,.pdf,.doc,.docx"
const MOBILE_IMAGE_MAX_BYTES = 4 * 1024 * 1024
const MOBILE_IMAGE_MAX_EDGE = 2200
const MOBILE_IMAGE_QUALITY = 0.85
const PDF_IMAGE_MAX_EDGE = 2400
const PDF_IMAGE_QUALITY = 0.9
const PDF_PAGE_WIDTH = 595.28
const PDF_PAGE_HEIGHT = 841.89
const PDF_PAGE_MARGIN = 24
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const UPLOAD_RETRY_DELAY_MS = 600
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
])
const IMAGE_UPLOAD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"])

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
])

type CanonicalRequestKey =
  | "general_id_passport"
  | "general_registration"
  | "general_salary_slips_3"
  | "general_bank_statements_salary_3m"
  | "equity_proof"
  | "object_expose"
  | "object_purchase_contract"
  | "object_land_register"
  | "object_energy_certificate"
  | "object_site_plan"

const CANONICAL_TITLE_BY_KEY: Record<CanonicalRequestKey, string> = {
  general_id_passport: "Personalausweis / Reisepass (Vorder- & Rückseite)",
  general_registration: "Meldebescheinigung",
  general_salary_slips_3: "Letzte 3 Gehaltsabrechnungen",
  general_bank_statements_salary_3m: "Kontoauszug vom Gehaltseingang",
  equity_proof: "Eigenkapital-Nachweis (aktueller Kontoauszug)",
  object_expose: "Exposé / Objektbeschreibung",
  object_purchase_contract: "Kaufvertragsentwurf (sobald vorhanden)",
  object_land_register: "Grundbuchauszug (aktuell)",
  object_energy_certificate: "Energieausweis",
  object_site_plan: "Flurkarte / Lageplan",
}

const STANDARD_GENERAL_KEYS: CanonicalRequestKey[] = [
  "general_id_passport",
  "general_registration",
  "general_salary_slips_3",
  "general_bank_statements_salary_3m",
]

const BAUFI_GENERAL_EXTRA_KEYS: CanonicalRequestKey[] = ["equity_proof"]

const BAUFI_OBJECT_KEYS: CanonicalRequestKey[] = [
  "object_expose",
  "object_purchase_contract",
  "object_land_register",
  "object_energy_certificate",
  "object_site_plan",
]
const BAUFI_ONLY_KEYS = new Set<CanonicalRequestKey>([...BAUFI_GENERAL_EXTRA_KEYS, ...BAUFI_OBJECT_KEYS])

function normalizeTitle(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function classifyRequestTitle(rawTitle: string): CanonicalRequestKey | null {
  const title = normalizeTitle(rawTitle)
  if (!title) return null
  const hasKontoauszug = title.includes("kontoauszug") || title.includes("kontoauszueg")

  if (title.includes("personalausweis") || title.includes("reisepass")) return "general_id_passport"
  if (title.includes("meldebescheinigung")) return "general_registration"
  if (title.includes("gehaltsabrechnung")) return "general_salary_slips_3"
  if (
    hasKontoauszug &&
    (
      title.includes("gehaltseingang") ||
      title.includes("gehaltskonto") ||
      title.includes("3m") ||
      title.includes("3 m") ||
      title.includes("3 monate")
    )
  ) {
    return "general_bank_statements_salary_3m"
  }
  if (title.includes("eigenkapital")) return "equity_proof"
  if (title.includes("expose") || title.includes("objektbeschreibung")) return "object_expose"
  if (title.includes("kaufvertrag")) return "object_purchase_contract"
  if (title.includes("grundbuch")) return "object_land_register"
  if (title.includes("energieausweis") || title.includes("energiepass")) return "object_energy_certificate"
  if (title.includes("flurkarte") || title.includes("lageplan")) return "object_site_plan"
  return null
}

function getEuropaceRequestScopeKey(request: Pick<RequestSourceRow, "europaceCategory" | "europaceAssignmentId">) {
  const category = String(request.europaceCategory ?? "").trim()
  const assignmentId = String(request.europaceAssignmentId ?? "").trim()
  if (!category && !assignmentId) return ""
  return `${category || "none"}::${assignmentId || "none"}`
}

type DocRequest = {
  id: string
  case_id: string
  title: string
  required: boolean
  created_at: string
  created_by: string
}

type DocumentRow = {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  uploaded_by?: string | null
  request_id?: string | null
  case_id?: string | null
}

type EuropaceDocumentRow = {
  local_document_id?: string | null
  europace_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  release_status?: string | null
  upload_status?: string | null
  last_sync_at?: string | null
  last_error?: string | null
  created_at?: string | null
}

type EuropaceUploadTarget = {
  key: string
  title: string
  category_id: string
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_type?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
}

type SkagDocumentRow = {
  local_document_id?: string | null
  upload_status?: string | null
  last_error?: string | null
}

type RequestSourceRow = {
  id: string
  title: string
  required: boolean
  created_at: string | null
  linkedRequestIds: string[]
  linkedDocumentIds: string[]
  source: "local" | "europace"
  requestTitle: string
  hint: string | null
  europaceCategory: string | null
  europaceAssignmentId: string | null
}

type RequestGroup = {
  id: string
  dedupeKey: string
  title: string
  required: boolean
  created_at: string | null
  requestIds: string[]
  documentIds: string[]
  canonicalKey: CanonicalRequestKey | null
  virtual: boolean
  source: "local" | "europace"
  requestTitle: string
  hint: string | null
  europaceCategory: string | null
  europaceAssignmentId: string | null
}

type UploadPhase = "preparing" | "uploading" | "retrying"

type UploadProgressState = {
  current: number
  total: number
  fileName: string
  phase: UploadPhase
}

type PdfProgressState = {
  current: number
  total: number
  fileName: string
  title: string
}

type UploadOptions = {
  requestId?: string | null
  requestTitle?: string | null
  keepUnassigned?: boolean
  europaceCategory?: string | null
  europaceAssignmentId?: string | null
}

type DirectUploadInitResult = {
  path: string
  token: string
  request_id: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(d))
}

function formatBytes(n: number | null | undefined) {
  if (!n || Number.isNaN(n)) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return "Fehler"
}

function fileExt(name: string) {
  const raw = String(name ?? "")
  const dot = raw.lastIndexOf(".")
  if (dot < 0) return ""
  return raw.slice(dot + 1).trim().toLowerCase()
}

function isImageDocument(doc: DocumentRow) {
  const mime = String(doc.mime_type ?? "").trim().toLowerCase()
  if (mime.startsWith("image/")) return true
  return IMAGE_UPLOAD_EXTENSIONS.has(fileExt(doc.file_name))
}

function sanitizeFileNamePart(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function isAllowedUploadFile(file: File) {
  const mime = String(file.type ?? "").trim().toLowerCase()
  if (mime.startsWith("image/")) return true
  if (mime && ALLOWED_UPLOAD_MIME_TYPES.has(mime)) return true
  return ALLOWED_UPLOAD_EXTENSIONS.has(fileExt(file.name))
}

function isRetryableUploadError(status: number, message: string) {
  if (status === 408 || status === 429) return true
  if (status >= 500) return true
  return /timeout|tempor|network|fetch failed|failed to fetch/i.test(String(message ?? ""))
}

function isMobileDevice() {
  if (typeof window === "undefined") return false
  const byViewport = window.matchMedia("(max-width: 768px)").matches
  const byUa = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
  return byViewport || byUa
}

function uploadPhaseLabel(phase: UploadPhase) {
  if (phase === "preparing") return "Bereite Datei vor"
  if (phase === "retrying") return "Wiederhole Upload"
  return "Upload läuft"
}

function replaceFileExtension(fileName: string, nextExt: string) {
  const trimmed = String(fileName ?? "").trim()
  if (!trimmed) return `upload.${nextExt}`
  if (!trimmed.includes(".")) return `${trimmed}.${nextExt}`
  return `${trimmed.slice(0, trimmed.lastIndexOf("."))}.${nextExt}`
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Bild konnte nicht gelesen werden."))
    }
    img.src = url
  })
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."))
    img.src = src
  })
}

async function optimizeImageForMobileUpload(file: File) {
  const isImage = String(file.type ?? "").toLowerCase().startsWith("image/")
  if (!isImage) return file

  const looksLikeHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  if (file.size <= MOBILE_IMAGE_MAX_BYTES && !looksLikeHeic) return file

  try {
    const image = await loadImageFromFile(file)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return file

    const maxEdge = Math.max(width, height)
    const scale = maxEdge > MOBILE_IMAGE_MAX_EDGE ? MOBILE_IMAGE_MAX_EDGE / maxEdge : 1
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", MOBILE_IMAGE_QUALITY)
    })
    if (!blob || blob.size === 0) return file

    const optimizedName = replaceFileExtension(file.name || "foto", "jpg")
    const optimized = new File([blob], optimizedName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })

    if (looksLikeHeic) return optimized
    return optimized.size < file.size ? optimized : file
  } catch {
    return file
  }
}

function fileUrl(
  path: string,
  opts?: {
    download?: boolean
    filename?: string | null
  }
) {
  const downloadParam = opts?.download ? "&download=1" : ""
  const filenameParam = opts?.filename ? `&filename=${encodeURIComponent(opts.filename)}` : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}${downloadParam}${filenameParam}`
}

function bankDocumentKindLabel(fileName: string) {
  const normalized = normalizeTitle(fileName)
  if (!normalized) return "Bankdokument"
  if (normalized.includes("kreditvertrag") || normalized.includes("darlehensvertrag") || normalized.includes("vertrag")) {
    return "Kreditvertrag"
  }
  if (normalized.includes("datenschutz") || normalized.includes("einwilligung")) {
    return "Datenschutz"
  }
  return "Bankdokument"
}

function translateEuropaceUploadStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "uploaded") return "hochgeladen"
  if (normalized === "error") return "Fehler"
  if (normalized === "pending") return "in Bearbeitung"
  return normalized
}

function translateEuropaceReleaseStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "released" || normalized === "freigegeben") return "freigegeben"
  if (normalized === "pending") return "offen"
  return normalized
}

function translateSkagUploadStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "uploaded") return "an SKAG übermittelt"
  if (normalized === "pending_credit_id") return "wartet auf manuelle Bankeinreichung"
  if (normalized === "pending") return "wird vorbereitet"
  if (normalized === "error") return "Übertragung prüfen"
  return normalized
}

export default function DocumentPanel({
  caseId,
  requests,
  documents,
  europaceDocuments = [],
  europaceUploadTargets = [],
  skagDocuments = [],
  documentPin = null,
  caseType,
  canCreateRequest,
  caseCustomerId,
  caseAdvisorId,
  hideTechnicalBranding = false,
}: {
  caseId: string
  requests: DocRequest[]
  documents: DocumentRow[]
  europaceDocuments?: EuropaceDocumentRow[]
  europaceUploadTargets?: EuropaceUploadTarget[]
  skagDocuments?: SkagDocumentRow[]
  documentPin?: string | null
  caseType?: string | null
  canCreateRequest: boolean
  caseCustomerId?: string | null
  caseAdvisorId?: string | null
  hideTechnicalBranding?: boolean
}) {
  const [title, setTitle] = useState("")
  const [required, setRequired] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [freeOpen, setFreeOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null)
  const [pdfProgress, setPdfProgress] = useState<PdfProgressState | null>(null)
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const reloadTimerRef = useRef<number | null>(null)
  const normalizedCaseType = String(caseType ?? "").trim().toLowerCase()
  const isKonsum = normalizedCaseType === "konsum"
  const isSchufaFree = normalizedCaseType === "schufa_frei"
  const isBaufi = !isKonsum && !isSchufaFree
  const usesEuropaceTargets = isKonsum && (europaceUploadTargets?.length ?? 0) > 0
  const canCreateManualRequest = canCreateRequest && (isBaufi || isSchufaFree)
  const bankDocuments = useMemo(
    () => (documents ?? []).filter((row) => isImportedBankDocumentPath(row.file_path)),
    [documents]
  )
  const managedDocuments = useMemo(
    () => (documents ?? []).filter((row) => !isImportedBankDocumentPath(row.file_path)),
    [documents]
  )
  const europaceDocumentMap = useMemo(() => {
    const map = new Map<string, EuropaceDocumentRow>()
    for (const row of europaceDocuments ?? []) {
      const localDocumentId = String(row?.local_document_id ?? "").trim()
      if (!localDocumentId || map.has(localDocumentId)) continue
      map.set(localDocumentId, row)
    }
    return map
  }, [europaceDocuments])
  const skagDocumentMap = useMemo(() => {
    const map = new Map<string, SkagDocumentRow>()
    for (const row of skagDocuments ?? []) {
      const localDocumentId = String(row?.local_document_id ?? "").trim()
      if (!localDocumentId || map.has(localDocumentId)) continue
      map.set(localDocumentId, row)
    }
    return map
  }, [skagDocuments])
  const documentById = useMemo(() => {
    const map = new Map<string, DocumentRow>()
    for (const row of managedDocuments ?? []) {
      const documentId = String(row?.id ?? "").trim()
      if (!documentId || map.has(documentId)) continue
      map.set(documentId, row)
    }
    return map
  }, [managedDocuments])

  const { docsByRequest, orphanDocs } = useMemo(() => {
    const map = new Map<string, DocumentRow[]>()
    const requestIds = new Set((requests ?? []).map((r) => r.id))
    const orphans: DocumentRow[] = []
    for (const d of managedDocuments ?? []) {
      const reqId = d.request_id || null
      if (reqId && !requestIds.has(reqId)) {
        orphans.push(d)
        continue
      }
      const key = reqId || "free"
      const arr = map.get(key) ?? []
      arr.push(d)
      map.set(key, arr)
    }
    return { docsByRequest: map, orphanDocs: orphans }
  }, [managedDocuments, requests])

  const requestIdsByNormalizedTitle = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const request of requests ?? []) {
      const key = normalizeTitle(request.title)
      if (!key) continue
      const rows = map.get(key) ?? []
      rows.push(request.id)
      map.set(key, rows)
    }
    return map
  }, [requests])

  const concreteEuropaceRequirements = useMemo(
    () =>
      isKonsum
        ? deriveConcreteUploadRequirements({
            requests,
            uploadTargets: europaceUploadTargets,
            documents: managedDocuments,
            europaceDocuments,
          })
        : [],
    [managedDocuments, europaceDocuments, europaceUploadTargets, isKonsum, requests]
  )
  const hasConcreteEuropaceRequirements = isKonsum && concreteEuropaceRequirements.length > 0

  const requestSourceRows = useMemo(() => {
    if (hasConcreteEuropaceRequirements) {
      return concreteEuropaceRequirements.map((requirement) => {
        const linkedDocumentIds = (managedDocuments ?? [])
          .filter((document) => {
            if (requirement.request_id && document.request_id === requirement.request_id) {
              return true
            }
            const mapping = europaceDocumentMap.get(document.id)
            return (
              Boolean(requirement.category_id) &&
              mapping?.category === requirement.category_id &&
              String(mapping?.assignment_id ?? "").trim() === String(requirement.assignment_id ?? "").trim()
            )
          })
          .map((document) => document.id)

        return {
          id: requirement.key,
          title: requirement.title,
          required: requirement.required,
          created_at: null,
          linkedRequestIds: requirement.request_id ? [requirement.request_id] : [],
          linkedDocumentIds,
          source: requirement.source === "request" ? ("local" as const) : ("europace" as const),
          requestTitle: requirement.title,
          hint:
            [requirement.category_name ?? requirement.category_id, requirement.assignment_role_name, requirement.assignment_name, requirement.category_description]
              .filter(Boolean)
              .join(" | ") || null,
          europaceCategory: requirement.category_id ?? null,
          europaceAssignmentId: requirement.assignment_id ?? null,
        }
      })
    }

    if (usesEuropaceTargets) {
      return (europaceUploadTargets ?? []).map((target) => {
        const normalizedTitle = normalizeTitle(target.title)
        const linkedRequestIds = normalizedTitle ? requestIdsByNormalizedTitle.get(normalizedTitle) ?? [] : []
        const categoryLabel = target.category_name ?? target.category_id
        const assignmentLabel =
          [target.assignment_role_name, target.assignment_name].filter(Boolean).join(" - ") ||
          target.assignment_name ||
          null

        return {
          id: target.key,
          title: target.title,
          required: true,
          created_at: null,
          linkedRequestIds,
          linkedDocumentIds: [],
          source: "europace" as const,
          requestTitle: target.title,
          hint: [categoryLabel, assignmentLabel, target.category_description].filter(Boolean).join(" | ") || null,
          europaceCategory: target.category_id,
          europaceAssignmentId: target.assignment_id ?? null,
        }
      })
    }

    return (requests ?? []).map((request) => ({
      id: request.id,
      title: request.title,
      required: request.required,
      created_at: request.created_at,
      linkedRequestIds: [request.id],
      linkedDocumentIds: [],
      source: "local" as const,
      requestTitle: request.title,
      hint: null,
      europaceCategory: null,
      europaceAssignmentId: null,
    }))
  }, [
    concreteEuropaceRequirements,
    managedDocuments,
    europaceDocumentMap,
    europaceUploadTargets,
    hasConcreteEuropaceRequirements,
    requestIdsByNormalizedTitle,
    requests,
    usesEuropaceTargets,
  ])

  const generalKeys = useMemo(
    () => (isBaufi ? [...STANDARD_GENERAL_KEYS, ...BAUFI_GENERAL_EXTRA_KEYS] : [...STANDARD_GENERAL_KEYS]),
    [isBaufi]
  )
  const objectKeys = useMemo(() => (isBaufi ? [...BAUFI_OBJECT_KEYS] : []), [isBaufi])

  function showFlash(tone: "success" | "error", text: string, autoHideMs = 2400) {
    setFlash({ tone, text })
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => {
      setFlash(null)
      flashTimerRef.current = null
    }, autoHideMs)
  }

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
    }
  }, [])

  const { generalRequests, objectRequests, otherRequests } = useMemo(() => {
    const general: RequestGroup[] = []
    const object: RequestGroup[] = []
    const other: RequestGroup[] = []
    const byDedupeKey = new Map<string, RequestGroup>()
    const nowIso = new Date().toISOString()
    const generalKeySet = new Set<CanonicalRequestKey>(generalKeys)
    const objectKeySet = new Set<CanonicalRequestKey>(objectKeys)
    const generalIndex = new Map(generalKeys.map((key, index) => [key, index] as const))
    const objectIndex = new Map(objectKeys.map((key, index) => [key, index] as const))

    function addToBucket(
      bucket: RequestGroup[],
      dedupeKey: string,
      request: RequestSourceRow,
      canonicalKey: CanonicalRequestKey | null,
      titleOverride?: string
    ) {
      const existing = byDedupeKey.get(dedupeKey)
      if (existing) {
        existing.required = existing.required || request.required
        for (const requestId of request.linkedRequestIds) {
          if (!existing.requestIds.includes(requestId)) existing.requestIds.push(requestId)
        }
        for (const documentId of request.linkedDocumentIds) {
          if (!existing.documentIds.includes(documentId)) existing.documentIds.push(documentId)
        }
        if (!existing.hint && request.hint) existing.hint = request.hint
        if (!existing.europaceCategory && request.europaceCategory) existing.europaceCategory = request.europaceCategory
        if (!existing.europaceAssignmentId && request.europaceAssignmentId) existing.europaceAssignmentId = request.europaceAssignmentId
        return
      }
      const group: RequestGroup = {
        id: request.id,
        dedupeKey,
        title: titleOverride ?? request.title,
        required: request.required,
        created_at: request.created_at,
        requestIds: [...request.linkedRequestIds],
        documentIds: [...request.linkedDocumentIds],
        canonicalKey,
        virtual: false,
        source: request.source,
        requestTitle: request.requestTitle,
        hint: request.hint,
        europaceCategory: request.europaceCategory,
        europaceAssignmentId: request.europaceAssignmentId,
      }
      bucket.push(group)
      byDedupeKey.set(dedupeKey, group)
    }

    for (const request of requestSourceRows) {
      const canonicalKey = classifyRequestTitle(request.title)
      const scopeKey = getEuropaceRequestScopeKey(request)
      if (!isBaufi && canonicalKey && BAUFI_ONLY_KEYS.has(canonicalKey)) {
        continue
      }
      if (canonicalKey && generalKeySet.has(canonicalKey)) {
        addToBucket(
          general,
          scopeKey ? `general:${canonicalKey}:${scopeKey}` : `general:${canonicalKey}`,
          request,
          canonicalKey,
          CANONICAL_TITLE_BY_KEY[canonicalKey]
        )
        continue
      }
      if (canonicalKey && objectKeySet.has(canonicalKey)) {
        addToBucket(
          object,
          scopeKey ? `object:${canonicalKey}:${scopeKey}` : `object:${canonicalKey}`,
          request,
          canonicalKey,
          CANONICAL_TITLE_BY_KEY[canonicalKey]
        )
        continue
      }
      const otherKey = normalizeTitle(request.title) || request.id
      addToBucket(other, scopeKey ? `other:${otherKey}:${scopeKey}` : `other:${otherKey}`, request, null)
    }

    if (!usesEuropaceTargets) {
      for (const key of generalKeys) {
        const dedupeKey = `general:${key}`
        if (!byDedupeKey.has(dedupeKey)) {
          const virtualGroup: RequestGroup = {
            id: `virtual-${dedupeKey}`,
            dedupeKey,
            title: CANONICAL_TITLE_BY_KEY[key],
            required: true,
            created_at: null,
            requestIds: [],
            documentIds: [],
            canonicalKey: key,
            virtual: true,
            source: "local",
            requestTitle: CANONICAL_TITLE_BY_KEY[key],
            hint: null,
            europaceCategory: null,
            europaceAssignmentId: null,
          }
          general.push(virtualGroup)
          byDedupeKey.set(dedupeKey, virtualGroup)
        }
      }

      for (const key of objectKeys) {
        const dedupeKey = `object:${key}`
        if (!byDedupeKey.has(dedupeKey)) {
          const virtualGroup: RequestGroup = {
            id: `virtual-${dedupeKey}`,
            dedupeKey,
            title: CANONICAL_TITLE_BY_KEY[key],
            required: true,
            created_at: null,
            requestIds: [],
            documentIds: [],
            canonicalKey: key,
            virtual: true,
            source: "local",
            requestTitle: CANONICAL_TITLE_BY_KEY[key],
            hint: null,
            europaceCategory: null,
            europaceAssignmentId: null,
          }
          object.push(virtualGroup)
          byDedupeKey.set(dedupeKey, virtualGroup)
        }
      }
    }

    general.sort((a, b) => {
      const aKey = a.canonicalKey
      const bKey = b.canonicalKey
      return (aKey ? generalIndex.get(aKey) ?? 999 : 999) - (bKey ? generalIndex.get(bKey) ?? 999 : 999)
    })
    object.sort((a, b) => {
      const aKey = a.canonicalKey
      const bKey = b.canonicalKey
      return (aKey ? objectIndex.get(aKey) ?? 999 : 999) - (bKey ? objectIndex.get(bKey) ?? 999 : 999)
    })
    other.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : new Date(nowIso).getTime()
      const bTime = b.created_at ? new Date(b.created_at).getTime() : new Date(nowIso).getTime()
      return aTime - bTime
    })

    return {
      generalRequests: general,
      objectRequests: object,
      otherRequests: other,
    }
  }, [generalKeys, isBaufi, objectKeys, requestSourceRows, usesEuropaceTargets])

  function uploaderLabel(d: DocumentRow) {
    if (!d.uploaded_by) return null
    if (caseCustomerId && d.uploaded_by === caseCustomerId) return "Kunde"
    if (caseAdvisorId && d.uploaded_by === caseAdvisorId) return "Berater"
    return "Team"
  }

  function renderDocGrid(list: DocumentRow[]) {
    if (!list.length) {
      return <div className="mt-2 text-xs text-slate-500">Noch keine Dateien hochgeladen.</div>
    }
    return (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((d) => {
          const europaceDocument = europaceDocumentMap.get(d.id) ?? null
          const skagDocument = skagDocumentMap.get(d.id) ?? null
          const uploadStatusLabel = translateEuropaceUploadStatus(europaceDocument?.upload_status)
          const releaseStatusLabel = translateEuropaceReleaseStatus(europaceDocument?.release_status)
          const syncLabel = hideTechnicalBranding ? "Uebertragung" : "Europace"
          const hasEuropaceState =
            Boolean(uploadStatusLabel) ||
            Boolean(releaseStatusLabel) ||
            Boolean(europaceDocument?.europace_document_id) ||
            Boolean(europaceDocument?.last_error)
          const skagStatusLabel = translateSkagUploadStatus(skagDocument?.upload_status)
          const hasSkagState = Boolean(skagStatusLabel) || Boolean(skagDocument?.last_error)

          return (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
              {d.mime_type?.startsWith("image/") ? (
                <button
                  type="button"
                  onClick={() => setImagePreview({ src: fileUrl(d.file_path), name: d.file_name })}
                  className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                  aria-label={`Vorschau öffnen: ${d.file_name}`}
                >
                  <img src={fileUrl(d.file_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">DOC</div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{d.file_name}</div>
                <div className="text-xs text-slate-500">
                  {formatBytes(d.size_bytes)} - {dt(d.created_at)}
                </div>
                {uploaderLabel(d) ? (
                  <div className="mt-1 text-[11px] text-slate-500">Von: {uploaderLabel(d)}</div>
                ) : null}
                {isKonsum ? (
                  <div className="mt-1 space-y-1">
                    {hasEuropaceState ? (
                      <>
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              String(europaceDocument?.upload_status ?? "").trim().toLowerCase() === "error"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {syncLabel}: {uploadStatusLabel ?? "unbekannt"}
                          </span>
                          {releaseStatusLabel ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Freigabe: {releaseStatusLabel}
                            </span>
                          ) : null}
                        </div>
                        {europaceDocument?.europace_document_id && !hideTechnicalBranding ? (
                          <div className="truncate text-[11px] text-slate-500">
                            Europace-ID: {europaceDocument.europace_document_id}
                          </div>
                        ) : null}
                        {europaceDocument?.last_error ? (
                          <div className="text-[11px] text-rose-600">{europaceDocument.last_error}</div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        {syncLabel}: {hideTechnicalBranding ? "wird vorbereitet" : "noch nicht synchronisiert"}
                      </div>
                    )}
                  </div>
                ) : null}
                {isSchufaFree ? (
                  <div className="mt-1 space-y-1">
                    {hasSkagState ? (
                      <>
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              String(skagDocument?.upload_status ?? "").trim().toLowerCase() === "error"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-cyan-100 text-cyan-800"
                            }`}
                          >
                            SKAG: {skagStatusLabel ?? "unbekannt"}
                          </span>
                        </div>
                        {skagDocument?.last_error ? (
                          <div className="text-[11px] text-rose-600">{skagDocument.last_error}</div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        SKAG: wird erst mit der manuellen Bankeinreichung übertragen
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="text-xs font-medium text-slate-700 hover:underline"
                  href={fileUrl(d.file_path, { download: true, filename: d.file_name })}
                  download={d.file_name}
                >
                  Download
                </a>
                <button
                  onClick={() => removeDoc(d.id)}
                  disabled={busy}
                  className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-60"
                >
                  Löschen
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderBankDocumentGrid(list: DocumentRow[]) {
    if (!list.length) return null
    return (
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((document) => (
          <div
            key={document.id}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              bankDocumentKindLabel(document.file_name) === "Kreditvertrag"
                ? "border-slate-900/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))]"
                : "border-emerald-200/80"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "text-slate-700" : "text-emerald-700"
                  }`}
                >
                  {bankDocumentKindLabel(document.file_name)}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{document.file_name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Automatisch vom Anbieter übernommen · {dt(document.created_at)}
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatBytes(document.size_bytes)}</div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                Nur zur Einsicht
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-semibold text-white shadow-sm ${
                  bankDocumentKindLabel(document.file_name) === "Kreditvertrag"
                    ? "bg-[linear-gradient(135deg,#0f172a,#0f766e)] shadow-[0_14px_30px_rgba(15,23,42,0.18)]"
                    : "bg-slate-900"
                }`}
                href={fileUrl(document.file_path)}
                target="_blank"
                rel="noreferrer"
              >
                {bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "Kreditvertrag öffnen" : "Öffnen"}
              </a>
              <a
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-900 shadow-sm"
                href={fileUrl(document.file_path, { download: true, filename: document.file_name })}
                download={document.file_name}
              >
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    )
  }

  async function rasterizeDocumentImage(doc: DocumentRow) {
    const response = await fetch(fileUrl(doc.file_path))
    if (!response.ok) {
      throw new Error(`"${doc.file_name}" konnte nicht geladen werden.`)
    }

    const sourceBlob = await response.blob()
    const objectUrl = URL.createObjectURL(sourceBlob)
    try {
      const image = await loadHtmlImage(objectUrl)
      const width = image.naturalWidth || image.width
      const height = image.naturalHeight || image.height
      if (!width || !height) throw new Error(`"${doc.file_name}" konnte nicht verarbeitet werden.`)

      const maxEdge = Math.max(width, height)
      const scale = maxEdge > PDF_IMAGE_MAX_EDGE ? PDF_IMAGE_MAX_EDGE / maxEdge : 1
      const targetWidth = Math.max(1, Math.round(width * scale))
      const targetHeight = Math.max(1, Math.round(height * scale))

      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("PDF konnte nicht erstellt werden.")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, targetWidth, targetHeight)
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

      const jpegBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", PDF_IMAGE_QUALITY)
      })
      if (!jpegBlob) throw new Error(`"${doc.file_name}" konnte nicht in PDF umgewandelt werden.`)

      return {
        bytes: new Uint8Array(await jpegBlob.arrayBuffer()),
        width: targetWidth,
        height: targetHeight,
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  async function convertRequestDocsToPdf(request: RequestGroup, list: DocumentRow[]) {
    const sortedList = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const imageDocs = sortedList.filter(isImageDocument)
    const skippedCount = sortedList.length - imageDocs.length

    if (!imageDocs.length) {
      showFlash("error", `Für "${request.title}" sind keine Bilddateien vorhanden.`)
      return
    }

    setMsg(null)
    setPdfBusyKey(request.dedupeKey)
    try {
      const pdfLib = await import("pdf-lib").catch(() => null)
      if (!pdfLib) throw new Error("PDF-Funktion ist aktuell nicht verfügbar.")
      const { PDFDocument } = pdfLib
      const pdfDoc = await PDFDocument.create()

      for (let index = 0; index < imageDocs.length; index += 1) {
        const doc = imageDocs[index]
        setPdfProgress({
          current: index + 1,
          total: imageDocs.length,
          fileName: doc.file_name,
          title: request.title,
        })
        const rasterized = await rasterizeDocumentImage(doc)
        const embedded = await pdfDoc.embedJpg(rasterized.bytes)
        const page = pdfDoc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
        const scale = Math.min(
          (PDF_PAGE_WIDTH - PDF_PAGE_MARGIN * 2) / rasterized.width,
          (PDF_PAGE_HEIGHT - PDF_PAGE_MARGIN * 2) / rasterized.height
        )
        const drawWidth = rasterized.width * scale
        const drawHeight = rasterized.height * scale
        page.drawImage(embedded, {
          x: (PDF_PAGE_WIDTH - drawWidth) / 2,
          y: (PDF_PAGE_HEIGHT - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        })
      }

      const pdfBytes = await pdfDoc.save()
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength)
      new Uint8Array(pdfBuffer).set(pdfBytes)
      const safeTitle = sanitizeFileNamePart(request.title) || "dokumente"
      const downloadName = `${safeTitle}-${caseId.slice(0, 8)}.pdf`
      downloadBlob(new Blob([pdfBuffer], { type: "application/pdf" }), downloadName)
      setMsg(`PDF für "${request.title}" wurde erstellt.`)
      showFlash(
        "success",
        skippedCount > 0
          ? `PDF erstellt. ${skippedCount} Datei(en) ohne Bild wurden übersprungen.`
          : `PDF für "${request.title}" erstellt.`
      )
    } catch (error: unknown) {
      const text = getErrorMessage(error)
      setMsg(text)
      showFlash("error", text, 3200)
    } finally {
      setPdfProgress(null)
      setPdfBusyKey(null)
    }
  }

  function renderRequestCard(r: RequestGroup) {
    const seenDocumentIds = new Set<string>()
    const docsFromRequests = r.requestIds.flatMap((requestId) => docsByRequest.get(requestId) ?? [])
    const docsFromMappings = r.documentIds
      .map((documentId) => documentById.get(documentId))
      .filter(Boolean) as DocumentRow[]
    const list = [...docsFromRequests, ...docsFromMappings].filter((document) => {
      if (seenDocumentIds.has(document.id)) return false
      seenDocumentIds.add(document.id)
      return true
    })
    const duplicateCount = Math.max(0, r.requestIds.length - 1)
    const uploadRequestId = r.requestIds[0] ?? null
    const imageCount = list.filter(isImageDocument).length
    return (
      <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">{r.title}</div>
            <div className="text-xs text-slate-500">
              {r.required ? "Pflicht" : "Optional"}
              {r.created_at ? ` - ${dt(r.created_at)}` : ""}
            </div>
            {duplicateCount > 0 ? (
              <div className="mt-1 text-[11px] text-slate-500">Zusammengefasst aus {duplicateCount + 1} gleichartigen Anforderungen</div>
            ) : null}
            {r.hint ? <div className="mt-1 text-[11px] text-slate-500">{r.hint}</div> : null}
            {r.virtual ? (
              <div className="mt-1 text-[11px] text-slate-500">
                {r.source === "europace"
                  ? hideTechnicalBranding
                    ? "Diese Anforderung wurde direkt aus der Antragsstrecke uebernommen."
                    : "Dieses Upload-Ziel kommt direkt aus Europace."
                  : "Diese Anforderung wird beim ersten Upload automatisch angelegt."}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canCreateRequest && imageCount > 0 ? (
              <button
                type="button"
                onClick={() => convertRequestDocsToPdf(r, list)}
                disabled={busy || pdfBusyKey === r.dedupeKey}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pdfBusyKey === r.dedupeKey ? "PDF wird erstellt..." : "In PDF umwandeln"}
              </button>
            ) : null}
            <label
              className={`rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm ${busy ? "cursor-not-allowed opacity-60" : ""}`}
            >
              Upload
              <input
                type="file"
                multiple
                accept={UPLOAD_ACCEPT}
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const files = e.target.files
                  if (files?.length) {
                    uploadFiles(files, {
                      requestId: uploadRequestId,
                      requestTitle: r.requestTitle,
                      europaceCategory: r.europaceCategory,
                      europaceAssignmentId: r.europaceAssignmentId,
                    })
                  }
                  e.currentTarget.value = ""
                }}
              />
            </label>
          </div>
        </div>

        {list.length ? renderDocGrid(list) : <div className="mt-2 text-xs text-slate-500">Noch nichts hochgeladen.</div>}
      </div>
    )
  }

  async function initDirectUpload(file: File, options: UploadOptions) {
    const res = await fetch("/api/app/documents/upload/direct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "init",
        caseId,
        requestId: options.requestId ?? null,
        requestTitle: options.requestTitle ?? null,
        keepUnassigned: Boolean(options.keepUnassigned),
        europaceCategory: options.europaceCategory ?? null,
        europaceAssignmentId: options.europaceAssignmentId ?? null,
        fileName: file.name || "upload",
        fileType: file.type || null,
        fileSize: Number(file.size || 0),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? "Upload konnte nicht vorbereitet werden."))
    const payload = json as Partial<DirectUploadInitResult>
    const path = String(payload.path ?? "").trim()
    const token = String(payload.token ?? "").trim()
    if (!path || !token) throw new Error("Upload konnte nicht vorbereitet werden.")
    return {
      path,
      token,
      request_id: payload.request_id ? String(payload.request_id) : null,
      file_name: String(payload.file_name ?? file.name ?? "upload"),
      mime_type: payload.mime_type ? String(payload.mime_type) : null,
      size_bytes: payload.size_bytes == null ? null : Number(payload.size_bytes),
    } as DirectUploadInitResult
  }

  async function completeDirectUpload(init: DirectUploadInitResult, options: UploadOptions) {
    const res = await fetch("/api/app/documents/upload/direct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        caseId,
        requestId: init.request_id ?? null,
        europaceCategory: options.europaceCategory ?? null,
        europaceAssignmentId: options.europaceAssignmentId ?? null,
        path: init.path,
        fileName: init.file_name,
        mimeType: init.mime_type ?? null,
        sizeBytes: init.size_bytes ?? null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? "Upload konnte nicht abgeschlossen werden."))
    return String(json?.request_id ?? init.request_id ?? "").trim() || null
  }

  async function uploadViaServerRoute(file: File, options: UploadOptions) {
    const form = new FormData()
    form.set("caseId", caseId)
    if (options.requestId) form.set("requestId", options.requestId)
    if (options.requestTitle) form.set("requestTitle", options.requestTitle)
    if (options.keepUnassigned) form.set("keepUnassigned", "1")
    if (options.europaceCategory) form.set("europaceCategory", options.europaceCategory)
    if (options.europaceAssignmentId) form.set("europaceAssignmentId", options.europaceAssignmentId)
    form.set("file", file)

    const res = await fetch("/api/app/documents/upload", {
      method: "POST",
      body: form,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? "Upload fehlgeschlagen"))
    return String(json?.request_id ?? options.requestId ?? "").trim() || null
  }

  async function uploadSingleFileWithRetry(
    file: File,
    options: UploadOptions,
    progress: { current: number; total: number; displayName: string }
  ) {
    const maxAttempts = 2
    let signedUploadError: unknown = null
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        setUploadProgress({
          current: progress.current,
          total: progress.total,
          fileName: progress.displayName,
          phase: attempt > 1 ? "retrying" : "uploading",
        })
        const init = await initDirectUpload(file, options)
        const supabase = createBrowserSupabaseClient()
        const contentType = init.mime_type || file.type || "application/octet-stream"
        const { error: storageErr } = await supabase.storage
          .from("case_documents")
          .uploadToSignedUrl(init.path, init.token, file, { contentType, upsert: false })
        if (storageErr) {
          const message = String(storageErr.message || "Upload fehlgeschlagen")
          if (attempt < maxAttempts && isRetryableUploadError(0, message)) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, UPLOAD_RETRY_DELAY_MS)
            })
            continue
          }
          throw new Error(message)
        }

        const completedRequestId = await completeDirectUpload(init, options)
        return completedRequestId
      } catch (error: unknown) {
        signedUploadError = error
        const message = getErrorMessage(error)
        if (attempt < maxAttempts && isRetryableUploadError(0, message)) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, UPLOAD_RETRY_DELAY_MS)
          })
          continue
        }
        break
      }
    }

    try {
      return await uploadViaServerRoute(file, options)
    } catch (fallbackError: unknown) {
      const fallbackMessage = getErrorMessage(fallbackError)
      if (signedUploadError && (!fallbackMessage || fallbackMessage === "Fehler" || /upload fehlgeschlagen/i.test(fallbackMessage))) {
        throw signedUploadError
      }
      throw fallbackError
    }
  }

  async function uploadFiles(files: FileList, options?: UploadOptions) {
    if (!files.length) return
    setMsg(null)
    setBusy(true)
    try {
      const selectedFiles = Array.from(files)
      const uploadOptions = options ?? {}
      for (const file of selectedFiles) {
        if (!isAllowedUploadFile(file)) {
          throw new Error(`"${file.name}" wird nicht unterstützt. Erlaubt sind PDF, DOC, DOCX und Bilder.`)
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`"${file.name}" ist zu gross. Maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei.`)
        }
      }

      let requestIdFinal = uploadOptions.requestId ?? null
      if (!requestIdFinal && uploadOptions.requestTitle && canCreateManualRequest) {
        const createRes = await fetch("/api/app/documents/requests", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ caseId, title: uploadOptions.requestTitle, required: true }),
        })
        const createJson = await createRes.json().catch(() => ({}))
        if (!createRes.ok) throw new Error(createJson?.error || "Dokumentanforderung konnte nicht angelegt werden")
        requestIdFinal = String(createJson?.id ?? "").trim() || null
      }

      let optimizedImages = 0
      let resolvedRequestId = requestIdFinal
      const uploadIntent: UploadOptions = {
        requestId: resolvedRequestId,
        requestTitle: uploadOptions.requestTitle,
        keepUnassigned: uploadOptions.keepUnassigned,
        europaceCategory: uploadOptions.europaceCategory,
        europaceAssignmentId: uploadOptions.europaceAssignmentId,
      }
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        setUploadProgress({
          current: index + 1,
          total: selectedFiles.length,
          fileName: file.name,
          phase: "preparing",
        })
        const preparedFile = await optimizeImageForMobileUpload(file)
        if (preparedFile !== file) optimizedImages += 1
        const resolved = await uploadSingleFileWithRetry(preparedFile, { ...uploadIntent, requestId: resolvedRequestId }, {
          current: index + 1,
          total: selectedFiles.length,
          displayName: file.name,
        })
        if (!resolvedRequestId && resolved) {
          resolvedRequestId = resolved
        }
      }
      setUploadProgress(null)
      setMsg(`${selectedFiles.length} Datei(en) hochgeladen.`)
      if (isMobileDevice()) {
        showFlash(
          "success",
          optimizedImages > 0
            ? `Erfolgreich hochgeladen (${optimizedImages} Foto(s) automatisch optimiert).`
            : "Erfolgreich hochgeladen."
        )
      }
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload()
      }, 1400)
    } catch (error: unknown) {
      const text = getErrorMessage(error)
      setUploadProgress(null)
      setMsg(text)
      showFlash("error", text, 3200)
    } finally {
      setBusy(false)
    }
  }

  async function removeDoc(id: string) {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/app/documents/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Löschen fehlgeschlagen")
      window.location.reload()
    } catch (error: unknown) {
      const text = getErrorMessage(error)
      setMsg(text)
      showFlash("error", text, 3200)
    } finally {
      setBusy(false)
    }
  }

  async function addRequest() {
    const t = title.trim()
    if (!t) return
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/app/documents/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, title: t, required }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Fehler")
      setTitle("")
      setRequired(true)
      window.location.reload()
    } catch (error: unknown) {
      const text = getErrorMessage(error)
      setMsg(text)
      showFlash("error", text, 3200)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {flash ? (
        <div className="fixed right-4 top-4 z-[70] max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
          <div className={flash.tone === "error" ? "text-rose-700" : "text-emerald-700"}>{flash.text}</div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-900">Dokumente</div>
        {canCreateRequest ? (
          <div className="text-xs text-slate-500">Berater / Admin</div>
        ) : (
          <div className="text-xs text-slate-500">Upload möglich</div>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">PDF, DOC, DOCX oder Bilder bis {formatBytes(MAX_UPLOAD_BYTES)} pro Datei.</div>
      {!isBaufi ? (
        <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {isKonsum
            ? hideTechnicalBranding
              ? "Neue Uploads werden direkt fuer deinen Antrag uebernommen. Den Uebertragungsstatus siehst du pro Datei."
              : "Neue Uploads werden zusaetzlich an Europace gespiegelt. Der Sync-Status wird pro Datei angezeigt."
            : "Neue Uploads werden direkt im SEPANA-Fall gespeichert und bei Schufa-frei anschließend im SEPANA-Prozess weiterverarbeitet. Den Status sehen Sie pro Datei."}
        </div>
      ) : null}

      {canCreateManualRequest ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_120px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neues Dokument anfordern"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
            />
            Pflicht
          </label>
          <button
            onClick={addRequest}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-60"
          >
            Hinzufuegen
          </button>
        </div>
      ) : null}

      {msg ? <div className="mt-2 text-xs text-slate-600">{msg}</div> : null}
      {uploadProgress ? (
        <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {uploadPhaseLabel(uploadProgress.phase)} ({uploadProgress.current}/{uploadProgress.total}): {uploadProgress.fileName}
        </div>
      ) : null}
      {pdfProgress ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          PDF wird erstellt für {pdfProgress.title} ({pdfProgress.current}/{pdfProgress.total}): {pdfProgress.fileName}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {bankDocuments.length ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.7),rgba(255,255,255,0.98))] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Bankunterlagen zur Einsicht</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  Kreditvertrag, Datenschutz und weitere Unterlagen des Anbieters liegen bereits im gemeinsamen Fall.
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-600">
                  Diese Dateien wurden automatisch aus der Bank übernommen und stehen identisch im Kunden- und Beraterfall bereit.
                </div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-xs text-slate-700 shadow-sm">
                {canCreateRequest
                  ? "Nächster Schritt: Kreditvertrag im Bereich Unterschriften als signierbare Version anlegen und Felder setzen."
                  : "Hinweis: Das ist zunächst die Vorschau der Bank. Dein Berater stellt dir den signierbaren Kreditvertrag danach separat bereit."}
              </div>
            </div>
            {documentPin ? (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">PIN für geschützte Dokumente</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      Falls die Bank beim Öffnen des Kreditvertrags oder von Datenschutzhinweisen nach einer PIN fragt, nutze bitte diesen Code.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold tracking-[0.22em] text-white">
                    {documentPin}
                  </div>
                </div>
              </div>
            ) : null}
            {renderBankDocumentGrid(bankDocuments)}
          </div>
        ) : null}

        {generalRequests.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">
              {isSchufaFree ? "Pflichtunterlagen" : "Allgemeine Unterlagen"}
            </div>
            <div className="mt-2 space-y-3">{generalRequests.map((r) => renderRequestCard(r))}</div>
          </div>
        ) : null}

        {isBaufi ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">Objektunterlagen</div>
            <div className="mt-1 text-xs text-slate-500">Nur bei Baufinanzierung.</div>
            {objectRequests.length ? <div className="mt-2 space-y-3">{objectRequests.map((r) => renderRequestCard(r))}</div> : null}
          </div>
        ) : null}

        {otherRequests.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">
              {isSchufaFree ? "Weitere Unterlagen und Rueckfragen" : "Weitere Unterlagen"}
            </div>
            <div className="mt-3 space-y-3">{otherRequests.map((r) => renderRequestCard(r))}</div>
          </div>
        ) : null}

        {generalRequests.length === 0 && objectRequests.length === 0 && otherRequests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {usesEuropaceTargets ? "Aktuell sind noch keine konkreten Unterlagen sichtbar." : "Noch keine Dokumente angefordert."}
          </div>
        ) : null}

        {orphanDocs.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-700">Nicht zugeordnet</div>
            <div className="mt-1 text-xs text-amber-800">
              Diese Dateien sind einer gelöschten oder nicht vorhandenen Anforderung zugeordnet.
            </div>
            {renderDocGrid(orphanDocs)}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-600">Allgemeines Upload</div>
            <button
              type="button"
              onClick={() => setFreeOpen((v) => !v)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
            >
              {freeOpen ? "Einklappen" : "Aufklappen"} ({(docsByRequest.get("free") ?? []).length} Dokumente)
            </button>
          </div>
          {freeOpen ? (
            <>
              <label className="mt-2 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
                Dateien hochladen
                <input
                  type="file"
                  multiple
                  accept={UPLOAD_ACCEPT}
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const files = e.target.files
                    if (files?.length) uploadFiles(files, { keepUnassigned: true })
                    e.currentTarget.value = ""
                  }}
                />
              </label>
              {renderDocGrid(docsByRequest.get("free") ?? [])}
            </>
          ) : null}
        </div>
      </div>

      {imagePreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setImagePreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Bildvorschau"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-medium text-slate-900">{imagePreview.name}</div>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
              >
                Schließen
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img src={imagePreview.src} alt={imagePreview.name} className="mx-auto h-auto max-h-[62vh] w-auto max-w-full rounded-lg" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}





