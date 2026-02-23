export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { safeFileName } from "@/lib/tippgeber/service"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const userId = url.searchParams.get("userId") || ""
    const tempId = url.searchParams.get("tempId") || ""
    if (!userId && !tempId) {
      return NextResponse.json({ ok: false, error: "Missing userId/tempId" }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 })
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png"
    const baseName = safeFileName(file.name || `logo.${ext}`)
    const base = userId ? userId : `temp/${tempId}`
    const path = `${base}/${Date.now()}_${baseName}`

    const admin = supabaseAdmin()
    const { error } = await admin.storage
      .from("tipgeber_logos")
      .upload(path, file, { upsert: true, contentType: file.type || "image/png" })
    if (error) throw error

    return NextResponse.json({ ok: true, path })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
