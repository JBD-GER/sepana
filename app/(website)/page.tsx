import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import FinanzpartnerLanding, { type BankPartnerLogo } from "./components/marketing/FinanzpartnerLanding"

export const metadata: Metadata = {
  title: "SEPANA | Ihr Finanzpartner für klare Kreditentscheidungen",
  description:
    "SEPANA ist Ihr Finanzpartner für Baufinanzierung und Privatkredit. Starten Sie Ihre Kreditanfrage in einem klaren Funnel mit persönlicher Begleitung.",
  alternates: { canonical: "/" },
}

type Provider = {
  id: string
  name: string
  logo_horizontal_path: string | null
  logo_icon_path: string | null
}

type ProviderItem = {
  provider: Provider
  term?: unknown | null
}

type ProvidersResponse = {
  ok: boolean
  items: ProviderItem[]
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function authModeFromType(type: string | null) {
  if (type === "invite") return "invite"
  if (type === "recovery") return "reset"
  if (type === "signup") return "signup"
  return null
}

function logoSrc(provider: Provider) {
  const file = provider.logo_horizontal_path || provider.logo_icon_path
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&width=280&height=88&quality=80&resize=contain&path=${encodeURIComponent(String(file))}`
}

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchHomeBankPartnerLogos(): Promise<BankPartnerLogo[]> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}/api/baufi/providers?product=baufi`, { cache: "no-store" })
    if (!res.ok) return []
    const json = (await res.json().catch(() => null)) as ProvidersResponse | null
    if (!json?.ok || !Array.isArray(json.items)) return []

    return json.items
      .map((item) => {
        const provider = item?.provider
        if (!provider?.id || !provider?.name) return null
        const src = logoSrc(provider)
        if (!src) return null
        return {
          id: String(provider.id),
          name: String(provider.name),
          src,
        } satisfies BankPartnerLogo
      })
      .filter((item): item is BankPartnerLogo => item !== null)
      .slice(0, 6)
  } catch {
    return []
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const type = firstParam(resolvedSearchParams?.type)
  const mode = authModeFromType(type)
  const code = firstParam(resolvedSearchParams?.code)
  const tokenHash = firstParam(resolvedSearchParams?.token_hash)

  if (mode && (code || tokenHash)) {
    const params = new URLSearchParams()
    for (const [key, rawValue] of Object.entries(resolvedSearchParams ?? {})) {
      const value = firstParam(rawValue)
      if (value) params.set(key, value)
    }
    if (!params.get("mode")) params.set("mode", mode)
    redirect(`/auth/confirm?${params.toString()}`)
  }

  const bankPartnerLogos = await fetchHomeBankPartnerLogos()
  return <FinanzpartnerLanding bankPartnerLogos={bankPartnerLogos} />
}
