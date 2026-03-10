export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { RATGEBER_STORAGE_BUCKET, getRatgeberImageSrc, slugify } from "@/lib/ratgeber/utils"

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120)
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

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg"
    const path = `ratgeber/${slug}/${Date.now()}_${safeFileName(file.name || `hero.${ext}`)}`

    const admin = supabaseAdmin()
    const { error } = await admin.storage
      .from(RATGEBER_STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" })

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
        { ok: false, error: "Das Bild ist zu gross. Bitte eine Datei unter 30 MB hochladen." },
        { status: 413 },
      )
    }

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
