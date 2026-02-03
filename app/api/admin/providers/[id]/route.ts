export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type ProductType = "baufi" | "konsum"
type ProductPayload = {
  id?: unknown
  enabled?: unknown
  is_available_online?: unknown
  is_available_live?: unknown
  is_active?: unknown
  term?: Record<string, unknown> | null
}

type PatchBody = {
  name?: unknown
  slug?: unknown
  website_url?: unknown
  logo_horizontal_path?: unknown
  logo_icon_path?: unknown
  preferred_logo_variant?: unknown
  is_active?: unknown
  products?: Partial<Record<ProductType, ProductPayload>>
}

type ProductRow = {
  id: string
  product_type: string
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

function asIntOrNull(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const normalized = raw.replace(",", ".")
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function asNumericString(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  return raw.replace(",", ".")
}

function normalizeDate(input: unknown) {
  const value = asString(input)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Date().toISOString().slice(0, 10)
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

function isProductType(value: string): value is ProductType {
  return value === "baufi" || value === "konsum"
}

async function upsertProduct(
  admin: ReturnType<typeof supabaseAdmin>,
  providerId: string,
  productType: ProductType,
  payload: ProductPayload,
  existingId: string | null
) {
  const basePatch = {
    provider_id: providerId,
    product_type: productType,
    is_available_online: asBoolean(payload.is_available_online, true),
    is_available_live: asBoolean(payload.is_available_live, true),
    is_active: asBoolean(payload.is_active, true),
  }

  if (existingId) {
    const { error } = await admin.from("provider_products").update(basePatch).eq("id", existingId)
    if (error) throw error
    return existingId
  }

  const { data, error } = await admin.from("provider_products").insert(basePatch).select("id").single()
  if (error) throw error
  return data.id as string
}

async function upsertLatestTerm(
  admin: ReturnType<typeof supabaseAdmin>,
  providerProductId: string,
  termPayload: Record<string, unknown>
) {
  const termPatch = {
    as_of_date: normalizeDate(termPayload.as_of_date),
    apr_example: asNumericString(termPayload.apr_example),
    nominal_example: asNumericString(termPayload.nominal_example),
    apr_from: asNumericString(termPayload.apr_from),
    apr_to: asNumericString(termPayload.apr_to),
    rate_note: asNullableString(termPayload.rate_note),
    special_repayment_free_pct: asNumericString(termPayload.special_repayment_free_pct),
    special_repayment_free_note: asNullableString(termPayload.special_repayment_free_note),
    repayment_change_note: asNullableString(termPayload.repayment_change_note),
    zinsbindung_min_years: asIntOrNull(termPayload.zinsbindung_min_years),
    zinsbindung_max_years: asIntOrNull(termPayload.zinsbindung_max_years),
    term_min_months: asIntOrNull(termPayload.term_min_months),
    term_max_months: asIntOrNull(termPayload.term_max_months),
    loan_min: asNumericString(termPayload.loan_min),
    loan_max: asNumericString(termPayload.loan_max),
  }

  const { data: latest } = await admin
    .from("provider_product_terms")
    .select("id")
    .eq("provider_product_id", providerProductId)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.id) {
    const { error } = await admin.from("provider_product_terms").update(termPatch).eq("id", latest.id)
    if (error) throw error
    return
  }

  const { error } = await admin.from("provider_product_terms").insert({
    provider_product_id: providerProductId,
    ...termPatch,
    features: { source: "admin_dashboard" },
  })
  if (error) throw error
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as PatchBody

    const providerPatch = {
      name: asNullableString(body.name),
      slug: slugify(asString(body.slug) || asString(body.name)),
      website_url: asNullableString(body.website_url),
      logo_horizontal_path: asNullableString(body.logo_horizontal_path),
      logo_icon_path: asNullableString(body.logo_icon_path),
      preferred_logo_variant: body.preferred_logo_variant === "icon" ? "icon" : "horizontal",
      is_active: asBoolean(body.is_active, true),
      updated_at: new Date().toISOString(),
    }

    if (!providerPatch.name) {
      return NextResponse.json({ ok: false, error: "Name fehlt" }, { status: 400 })
    }
    if (!providerPatch.slug) {
      return NextResponse.json({ ok: false, error: "Slug fehlt" }, { status: 400 })
    }

    const admin = supabaseAdmin()

    const { error: providerErr } = await admin.from("providers").update(providerPatch).eq("id", id)
    if (providerErr) throw providerErr

    const { data: existingProducts } = await admin
      .from("provider_products")
      .select("id,product_type")
      .eq("provider_id", id)

    const productByType = new Map<ProductType, ProductRow>()
    for (const product of (existingProducts ?? []) as ProductRow[]) {
      if (isProductType(product.product_type)) {
        productByType.set(product.product_type, product)
      }
    }

    const incomingProducts = body.products ?? {}
    const types: ProductType[] = ["baufi", "konsum"]

    for (const type of types) {
      const payload = incomingProducts[type]
      if (!payload) continue

      const enabled = asBoolean(payload.enabled, true)
      const existingProduct = productByType.get(type) ?? null

      if (!enabled) {
        if (existingProduct?.id) {
          const { error } = await admin
            .from("provider_products")
            .update({ is_active: false, is_available_online: false, is_available_live: false })
            .eq("id", existingProduct.id)
          if (error) throw error
        }
        continue
      }

      const productId = await upsertProduct(admin, id, type, payload, existingProduct?.id ?? null)
      if (payload.term && typeof payload.term === "object") {
        await upsertLatestTerm(admin, productId, payload.term)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Serverfehler" },
      { status: 500 }
    )
  }
}
