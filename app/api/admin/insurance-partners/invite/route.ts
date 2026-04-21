import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? "").trim().toLowerCase()
    const partnerCode = String(body?.partnerCode ?? "").trim().toUpperCase()
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Ungueltige E-Mail" }, { status: 400 })
    if (!partnerCode) return NextResponse.json({ ok: false, error: "Partner-ID fehlt" }, { status: 400 })

    const displayName = trimOrNull(body?.display_name)
    const companyName = trimOrNull(body?.company_name)
    const bio = trimOrNull(body?.bio)
    const languages = Array.isArray(body?.languages)
      ? body.languages.map((value: unknown) => String(value ?? "").trim()).filter(Boolean).slice(0, 20)
      : []
    const photoPath = trimOrNull(body?.photo_path)
    const phone = trimOrNull(body?.phone)

    const { data: existingPartnerCode } = await admin
      .from("insurance_partner_profiles")
      .select("user_id")
      .eq("partner_code", partnerCode)
      .maybeSingle()

    if (existingPartnerCode?.user_id) {
      return NextResponse.json({ ok: false, error: "Partner-ID ist bereits vergeben" }, { status: 409 })
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const redirectTo = `${origin}/einladung?mode=invite`

    let inviteLink: string | null = null
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { role: "insurance" },
    })
    let invitedUserId = data?.user?.id ?? null

    if (error) {
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

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        role: "insurance",
        password_set_at: existingProfile?.password_set_at ?? null,
      },
      { onConflict: "user_id" }
    )
    if (profileError) throw profileError

    const { error: partnerProfileError } = await admin.from("insurance_partner_profiles").upsert(
      {
        user_id: userId,
        partner_code: partnerCode,
        display_name: displayName,
        company_name: companyName,
        bio,
        languages,
        photo_path: photoPath,
        phone,
        email,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    if (partnerProfileError) throw partnerProfileError

    return NextResponse.json({ ok: true, user_id: userId, link: inviteLink })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
