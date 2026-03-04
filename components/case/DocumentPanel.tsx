"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

const UPLOAD_ACCEPT = "image/*,.pdf,.doc,.docx"
const MOBILE_IMAGE_MAX_BYTES = 4 * 1024 * 1024
const MOBILE_IMAGE_MAX_EDGE = 2200
const MOBILE_IMAGE_QUALITY = 0.85
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
  general_id_passport: "Personalausweis / Reisepass (Vorder- & Rueckseite)",
  general_registration: "Meldebescheinigung",
  general_salary_slips_3: "Letzte 3 Gehaltsabrechnungen",
  general_bank_statements_salary_3m: "Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)",
  equity_proof: "Eigenkapital-Nachweis (aktueller Kontoauszug)",
  object_expose: "Expose / Objektbeschreibung",
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

type RequestGroup = {
  id: string
  dedupeKey: string
  title: string
  required: boolean
  created_at: string | null
  requestIds: string[]
  canonicalKey: CanonicalRequestKey | null
  virtual: boolean
}

type UploadPhase = "preparing" | "uploading" | "retrying"

type UploadProgressState = {
  current: number
  total: number
  fileName: string
  phase: UploadPhase
}

type UploadOptions = {
  requestId?: string | null
  requestTitle?: string | null
  keepUnassigned?: boolean
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
  if (!n || Number.isNaN(n)) return "—"
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
  return "Upload laeuft"
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

export default function DocumentPanel({
  caseId,
  requests,
  documents,
  caseType,
  canCreateRequest,
  caseCustomerId,
  caseAdvisorId,
}: {
  caseId: string
  requests: DocRequest[]
  documents: DocumentRow[]
  caseType?: string | null
  canCreateRequest: boolean
  caseCustomerId?: string | null
  caseAdvisorId?: string | null
}) {
  const [title, setTitle] = useState("")
  const [required, setRequired] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [freeOpen, setFreeOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  const reloadTimerRef = useRef<number | null>(null)
  const normalizedCaseType = String(caseType ?? "").trim().toLowerCase()
  const isBaufi = normalizedCaseType !== "konsum"

  const { docsByRequest, orphanDocs } = useMemo(() => {
    const map = new Map<string, DocumentRow[]>()
    const requestIds = new Set((requests ?? []).map((r) => r.id))
    const orphans: DocumentRow[] = []
    for (const d of documents ?? []) {
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
  }, [documents, requests])

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
      request: DocRequest,
      canonicalKey: CanonicalRequestKey | null,
      titleOverride?: string
    ) {
      const existing = byDedupeKey.get(dedupeKey)
      if (existing) {
        existing.required = existing.required || request.required
        if (!existing.requestIds.includes(request.id)) existing.requestIds.push(request.id)
        return
      }
      const group: RequestGroup = {
        id: request.id,
        dedupeKey,
        title: titleOverride ?? request.title,
        required: request.required,
        created_at: request.created_at,
        requestIds: [request.id],
        canonicalKey,
        virtual: false,
      }
      bucket.push(group)
      byDedupeKey.set(dedupeKey, group)
    }

    for (const request of requests ?? []) {
      const canonicalKey = classifyRequestTitle(request.title)
      if (!isBaufi && canonicalKey && BAUFI_ONLY_KEYS.has(canonicalKey)) {
        continue
      }
      if (canonicalKey && generalKeySet.has(canonicalKey)) {
        addToBucket(general, `general:${canonicalKey}`, request, canonicalKey, CANONICAL_TITLE_BY_KEY[canonicalKey])
        continue
      }
      if (canonicalKey && objectKeySet.has(canonicalKey)) {
        addToBucket(object, `object:${canonicalKey}`, request, canonicalKey, CANONICAL_TITLE_BY_KEY[canonicalKey])
        continue
      }
      const otherKey = normalizeTitle(request.title) || request.id
      addToBucket(other, `other:${otherKey}`, request, null)
    }

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
          canonicalKey: key,
          virtual: true,
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
          canonicalKey: key,
          virtual: true,
        }
        object.push(virtualGroup)
        byDedupeKey.set(dedupeKey, virtualGroup)
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
  }, [generalKeys, isBaufi, objectKeys, requests])

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
        {list.map((d) => (
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
                Loeschen
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderRequestCard(r: RequestGroup) {
    const list = r.requestIds.flatMap((requestId) => docsByRequest.get(requestId) ?? [])
    const duplicateCount = Math.max(0, r.requestIds.length - 1)
    const uploadRequestId = r.requestIds[0] ?? null
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
            {r.virtual ? (
              <div className="mt-1 text-[11px] text-slate-500">
                Diese Anforderung wird beim ersten Upload automatisch angelegt.
              </div>
            ) : null}
          </div>
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
                    requestTitle: r.title,
                  })
                }
                e.currentTarget.value = ""
              }}
            />
          </label>
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

  async function completeDirectUpload(init: DirectUploadInitResult) {
    const res = await fetch("/api/app/documents/upload/direct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        caseId,
        requestId: init.request_id ?? null,
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

        const completedRequestId = await completeDirectUpload(init)
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
          throw new Error(`"${file.name}" wird nicht unterstuetzt. Erlaubt sind PDF, DOC, DOCX und Bilder.`)
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`"${file.name}" ist zu gross. Maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei.`)
        }
      }

      let requestIdFinal = uploadOptions.requestId ?? null
      if (!requestIdFinal && uploadOptions.requestTitle && canCreateRequest) {
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
      if (!res.ok) throw new Error(json?.error || "Loeschen fehlgeschlagen")
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
          <div className="text-xs text-slate-500">Upload moeglich</div>
        )}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">PDF, DOC, DOCX oder Bilder bis {formatBytes(MAX_UPLOAD_BYTES)} pro Datei.</div>

      {canCreateRequest ? (
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

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">Allgemeine Unterlagen</div>
          {generalRequests.length ? <div className="mt-2 space-y-3">{generalRequests.map((r) => renderRequestCard(r))}</div> : null}
        </div>

        {isBaufi ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">Objektunterlagen</div>
            <div className="mt-1 text-xs text-slate-500">Nur bei Baufinanzierung.</div>
            {objectRequests.length ? <div className="mt-2 space-y-3">{objectRequests.map((r) => renderRequestCard(r))}</div> : null}
          </div>
        ) : null}

        {otherRequests.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-600">Weitere Unterlagen</div>
            <div className="mt-3 space-y-3">{otherRequests.map((r) => renderRequestCard(r))}</div>
          </div>
        ) : null}

        {generalRequests.length === 0 && objectRequests.length === 0 && otherRequests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Noch keine Dokumente angefordert.
          </div>
        ) : null}

        {orphanDocs.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-700">Nicht zugeordnet</div>
            <div className="mt-1 text-xs text-amber-800">
              Diese Dateien sind einer geloeschten oder nicht vorhandenen Anforderung zugeordnet.
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


