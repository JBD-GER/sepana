// app/api/baufi/logo/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function safePath(input: string) {
  const p = input.trim().replace(/^\/+/, "")
  if (!p) return null
  if (p.includes("..")) return null
  return p
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const path = safePath(url.searchParams.get("path") || "")
  const bucket = url.searchParams.get("bucket") || "logo_banken"
  const raw = url.searchParams.get("raw") === "1"

  if (!path) return NextResponse.json({ ok: false, error: "path fehlt" }, { status: 400 })

  const sb = supabaseAdmin()

  if (raw) {
    const { data, error } = await sb.storage.from(bucket).download(path)
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Datei nicht gefunden" }, { status: 404 })
    }
    const arrayBuffer = await data.arrayBuffer()
    const contentType = data.type || "application/octet-stream"
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
    })
  }

  // 1 Stunde gültig
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Logo nicht gefunden" }, { status: 404 })
  }

  // Redirect auf Signed URL (Next/Image oder <img> kann das laden)
  return NextResponse.redirect(data.signedUrl, 302)
}
