// app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function safeNext(next: string | null) {
  if (!next) return "/login"
  if (!next.startsWith("/")) return "/login"
  if (next.startsWith("/api")) return "/login"
  return next
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = safeNext(url.searchParams.get("next"))

  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()

  // harte Weiterleitung
  return NextResponse.redirect(new URL(next, url.origin), 303)
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}
