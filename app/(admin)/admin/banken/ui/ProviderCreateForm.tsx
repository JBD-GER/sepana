"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export default function ProviderCreateForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [preferredLogo, setPreferredLogo] = useState<"horizontal" | "icon">("horizontal")
  const [isActive, setIsActive] = useState(true)
  const [withBaufi, setWithBaufi] = useState(true)
  const [withKonsum, setWithKonsum] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const inputBase =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  async function createProvider() {
    setMsg(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMsg("Name fehlt.")
      return
    }

    const finalSlug = slugify(slug || trimmedName)
    if (!finalSlug) {
      setMsg("Slug ist ungueltig.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: finalSlug,
          website_url: websiteUrl.trim() || null,
          preferred_logo_variant: preferredLogo,
          is_active: isActive,
          create_products: {
            baufi: withBaufi,
            konsum: withKonsum,
          },
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json?.error || "Anlegen fehlgeschlagen")

      setName("")
      setSlug("")
      setWebsiteUrl("")
      setPreferredLogo("horizontal")
      setIsActive(true)
      setWithBaufi(true)
      setWithKonsum(true)
      setMsg("Bank angelegt.")
      router.refresh()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Neu</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Bank anlegen</div>
        </div>
        <button
          type="button"
          onClick={createProvider}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Speichert..." : "Bank erstellen"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Name</label>
          <input
            value={name}
            onChange={(e) => {
              const nextName = e.target.value
              setName(nextName)
              if (!slug) setSlug(slugify(nextName))
            }}
            placeholder="Neue Bank"
            className={inputBase}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="neue-bank"
            className={inputBase}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Webseite (optional)</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
            className={inputBase}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Logo Variante</label>
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

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Aktiv
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={withBaufi} onChange={(e) => setWithBaufi(e.target.checked)} />
          Baufi Produkt erstellen
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={withKonsum} onChange={(e) => setWithKonsum(e.target.checked)} />
          Konsum Produkt erstellen
        </label>
      </div>

      {msg ? <div className="mt-3 text-sm text-slate-600">{msg}</div> : null}
    </div>
  )
}
