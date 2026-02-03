"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ProductType, ProviderAdminItem, ProviderProductAdmin } from "./types"

type TermFormState = {
  as_of_date: string
  apr_example: string
  nominal_example: string
  apr_from: string
  apr_to: string
  rate_note: string
  special_repayment_free_pct: string
  special_repayment_free_note: string
  repayment_change_note: string
  zinsbindung_min_years: string
  zinsbindung_max_years: string
  term_min_months: string
  term_max_months: string
  loan_min: string
  loan_max: string
}

type ProductFormState = {
  id: string | null
  enabled: boolean
  is_available_online: boolean
  is_available_live: boolean
  is_active: boolean
  term: TermFormState
}

const PRODUCT_TYPES: ProductType[] = ["baufi", "konsum"]

function toInput(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value)
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function createEmptyTermState(): TermFormState {
  return {
    as_of_date: todayIsoDate(),
    apr_example: "",
    nominal_example: "",
    apr_from: "",
    apr_to: "",
    rate_note: "",
    special_repayment_free_pct: "",
    special_repayment_free_note: "",
    repayment_change_note: "",
    zinsbindung_min_years: "",
    zinsbindung_max_years: "",
    term_min_months: "",
    term_max_months: "",
    loan_min: "",
    loan_max: "",
  }
}

function createProductState(input?: ProviderProductAdmin): ProductFormState {
  const term = input?.term
  return {
    id: input?.id ?? null,
    enabled: !!input,
    is_available_online: input?.is_available_online ?? true,
    is_available_live: input?.is_available_live ?? true,
    is_active: input?.is_active ?? true,
    term: term
      ? {
          as_of_date: toInput(term.as_of_date || todayIsoDate()),
          apr_example: toInput(term.apr_example),
          nominal_example: toInput(term.nominal_example),
          apr_from: toInput(term.apr_from),
          apr_to: toInput(term.apr_to),
          rate_note: toInput(term.rate_note),
          special_repayment_free_pct: toInput(term.special_repayment_free_pct),
          special_repayment_free_note: toInput(term.special_repayment_free_note),
          repayment_change_note: toInput(term.repayment_change_note),
          zinsbindung_min_years: toInput(term.zinsbindung_min_years),
          zinsbindung_max_years: toInput(term.zinsbindung_max_years),
          term_min_months: toInput(term.term_min_months),
          term_max_months: toInput(term.term_max_months),
          loan_min: toInput(term.loan_min),
          loan_max: toInput(term.loan_max),
        }
      : createEmptyTermState(),
  }
}

