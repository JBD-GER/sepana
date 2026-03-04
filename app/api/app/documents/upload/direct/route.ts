export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(Object.keys(MIME_BY_EXT))
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(Object.values(MIME_BY_EXT))

type MinimalCaseAccessClient = {
  from: (
    table: string
  ) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown }>
      }
    }
  }
}

type CaseAccessRow = {
  customer_id?: string | null
  assigned_advisor_id?: string | null
}

type RequestRow = {
  id?: string | null
  title?: string | null
  required?: boolean | null
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

function inferMimeTypeFromMeta(fileName: string, fileType: string) {
  const explicit = String(fileType || "").trim().toLowerCase()
  if (explicit) return explicit
  const byExt = MIME_BY_EXT[fileExt(fileName)]
  return byExt || "application/octet-stream"
}

function isSupportedDocument(fileName: string, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime.startsWith("image/")) return true
  if (normalizedMime && ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMime)) return true
  return ALLOWED_DOCUMENT_EXTENSIONS.has(fileExt(fileName))
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

function classifyUploadError(message: string) {
  const normalized = String(message ?? "").toLowerCase()
  if (/payload too large|request entity too large|entity too large|file too large|too large/.test(normalized)) {
    return { status: 413, text: `Datei zu gross. Maximal ${Math.round(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))} MB erlaubt.` }
  }
  if (/mime|content.?type|unsupported|invalid file type|not supported/.test(normalized)) {
    return { status: 415, text: "Dateityp nicht unterstuetzt. Erlaubt sind PDF, DOC, DOCX und Bilder." }
  }
  return { status: 500, text: message || "Serverfehler" }
}

function resolveSiteOrigin(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fallback below
    }
  }
  return new URL(req.url).origin
}

async function canAccessCase(supabase: unknown, caseId: string, userId: string, role: string | null) {
  const client = supabase as MinimalCaseAccessClient
  const { data } = await client
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  const c = (data as CaseAccessRow | null) ?? null
  if (!c) return false
  if (role === "admin") return true
  if (role === "customer") return c.customer_id === userId
  if (role === "advisor") return c.assigned_advisor_id === userId
  return false
}

function extractRequestIds(rows: RequestRow[]) {
  return rows.map((r) => r.id ?? null).filter((id): id is string => Boolean(id))
}

async function findOpenRequestId(admin: ReturnType<typeof supabaseAdmin>, rows: RequestRow[]) {
  const reqIds = extractRequestIds(rows)
  if (!reqIds.length) return null

  const { data: existingDocs } = await admin.from("documents").select("request_id").in("request_id", reqIds)
  const existingRows = (existingDocs as Array<{ request_id?: string | null }> | null) ?? []
  const haveDocs = new Set(existingRows.map((d) => d.request_id ?? null).filter((id): id is string => Boolean(id)))

  const open = rows.filter((r) => (r.id ? !haveDocs.has(r.id) : false))
  const requiredOpen = open.filter((r) => r.required)
  return (requiredOpen[0] ?? open[0])?.id ?? null
}

async function notifyAdvisorAboutCustomerUpload(opts: {
  req: Request
  role: string | null
  userId: string
  caseId: string
  originalName: string
  requestIdFinal: string | null
}) {
  const eventMeta = await logCaseEvent({
    caseId: opts.caseId,
    actorId: opts.userId,
    actorRole: opts.role ?? "customer",
    type: "document_uploaded",
    title: "Dokument hochgeladen",
    body: `Datei: ${opts.originalName}`,
    meta: { file_name: opts.originalName, request_id: opts.requestIdFinal },
  })

  if (opts.role !== "customer") return

  const caseMeta = eventMeta ?? (await getCaseMeta(opts.caseId))
  if (!caseMeta?.advisor_email) return

  const caseLabel = caseMeta.case_ref ? ` (${caseMeta.case_ref})` : ""
  const origin = resolveSiteOrigin(opts.req)
  const html = buildEmailHtml({
    title: "Neues Dokument vom Kunden",
    intro: `Im Fall${caseLabel} wurde ein neues Dokument hochgeladen.`,
    steps: [`Datei: ${opts.originalName}`, "Bitte pruefen Sie das Dokument im Advisor-Dashboard."],
    ctaLabel: "Zum Advisor-Dashboard",
    ctaUrl: `${origin}/advisor`,
    eyebrow: "SEPANA - Dokumenten-Update",
    preheader: "Ein Kunde hat ein neues Dokument hochgeladen.",
  })
  void sendEmail({
    to: caseMeta.advisor_email,
    subject: "Neues Dokument im Kundenfall",
    html,
  }).catch(() => null)
}

