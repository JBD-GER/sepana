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

type UpdateBody = {
  userId?: string
  companyName?: string
  street?: string
  houseNumber?: string
  zip?: string
  city?: string
  email?: string | null
  phone?: string | null
  logoPath?: string | null
  tippgeberKind?: string | null
  isActive?: boolean
}

async function handle(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = (await req.json().catch(() => null)) as UpdateBody | null
    const userId = trim(body?.userId)
    const companyName = trim(body?.companyName)
    const street = trim(body?.street)
    const houseNumber = trim(body?.houseNumber)
    const zip = trim(body?.zip)
    const city = trim(body?.city)
    const emailRaw = trim(body?.email ?? "")
    const email = emailRaw ? emailRaw.toLowerCase() : null
    const phone = trim(body?.phone ?? "") || null
    const logoPath = trim(body?.logoPath ?? "") || null
    const tippgeberKind = normalizeTippgeberKind(body?.tippgeberKind)
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId fehlt." }, { status: 400 })
    }
    if (!companyName || !street || !houseNumber || !zip || !city) {
      return NextResponse.json({ ok: false, error: "Bitte Firmendaten vollständig angeben." }, { status: 400 })
    }
    if (email && !isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Ungültige E-Mail." }, { status: 400 })
    }

    const { data: existing } = await admin
      .from("tippgeber_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Tippgeber nicht gefunden." }, { status: 404 })
    }

    const now = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      company_name: companyName,
      address_street: street,
      address_house_number: houseNumber,
      address_zip: zip,
      address_city: city,
      email,
      phone,
      logo_path: logoPath,
      tippgeber_kind: tippgeberKind,
      is_active: isActive,
      updated_at: now,
    }

    const updateQuery = await admin
      .from("tippgeber_profiles")
      .update(updatePayload)
      .eq("user_id", userId)
    if (updateQuery.error && isMissingTippgeberKindColumnError(updateQuery.error)) {
      delete updatePayload.tippgeber_kind
      const fallbackQuery = await admin
        .from("tippgeber_profiles")
        .update(updatePayload)
        .eq("user_id", userId)
      if (fallbackQuery.error) throw fallbackQuery.error
    } else if (updateQuery.error) {
      throw updateQuery.error
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return handle(req)
}

export async function PATCH(req: Request) {
  return handle(req)
}

