import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import BaufiLeadFunnel from "./ui/BaufiLeadFunnel"

export const metadata: Metadata = {
  title: "Baufinanzierung anfragen | SEPANA",
  description:
    "Kostenloses Baufinanzierungs-Angebot anfordern: Bedarf erfassen, monatliche Rate transparent einordnen und mit wenigen Angaben anfragen.",
  alternates: { canonical: "/baufinanzierung/anfrage" },
  openGraph: {
    title: "Baufinanzierung anfragen | SEPANA",
    description:
      "Schnelle Baufinanzierungs-Anfrage mit klarer Rate, mehr Transparenz und persönlicher Rückmeldung.",
    url: "/baufinanzierung/anfrage",
    type: "website",
  },
}

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gad_source",
  "gad_campaignid",
  "gbraid",
  "wbraid",
] as const

const PROCESS = [
  {
    title: "1. Bedarf erfassen",
    text: "Sie geben Finanzierungsbedarf, Vorhaben und Immobilienart ein und sehen sofort eine orientierende Monatsrate.",
  },
  {
    title: "2. Daten senden",
    text: "Mit wenigen Kontaktdaten fordern Sie Ihr kostenloses Angebot an - ohne lange Pflichtformulare.",
  },
  {
    title: "3. Persönliche Rückmeldung",
    text: "Wir melden uns zeitnah mit einer ersten Einschätzung und den nächsten sinnvollen Schritten.",
  },
  {
    title: "4. Vergleich & Umsetzung",
    text: "Wenn Sie möchten, gehen wir direkt in den Bankenvergleich und begleiten die Umsetzung bis zum Abschluss.",
  },
]

const FAQ = [
  {
    q: "Ist die Anfrage wirklich kostenlos?",
    a: "Ja. Die Anfrage und die erste Einschätzung sind kostenlos und unverbindlich.",
  },
  {
    q: "Wie wird die Beispielrate berechnet?",
    a: "Die Vorschau nutzt 3,30 % Sollzins p.a., 2,00 % anfängliche Tilgung und 10 Jahre Zinsbindung als Orientierung.",
  },
  {
    q: "Sind dafür schon Unterlagen nötig?",
    a: "Nein. Für die erste Anfrage reichen wenige Angaben. Unterlagen besprechen wir erst im nächsten Schritt.",
  },
  {
    q: "Kann ich danach noch etwas anpassen?",
    a: "Ja. Finanzierungsbedarf und Details können später mit uns gemeinsam verfeinert werden.",
  },
]

type SearchParams = Record<string, string | string[] | undefined>

type Provider = {
  id: string
  name: string
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: string | null
}

type ProviderItem = {
  provider: Provider
}

type ProvidersResponse = {
  ok: boolean
  items: ProviderItem[]
}

const EXCLUDED_BAUFI_PROVIDER_IDS = new Set([
  "abcd7c3c-4e40-4e64-9a5f-a41ea7699a08", // Sparkasse
  "253307b6-ad83-4de4-9f77-e6eba95f6492", // Volksbank / VR
])

function toFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function pickTracking(params: SearchParams) {
  const tracking: Record<string, string> = {}
  for (const key of TRACKING_KEYS) {
    const value = toFirstValue(params[key])
    if (!value) continue
    tracking[key] = value
  }
  return tracking
}

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

