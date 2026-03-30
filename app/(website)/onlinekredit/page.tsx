import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import OnlinekreditWizard from "@/components/onlinekredit/OnlinekreditWizard"
import { getPublishedWebsiteReviewSummarySet } from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Onlinekredit in 15 Minuten | SEPANA",
  description:
    "Onlinekredit 100 % digital anfragen, passende Angebote vergleichen und ausgewählte Kredite komplett online abschließen. In 15 Minuten starten.",
  alternates: { canonical: "/onlinekredit" },
}

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  existing?: string
}

type Provider = {
  id: string
  name: string
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: string | null
}

type ProviderItem = {
  provider: Provider
  product: {
    is_available_online: boolean
    is_available_live: boolean
  } | null
}

type ProvidersResponse = {
  ok: boolean
  items: ProviderItem[]
}

type LogoItem = {
  id: string
  name: string
  src: string
  variant: "icon" | "horizontal"
}

const SPARKASSE_PROVIDER_ID = "abcd7c3c-4e40-4e64-9a5f-a41ea7699a08"
const SPARKASSE_LOGO_PATH = "Sparkasse.svg.png"
const COMMERZBANK_PROVIDER_ID = "7954e840-9aa5-44e7-9a99-06dfbbfacb79"
const SANTANDER_PROVIDER_ID = "eee2c187-0c6d-4947-92f6-be1800f1a46d"
const TARGOBANK_PROVIDER_ID = "3198054c-cdfb-4465-939a-a083ac68d1a7"
const DKB_PROVIDER_ID = "c46a7c1d-4060-4b59-8b16-32571f751f4d"
const ING_PROVIDER_ID = "8332cd03-6bb4-47d6-822d-799843451d34"

const REQUESTED_LOGO_ORDER = [
  COMMERZBANK_PROVIDER_ID,
  SANTANDER_PROVIDER_ID,
  TARGOBANK_PROVIDER_ID,
  SPARKASSE_PROVIDER_ID,
  DKB_PROVIDER_ID,
  ING_PROVIDER_ID,
] as const

const SERVICE_POINTS = [
  {
    title: "100 % digital",
    text: "Anfrage, Angebotsauswahl, Unterlagen und bei passenden Banken auch Legitimation und Signatur komplett online.",
  },
  {
    title: "In 15 Minuten zum Kreditvertrag",
    text: "Kreditsumme, Laufzeit und Haushaltsdaten in einer kompakten Strecke erfassen statt in mehreren Formularen.",
  },
  {
    title: "Online abschließbar",
    text: "Ausgewählte Angebote laufen direkt digital weiter, ohne Papier und ohne Medienbruch zwischen den Schritten.",
  },
] as const

const SEO_POINTS = [
  "Onlinekredit in 15 Minuten digital starten",
  "Anfrage, Angebotsauswahl und Unterlagen in einer klaren Strecke statt in mehreren Portalen",
  "Ausgewählte Banken direkt 100 % online bis zur Legitimation und Signatur weiterführen",
]

const USE_CASES = ["Freie Verwendung", "Umschuldung", "Auto", "Renovierung", "Möbel", "PV & Speicher"]

function logoSrc(provider: Provider) {
  const prefer = provider?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const preferredFile = prefer === "icon" ? provider?.logo_icon_path : provider?.logo_horizontal_path
  const fallbackFile = prefer === "icon" ? provider?.logo_horizontal_path : provider?.logo_icon_path
  const file = preferredFile || fallbackFile
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
}

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchKonsumProviders(): Promise<ProviderItem[]> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}/api/baufi/providers?product=konsum`, { cache: "no-store" })
    if (!res.ok) return []
    const json = (await res.json().catch(() => null)) as ProvidersResponse | null
    if (!json?.ok || !Array.isArray(json.items)) return []
    return json.items
  } catch {
    return []
  }
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function formatScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function stars(value: number | null) {
  if (value == null) return "☆☆☆☆☆"
  const full = Math.max(0, Math.min(5, Math.round(value)))
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`
}

