// app/api/app/documents/upload/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

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

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(Object.keys(MIME_BY_EXT))
const ALLOWED_DOCUMENT_MIME_TYPES = new Set(Object.values(MIME_BY_EXT))

function isSupportedDocument(file: File, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime.startsWith("image/")) return true
  if (normalizedMime && ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMime)) return true
  return ALLOWED_DOCUMENT_EXTENSIONS.has(fileExt(file.name))
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

export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const form = await req.formData()
    const caseId = String(form.get("caseId") || "")
    const requestId = String(form.get("requestId") || "").trim() || null
    const requestTitle = String(form.get("requestTitle") || "").trim()
    const keepUnassigned = String(form.get("keepUnassigned") || "").trim() === "1"
    const file = form.get("file")
    if (!caseId || !(file instanceof File)) {
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

    const allowed = await canAccessCase(supabase, caseId, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
    const fallbackName = `file.${ext || "bin"}`
    const originalName = String(file.name || "").trim() || fallbackName
    const safeName = safeFileName(originalName)
    const path = `${caseId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`
    const mimeType = inferMimeType(file)
    if (!isSupportedDocument(file, mimeType)) {
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
    const { error: upErr } = await admin.storage.from("case_documents").upload(path, file, {
      upsert: false,
      contentType: mimeType,
    })
    if (upErr) throw upErr

    const { error: docErr } = await admin.from("documents").insert({
      case_id: caseId,
      request_id: requestIdFinal,
      uploaded_by: user.id,
      file_path: path,
      file_name: originalName,
      mime_type: mimeType || null,
      size_bytes: file.size || null,
    })
    if (docErr) throw docErr

    const eventMeta = await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "document_uploaded",
      title: "Dokument hochgeladen",
      body: `Datei: ${originalName}`,
      meta: { file_name: originalName, request_id: requestIdFinal },
    })

    if (role === "customer") {
      const caseMeta = eventMeta ?? (await getCaseMeta(caseId))
      if (caseMeta?.advisor_email) {
        const caseLabel = caseMeta.case_ref ? ` (${caseMeta.case_ref})` : ""
        const origin = resolveSiteOrigin(req)
        const html = buildEmailHtml({
          title: "Neues Dokument vom Kunden",
          intro: `Im Fall${caseLabel} wurde ein neues Dokument hochgeladen.`,
          steps: [`Datei: ${originalName}`, "Bitte pruefen Sie das Dokument im Advisor-Dashboard."],
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
    }

    return NextResponse.json({ ok: true, path, request_id: requestIdFinal })
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e ?? "")
    const classified = classifyUploadError(raw)
    return NextResponse.json({ error: classified.text }, { status: classified.status })
  }
}
