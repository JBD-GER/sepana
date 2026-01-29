import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

function safeMode(m: string | null) {
  if (m === "reset" || m === "invite" || m === "signup") return m
  return null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = safeMode(url.searchParams.get("mode"))

  const code = url.searchParams.get("code")
  const token_hash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as
    | "signup"
    | "invite"
    | "recovery"
    | "magiclink"
    | "email_change"
    | null

  const supabase = await createServerSupabaseClient()

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } else if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type })
      if (error) throw error
    } else {
      return NextResponse.redirect(new URL("/login?error=invalid_link", url.origin))
    }

    const finalMode =
      mode ||
      (type === "recovery" ? "reset" : type === "invite" ? "invite" : type === "signup" ? "signup" : null)

    if (finalMode === "invite") return NextResponse.redirect(new URL("/einladung?mode=invite", url.origin))
    if (finalMode === "reset") return NextResponse.redirect(new URL("/einladung?mode=reset", url.origin))
    if (finalMode === "signup") return NextResponse.redirect(new URL("/login?confirmed=1", url.origin))

    return NextResponse.redirect(new URL("/app", url.origin))
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired", url.origin))
  }
}
