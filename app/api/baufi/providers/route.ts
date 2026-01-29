// app/api/baufi/providers/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Provider = {
  id: string
  type: string
  name: string
  slug: string
  website_url: string | null
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: "horizontal" | "icon" | string | null
  is_active: boolean
}

type ProviderProduct = {
  id: string
  provider_id: string
  product_type: "baufi" | "konsum" | string
  is_available_online: boolean
  is_available_live: boolean
  is_active: boolean
}

type Term = {
  id: string
  provider_product_id: string
  as_of_date: string
  apr_example: string | null
  nominal_example: string | null
  apr_from: string | null
  apr_to: string | null
  rate_note: string | null
  special_repayment_free_pct: string | null
  special_repayment_free_note: string | null
  repayment_change_note: string | null
  zinsbindung_min_years: number | null
  zinsbindung_max_years: number | null
  term_min_months: number | null
  term_max_months: number | null
  loan_min: string | null
  loan_max: string | null
  features: any
}

function pickLatestTerms(terms: Term[]) {
  const map = new Map<string, Term>()
  for (const t of terms) {
    const prev = map.get(t.provider_product_id)
    if (!prev) map.set(t.provider_product_id, t)
    else if (String(t.as_of_date) > String(prev.as_of_date)) map.set(t.provider_product_id, t)
  }
  return map
}

function isTermArray(v: unknown): v is Term[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        x &&
        typeof x === "object" &&
        "id" in x &&
        "provider_product_id" in x &&
        "as_of_date" in x
    )
  )
}

function normalizeProductType(v: string | null) {
  const t = String(v || "baufi").toLowerCase()
  if (t === "konsum") return "konsum"
  return "baufi"
}

export async function GET(req: Request) {
  const sb = supabaseAdmin()
  const url = new URL(req.url)
  const productType = normalizeProductType(url.searchParams.get("product"))

  try {
    /**
     * ✅ WICHTIG:
     * Wir holen nur Provider, die EIN passendes provider_product haben (inner join).
     * Damit kommen keine “Konsum-only” Banken mehr durch, wenn product=baufi.
     */
    const { data: rows, error: pErr } = await sb
      .from("providers")
      .select(
        `
          id,type,name,slug,website_url,logo_horizontal_path,logo_icon_path,preferred_logo_variant,is_active,
          provider_products!inner(id,provider_id,product_type,is_available_online,is_available_live,is_active)
        `
      )
      .eq("type", "bank")
      .eq("is_active", true)
      .eq("provider_products.product_type", productType)
      .eq("provider_products.is_active", true)
      .order("name", { ascending: true })

    if (pErr) throw pErr

    const safeRows = (rows ?? []) as Array<
      Provider & { provider_products: ProviderProduct[] }
    >

    // pro Provider nehmen wir das passende Produkt (normalerweise 1:1)
    const itemsBase = safeRows
      .map((p) => {
        const prod = Array.isArray(p.provider_products) ? p.provider_products[0] : null
        const provider: Provider = {
          id: p.id,
          type: p.type,
          name: p.name,
          slug: p.slug,
          website_url: p.website_url ?? null,
          logo_horizontal_path: p.logo_horizontal_path ?? null,
          logo_icon_path: p.logo_icon_path ?? null,
          preferred_logo_variant: p.preferred_logo_variant ?? null,
          is_active: !!p.is_active,
        }
        return { provider, product: prod }
      })
      .filter((x) => !!x.product) as Array<{ provider: Provider; product: ProviderProduct }>

    const productIds = itemsBase.map((x) => x.product.id)

    // latest term pro Produkt
    let termsMap = new Map<string, Term>()
    if (productIds.length) {
      const { data: termsRaw, error: tErr } = await sb
        .from("provider_product_terms")
        .select(
          "id,provider_product_id,as_of_date,apr_example,nominal_example,apr_from,apr_to,rate_note," +
            "special_repayment_free_pct,special_repayment_free_note,repayment_change_note," +
            "zinsbindung_min_years,zinsbindung_max_years,term_min_months,term_max_months," +
            "loan_min,loan_max,features"
        )
        .in("provider_product_id", productIds)

      if (tErr) throw tErr

      const safeTerms: Term[] = isTermArray(termsRaw) ? termsRaw : []
      termsMap = pickLatestTerms(safeTerms)
    }

    const result = itemsBase.map(({ provider, product }) => {
      const term = termsMap.get(product.id) || null
      return { provider, product, term }
    })

    return NextResponse.json({ ok: true, productType, items: result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
