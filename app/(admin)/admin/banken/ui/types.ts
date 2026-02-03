export type ProductType = "baufi" | "konsum"

export type ProviderTermAdmin = {
  id: string | null
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

export type ProviderProductAdmin = {
  id: string | null
  product_type: ProductType
  is_available_online: boolean
  is_available_live: boolean
  is_active: boolean
  term: ProviderTermAdmin | null
}

export type ProviderAdminItem = {
  id: string
  type: string
  name: string
  slug: string
  website_url: string | null
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: "horizontal" | "icon" | null
  is_active: boolean
  products: Partial<Record<ProductType, ProviderProductAdmin>>
}
