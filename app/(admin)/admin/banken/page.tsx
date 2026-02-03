import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import ProviderCreateForm from "./ui/ProviderCreateForm"
import ProviderRowEditor from "./ui/ProviderRowEditor"
import type { ProductType, ProviderAdminItem, ProviderTermAdmin } from "./ui/types"

type ProviderRow = {
  id: string
  type: string
  name: string
  slug: string
  website_url: string | null
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: "horizontal" | "icon" | null
  is_active: boolean
}

type ProductRow = {
  id: string
  provider_id: string
  product_type: string
  is_available_online: boolean
  is_available_live: boolean
  is_active: boolean
}

type TermRow = {
  id: string
  provider_product_id: string
  as_of_date: string | null
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
}

function isProductType(value: string): value is ProductType {
  return value === "baufi" || value === "konsum"
}

function normalizeTerm(row: TermRow | null): ProviderTermAdmin | null {
  if (!row) return null
  return {
    id: row.id,
    as_of_date: row.as_of_date ?? null,
    apr_example: row.apr_example ?? null,
    nominal_example: row.nominal_example ?? null,
    apr_from: row.apr_from ?? null,
    apr_to: row.apr_to ?? null,
    rate_note: row.rate_note ?? null,
    special_repayment_free_pct: row.special_repayment_free_pct ?? null,
    special_repayment_free_note: row.special_repayment_free_note ?? null,
    repayment_change_note: row.repayment_change_note ?? null,
    zinsbindung_min_years: row.zinsbindung_min_years ?? null,
    zinsbindung_max_years: row.zinsbindung_max_years ?? null,
    term_min_months: row.term_min_months ?? null,
    term_max_months: row.term_max_months ?? null,
    loan_min: row.loan_min ?? null,
    loan_max: row.loan_max ?? null,
  }
}

export default async function AdminBanksPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const { data: providers } = await admin
    .from("providers")
    .select(
      "id,type,name,slug,website_url,logo_horizontal_path,logo_icon_path,preferred_logo_variant,is_active"
    )
    .eq("type", "bank")
    .order("name", { ascending: true })

  const providerRows = (providers ?? []) as ProviderRow[]
  const providerIds = providerRows.map((x) => x.id)

  const { data: products } = providerIds.length
    ? await admin
        .from("provider_products")
        .select("id,provider_id,product_type,is_available_online,is_available_live,is_active")
        .in("provider_id", providerIds)
    : { data: [] as ProductRow[] }

  const productRows = (products ?? []) as ProductRow[]
  const productIds = productRows.map((x) => x.id)

  const { data: terms } = productIds.length
    ? await admin
        .from("provider_product_terms")
        .select(
          "id,provider_product_id,as_of_date,apr_example,nominal_example,apr_from,apr_to,rate_note,special_repayment_free_pct,special_repayment_free_note,repayment_change_note,zinsbindung_min_years,zinsbindung_max_years,term_min_months,term_max_months,loan_min,loan_max"
        )
        .in("provider_product_id", productIds)
        .order("as_of_date", { ascending: false })
    : { data: [] as TermRow[] }

  const latestTermByProduct = new Map<string, TermRow>()
  for (const term of (terms ?? []) as TermRow[]) {
    if (!latestTermByProduct.has(term.provider_product_id)) {
      latestTermByProduct.set(term.provider_product_id, term)
    }
  }

  const productsByProvider = new Map<string, ProductRow[]>()
  for (const product of productRows) {
    const current = productsByProvider.get(product.provider_id) ?? []
    current.push(product)
    productsByProvider.set(product.provider_id, current)
  }

  const items: ProviderAdminItem[] = providerRows.map((provider) => {
    const providerProducts = productsByProvider.get(provider.id) ?? []
    const normalizedProducts: ProviderAdminItem["products"] = {}

    for (const product of providerProducts) {
      if (!isProductType(product.product_type)) continue
      const latestTerm = normalizeTerm(latestTermByProduct.get(product.id) ?? null)
      normalizedProducts[product.product_type] = {
        id: product.id,
        product_type: product.product_type,
        is_available_online: !!product.is_available_online,
        is_available_live: !!product.is_available_live,
        is_active: !!product.is_active,
        term: latestTerm,
      }
    }

    return {
      id: provider.id,
      type: provider.type,
      name: provider.name,
      slug: provider.slug,
      website_url: provider.website_url ?? null,
      logo_horizontal_path: provider.logo_horizontal_path ?? null,
      logo_icon_path: provider.logo_icon_path ?? null,
      preferred_logo_variant: provider.preferred_logo_variant ?? "horizontal",
      is_active: !!provider.is_active,
      products: normalizedProducts,
    }
  })

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Verwaltung</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Banken & Produkte</h1>
            <p className="mt-1 text-sm text-slate-600">
              Banken anzeigen, bearbeiten, neu anlegen und Logos direkt in `logo_banken` hochladen.
            </p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            {(items ?? []).length} Banken
          </div>
        </div>
      </div>

      <ProviderCreateForm />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">Bankenliste</div>
          <div className="text-xs text-slate-500">Anbieter + Produkte + letzte Konditionen</div>
        </div>

        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <ProviderRowEditor initial={item} />
            </div>
          ))}

          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-6 text-sm text-slate-500">
              Keine Banken gefunden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