export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const bodyRaw = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(bodyRaw.action ?? "").trim().toLowerCase()

    if (action === "init") {
      const caseId = String(bodyRaw.caseId ?? "").trim()
      const requestId = String(bodyRaw.requestId ?? "").trim() || null
      const requestTitle = String(bodyRaw.requestTitle ?? "").trim()
      const keepUnassigned = Boolean(bodyRaw.keepUnassigned)
      const fileNameRaw = String(bodyRaw.fileName ?? "").trim()
      const fileTypeRaw = String(bodyRaw.fileType ?? "").trim()
      const fileSizeParsed = Number(bodyRaw.fileSize ?? 0)
      const fileSize = Number.isFinite(fileSizeParsed) ? Math.max(0, Math.round(fileSizeParsed)) : 0

      if (!caseId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
      if (!fileSize) return NextResponse.json({ error: "Leere Datei" }, { status: 400 })
      if (fileSize > MAX_DOCUMENT_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `Datei zu gross. Maximal ${Math.round(MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024))} MB erlaubt.` },
          { status: 413 }
        )
      }

      const allowed = await canAccessCase(supabase, caseId, user.id, role)
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const fallbackExt = fileExt(fileNameRaw) || "bin"
      const fallbackName = `file.${fallbackExt}`
      const originalName = fileNameRaw || fallbackName
      const safeName = safeFileName(originalName)
      const mimeType = inferMimeTypeFromMeta(originalName, fileTypeRaw)
      if (!isSupportedDocument(originalName, mimeType)) {
        return NextResponse.json(
          { error: "Dateityp nicht unterstuetzt. Erlaubt sind PDF, DOC, DOCX und Bilder." },
          { status: 415 }
        )
      }

      const admin = supabaseAdmin()
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
        const target = normalizeRequestTitle(requestTitle)
        const rows = await loadRequestRows()
        const titleMatches = rows.filter((row) => normalizeRequestTitle(String(row.title ?? "")) === target)

        if (titleMatches.length) {
          requestIdFinal = (await findOpenRequestId(admin, titleMatches)) ?? titleMatches[0]?.id ?? null
        } else {
          const { data: createdReq, error: createReqErr } = await admin
            .from("document_requests")
            .insert({
              case_id: caseId,
              title: requestTitle,
              required: true,
              created_by: user.id,
            })
            .select("id")
            .single()
          if (!createReqErr) {
            requestIdFinal = (createdReq as { id?: string | null } | null)?.id ?? null
          }
        }
      }

      if (!requestIdFinal && !keepUnassigned) {
        const rows = await loadRequestRows()
        if (rows.length) {
          requestIdFinal = await findOpenRequestId(admin, rows)
        }
      }

      const path = `${caseId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`
      const sign = await admin.storage.from("case_documents").createSignedUploadUrl(path)
      if (sign.error) throw sign.error
      const token = String((sign.data as { token?: string } | null)?.token ?? "").trim()
      if (!token) throw new Error("Upload konnte nicht vorbereitet werden.")

      return NextResponse.json({
        ok: true,
        path,
        token,
        request_id: requestIdFinal,
        file_name: originalName,
        mime_type: mimeType,
        size_bytes: fileSize,
      })
    }

    if (action === "complete") {
      const caseId = String(bodyRaw.caseId ?? "").trim()
      const path = String(bodyRaw.path ?? "").trim()
      const requestId = String(bodyRaw.requestId ?? "").trim() || null
      const fileName = String(bodyRaw.fileName ?? "").trim()
      const mimeTypeRaw = String(bodyRaw.mimeType ?? "").trim().toLowerCase()
      const sizeParsed = Number(bodyRaw.sizeBytes ?? 0)
      const sizeBytes = Number.isFinite(sizeParsed) && sizeParsed > 0 ? Math.round(sizeParsed) : null

      if (!caseId || !path || !fileName) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
      if (!path.startsWith(`${caseId}/`)) {
        return NextResponse.json({ error: "Ungueltiger Upload-Pfad." }, { status: 400 })
      }

      const allowed = await canAccessCase(supabase, caseId, user.id, role)
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const admin = supabaseAdmin()

      if (requestId) {
        const { data: reqRow } = await admin
          .from("document_requests")
          .select("id")
          .eq("id", requestId)
          .eq("case_id", caseId)
          .maybeSingle()
        if (!reqRow) {
          return NextResponse.json({ error: "Dokumentanforderung nicht gefunden." }, { status: 400 })
        }
      }

      const { data: existingDoc } = await admin
        .from("documents")
        .select("id,request_id")
        .eq("case_id", caseId)
        .eq("file_path", path)
        .maybeSingle()
      if (existingDoc) {
        return NextResponse.json({ ok: true, request_id: existingDoc.request_id ?? requestId ?? null, already: true })
      }

      const info = await admin.storage.from("case_documents").info(path)
      if (info.error || !info.data) {
        return NextResponse.json({ error: "Datei wurde im Upload-Speicher nicht gefunden." }, { status: 400 })
      }

      const mimeType = mimeTypeRaw || inferMimeTypeFromMeta(fileName, "")
      const { error: docErr } = await admin.from("documents").insert({
        case_id: caseId,
        request_id: requestId,
        uploaded_by: user.id,
        file_path: path,
        file_name: fileName,
        mime_type: mimeType || null,
        size_bytes: sizeBytes,
      })
      if (docErr) throw docErr

      await notifyAdvisorAboutCustomerUpload({
        req,
        role,
        userId: user.id,
        caseId,
        originalName: fileName,
        requestIdFinal: requestId,
      })

      return NextResponse.json({ ok: true, request_id: requestId ?? null })
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 })
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e ?? "")
    const classified = classifyUploadError(raw)
    return NextResponse.json({ error: classified.text }, { status: classified.status })
  }
}