function logoSrc(path: string | null) {
  if (!path) return null
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(path)}`
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

function serializeMaybeString(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default function ProviderRowEditor({ initial }: { initial: ProviderAdminItem }) {
  const router = useRouter()

  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url ?? "")
  const [horizontalLogoPath, setHorizontalLogoPath] = useState(initial.logo_horizontal_path ?? "")
  const [iconLogoPath, setIconLogoPath] = useState(initial.logo_icon_path ?? "")
  const [preferredLogo, setPreferredLogo] = useState<"horizontal" | "icon">(
    initial.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  )
  const [isActive, setIsActive] = useState(initial.is_active)
  const [products, setProducts] = useState<Record<ProductType, ProductFormState>>({
    baufi: createProductState(initial.products.baufi),
    konsum: createProductState(initial.products.konsum),
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const horizontalLogoSrc = useMemo(() => logoSrc(horizontalLogoPath || null), [horizontalLogoPath])
  const iconLogoSrc = useMemo(() => logoSrc(iconLogoPath || null), [iconLogoPath])

  const inputBase =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  function updateProduct<K extends keyof ProductFormState>(type: ProductType, key: K, value: ProductFormState[K]) {
    setProducts((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }))
  }

  function updateTerm<K extends keyof TermFormState>(type: ProductType, key: K, value: TermFormState[K]) {
    setProducts((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        term: {
          ...prev[type].term,
          [key]: value,
        },
      },
    }))
  }

  async function uploadLogo(variant: "horizontal" | "icon", file: File) {
    setMsg(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(
        `/api/admin/providers/upload-logo?providerId=${encodeURIComponent(initial.id)}&variant=${variant}`,
        {
          method: "POST",
          body: form,
        }
      )
      const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string }
      if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen")

      if (variant === "horizontal") setHorizontalLogoPath(json.path ?? "")
      if (variant === "icon") setIconLogoPath(json.path ?? "")
      setMsg("Logo hochgeladen.")
      router.refresh()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setMsg(null)
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        slug: slugify(slug || name),
        website_url: serializeMaybeString(websiteUrl),
        logo_horizontal_path: serializeMaybeString(horizontalLogoPath),
        logo_icon_path: serializeMaybeString(iconLogoPath),
        preferred_logo_variant: preferredLogo,
        is_active: isActive,
        products: {
          baufi: {
            id: products.baufi.id,
            enabled: products.baufi.enabled,
            is_available_online: products.baufi.is_available_online,
            is_available_live: products.baufi.is_available_live,
            is_active: products.baufi.is_active,
            term: {
              as_of_date: serializeMaybeString(products.baufi.term.as_of_date),
              apr_example: serializeMaybeString(products.baufi.term.apr_example),
              nominal_example: serializeMaybeString(products.baufi.term.nominal_example),
              apr_from: serializeMaybeString(products.baufi.term.apr_from),
              apr_to: serializeMaybeString(products.baufi.term.apr_to),
              rate_note: serializeMaybeString(products.baufi.term.rate_note),
              special_repayment_free_pct: serializeMaybeString(products.baufi.term.special_repayment_free_pct),
              special_repayment_free_note: serializeMaybeString(products.baufi.term.special_repayment_free_note),
              repayment_change_note: serializeMaybeString(products.baufi.term.repayment_change_note),
              zinsbindung_min_years: serializeMaybeString(products.baufi.term.zinsbindung_min_years),
              zinsbindung_max_years: serializeMaybeString(products.baufi.term.zinsbindung_max_years),
              term_min_months: serializeMaybeString(products.baufi.term.term_min_months),
              term_max_months: serializeMaybeString(products.baufi.term.term_max_months),
              loan_min: serializeMaybeString(products.baufi.term.loan_min),
              loan_max: serializeMaybeString(products.baufi.term.loan_max),
            },
          },
          konsum: {
            id: products.konsum.id,
            enabled: products.konsum.enabled,
            is_available_online: products.konsum.is_available_online,
            is_available_live: products.konsum.is_available_live,
            is_active: products.konsum.is_active,
            term: {
              as_of_date: serializeMaybeString(products.konsum.term.as_of_date),
              apr_example: serializeMaybeString(products.konsum.term.apr_example),
              nominal_example: serializeMaybeString(products.konsum.term.nominal_example),
              apr_from: serializeMaybeString(products.konsum.term.apr_from),
              apr_to: serializeMaybeString(products.konsum.term.apr_to),
              rate_note: serializeMaybeString(products.konsum.term.rate_note),
              special_repayment_free_pct: serializeMaybeString(products.konsum.term.special_repayment_free_pct),
              special_repayment_free_note: serializeMaybeString(products.konsum.term.special_repayment_free_note),
              repayment_change_note: serializeMaybeString(products.konsum.term.repayment_change_note),
              zinsbindung_min_years: serializeMaybeString(products.konsum.term.zinsbindung_min_years),
              zinsbindung_max_years: serializeMaybeString(products.konsum.term.zinsbindung_max_years),
              term_min_months: serializeMaybeString(products.konsum.term.term_min_months),
              term_max_months: serializeMaybeString(products.konsum.term.term_max_months),
              loan_min: serializeMaybeString(products.konsum.term.loan_min),
              loan_max: serializeMaybeString(products.konsum.term.loan_max),
            },
          },
        },
      }

      if (!payload.name) {
        setMsg("Name fehlt.")
        return
      }
      if (!payload.slug) {
        setMsg("Slug fehlt.")
        return
      }

      const res = await fetch(`/api/admin/providers/${encodeURIComponent(initial.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")

      setMsg("Gespeichert.")
      router.refresh()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{initial.name}</div>
          <div className="text-xs text-slate-500">
            ID: {initial.id.slice(0, 8)}... | Typ: {initial.type}
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Speichert..." : "Speichern"}
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase} />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className={inputBase}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Webseite</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
            className={inputBase}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Bevorzugtes Logo</label>
          <select
            value={preferredLogo}
            onChange={(e) => setPreferredLogo(e.target.value === "icon" ? "icon" : "horizontal")}
            className={inputBase}
          >
            <option value="horizontal">Horizontal</option>
            <option value="icon">Icon</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Anbieter aktiv
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Logo horizontal</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-14 w-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {horizontalLogoSrc ? (
                <img src={horizontalLogoSrc} alt="" className="max-h-10 max-w-[140px] object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Kein Logo</span>
              )}
            </div>
            <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
              Hochladen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadLogo("horizontal", f)
                }}
                className="hidden"
              />
            </label>
          </div>
          <input
            value={horizontalLogoPath}
            onChange={(e) => setHorizontalLogoPath(e.target.value)}
            placeholder="Pfad in logo_banken"
            className={`${inputBase} mt-2`}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Logo Icon</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {iconLogoSrc ? (
                <img src={iconLogoSrc} alt="" className="max-h-10 max-w-10 object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400">Kein</span>
              )}
            </div>
            <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
              Hochladen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) uploadLogo("icon", f)
                }}
                className="hidden"
              />
            </label>
          </div>
          <input
            value={iconLogoPath}
            onChange={(e) => setIconLogoPath(e.target.value)}
            placeholder="Pfad in logo_banken"
            className={`${inputBase} mt-2`}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {PRODUCT_TYPES.map((productType) => {
          const p = products[productType]
          return (
            <div key={productType} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-900">{productType}</div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => updateProduct(productType, "enabled", e.target.checked)}
                  />
                  Produkt aktivieren
                </label>
              </div>

              {p.enabled ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.is_available_online}
                        onChange={(e) => updateProduct(productType, "is_available_online", e.target.checked)}
                      />
                      Online sichtbar
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.is_available_live}
                        onChange={(e) => updateProduct(productType, "is_available_live", e.target.checked)}
                      />
                      Live sichtbar
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => updateProduct(productType, "is_active", e.target.checked)}
                      />
                      Datensatz aktiv
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-4">
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Stand (Datum)</label>
                      <input
                        type="date"
                        value={p.term.as_of_date}
                        onChange={(e) => updateTerm(productType, "as_of_date", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Effektivzins (Beispiel, %)</label>
                      <input
                        value={p.term.apr_example}
                        onChange={(e) => updateTerm(productType, "apr_example", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Sollzins (Beispiel, %)</label>
                      <input
                        value={p.term.nominal_example}
                        onChange={(e) => updateTerm(productType, "nominal_example", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Effektivzins ab (%)</label>
                      <input
                        value={p.term.apr_from}
                        onChange={(e) => updateTerm(productType, "apr_from", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Effektivzins bis (%)</label>
                      <input
                        value={p.term.apr_to}
                        onChange={(e) => updateTerm(productType, "apr_to", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Sondertilgung frei (% p.a.)</label>
                      <input
                        value={p.term.special_repayment_free_pct}
                        onChange={(e) => updateTerm(productType, "special_repayment_free_pct", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Zinsbindung min. (Jahre)</label>
                      <input
                        value={p.term.zinsbindung_min_years}
                        onChange={(e) => updateTerm(productType, "zinsbindung_min_years", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Zinsbindung max. (Jahre)</label>
                      <input
                        value={p.term.zinsbindung_max_years}
                        onChange={(e) => updateTerm(productType, "zinsbindung_max_years", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Laufzeit min. (Monate)</label>
                      <input
                        value={p.term.term_min_months}
                        onChange={(e) => updateTerm(productType, "term_min_months", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Laufzeit max. (Monate)</label>
                      <input
                        value={p.term.term_max_months}
                        onChange={(e) => updateTerm(productType, "term_max_months", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Kreditbetrag min. (EUR)</label>
                      <input
                        value={p.term.loan_min}
                        onChange={(e) => updateTerm(productType, "loan_min", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-slate-600">Kreditbetrag max. (EUR)</label>
                      <input
                        value={p.term.loan_max}
                        onChange={(e) => updateTerm(productType, "loan_max", e.target.value)}
                        className={inputBase}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-3">
                    <div className="grid gap-1 xl:col-span-1">
                      <label className="text-xs text-slate-600">Hinweis Zinskondition</label>
                      <textarea
                        value={p.term.rate_note}
                        onChange={(e) => updateTerm(productType, "rate_note", e.target.value)}
                        className={`${inputBase} min-h-[72px]`}
                      />
                    </div>
                    <div className="grid gap-1 xl:col-span-1">
                      <label className="text-xs text-slate-600">Hinweis Sondertilgung</label>
                      <textarea
                        value={p.term.special_repayment_free_note}
                        onChange={(e) => updateTerm(productType, "special_repayment_free_note", e.target.value)}
                        className={`${inputBase} min-h-[72px]`}
                      />
                    </div>
                    <div className="grid gap-1 xl:col-span-1">
                      <label className="text-xs text-slate-600">Hinweis Ratenaenderung</label>
                      <textarea
                        value={p.term.repayment_change_note}
                        onChange={(e) => updateTerm(productType, "repayment_change_note", e.target.value)}
                        className={`${inputBase} min-h-[72px]`}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  Produkt wird auf inaktiv gesetzt und nicht in Vergleichen verwendet.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
    </div>
  )
}
