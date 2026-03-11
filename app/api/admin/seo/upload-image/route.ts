export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { RATGEBER_STORAGE_BUCKET, getRatgeberImageSrc, slugify } from "@/lib/ratgeber/utils"

const FALLBACK_CONTENT_TYPE = "image/jpeg"
const MAX_HERO_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120)
}

function getFileExtension(name: string) {
  const parts = name.toLowerCase().split(".")
  return parts.length > 1 ? parts.pop() ?? "" : ""
}

function resolveContentType(file: File, ext: string) {
  const normalizedType = file.type.trim().toLowerCase()
  if (normalizedType === "image/jpg") return "image/jpeg"
  if (normalizedType.startsWith("image/")) return normalizedType
  return ALLOWED_IMAGE_TYPES[ext] ?? FALLBACK_CONTENT_TYPE
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const slug = slugify(url.searchParams.get("slug") || "ratgeber")
    const form = await req.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Datei fehlt." }, { status: 400 })
    }

    if (file.size > MAX_HERO_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Das Bild ist zu gross. Bitte eine Datei unter 4 MB hochladen." },
        { status: 413 },
      )
    }

    const ext = getFileExtension(file.name) || "jpg"
    const contentType = resolveContentType(file, ext)
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "Nur Bilddateien wie JPG, PNG, WebP oder GIF sind erlaubt." },
        { status: 400 },
      )
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength === 0) {
      return NextResponse.json({ ok: false, error: "Die Bilddatei ist leer." }, { status: 400 })
    }

    const path = `ratgeber/${slug}/${Date.now()}_${safeFileName(file.name || `hero.${ext}`)}`

    const admin = supabaseAdmin()
    const { error } = await admin.storage
      .from(RATGEBER_STORAGE_BUCKET)
      .upload(path, Buffer.from(bytes), { upsert: true, contentType })

    if (error) throw error

    return NextResponse.json({ ok: true, path, previewUrl: getRatgeberImageSrc(path) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    if (
      /Failed to parse body as FormData/i.test(message) ||
      /request body exceeded/i.test(message) ||
      /10MB/i.test(message)
    ) {
      return NextResponse.json(
        { ok: false, error: "Das Bild ist zu gross. Bitte eine Datei unter 4 MB hochladen." },
        { status: 413 },
      )
    }

    if (/bucket.*not found/i.test(message) || /website_media/i.test(message)) {
      return NextResponse.json(
        { ok: false, error: "Der Storage-Bucket `website_media` fehlt oder ist nicht erreichbar." },
        { status: 500 },
      )
    }

    if (/mime|content type|invalid/i.test(message)) {
      return NextResponse.json(
        { ok: false, error: "Der Upload wurde vom Storage abgelehnt. Bitte JPG, PNG oder WebP verwenden." },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