async function fetchBaufiProviders(): Promise<ProviderItem[]> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}/api/baufi/providers?product=baufi`, { cache: "no-store" })
    if (!res.ok) return []
    const json = (await res.json().catch(() => null)) as ProvidersResponse | null
    if (!json?.ok || !Array.isArray(json.items)) return []
    return json.items
  } catch {
    return []
  }
}

export default async function BaufiLeadRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [resolvedSearchParams, providers] = await Promise.all([searchParams, fetchBaufiProviders()])
  const tracking = pickTracking(resolvedSearchParams)

  const logoMap = new Map<string, { id: string; name: string; src: string; variant: "icon" | "horizontal" }>()
  for (const item of providers) {
    if (EXCLUDED_BAUFI_PROVIDER_IDS.has(item.provider.id)) continue
    const src = logoSrc(item.provider)
    if (!src) continue
    if (logoMap.has(item.provider.id)) continue
    const variant = item.provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
    logoMap.set(item.provider.id, {
      id: item.provider.id,
      name: item.provider.name,
      src,
      variant,
    })
  }
  const logos = Array.from(logoMap.values()).slice(0, 12)

  return (
    <div className="space-y-8 sm:space-y-12 lg:space-y-14">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.2),transparent_42%),radial-gradient(circle_at_90%_8%,rgba(16,185,129,0.18),transparent_38%),linear-gradient(135deg,#0f172a_0%,#0b2143_48%,#123a57_100%)] p-4 text-white shadow-[0_24px_70px_rgba(2,6,23,0.46)] sm:rounded-[36px] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-8">
          <div className="lg:pr-2">
            <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
              Baufinanzierung · Kostenlose Anfrage
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Baufinanzierung anfragen und Rate sofort einordnen.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Fordern Sie jetzt Ihr kostenloses Angebot an. Sie sehen direkt eine klare Beispielrate und senden danach nur die wichtigsten Kontaktdaten.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-100/95">
              <li className="flex gap-2">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                <span>Mehr Transparenz: Zinssatz, Tilgung und Monatsrate werden sofort sichtbar.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                <span>Wenige Pflichtfelder: erst Bedarf, dann Kontakt - ohne Papierchaos.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                <span>Persönliche Rückmeldung statt anonymer Standardstrecke.</span>
              </li>
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#anfrage"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 sm:w-auto"
              >
                Kostenloses Angebot anfordern
              </a>
              <Link
                href="/baufinanzierung"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
              >
                Zur Vergleichsseite
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-sm sm:rounded-[30px] sm:p-4">
            <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-slate-100 shadow-inner">
              <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Persönlich & digital
              </div>
              <div className="relative h-[260px] sm:h-[340px] lg:h-[420px]">
                <Image
                  src="/1769756216141_ChatGPT_Image_29._Jan._2026_14_51_21.png"
                  alt="Beratung für Baufinanzierung"
                  fill
                  priority
                  className="object-cover object-top"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Beispielzins</div>
                <div className="mt-1 text-lg font-semibold text-white">3,30 % p.a.</div>
                <div className="text-xs text-slate-200/85">für die Orientierung im Rechner</div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Zinsbindung</div>
                <div className="mt-1 text-lg font-semibold text-white">10 Jahre</div>
                <div className="text-xs text-slate-200/85">inkl. 2,00 % anfänglicher Tilgung</div>
              </div>
            </div>
          </div>
        </div>

        {logos.length ? (
          <div className="relative mt-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200/85">
              Partnerbanken im Netzwerk
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {logos.map((logo) => (
                <div key={logo.id} className="flex h-16 items-center justify-center rounded-xl border border-white/20 bg-white/95 px-4 py-2">
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

      <section id="anfrage" className="scroll-mt-24">
        <BaufiLeadFunnel initialTracking={tracking} />
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">So läuft Ihre Anfrage ab</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {PROCESS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Transparenz</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Rate nachvollziehbar erklärt</h3>
          <p className="mt-2 text-sm text-slate-600">Sie sehen, wie sich Zins- und Tilgungsanteil zusammensetzen.</p>
        </article>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Vertrauen</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Starkes Banken-Netzwerk</h3>
          <p className="mt-2 text-sm text-slate-600">Wir prüfen passende Optionen aus einem breiten Partnernetzwerk.</p>
        </article>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Service</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Persönliche Begleitung</h3>
          <p className="mt-2 text-sm text-slate-600">Sie entscheiden das Tempo, wir liefern Struktur und Klarheit.</p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FAQ</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Häufige Fragen zur Anfrage</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
