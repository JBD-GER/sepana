export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Body = {
  partner_code?: string | null
  company_name?: string | null
  display_name?: string | null
  bio?: string | null
  languages?: string[] | null
  photo_path?: string | null
  is_active?: boolean | null
  phone?: string | null
  email?: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeLanguages(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .slice(0, 20)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as Body
    const partnerCode = trimOrNull(body.partner_code)?.toUpperCase() ?? null
    const companyName = trimOrNull(body.company_name)
    const displayName = trimOrNull(body.display_name)
    const bio = trimOrNull(body.bio)
    const languages = normalizeLanguages(body.languages ?? [])
    const photoPath = trimOrNull(body.photo_path)
    const phone = trimOrNull(body.phone)
    const email = trimOrNull(body.email)?.toLowerCase() ?? null
    const isActive = typeof body.is_active === "boolean" ? body.is_active : null

    if (!partnerCode) {
      return NextResponse.json({ ok: false, error: "Partner-ID fehlt" }, { status: 400 })
    }

    const admin = supabaseAdmin()

    const { data: roleRow, error: roleError } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", id)
      .maybeSingle()

    if (roleError) throw roleError
    if (!roleRow || String(roleRow.role ?? "").trim().toLowerCase() !== "insurance") {
      return NextResponse.json({ ok: false, error: "Versicherungspartner nicht gefunden" }, { status: 404 })
    }

    const { data: existingPartnerCode, error: partnerCodeError } = await admin
      .from("insurance_partner_profiles")
      .select("user_id")
      .eq("partner_code", partnerCode)
      .neq("user_id", id)
      .maybeSingle()

    if (partnerCodeError) throw partnerCodeError
    if (existingPartnerCode?.user_id) {
      return NextResponse.json({ ok: false, error: "Partner-ID ist bereits vergeben" }, { status: 409 })
    }

    const { error: updateError } = await admin.from("insurance_partner_profiles").upsert(
      {
        user_id: id,
        partner_code: partnerCode,
        company_name: companyName,
        display_name: displayName,
        bio,
        languages,
        photo_path: photoPath,
        phone,
        email,
        ...(isActive === null ? {} : { is_active: isActive }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
