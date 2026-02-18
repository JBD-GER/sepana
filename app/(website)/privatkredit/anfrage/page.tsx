import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import PrivatkreditLiveStart from "../ui/PrivatkreditLiveStart"
import PrivatkreditContactForm from "../ui/PrivatkreditContactForm"
import PrivatkreditReviews from "../ui/PrivatkreditReviews"
import PrivatkreditCallbackBox from "../ui/PrivatkreditCallbackBox"
import PrivatkreditRateCalculator from "../ui/PrivatkreditRateCalculator"

export const metadata: Metadata = {
  title: "Ratenkredit aufnehmen | SEPANA",
  description:
    "Ratenkredit aufnehmen mit transparenter Monatsrate: Betrag und Laufzeit einordnen, Anfrage senden und persönliche Rückmeldung erhalten.",
  alternates: { canonical: "/privatkredit/anfrage" },
}

const TRUST_POINTS = [
  "Ratenkredit mit klarer Monatsrate statt intransparenter Konditionen",
  "Schnelle Einschätzung auf Basis weniger Pflichtangaben",
  "Sichere, DSGVO-konforme Verarbeitung Ihrer Daten",
]

const BENEFITS = [
  {
    title: "Rate direkt verstehen",
    text: "Sie sehen sofort, wie sich Monatsrate, Zinsanteil und Tilgungsanteil zusammensetzen.",
  },
  {
    title: "Wenige Pflichtfelder",
    text: "Anfrage in kurzer Zeit abschicken, ohne lange Datenerfassung oder unnötige Formulare.",
  },
  {
    title: "Persönliche Begleitung",
    text: "Auf Wunsch gehen wir mit Ihnen live durch die Optionen und klären offene Fragen direkt.",
  },
]

const FLOW = [
  {
    title: "1. Rate simulieren",
    text: "Sie wählen Betrag und Laufzeit und erhalten sofort eine orientierende Monatsrate bei 5,99 %.",
  },
  {
    title: "2. Anfrage senden",
    text: "Sie übermitteln Ihre wichtigsten Kontaktdaten und den gewünschten Kreditrahmen.",
  },
  {
    title: "3. Rückmeldung erhalten",
    text: "Wir melden uns zeitnah mit einer klaren Einschätzung und den nächsten Schritten.",
  },
  {
    title: "4. Auszahlung vorbereiten",
    text: "Bei positiver Entscheidung kann die Auszahlung nach vollständigen Unterlagen schnell erfolgen.",
  },
]

const FAQ = [
  {
    q: "Ist der Rechner verbindlich?",
    a: "Nein. Die Werte dienen als Orientierung. Finale Konditionen hängen von Bonität, Laufzeit und Anbieter ab.",
  },
  {
    q: "Mit welchem Zinssatz wird gerechnet?",
    a: "Der Rechner nutzt einen festen Beispielzins von 5,99 % p.a. für eine transparente Einordnung.",
  },
  {
    q: "Kann ich die Laufzeit frei wählen?",
    a: "Ja. Sie können die Laufzeit in Monaten anpassen und sehen direkt, wie sich die Monatsrate verändert.",
  },
  {
    q: "Welche Daten brauche ich für die Anfrage?",
    a: "Für den Start reichen Vorname, Nachname, E-Mail, Telefon und Ihr gewünschter Kreditrahmen.",
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

export default async function PrivatkreditAnfragePage() {
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
    <div className="space-y-8 sm:space-y-12 lg:space-y-14">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.2),transparent_42%),radial-gradient(circle_at_90%_8%,rgba(16,185,129,0.18),transparent_38%),linear-gradient(135deg,#0f172a_0%,#0b2143_48%,#123a57_100%)] p-4 text-white shadow-[0_24px_70px_rgba(2,6,23,0.46)] sm:rounded-[36px] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-8">
          <div className="lg:pr-2">
            <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
              Ratenkredit · Anfrage
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Ratenkredit aufnehmen - klar kalkulieren, schnell anfragen.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Nutzen Sie den Rechner für eine transparente Monatsrate und senden Sie danach Ihre Anfrage mit wenigen Angaben. Persönliche Beratung ist jederzeit möglich.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-100/95">
              {TRUST_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="#ratenrechner"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 sm:w-auto"
              >
                Rate berechnen
              </Link>
              <Link
                href="#kontakt"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
              >
                Ratenkredit anfragen
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-sm sm:rounded-[30px] sm:p-4">
            <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-slate-100 shadow-inner">
              <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Live & persönlich
              </div>
              <div className="relative h-[260px] sm:h-[340px] lg:h-[420px]">
                <Image
                  src="/1769756216141_ChatGPT_Image_29._Jan._2026_14_51_21.png"
                  alt="Berater für Ratenkredit"
                  fill
                  priority
                  className="object-cover object-top"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Beispielzins</div>
                <div className="mt-1 text-lg font-semibold text-white">5,99 % p.a.</div>
                <div className="text-xs text-slate-200/85">für den Ratenrechner</div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Tempo</div>
                <div className="mt-1 text-lg font-semibold text-white">Schnelle Rückmeldung</div>
                <div className="text-xs text-slate-200/85">bei vollständigen Angaben</div>
              </div>
            </div>
          </div>
        </div>

        {logos.length ? (
          <div className="relative mt-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200/85">
              Partnerbanken für Ratenkredite
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

      <section id="ratenrechner" className="scroll-mt-24">
        <PrivatkreditRateCalculator />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6 lg:flex lg:h-full lg:flex-col lg:gap-6 lg:space-y-0">
          <div className="lg:[&>section]:h-full lg:[&>section]:min-h-[220px]">
            <PrivatkreditReviews />
          </div>
          <div id="live-start" className="scroll-mt-24 lg:flex-1 lg:[&>section]:h-full lg:[&>section]:min-h-[520px]">
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
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Ihr Weg zum Ratenkredit in 4 Schritten</h2>
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

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FAQ</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Häufige Fragen zum Ratenkredit</h2>
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
