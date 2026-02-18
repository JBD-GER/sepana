import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import PrivatkreditLiveStart from "./ui/PrivatkreditLiveStart"
import PrivatkreditContactForm from "./ui/PrivatkreditContactForm"
import PrivatkreditReviews from "./ui/PrivatkreditReviews"
import PrivatkreditCallbackBox from "./ui/PrivatkreditCallbackBox"

export const metadata: Metadata = {
  title: "Privatkredit Anfrage | SEPANA",
  description:
    "Moderne Privatkredit-Landingpage mit persönlicher Beratung, transparenter Zinsprüfung und schneller Auszahlung bei positiver Entscheidung.",
  alternates: { canonical: "/privatkredit" },
}

const TRUST_POINTS = [
  "Persönliche Beratung statt anonymer Standardstrecke",
  "Transparente Konditionseinschätzung in Echtzeit",
  "Sichere, DSGVO-konforme Verarbeitung Ihrer Daten",
]

const BENEFITS = [
  {
    title: "Klarer Prozess",
    text: "Sie wissen zu jedem Zeitpunkt, was als Nächstes passiert und welche Unterlagen wirklich benötigt werden.",
  },
  {
    title: "Direkter Kontakt",
    text: "Auf Wunsch starten Sie sofort die Live-Beratung und sprechen direkt mit einer Beraterin oder einem Berater.",
  },
  {
    title: "Schnelle Entscheidungen",
    text: "Bei vollständigen Angaben erhalten Sie eine zügige Rückmeldung und können ohne Verzögerung weitermachen.",
  },
]

const FLOW = [
  {
    title: "1. Anfrage starten",
    text: "Sie übermitteln Ihre wichtigsten Eckdaten sicher über das Kontaktformular oder starten direkt die Live-Beratung.",
  },
  {
    title: "2. Zinssatz in Echtzeit prüfen",
    text: "Wir prüfen Ihre Zinsspanne auf Basis Ihrer Angaben direkt im Gespräch oder unmittelbar nach Eingang Ihrer Anfrage.",
  },
  {
    title: "3. Klare Rückmeldung erhalten",
    text: "Sie erhalten zeitnah eine transparente Einschätzung, welche Unterlagen benötigt werden und wie der nächste Schritt aussieht.",
  },
  {
    title: "4. Auszahlung in bis zu 48 Stunden",
    text: "Bei positiver Entscheidung und vollständigen Unterlagen kann die Auszahlung innerhalb von bis zu 48 Stunden erfolgen.",
  },
]

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

export default async function PrivatkreditPage() {
  const providers = await fetchKonsumProviders()
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

  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.2),transparent_42%),radial-gradient(circle_at_90%_8%,rgba(16,185,129,0.18),transparent_38%),linear-gradient(135deg,#0f172a_0%,#0b2143_48%,#123a57_100%)] p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.46)] sm:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.12fr_0.88fr] xl:items-end">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
              Privatkredit · Finale Anfrage
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Smart finanzieren. Persönlich beraten. Schnell entscheiden.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Diese Seite ist Ihr direkter Weg zum Privatkredit. Ohne überladene Vergleichslisten, dafür mit klarer
              Beratung, transparenter Zinseinordnung und einem Ablauf, der auf zügige Entscheidungen ausgelegt ist.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-100/95">
              {TRUST_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#kontakt"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Anfrage jetzt starten
              </Link>
              <Link
                href="#live-start"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Zur Live-Beratung
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/20 bg-white/10 p-4 shadow-xl backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-slate-100 shadow-inner">
              <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Live & persönlich
              </div>
              <div className="relative h-[360px] sm:h-[420px]">
                <Image
                  src="/1769756216141_ChatGPT_Image_29._Jan._2026_14_51_21.png"
                  alt="Berater für Privatkredit"
                  fill
                  priority
                  className="object-cover object-top"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Bewertungen</div>
                <div className="mt-1 text-lg font-semibold text-white">5,0 / 5,0</div>
                <div className="text-xs text-slate-200/85">25 aktuelle Stimmen</div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Tempo</div>
                <div className="mt-1 text-lg font-semibold text-white">48h Auszahlung*</div>
                <div className="text-xs text-slate-200/85">bei positiver Entscheidung</div>
              </div>
            </div>
          </div>
        </div>

        {logos.length ? (
          <div className="relative mt-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200/85">
              Konsumkredit-Partnerbanken
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6 xl:flex xl:h-full xl:flex-col xl:gap-6 xl:space-y-0">
          <div className="xl:[&>section]:h-full xl:[&>section]:min-h-[220px]">
            <PrivatkreditReviews />
          </div>
          <div id="live-start" className="scroll-mt-24 xl:flex-1 xl:[&>section]:h-full xl:[&>section]:min-h-[520px]">
            <PrivatkreditLiveStart />
          </div>
        </div>

        <div id="kontakt" className="scroll-mt-24">
          <PrivatkreditContactForm />
        </div>
      </div>

      <section id="rueckruf" className="scroll-mt-24">
        <PrivatkreditCallbackBox />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {BENEFITS.map((item) => (
          <article key={item.title} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Vorteil</div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">So läuft es ab</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Ihr Weg zum Privatkredit in 4 Schritten</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {FLOW.map((step, idx) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Schritt {idx + 1}</div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
