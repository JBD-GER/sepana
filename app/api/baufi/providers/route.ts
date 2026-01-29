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

// kleiner Runtime-Guard, damit TS happy ist und du keine "GenericStringError" Casts brauchst
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

export async function GET(req: Request) {
  const sb = supabaseAdmin()
  const url = new URL(req.url)
  const productType = (url.searchParams.get("product") || "baufi").toLowerCase()

  try {
    // 1) Alle Banken (immer alle anzeigen)
    const { data: providersRaw, error: pErr } = await sb
      .from("providers")
      .select("id,type,name,slug,website_url,logo_horizontal_path,logo_icon_path,preferred_logo_variant,is_active")
      .eq("type", "bank")
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (pErr) throw pErr
    const providers: Provider[] = (providersRaw ?? []) as unknown as Provider[]

    // 2) Produkte (baufi/konsum)
    const { data: productsRaw, error: prodErr } = await sb
      .from("provider_products")
      .select("id,provider_id,product_type,is_available_online,is_available_live,is_active")
      .eq("product_type", productType)
      .eq("is_active", true)

    if (prodErr) throw prodErr
    const products: ProviderProduct[] = (productsRaw ?? []) as unknown as ProviderProduct[]

    const productIds = products.map((x) => x.id)

    // 3) Terms (latest pro Produkt)
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

    // Merge
    const productByProvider = new Map<string, ProviderProduct>()
    for (const pr of products) productByProvider.set(pr.provider_id, pr)

    const result = providers.map((p) => {
      const prod = productByProvider.get(p.id) || null
      const term = prod ? termsMap.get(prod.id) || null : null
      return { provider: p, product: prod, term }
    })

    return NextResponse.json({ ok: true, productType, items: result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
