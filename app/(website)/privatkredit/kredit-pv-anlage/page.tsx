import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import WebsiteReviewsOverviewCard from "../../components/WebsiteReviewsOverviewCard"
import { TeamSection } from "../../components/marketing/sections"
import PvQuickStartForm from "./ui/PvQuickStartForm"
import PvCashflowCalculator from "./ui/PvCashflowCalculator"

export const metadata: Metadata = {
  title: "PV-Anlage 100 % finanzieren | SEPANA",
  description:
    "Kredit für PV-Anlage mit KfW 270 oder Top-Ökokredit: 100 % Finanzierung ohne hohes Eigenkapital, Cashflow-Rechner und schnelle Rückmeldung.",
  alternates: { canonical: "/privatkredit/kredit-pv-anlage" },
}

const CORE_POINTS = [
  "KfW 270 oder Top-Ökokredit ab 3,27 %",
  "Cashflow-positiv ab Tag 1 möglich",
  "Rückmeldung meist innerhalb von 24 Stunden",
  "100 % Finanzierung ohne hohes Eigenkapital",
  "Sondertilgung und Ratenpause möglich",
  "Privat und gewerblich finanzierbar",
]

const FACT_CARDS = [
  {
    title: "24h Reaktion",
    text: "Antrag digital starten, Rückmeldung typischerweise innerhalb von 24 Stunden erhalten.",
  },
  {
    title: "1.200+ Finanzierungen",
    text: "Über 1.200 erfolgreich finanzierte PV-Anlagen über unser Netzwerk begleitet.",
  },
  {
    title: "Privat & Gewerblich",
    text: "Von privaten PV-Projekten bis zu gewerblichen Anfragen ab 5 Mio. € Volumen.",
  },
  {
    title: "Flexible Kreditstruktur",
    text: "Sondertilgung und Ratenpause helfen, die Finanzierung an den Ertragsverlauf anzupassen.",
  },
]

const CREDIT_STEPS = [
  {
    step: "01",
    title: "Anfrage starten",
    text: "Sie senden uns Ihre Eckdaten zur PV-Finanzierung über Schnellstart oder den PV Kredit Rechner.",
  },
  {
    step: "02",
    title: "Antrag mit Unterlagen",
    text: "Wir stellen gemeinsam den Antrag und prüfen die Unterlagen: Gehaltsnachweis, Ausweis und Kontoauszüge.",
  },
  {
    step: "03",
    title: "Bewilligung & Auszahlung",
    text: "Nach erfolgreicher Prüfung wird der Antrag bewilligt, inklusive möglicher KfW-Förderung, und die Finanzierung umgesetzt.",
  },
]

const SEO_TEXT_BLOCKS = [
  {
    title: "Kredit für PV-Anlage strukturiert planen",
    text:
      "Ein Kredit für eine PV-Anlage sollte nicht nur über den Zinssatz bewertet werden, sondern über die gesamte Wirkung auf Ihr monatliches Budget. Entscheidend ist, wie sich Kreditrate, Eigenverbrauch und Einspeisung zusammen entwickeln. Genau deshalb führen wir die Berechnung transparent zusammen und zeigen, ab wann ein positiver Cashflow realistisch erreichbar ist. So entsteht eine Entscheidung, die nicht auf einem einzelnen Werbeversprechen basiert, sondern auf nachvollziehbaren Zahlen für Ihr konkretes Vorhaben.",
  },
  {
    title: "PV-Anlage finanzieren ohne hohes Eigenkapital",
    text:
      "Viele Kundinnen und Kunden möchten ihre PV-Anlage finanzieren, ohne zunächst viel Eigenkapital zu binden. Mit passenden Kreditstrukturen, möglicher Sondertilgung und optionaler Ratenpause lässt sich die Finanzierung oft so aufbauen, dass sie flexibel bleibt. Wichtig ist dabei die Verbindung aus KfW-orientierter Förderlogik, bankfähiger Unterlagenstruktur und einer klaren Rückmeldung innerhalb kurzer Zeit. Dadurch bleibt der Prozess planbar und die Umsetzung wird nicht durch unnötige Reibung verzögert.",
  },
  {
    title: "Photovoltaik-Kredit mit Beratung statt Standardstrecke",
    text:
      "Ein Photovoltaik-Kredit ist mehr als ein Online-Formular. In der Praxis geht es um Laufzeitstrategie, Tragfähigkeit im Alltag und die Frage, wie schnell sich das Projekt wirtschaftlich trägt. Deshalb kombinieren wir Rechner, Partnerbanken und persönliche Beratung in einem Ablauf. Sie erhalten eine saubere Einordnung, welche Kreditsumme, welche Rate und welche Laufzeit zu Ihrer Situation passt. Das schafft Klarheit vor der Anfrage und reduziert Fehlentscheidungen im weiteren Finanzierungsprozess.",
  },
]

