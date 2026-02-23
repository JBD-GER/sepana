import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { isEmail } from "@/lib/tippgeber/service"

export const runtime = "nodejs"

function trim(value: unknown) {
  return String(value ?? "").trim()
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const companyName = trim(body?.companyName)
    const street = trim(body?.street)
    const houseNumber = trim(body?.houseNumber)
    const zip = trim(body?.zip)
    const city = trim(body?.city)
    const email = trim(body?.email).toLowerCase()
    const phone = trim(body?.phone) || null
    const logoPath = trim(body?.logoPath) || null

    if (!companyName || !street || !houseNumber || !zip || !city) {
      return NextResponse.json({ ok: false, error: "Bitte Firmendaten vollständig angeben." }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Ungültige E-Mail." }, { status: 400 })
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const redirectTo = `${origin.replace(/\/$/, "")}/einladung?mode=invite`

    let inviteLink: string | null = null
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    let userId = data?.user?.id ?? null
    if (error) {
      const link = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      })
      if (link.error) {
        throw error
      }
      inviteLink = link.data?.properties?.action_link ?? null
      userId = link.data?.user?.id ?? userId
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Einladung erstellt, aber keine user.id erhalten." }, { status: 500 })
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("password_set_at")
      .eq("user_id", userId)
      .maybeSingle()
    const passwordSetAt = (existingProfile as { password_set_at?: string | null } | null)?.password_set_at ?? null

    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        role: "tipgeber",
        password_set_at: passwordSetAt,
      },
      { onConflict: "user_id" }
    )
    if (profileErr) throw profileErr

    const now = new Date().toISOString()
    const { error: tgErr } = await admin.from("tippgeber_profiles").upsert(
      {
        user_id: userId,
        company_name: companyName,
        address_street: street,
        address_house_number: houseNumber,
        address_zip: zip,
        address_city: city,
        phone,
        email,
        logo_path: logoPath,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    if (tgErr) throw tgErr

    return NextResponse.json({ ok: true, user_id: userId, link: inviteLink })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