export default async function OnlinekreditPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const existingAccount = parseBoolParam(sp.existing)

  const [providers, reviewSummary] = await Promise.all([
    fetchKonsumProviders(),
    getPublishedWebsiteReviewSummarySet(),
  ])

  const availableById = new Map(
    providers
      .filter((item) => !!item.product)
      .map((item) => {
        const src = logoSrc(item.provider)
        if (!src) return null
        const variant = item.provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
        return { id: item.provider.id, name: item.provider.name, src, variant }
      })
      .filter((item): item is LogoItem => item !== null)
      .map((logo) => [logo.id, logo] as const),
  )

  const sparkasseFromProviders = availableById.get(SPARKASSE_PROVIDER_ID)
  const sparkasseFallback: LogoItem = {
    id: SPARKASSE_PROVIDER_ID,
    name: "Sparkasse",
    src: `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(SPARKASSE_LOGO_PATH)}`,
    variant: "icon",
  }
  const logos = REQUESTED_LOGO_ORDER.map((id) => {
    if (id === SPARKASSE_PROVIDER_ID) return sparkasseFromProviders ?? sparkasseFallback
    return availableById.get(id) ?? null
  }).filter((item): item is LogoItem => item !== null)

  const reviewStats = reviewSummary.overall

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_12%,rgba(56,189,248,0.24),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(16,185,129,0.20),transparent_30%),linear-gradient(135deg,#07162f_0%,#0b1f5e_55%,#0f3d82_100%)] p-4 text-white shadow-[0_24px_70px_rgba(2,6,23,0.32)] sm:rounded-[38px] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-emerald-300/18 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-cyan-300/18 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
            100 % digitaler Onlinekredit
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            In 15 Minuten zum Kreditvertrag.
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-relaxed text-slate-200/95 sm:text-[17px]">
            Kredit digital anfragen, passende Angebote sehen und ausgewählte Strecken komplett online abschließen.
            Ohne Papier, ohne Medienbruch und in einem klaren Ablauf von der Anfrage bis zu den Unterlagen.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/12 px-3 py-1">100 % digital</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">15 Minuten</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Komplett online abschließbar</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Ohne Papier</span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {SERVICE_POINTS.map((item, index) => (
              <div key={item.title} className="rounded-[22px] border border-white/16 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/14 text-xs font-semibold text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-slate-200/88">{item.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="#onlinekredit-wizard"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 sm:w-auto"
            >
              Jetzt online starten
            </Link>
            <Link
              href="#onlinekredit-inhalt"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 sm:w-auto"
            >
              Ablauf ansehen
            </Link>
            {reviewStats.count > 0 ? (
              <Link
                href="/bewertungen"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-center text-xs font-semibold text-white/95 backdrop-blur transition hover:bg-white/15 sm:w-auto sm:justify-start"
              >
                <span className="text-amber-300">{stars(reviewStats.average)}</span>
                <span>
                  {formatScore(reviewStats.average)} · {reviewStats.count} Bewertungen
                </span>
              </Link>
            ) : null}
          </div>
        </div>

        {logos.length ? (
          <div className="relative mt-8 rounded-[24px] border border-white/16 bg-white/8 p-3 backdrop-blur-sm sm:rounded-[28px] sm:p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200/80">
              Ausgewählte Partnerbanken
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/12 bg-white/90 px-3 py-2 sm:h-16 sm:px-4"
                >
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className={logo.variant === "icon" ? "h-8 w-8 object-contain" : "max-h-8 w-auto max-w-full object-contain"}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section id="onlinekredit-wizard">
        <OnlinekreditWizard
          caseId={caseId}
          caseRef={caseRef}
          accessToken={accessToken}
          existingAccount={existingAccount}
        />
      </section>

      <section id="onlinekredit-inhalt" className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm sm:rounded-[32px] sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Onlinekredit digital abschließen</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Schnell digital starten und sauber bis zum Abschluss weitergehen
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            <p>
              Ein Onlinekredit über SEPANA verbindet eine schnelle digitale Anfrage mit einem strukturierten Ablauf.
              Du erfasst Betrag, Laufzeit, persönliche Daten und Haushaltsangaben direkt im Wizard und siehst danach
              passende Angebote ohne Medienbruch.
            </p>
            <p>
              Wenn Unterlagen benötigt werden oder die Bank bereits Vertrags- und Datenschutzhinweise bereitstellt,
              bleibt alles in demselben Vorgang. Das spart Rückfragen, schafft Übersicht und macht den Weg vom Antrag
              bis zum Abschluss deutlich nachvollziehbarer.
            </p>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-[24px] border border-emerald-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.95))] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Was dich erwartet</div>
            <div className="mt-4 space-y-3">
              {SEO_POINTS.map((point) => (
                <div key={point} className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-700">
                  {point}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Typische Kreditwünsche</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Für viele klassische Onlinekredit-Fälle passend
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ob freie Verwendung, Umschuldung oder größere Anschaffungen: Die Strecke ist auf schnelle, klare
              Privatkredit-Anfragen ausgelegt.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {USE_CASES.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
