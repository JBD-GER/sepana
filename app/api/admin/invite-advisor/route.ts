// app/api/admin/invite-advisor/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? "").trim().toLowerCase()
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Ungültige E-Mail" }, { status: 400 })

    // Invite link soll auf deine Seite führen, wo Passwort gesetzt wird:
    // -> /einladung?mode=invite
    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/einladung?mode=invite`
        : undefined

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined)
    if (error) throw error

    const invitedUserId = data?.user?.id
    if (!invitedUserId) {
      return NextResponse.json({ ok: false, error: "Invite ok, aber keine user.id erhalten" }, { status: 500 })
    }

    // Profile sicherstellen (role=advisor)
    const { error: upErr } = await admin.from("profiles").upsert(
      {
        user_id: invitedUserId,
        role: "advisor",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    if (upErr) throw upErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
