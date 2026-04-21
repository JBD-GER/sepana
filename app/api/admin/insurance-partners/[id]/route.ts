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
  street?: string | null
  zipcode?: string | null
  city?: string | null
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
    const street = trimOrNull(body.street)
    const zipcode = trimOrNull(body.zipcode)
    const city = trimOrNull(body.city)
    const isActive = typeof body.is_active === "boolean" ? body.is_active : null

    if (!partnerCode) {
      return NextResponse.json({ ok: false, error: "Partner-ID fehlt" }, { status: 400 })
    }
    if (!street || !zipcode || !city) {
      return NextResponse.json({ ok: false, error: "Adresse, PLZ und Ort sind erforderlich" }, { status: 400 })
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
        street,
        zipcode,
        city,
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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

    const admin = supabaseAdmin()
    const [{ data: roleRow, error: roleError }, { data: partnerProfile, error: profileError }] = await Promise.all([
      admin.from("profiles").select("role").eq("user_id", id).maybeSingle(),
      admin.from("insurance_partner_profiles").select("photo_path").eq("user_id", id).maybeSingle(),
    ])

    if (roleError) throw roleError
    if (profileError) throw profileError
    if (!roleRow || String(roleRow.role ?? "").trim().toLowerCase() !== "insurance") {
      return NextResponse.json({ ok: false, error: "Versicherungspartner nicht gefunden" }, { status: 404 })
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(id)
    const authDeleteMessage = String(authDeleteError?.message ?? "").toLowerCase()
    if (authDeleteError && !authDeleteMessage.includes("not found") && !authDeleteMessage.includes("user not found")) {
      throw authDeleteError
    }

    const photoPath = trimOrNull(partnerProfile?.photo_path)
    if (photoPath) {
      const { error: storageError } = await admin.storage.from("insurance_partner_avatars").remove([photoPath])
      if (storageError && !String(storageError.message ?? "").toLowerCase().includes("not found")) {
        throw storageError
      }
    }

    const { error: partnerDeleteError } = await admin.from("insurance_partner_profiles").delete().eq("user_id", id)
    if (partnerDeleteError) throw partnerDeleteError

    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("user_id", id)
    if (profileDeleteError) throw profileDeleteError

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
