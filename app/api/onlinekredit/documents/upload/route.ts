export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { syncLocalDocumentToEuropaceWithRetry } from "@/lib/europace/documents"
import { logCaseEvent } from "@/lib/notifications/notify"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(Object.keys(MIME_BY_EXT))
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(Object.values(MIME_BY_EXT))

type RequestRow = {
  id?: string | null
  title?: string | null
  required?: boolean | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function safeFileName(name: string) {
  return String(name || "").replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function fileExt(name: string) {
  const raw = String(name || "")
  const idx = raw.lastIndexOf(".")
  if (idx < 0) return ""
  return raw.slice(idx + 1).trim().toLowerCase()
}

function normalizeRequestTitle(value: string) {
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

function inferMimeType(file: File) {
  const explicit = String(file.type || "").trim().toLowerCase()
  if (explicit) return explicit
  const byExt = MIME_BY_EXT[fileExt(file.name)]
  return byExt || "application/octet-stream"
}

function isSupportedDocument(file: File, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime && ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMime)) return true
  return ALLOWED_DOCUMENT_EXTENSIONS.has(fileExt(file.name))
}

function classifyUploadError(message: string) {
  const normalized = String(message ?? "").toLowerCase()
  if (/payload too large|request entity too large|entity too large|file too large|too large/.test(normalized)) {
    return { status: 413, text: `Datei zu gross. Maximal ${Math.round(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))} MB erlaubt.` }
  }
  if (/mime|content.?type|unsupported|invalid file type|not supported/.test(normalized)) {
    return { status: 415, text: "Dateityp nicht unterstuetzt. Erlaubt sind PDF, JPG, PNG und TIFF." }
  }
  return { status: 500, text: message || "Serverfehler" }
}

function resolveSiteOrigin(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fall through
    }
  }
  return new URL(req.url).origin
}

function extractRequestIds(rows: RequestRow[]) {
  return rows.map((row) => row.id ?? null).filter((id): id is string => Boolean(id))
}

async function findOpenRequestId(admin: ReturnType<typeof supabaseAdmin>, rows: RequestRow[]) {
  const requestIds = extractRequestIds(rows)
  if (!requestIds.length) return null

  const { data: existingDocs } = await admin.from("documents").select("request_id").in("request_id", requestIds)
  const existingRows = (existingDocs as Array<{ request_id?: string | null }> | null) ?? []
  const occupiedIds = new Set(existingRows.map((row) => row.request_id ?? null).filter((id): id is string => Boolean(id)))

  const open = rows.filter((row) => (row.id ? !occupiedIds.has(row.id) : false))
  const requiredOpen = open.filter((row) => row.required)
  return (requiredOpen[0] ?? open[0])?.id ?? null
}

