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
    const displayName = body?.display_name ? String(body.display_name).trim() : null
    const bio = body?.bio ? String(body.bio).trim() : null
    const languages = Array.isArray(body?.languages)
      ? body.languages.map((x: any) => String(x || "").trim()).filter(Boolean).slice(0, 20)
      : []
    const photoPath = body?.photo_path ? String(body.photo_path).trim() : null
    const phone = body?.phone ? String(body.phone).trim() : null

    // Invite link soll auf deine Seite führen, wo Passwort gesetzt wird:
    // -> /einladung?mode=invite
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const redirectTo = `${origin}/einladung?mode=invite`

    let inviteLink: string | null = null
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    let invitedUserId = data?.user?.id ?? null
    if (error) {
      // Fallback: generateLink, z.B. wenn User bereits existiert
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      })
      if (linkErr) throw error
      inviteLink = linkData?.properties?.action_link ?? null
      invitedUserId = linkData?.user?.id ?? invitedUserId
    }

    const userId = invitedUserId
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invite ok, aber keine user.id erhalten" }, { status: 500 })
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("password_set_at")
      .eq("user_id", userId)
      .maybeSingle()
    const passwordSetAt = existingProfile?.password_set_at ?? null

    // Profile sicherstellen (role=advisor) + password_set_at nur falls nicht gesetzt
    const { error: upErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        role: "advisor",
        password_set_at: passwordSetAt,
      },
      { onConflict: "user_id" }
    )
    if (upErr) throw upErr

    // Advisor-Profil minimal anlegen
    const fullProfile = {
      user_id: userId,
      display_name: displayName,
      bio,
      languages,
      photo_path: photoPath,
      phone,
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    const { error: profErr } = await admin.from("advisor_profiles").upsert(fullProfile, { onConflict: "user_id" })
    if (profErr) {
      // Wenn Spalten fehlen (z.B. phone/is_active), retry mit minimalen Feldern
      if (profErr.code === "42703" || /column/i.test(profErr.message ?? "")) {
        const minimalProfile = {
          user_id: userId,
          display_name: displayName,
          bio,
          languages,
          photo_path: photoPath,
          updated_at: new Date().toISOString(),
        }
        const { error: profErr2 } = await admin
          .from("advisor_profiles")
          .upsert(minimalProfile, { onConflict: "user_id" })
        if (profErr2) throw profErr2
      } else {
        throw profErr
      }
    }

    return NextResponse.json({ ok: true, user_id: userId, link: inviteLink })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
