import { NextResponse } from "next/server"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { syncLocalDocumentToSkag } from "@/lib/skag/sync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

type RequestRow = {
  id?: string | null
  title?: string | null
  required?: boolean | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function fileExt(name: string) {
  const index = String(name ?? "").lastIndexOf(".")
  if (index < 0) return ""
  return String(name).slice(index + 1).trim().toLowerCase()
}

function safeFileName(name: string) {
  return String(name ?? "").replace(/[^\w.-]+/g, "_").slice(0, 160)
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
  const explicit = String(file.type ?? "").trim().toLowerCase()
  if (explicit) return explicit
  return MIME_BY_EXT[fileExt(file.name)] || "application/octet-stream"
}

function isSupportedDocument(file: File, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime.startsWith("image/")) return true
  if (Object.values(MIME_BY_EXT).includes(normalizedMime)) return true
  return Object.prototype.hasOwnProperty.call(MIME_BY_EXT, fileExt(file.name))
}

async function findOpenRequestId(admin: ReturnType<typeof supabaseAdmin>, rows: RequestRow[]) {
  const requestIds = rows.map((row) => row.id ?? null).filter((entry): entry is string => Boolean(entry))
  if (!requestIds.length) return null

  const { data: documents } = await admin.from("documents").select("request_id").in("request_id", requestIds)
  const occupied = new Set(
    ((documents as Array<{ request_id?: string | null }> | null) ?? [])
      .map((row) => row.request_id ?? null)
      .filter((entry): entry is string => Boolean(entry))
  )

  const open = rows.filter((row) => row.id && !occupied.has(row.id))
  const requiredOpen = open.filter((row) => row.required)
  return (requiredOpen[0] ?? open[0])?.id ?? null
}

async function notifyAdvisor(req: Request, caseId: string, fileName: string, requestId: string | null, customerId: string | null) {
  const eventMeta = await logCaseEvent({
    caseId,
    actorId: customerId,
    actorRole: "customer",
    type: "document_uploaded",
    title: "Dokument hochgeladen",
    body: `Datei: ${fileName}`,
    meta: { file_name: fileName, request_id: requestId },
  })

  const caseMeta = eventMeta ?? (await getCaseMeta(caseId))
  if (!caseMeta?.advisor_email) return

  const origin = (() => {
    const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
    if (!configured) return new URL(req.url).origin
    try {
      return new URL(configured).origin
    } catch {
      return new URL(req.url).origin
    }
  })()

  const html = buildEmailHtml({
    title: "Neues Dokument vom Kunden",
    intro: `Im Fall ${caseMeta.case_ref ?? caseId} wurde ein neues Dokument hochgeladen.`,
    steps: [`Datei: ${fileName}`, "Bitte pruefen Sie den Fall im Advisor-Portal."],
    ctaLabel: "Zum Advisor-Portal",
    ctaUrl: `${origin}/advisor/faelle/${caseId}`,
    eyebrow: "SEPANA - Dokumentenupdate",
  })

  await sendEmail({
    to: caseMeta.advisor_email,
    subject: "Neues Dokument im Fall",
    html,
  }).catch(() => null)
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const caseId = trimOrNull(form.get("caseId"))
    const caseRef = trimOrNull(form.get("caseRef"))
    const accessToken = trimOrNull(form.get("access"))
    const requestId = trimOrNull(form.get("requestId"))
    const requestTitle = trimOrNull(form.get("requestTitle"))
    const keepUnassigned = trimOrNull(form.get("keepUnassigned")) === "1"
    const file = form.get("file")

    if (!caseId || !caseRef || !accessToken || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Fehlende Felder." }, { status: 400 })
    }
    if (!file.size) {
      return NextResponse.json({ ok: false, error: "Leere Datei." }, { status: 400 })
    }
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Datei ist zu gross." }, { status: 413 })
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "schufa_frei",
    })
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "Link ungueltig oder abgelaufen." }, { status: access.status })
    }

    const mimeType = inferMimeType(file)
    if (!isSupportedDocument(file, mimeType)) {
      return NextResponse.json({ ok: false, error: "Dateityp nicht unterstuetzt." }, { status: 415 })
    }

    let requestIdFinal = requestId
    if (!requestIdFinal && requestTitle) {
      const { data: requestRows } = await admin
        .from("document_requests")
        .select("id,title,required,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })

      const rows = (requestRows as RequestRow[] | null) ?? []
      const target = normalizeRequestTitle(requestTitle)
      const matches = rows.filter((row) => normalizeRequestTitle(String(row.title ?? "")) === target)

      if (matches.length) {
        requestIdFinal = (await findOpenRequestId(admin, matches)) ?? matches[0]?.id ?? null
      } else {
        const created = await admin
          .from("document_requests")
          .insert({
            case_id: caseId,
            title: requestTitle,
            required: true,
            created_by: access.caseRow.customer_id ?? null,
          })
          .select("id")
          .single()
        requestIdFinal = trimOrNull(created.data?.id)
      }
    }

    if (!requestIdFinal && !keepUnassigned) {
      const { data: requestRows } = await admin
        .from("document_requests")
        .select("id,title,required,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
      const rows = (requestRows as RequestRow[] | null) ?? []
      if (rows.length) requestIdFinal = await findOpenRequestId(admin, rows)
    }

    const originalName = trimOrNull(file.name) ?? "upload.bin"
    const path = `${caseId}/${Date.now()}_${crypto.randomUUID()}_${safeFileName(originalName)}`

    const upload = await admin.storage.from("case_documents").upload(path, file, {
      upsert: false,
      contentType: mimeType,
    })
    if (upload.error) throw upload.error

    const inserted = await admin
      .from("documents")
      .insert({
        case_id: caseId,
        request_id: requestIdFinal,
        uploaded_by: access.caseRow.customer_id ?? null,
        file_path: path,
        file_name: originalName,
        mime_type: mimeType,
        size_bytes: file.size,
      })
      .select("id")
      .single()
    if (inserted.error) throw inserted.error

    const localDocumentId = trimOrNull(inserted.data?.id)
    const skagSync =
      localDocumentId
        ? await syncLocalDocumentToSkag(admin, {
            caseId,
            localDocumentId,
            filePath: path,
            fileName: originalName,
          })
        : { attempted: false, ok: false, reason: "missing_local_document_id" }

    await notifyAdvisor(req, caseId, originalName, requestIdFinal, access.caseRow.customer_id ?? null)

    return NextResponse.json({
      ok: true,
      requestId: requestIdFinal,
      skagSync,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