async function logPublicUploadEvent(opts: {
  caseId: string
  customerId: string | null
  originalName: string
  requestIdFinal: string | null
}) {
  await logCaseEvent({
    caseId: opts.caseId,
    actorId: opts.customerId,
    actorRole: "customer",
    type: "document_uploaded",
    title: "Dokument hochgeladen",
    body: `Datei: ${opts.originalName}`,
    meta: { file_name: opts.originalName, request_id: opts.requestIdFinal },
  })
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const caseId = String(form.get("caseId") || "").trim()
    const caseRef = String(form.get("caseRef") || "").trim()
    const accessToken = String(form.get("access") || "").trim()
    const requestId = String(form.get("requestId") || "").trim() || null
    const requestTitle = String(form.get("requestTitle") || "").trim()
    const europaceCategory = String(form.get("europaceCategory") || "").trim() || null
    const europaceAssignmentId = String(form.get("europaceAssignmentId") || "").trim() || null
    const keepUnassigned = String(form.get("keepUnassigned") || "").trim() === "1"
    const file = form.get("file")

    if (!caseId || !caseRef || !accessToken || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }
    if (!file.size) {
      return NextResponse.json({ error: "Leere Datei" }, { status: 400 })
    }
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Datei zu gross. Maximal ${Math.round(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))} MB erlaubt.` },
        { status: 413 }
      )
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "konsum",
    })

    if (!access.ok) {
      return NextResponse.json({ error: "Link ungueltig oder abgelaufen." }, { status: access.status })
    }

    const { data: europaceMeta } = await admin
      .from("case_europace")
      .select("vorgangsnummer,antragsnummer")
      .eq("case_id", caseId)
      .maybeSingle()

    if (!trimOrNull(europaceMeta?.vorgangsnummer) || !trimOrNull(europaceMeta?.antragsnummer)) {
      return NextResponse.json(
        { error: "Der Antrag ist noch nicht final angelegt. Bitte warte, bis die Bestaetigungsseite vollstaendig geladen ist." },
        { status: 409 }
      )
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
    const fallbackName = `file.${ext || "bin"}`
    const originalName = String(file.name || "").trim() || fallbackName
    const safeName = safeFileName(originalName)
    const mimeType = inferMimeType(file)

    if (!isSupportedDocument(file, mimeType)) {
      return NextResponse.json(
        { error: "Dateityp nicht unterstuetzt. Erlaubt sind PDF, JPG, PNG und TIFF." },
        { status: 415 }
      )
    }

    let requestIdFinal = requestId
    let requestRows: RequestRow[] = []
    let requestRowsLoaded = false

    async function loadRequestRows() {
      if (requestRowsLoaded) return requestRows
      const { data } = await admin
        .from("document_requests")
        .select("id,title,required,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
      requestRows = (data as RequestRow[] | null) ?? []
      requestRowsLoaded = true
      return requestRows
    }

    if (!requestIdFinal && requestTitle) {
      const targetTitle = normalizeRequestTitle(requestTitle)
      const rows = await loadRequestRows()
      const titleMatches = rows.filter((row) => normalizeRequestTitle(String(row.title ?? "")) === targetTitle)
      if (titleMatches.length) {
        requestIdFinal = (await findOpenRequestId(admin, titleMatches)) ?? titleMatches[0]?.id ?? null
      }
    }

    if (!requestIdFinal && !keepUnassigned) {
      const rows = await loadRequestRows()
      if (rows.length) {
        requestIdFinal = await findOpenRequestId(admin, rows)
      }
    }

    if (requestIdFinal) {
      const { data: requestRow } = await admin
        .from("document_requests")
        .select("id")
        .eq("id", requestIdFinal)
        .eq("case_id", caseId)
        .maybeSingle()
      if (!requestRow) {
        return NextResponse.json({ error: "Dokumentanforderung nicht gefunden." }, { status: 400 })
      }
    }

    const path = `${caseId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`
    const { error: uploadError } = await admin.storage.from("case_documents").upload(path, file, {
      upsert: false,
      contentType: mimeType,
    })
    if (uploadError) throw uploadError

    const { data: insertedDoc, error: docError } = await admin
      .from("documents")
      .insert({
        case_id: caseId,
        request_id: requestIdFinal,
        uploaded_by: access.caseRow.customer_id ?? null,
        file_path: path,
        file_name: originalName,
        mime_type: mimeType || null,
        size_bytes: file.size || null,
      })
      .select("id")
      .single()
    if (docError) throw docError

    const localDocumentId = trimOrNull((insertedDoc as { id?: string | null } | null)?.id)
    let europaceSync:
      | {
          attempted: boolean
          ok: boolean
          reason: string | null
          europaceDocumentId: string | null
        }
      | null = null

    if (localDocumentId) {
      europaceSync = await syncLocalDocumentToEuropaceWithRetry(
        admin,
        {
          caseId,
          localDocumentId,
          filePath: path,
          fileName: originalName,
          siteOrigin: resolveSiteOrigin(req),
          category: europaceCategory,
          assignmentId: europaceAssignmentId,
          antragsnummer: trimOrNull(europaceMeta?.antragsnummer),
        },
        {
          maxAttempts: 3,
          retryDelayMs: 600,
        }
      ).catch((error) => ({
        attempted: true,
        ok: false,
        reason: error instanceof Error ? error.message : "Europace-Unterlagensync fehlgeschlagen.",
        europaceDocumentId: null,
      }))
    }

    await logPublicUploadEvent({
      caseId,
      customerId: access.caseRow.customer_id ?? null,
      originalName,
      requestIdFinal,
    })

    return NextResponse.json({
      ok: true,
      path,
      request_id: requestIdFinal,
      europaceSync,
    })
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "")
    const classified = classifyUploadError(raw)
    return NextResponse.json({ error: classified.text }, { status: classified.status })
  }
}
