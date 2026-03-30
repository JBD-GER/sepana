export const runtime = "nodejs"

import { NextResponse } from "next/server"

const ALLOWED_HOSTS = new Set(["www.europace2.de", "europace2.de"])

function parseRemoteUrl(raw: string | null) {
  const value = String(raw ?? "").trim()
  if (!value) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== "https:") return null
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null
  if (!url.pathname.startsWith("/produktanbieter-logos/")) return null

  return url
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const remoteUrl = parseRemoteUrl(requestUrl.searchParams.get("url"))

  if (!remoteUrl) {
    return NextResponse.json({ ok: false, error: "ungueltige logo url" }, { status: 400 })
  }

  const upstream = await fetch(remoteUrl, {
    headers: {
      accept: req.headers.get("accept") || "image/*,*/*;q=0.8",
    },
    cache: "force-cache",
  })

  if (!upstream.ok) {
    return NextResponse.json({ ok: false, error: "Logo konnte nicht geladen werden" }, { status: upstream.status })
  }

  const headers = new Headers()
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800")
  headers.set("content-type", upstream.headers.get("content-type") || "image/svg+xml")

  const contentLength = upstream.headers.get("content-length")
  if (contentLength) {
    headers.set("content-length", contentLength)
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  })
}
