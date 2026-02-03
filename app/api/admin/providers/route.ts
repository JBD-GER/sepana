export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type ProductType = "baufi" | "konsum"

type CreateBody = {
  name?: unknown
  slug?: unknown
  website_url?: unknown
  preferred_logo_variant?: unknown
  is_active?: unknown
  create_products?: {
    baufi?: unknown
    konsum?: unknown
  }
}

function asString(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function asNullableString(value: unknown) {
  const v = asString(value)
  return v ? v : null
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  return fallback
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function ensureProduct(
  admin: ReturnType<typeof supabaseAdmin>,
  providerId: string,
  productType: ProductType
) {
  const { error } = await admin.from("provider_products").insert({
    provider_id: providerId,
    product_type: productType,
    is_available_online: true,
    is_available_live: true,
    is_active: true,
  })
  if (error) throw error
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as CreateBody
    const name = asString(body.name)
    const slug = slugify(asString(body.slug) || name)

    if (!name) return NextResponse.json({ ok: false, error: "Name fehlt" }, { status: 400 })
    if (!slug) return NextResponse.json({ ok: false, error: "Slug ungueltig" }, { status: 400 })

    const preferredLogoVariant = body.preferred_logo_variant === "icon" ? "icon" : "horizontal"
    const websiteUrl = asNullableString(body.website_url)
    const isActive = asBoolean(body.is_active, true)
    const createProducts = body.create_products ?? {}

    const admin = supabaseAdmin()

    const { data: provider, error: insertErr } = await admin
      .from("providers")
      .insert({
        type: "bank",
        name,
        slug,
        website_url: websiteUrl,
        preferred_logo_variant: preferredLogoVariant,
        is_active: isActive,
      })
      .select("id,name,slug")
      .single()

    if (insertErr) throw insertErr

    const providerId = provider.id as string

    if (asBoolean(createProducts.baufi, true)) {
      await ensureProduct(admin, providerId, "baufi")
    }
    if (asBoolean(createProducts.konsum, true)) {
      await ensureProduct(admin, providerId, "konsum")
    }

    return NextResponse.json({
      ok: true,
      provider: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Serverfehler" },
      { status: 500 }
    )
  }
}
