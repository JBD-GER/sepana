import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { isEmail } from "@/lib/tippgeber/service"
import { normalizeTippgeberKind } from "@/lib/tippgeber/kinds"

export const runtime = "nodejs"

function trim(value: unknown) {
  return String(value ?? "").trim()
}

function isMissingTippgeberKindColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("tippgeber_kind") && (msg.includes("column") || msg.includes("exist"))
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
    const tippgeberKind = normalizeTippgeberKind(body?.tippgeberKind)

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
    const tippgeberPayload: Record<string, unknown> = {
      user_id: userId,
      company_name: companyName,
      address_street: street,
      address_house_number: houseNumber,
      address_zip: zip,
      address_city: city,
      phone,
      email,
      logo_path: logoPath,
      tippgeber_kind: tippgeberKind,
      is_active: true,
      updated_at: now,
    }

    const tgInsert = await admin.from("tippgeber_profiles").upsert(tippgeberPayload, { onConflict: "user_id" })
    if (tgInsert.error && isMissingTippgeberKindColumnError(tgInsert.error)) {
      delete tippgeberPayload.tippgeber_kind
      const fallbackInsert = await admin.from("tippgeber_profiles").upsert(tippgeberPayload, { onConflict: "user_id" })
      if (fallbackInsert.error) throw fallbackInsert.error
    } else if (tgInsert.error) {
      throw tgInsert.error
    }

    return NextResponse.json({ ok: true, user_id: userId, link: inviteLink })
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
