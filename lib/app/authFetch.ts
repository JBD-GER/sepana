// lib/app/authFetch.ts
import { cookies, headers } from "next/headers"

function serializeCookies(all: Array<{ name: string; value: string }>) {
  return all.map((c) => `${c.name}=${c.value}`).join("; ")
}

export async function getBaseUrl() {
  const h = await headers()

  const rawHost =
    h.get("x-forwarded-host") ||
    h.get("host") ||
    "localhost:3000"

  // manche Proxies liefern "host, host2"
  const host = rawHost.split(",")[0].trim()

  const rawProto = h.get("x-forwarded-proto") || "http"
  const proto = rawProto.split(",")[0].trim()

  return `${proto}://${host}`
}

/**
 * Server-Fetch auf interne API-Endpunkte (same app) inkl. Cookie-Forwarding.
 * -> interne APIs können Session stabil erkennen.
 */
export async function authFetch(path: string, init?: RequestInit) {
  const baseUrl = await getBaseUrl()
  const cookieStore = await cookies()
  const cookieHeader = serializeCookies(cookieStore.getAll())

  const headersIn = new Headers(init?.headers || {})
  if (cookieHeader) headersIn.set("cookie", cookieHeader)
  headersIn.set("x-internal", "1")

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: headersIn,
    cache: "no-store",
  })
}
