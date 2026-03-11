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

function parseBoundedInt(raw: string | null, min: number, max: number) {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const v = Math.floor(n)
  if (v < min || v > max) return null
  return v
}

function parseResize(raw: string | null) {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (value === "cover" || value === "contain" || value === "fill") return value
  return null
}

function safeFileName(input: string | null) {
  const name = String(input ?? "").trim()
  if (!name) return "download"
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160) || "download"
}

function cacheControlForRequest(bucket: string, raw: boolean) {
  if (bucket === "logo_banken" && !raw) {
    return "public, max-age=31536000, s-maxage=31536000, immutable"
  }
  return "public, max-age=3600"
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const path = safePath(url.searchParams.get("path") || "")
  const bucket = url.searchParams.get("bucket") || "logo_banken"
  const download = url.searchParams.get("download") === "1"
  const raw = url.searchParams.get("raw") === "1" || download
  const width = parseBoundedInt(url.searchParams.get("width"), 16, 4096)
  const height = parseBoundedInt(url.searchParams.get("height"), 16, 4096)
  const quality = parseBoundedInt(url.searchParams.get("quality"), 20, 100)
  const resize = parseResize(url.searchParams.get("resize"))
  const filename = safeFileName(url.searchParams.get("filename"))

  if (!path) return NextResponse.json({ ok: false, error: "path fehlt" }, { status: 400 })

  const sb = supabaseAdmin()

  if (raw) {
    const { data, error } = await sb.storage.from(bucket).download(path)
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Datei nicht gefunden" }, { status: 404 })
    }
    const arrayBuffer = await data.arrayBuffer()
    const contentType = data.type || "application/octet-stream"
    const headers: Record<string, string> = {
      "content-type": contentType,
      "cache-control": cacheControlForRequest(bucket, raw),
    }
    if (download) {
      headers["content-disposition"] = `attachment; filename="${filename}"`
    }
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    })
  }

  const options: any = {}
  if (width || height || quality || resize) {
    options.transform = {
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(quality ? { quality } : {}),
      ...(resize ? { resize } : {}),
    }
  }

  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60, options)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Logo nicht gefunden" }, { status: 404 })
  }

  const upstream = await fetch(data.signedUrl, {
    headers: {
      accept: req.headers.get("accept") || "*/*",
    },
  })

  if (!upstream.ok) {
    return NextResponse.json({ ok: false, error: "Logo konnte nicht geladen werden" }, { status: upstream.status })
  }

  const headers = new Headers()
  headers.set("cache-control", cacheControlForRequest(bucket, raw))
  headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream")

  const contentLength = upstream.headers.get("content-length")
  if (contentLength) {
    headers.set("content-length", contentLength)
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  })
}

