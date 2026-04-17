import { NextResponse } from "next/server"
import { getSkagPushCredentials } from "@/lib/skag/config"
import { applySkagPushUpdate } from "@/lib/skag/sync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SEPANA Push"' },
  })
}

function decodeBasicAuth(header: string | null) {
  const raw = String(header ?? "").trim()
  if (!raw.toLowerCase().startsWith("basic ")) return null
  const encoded = raw.slice(6).trim()
  if (!encoded) return null
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8")
    const separator = decoded.indexOf(":")
    if (separator < 0) return null
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const auth = decodeBasicAuth(req.headers.get("authorization"))
    const expected = getSkagPushCredentials()
    if (!auth || auth.username !== expected.username || auth.password !== expected.password) {
      return unauthorized()
    }

    const form = await req.formData()
    const payload: Record<string, unknown> = {}
    for (const [key, value] of form.entries()) {
      payload[key] = typeof value === "string" ? value : null
    }

    const admin = supabaseAdmin()
    const result = await applySkagPushUpdate(admin, payload)

    return NextResponse.json({
      ok: true,
      matched: result.matched,
      caseId: result.caseId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
