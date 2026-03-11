export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { RATGEBER_STORAGE_BUCKET, getRatgeberImageSrc, slugify } from "@/lib/ratgeber/utils"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

const MAX_HERO_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const FALLBACK_CONTENT_TYPE = "image/jpeg"
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

type UploadImageBody = {
  action?: unknown
  fileName?: unknown
  fileType?: unknown
  fileSize?: unknown
  path?: unknown
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120)
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getFileExtension(name: string) {
  const parts = name.toLowerCase().split(".")
  return parts.length > 1 ? parts.pop() ?? "" : ""
}

function resolveContentType(fileName: string, fileType: string) {
  const normalizedType = fileType.trim().toLowerCase()
  if (normalizedType === "image/jpg") return "image/jpeg"
  if (normalizedType.startsWith("image/")) return normalizedType
  const ext = getFileExtension(fileName)
  return ALLOWED_IMAGE_TYPES[ext] ?? FALLBACK_CONTENT_TYPE
}

function classifyUploadError(message: string) {
  const normalized = message.toLowerCase()
  if (/payload too large|request entity too large|entity too large|file too large|too large/.test(normalized)) {
    return { status: 413, error: "Das Bild ist zu gross. Bitte eine Datei unter 10 MB hochladen." }
  }
  if (/mime|content.?type|unsupported|invalid file type|not supported/.test(normalized)) {
    return { status: 415, error: "Nur Bilddateien wie JPG, PNG, WebP oder GIF sind erlaubt." }
  }
  if (/bucket.*not found/.test(normalized) || /website_media/.test(normalized)) {
    return { status: 500, error: "Der Storage-Bucket `website_media` fehlt oder ist nicht erreichbar." }
  }
  return { status: 500, error: message || "Serverfehler" }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const slug = slugify(url.searchParams.get("slug") || "ratgeber")
    const body = (await req.json().catch(() => ({}))) as UploadImageBody
    const action = asString(body.action).toLowerCase()

    if (action === "init") {
      const fileName = asString(body.fileName)
      const fileType = asString(body.fileType)
      const fileSize = Number(body.fileSize ?? 0)

      if (!fileName) {
        return NextResponse.json({ ok: false, error: "Dateiname fehlt." }, { status: 400 })
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        return NextResponse.json({ ok: false, error: "Die Bilddatei ist leer." }, { status: 400 })
      }
      if (fileSize > MAX_HERO_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Das Bild ist zu gross. Bitte eine Datei unter 10 MB hochladen." },
          { status: 413 },
        )
      }

      const ext = getFileExtension(fileName) || "jpg"
      const contentType = resolveContentType(fileName, fileType)
      if (!contentType.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "Nur Bilddateien wie JPG, PNG, WebP oder GIF sind erlaubt." },
          { status: 400 },
        )
      }

      const path = `ratgeber/${slug}/${Date.now()}_${safeFileName(fileName || `hero.${ext}`)}`
      const admin = supabaseAdmin()
      const signed = await admin.storage.from(RATGEBER_STORAGE_BUCKET).createSignedUploadUrl(path)
      if (signed.error) throw signed.error

      const token = asString((signed.data as { token?: string } | null)?.token)
      if (!token) {
        throw new Error("Upload konnte nicht vorbereitet werden.")
      }

      return NextResponse.json({
        ok: true,
        path,
        token,
        contentType,
      })
    }

    if (action === "complete") {
      const path = asString(body.path)
      if (!path) {
        return NextResponse.json({ ok: false, error: "Upload-Pfad fehlt." }, { status: 400 })
      }

      const admin = supabaseAdmin()
      const info = await admin.storage.from(RATGEBER_STORAGE_BUCKET).info(path)
      if (info.error || !info.data) {
        return NextResponse.json({ ok: false, error: "Datei wurde im Upload-Speicher nicht gefunden." }, { status: 400 })
      }

      return NextResponse.json({ ok: true, path, previewUrl: getRatgeberImageSrc(path) })
    }

    return NextResponse.json({ ok: false, error: "Ungueltige Upload-Aktion." }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    const classified = classifyUploadError(message)
    return NextResponse.json({ ok: false, error: classified.error }, { status: classified.status })
  }
}