const FAQ_ITEMS = [
  {
    q: "Ist der PV Kredit Rechner verbindlich?",
    a: "Nein. Die Berechnung dient als Orientierung für Ihre Finanzierung. Die finalen Konditionen hängen von Bonität, Bank und konkreter Ausgestaltung ab.",
  },
  {
    q: "Kann ich eine PV-Anlage ohne Eigenkapital finanzieren?",
    a: "Ja, in vielen Fällen ist eine Finanzierung ohne hohes Eigenkapital möglich. Die konkrete Struktur wird anhand Ihrer Daten und des Vorhabens geprüft.",
  },
  {
    q: "Wie schnell bekomme ich eine Rückmeldung?",
    a: "Bei vollständigen Angaben erhalten Sie in der Regel innerhalb von 24 Stunden eine erste Rückmeldung zu den nächsten Schritten.",
  },
  {
    q: "Sind Sondertilgungen und Ratenpausen möglich?",
    a: "Je nach Bank und Produkt sind Sondertilgungen sowie flexible Ratenmodelle möglich. Wir prüfen diese Optionen im Rahmen Ihrer Anfrage.",
  },
  {
    q: "Eignet sich die Finanzierung auch für gewerbliche Projekte?",
    a: "Ja. Neben privaten Vorhaben begleiten wir auch gewerbliche PV-Finanzierungen, inklusive größerer Volumina.",
  },
  {
    q: "Welche Unterlagen sollte ich für die Anfrage vorbereiten?",
    a: "Hilfreich sind ein Angebot zur PV-Anlage, grobe Verbrauchsdaten und Ihre Kontaktdaten. Für die erste Einordnung reichen meist wenige Angaben aus.",
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
  const prefer = provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const preferredFile = prefer === "icon" ? provider.logo_icon_path : provider.logo_horizontal_path
  const fallbackFile = prefer === "icon" ? provider.logo_horizontal_path : provider.logo_icon_path
  const file = preferredFile || fallbackFile
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
}

async function getBaseUrl() {
  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000"
  const proto = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchKonsumProviders(): Promise<ProviderItem[]> {
  try {
    const base = await getBaseUrl()
    const response = await fetch(`${base}/api/baufi/providers?product=konsum`, { cache: "no-store" })
    if (!response.ok) return []
    const json = (await response.json().catch(() => null)) as ProvidersResponse | null
    if (!json?.ok || !Array.isArray(json.items)) return []
    return json.items
  } catch {
    return []
  }
}

export default async function PvKreditLandingPage() {
  const providers = await fetchKonsumProviders()
  const logosById = new Map(
    providers
      .filter((item) => !!item.product)
      .map((item) => {
        const src = logoSrc(item.provider)
        if (!src) return null
        const variant = item.provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
        return { id: item.provider.id, name: item.provider.name, src, variant }
      })
      .filter((item): item is LogoItem => item !== null)
      .map((item) => [item.id, item] as const),
  )

  const sparkasseFallback: LogoItem = {
    id: SPARKASSE_PROVIDER_ID,
    name: "Sparkasse",
    src: `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(SPARKASSE_LOGO_PATH)}`,
    variant: "icon",
  }

  const bankLogos = REQUESTED_LOGO_ORDER.map((id) => {
    if (id === SPARKASSE_PROVIDER_ID) return logosById.get(id) ?? sparkasseFallback
    return logosById.get(id) ?? null
  }).filter((item): item is LogoItem => item !== null)

  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.18),transparent_40%),radial-gradient(circle_at_88%_16%,rgba(45,212,191,0.16),transparent_36%),linear-gradient(145deg,#052e35_0%,#0b3e60_52%,#165c73_100%)] p-4 text-white shadow-[0_28px_80px_rgba(2,6,23,0.34)] sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/18 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-300/16 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
              Privatkredit · Kredit PV Anlage
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              PV-Anlage 100 % finanzieren
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-100/95 sm:text-base">
              KfW 270 oder Top-Ökokredit ab 3,27 %: Cashflow-positiv ab Tag 1 möglich, ohne hohes Eigenkapital.
              Nutzen Sie den Schnellstart oder rechnen Sie Ihre Monatsrate direkt mit Ersparnis und Einspeisung gegen.
            </p>

            <ul className="mt-6 grid gap-2 text-sm text-slate-100/95 sm:grid-cols-2">
              {CORE_POINTS.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Antwortzeit</div>
                <div className="mt-1 text-xl font-semibold">24 Stunden</div>
                <div className="text-xs text-slate-200/90">bei vollständigen Angaben</div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">Erfolg</div>
                <div className="mt-1 text-xl font-semibold">1.200+</div>
                <div className="text-xs text-slate-200/90">finanzierte PV-Anlagen</div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="#quick-start"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:w-auto"
              >
                Kreditanfrage starten
              </Link>
              <Link
                href="#rechner"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 sm:w-auto"
              >
                Cashflow berechnen
              </Link>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-200/90">
              Repräsentatives Beispiel KfW-270-Darlehen ab 3,27 %. Je nach Bonität erhalten 2/3 der Kunden Zinssätze
              zwischen 6,99 % und 9,99 %.
            </p>
          </div>

          <div className="space-y-4">
            <PvQuickStartForm />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_58px_rgba(15,23,42,0.08)] sm:p-7">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-emerald-200 bg-[linear-gradient(140deg,#ecfdf5_0%,#f0fdfa_52%,#ecfeff_100%)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">KfW zuerst</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">KfW 270 im Fokus</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              KfW-Förderdarlehen als starker Einstieg in die Finanzierung Ihrer PV-Anlage.
            </p>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
              <Image src="/kfw_logo_1280-2x.png" alt="KfW Logo" width={280} height={90} className="h-10 w-auto" />
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <div>ab 3,27 % Beispielzins</div>
                <div>Sondertilgung und Ratenpause möglich</div>
                <div>100 % Finanzierung ohne hohes Eigenkapital</div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
            <Image
              src="/pv-anlage.png"
              alt="Photovoltaik-Anlage auf Hausdach"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1280px) 100vw, 45vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/68 via-slate-950/8 to-transparent" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-white/10 p-3 text-white backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200">PV-Finanzierung</div>
              <div className="mt-1 text-sm font-semibold">Rate, Ersparnis und Einspeisung direkt gegenüberstellen</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dann Partnerbanken</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Partnerbanken</h2>
          {bankLogos.length ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {bankLogos.map((logo) => (
                <div
                  key={logo.id}
                  className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={logo.variant === "icon" ? 32 : 120}
                    height={32}
                    className={logo.variant === "icon" ? "h-8 w-8 object-contain" : "max-h-8 w-auto max-w-full object-contain"}
                    loading="lazy"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Bankenlogos werden geladen.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {FACT_CARDS.map((card) => (
          <article key={card.title} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Vorteil</div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.text}</p>
          </article>
        ))}
      </section>

      <section id="rechner" className="scroll-mt-24">
        <PvCashflowCalculator />
      </section>

      <TeamSection
        eyebrow="Team"
        title="Ihre Berater wie auf der Startseite"
        description="Herr Pfad, Herr Wagner und Frau Müller begleiten Ihre PV-Kreditanfrage persönlich und strukturiert."
      />

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Direkt bewertete Finanzierungsberatung"
        description="Transparenter Einblick in unsere veröffentlichten Bewertungen aus Baufinanzierung und Privatkredit."
      />

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Voraussetzungen & Schritte</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            So läuft Ihr PV-Kredit ab
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Klarer Ablauf vom Erstkontakt bis zur Bewilligung, inklusive Prüfung einer möglichen KfW-Förderung.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {CREDIT_STEPS.map((item) => (
            <article key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Schritt {item.step}</div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Häufige Fragen zum PV-Kredit
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">PV Kredit Wissen</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Wichtige Hintergründe zur Finanzierung Ihrer PV-Anlage
          </h2>
        </div>
        <div className="space-y-4">
          {SEO_TEXT_BLOCKS.map((block) => (
            <article key={block.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{block.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">{block.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Nächste Schritte</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Jetzt Anfrage starten</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Wenn Sie möchten, starten wir direkt mit den Eckdaten und melden uns mit einer klaren Einordnung.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="#quick-start"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Kreditanfrage starten
          </Link>
          <Link
            href="#rechner"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Zum PV Kredit Rechner
          </Link>
        </div>
      </section>
    </div>
  )
}
