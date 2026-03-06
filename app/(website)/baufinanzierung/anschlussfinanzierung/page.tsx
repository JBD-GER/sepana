import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import WebsiteReviewsOverviewCard from "@/app/(website)/components/WebsiteReviewsOverviewCard"
import { TeamSection, ValueGridSection } from "@/app/(website)/components/marketing/sections"
import AnschlussfinanzierungRechner from "./ui/AnschlussfinanzierungRechner"
import AnschlussKurzanfrageForm from "./ui/AnschlussKurzanfrageForm"

export const metadata: Metadata = {
  title: "Anschlussfinanzierung & Forward-Darlehen | SEPANA Finanzpartner",
  description:
    "Anschlussfinanzierung mit klarer Strategie: Zinsbindung prüfen, Optionen vergleichen und mit SEPANA persönlich in die nächste Finanzierung gehen. Inklusive Forward-Darlehen.",
  alternates: { canonical: "/baufinanzierung/anschlussfinanzierung" },
}

const ADVANTAGES = [
  {
    title: "Frühzeitig Zinssicherheit aufbauen",
    text: "Mit einem Forward-Darlehen sichern Sie sich Konditionen frühzeitig für die Anschlussfinanzierung, bevor die aktuelle Zinsbindung endet.",
  },
  {
    title: "Ablauf statt Aktionismus",
    text: "Wir planen Rückfragen, Unterlagen und Bankansprache rechtzeitig, damit die Entscheidung nicht unter Zeitdruck passiert.",
  },
  {
    title: "Optionen klar gegeneinander prüfen",
    text: "Umschuldung oder Forward Darlehen: Wir arbeiten transparent heraus, welche Variante zu Ihrem Objekt und Haushalt passt.",
  },
]

const TIMELINE = [
  {
    phase: "36-24 Monate vorher",
    title: "Strategie und Zinsszenario",
    text: "Restschuld, Haushaltsdaten und Zielrate sauber aufsetzen. So wird früh klar, welche Lösung realistisch und sinnvoll ist.",
  },
  {
    phase: "24-12 Monate vorher",
    title: "Forward oder klassischer Anschlussvertrag",
    text: "Wir stellen Forward-Darlehen und klassischen Darlehensvertrag mit Ablöse der alten Finanzierung transparent gegenüber.",
  },
  {
    phase: "12-0 Monate vorher",
    title: "Abschluss und Übergang",
    text: "Dokumente finalisieren, Auszahlungstermin abstimmen und den Wechsel in die neue Finanzierung sauber organisieren.",
  },
]

const FAQ = [
  {
    question: "Was ist eine Anschlussfinanzierung?",
    answer:
      "Die Anschlussfinanzierung regelt Ihre Restschuld nach Ende der Zinsbindung. Typische Wege sind eine Umschuldung oder ein Forward-Darlehen.",
  },
  {
    question: "Wann ist ein Forward-Darlehen sinnvoll?",
    answer:
      "Ein Forward-Darlehen kann sinnvoll sein, wenn Ihre Zinsbindung in den nächsten Jahren endet und Sie heutige Konditionen sichern wollen. Entscheidend sind Laufzeit, Forward-Aufschlag und Ihre Rate.",
  },
  {
    question: "Wie starten wir bei SEPANA?",
    answer:
      "Sie starten über die Kreditanfrage, wählen Baufinanzierung und geben die Eckdaten ein. Danach strukturieren wir die Anschlussfinanzierung gemeinsam Schritt für Schritt.",
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
}

type ProvidersResponse = {
  ok: boolean
  items: ProviderItem[]
}

type BankLogo = {
  id: string
  name: string
  src: string
  variant: "icon" | "horizontal"
}

const EXCLUDED_PROVIDER_IDS = new Set([
  "abcd7c3c-4e40-4e64-9a5f-a41ea7699a08", // Sparkasse
  "253307b6-ad83-4de4-9f77-e6eba95f6492", // Volksbank / VR
])

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

async function fetchPartnerbankLogos(): Promise<BankLogo[]> {
  try {
    const base = await getBaseUrl()
    const response = await fetch(`${base}/api/baufi/providers?product=baufi`, { cache: "no-store" })
    if (!response.ok) return []
    const json = (await response.json().catch(() => null)) as ProvidersResponse | null
    if (!json?.ok || !Array.isArray(json.items)) return []

    const logos = new Map<string, BankLogo>()
    for (const item of json.items) {
      if (EXCLUDED_PROVIDER_IDS.has(item.provider.id)) continue
      const src = logoSrc(item.provider)
      if (!src) continue
      if (logos.has(item.provider.id)) continue
      logos.set(item.provider.id, {
        id: item.provider.id,
        name: item.provider.name,
        src,
        variant: item.provider.preferred_logo_variant === "icon" ? "icon" : "horizontal",
      })
    }

    return Array.from(logos.values())
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .slice(0, 8)
  } catch {
    return []
  }
}

export default async function AnschlussfinanzierungPage() {
  const bankLogos = await fetchPartnerbankLogos()

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_10%_10%,rgba(45,212,191,0.2),transparent_34%),radial-gradient(circle_at_88%_14%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,#041227_0%,#0a2a58_52%,#0f4c81_100%)] p-5 text-white shadow-[0_22px_66px_rgba(2,6,23,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-cyan-300/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-blue-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.06fr_0.94fr] xl:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              Baufinanzierung Unterpunkt
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
              Anschlussfinanzierung mit Plan: heute vorbereiten, morgen entspannt verlängern.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Wir begleiten Ihre Anschlussfinanzierung persönlich und strategisch. Ob Umschuldung oder
              Forward-Darlehen: Sie erhalten einen klaren Ablauf, eine realistische Einschätzung und eine saubere Umsetzung.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Anschlussfinanzierung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Forward-Darlehen</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Umschuldung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Zinsbindung</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#kurzanfrage"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Kurzanfrage starten
              </Link>
              <Link
                href="#rechner"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Zum Rechner
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-[24px] border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="relative h-[250px] overflow-hidden rounded-[18px] border border-white/10 bg-slate-900 sm:h-[300px]">
                <Image
                  src="/familie_kueche.jpg"
                  alt="Beratung zur Anschlussfinanzierung"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Forward Darlehen</div>
                  <div className="mt-1 text-sm font-semibold sm:text-base">Zinsen sichern, bevor die alte Bindung endet</div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Restschuld</div>
              <div className="mt-2 text-lg font-semibold text-white">Daten klar aufbereiten</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Saubere Eckdaten reduzieren Rückfragen und beschleunigen die Bankansprache.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Timing</div>
              <div className="mt-2 text-lg font-semibold text-white">Früh starten lohnt sich</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Je früher Sie planen, desto mehr Optionen haben Sie bei Anschlussfinanzierung und Forward-Darlehen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="partnerbanken" className="scroll-mt-24 rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Partnerbanken</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Starke Partnerbanken für Ihre Anschlussfinanzierung
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Für Anschlussfinanzierung und Forward-Darlehen vergleichen wir passende Banken aus dem SEPANA Netzwerk.
              Entscheidend sind nicht nur der Zins, sondern das Gesamtpaket aus Rate, Laufzeit und Flexibilität.
            </p>
          </div>

          <Link
            href="#kurzanfrage"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Zur Kurzanfrage
          </Link>
        </div>

        {bankLogos.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {bankLogos.map((logo) => (
              <div
                key={logo.id}
                className="flex h-16 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 shadow-sm"
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.variant === "icon" ? 32 : 140}
                  height={32}
                  className={logo.variant === "icon" ? "h-8 w-8 object-contain" : "max-h-8 w-auto max-w-[140px] object-contain"}
                  loading="lazy"
                  unoptimized
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Partnerbanken werden geladen.</p>
        )}
      </section>

      <AnschlussfinanzierungRechner />

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Bewertungen direkt nach dem Rechner"
        description="So bewerten Kundinnen und Kunden die Zusammenarbeit mit SEPANA in der Baufinanzierung."
        ctaHref="#kurzanfrage"
        ctaLabel="Zur Kurzanfrage"
      />

      <AnschlussKurzanfrageForm />

      <ValueGridSection
        eyebrow="Ihr Vorteil"
        title="Darum funktioniert unsere Anschlussfinanzierung in der Praxis"
        description="Wir verbinden Beratung, Struktur und Timing. Dadurch können Sie Entscheidungen treffen, bevor Zeitdruck entsteht."
        items={ADVANTAGES}
      />

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ablauf</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            So planen wir Ihre Anschlussfinanzierung Schritt für Schritt
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Je nach Restlaufzeit setzen wir unterschiedliche Schwerpunkte. So bleibt die Finanzierung planbar und nachvollziehbar.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {TIMELINE.map((item) => (
            <article
              key={item.phase}
              className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm"
            >
              <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                {item.phase}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-slate-900">
            <div className="relative h-[260px] sm:h-[320px] lg:h-full lg:min-h-[360px]">
              <Image
                src="/familie_haus.jpg"
                alt="Familie bei der Entscheidung zur Anschlussfinanzierung"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
          </div>

          <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Checkliste</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Diese Punkte sollten vor dem Abschluss geklärt sein
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Wir prüfen mit Ihnen die wesentlichen Faktoren, damit das ausgewählte Modell auch langfristig zu Ihrer
              Lebenssituation passt.
            </p>

            <div className="mt-4 space-y-2">
              {[
                "Restschuld und gewünschte Monatsrate realistisch abstimmen",
                "Sollzinsbindung und Tilgung passend zur Lebensplanung wählen",
                "Nebenkosten für Umschuldung und Grundbuch im Blick behalten",
                "Konditionen für Umschuldung und Forward-Darlehen vergleichen",
              ].map((point) => (
                <div key={point} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <span className="mt-[1px] text-[#0b1f5e]">•</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Häufige Fragen zur Anschlussfinanzierung</h2>
        </div>

        <div className="mt-5 grid gap-3">
          {FAQ.map((item) => (
            <article key={item.question} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <TeamSection
        eyebrow="Team Anschlussfinanzierung"
        title="Persönliche Begleitung bis zum neuen Zins"
        description="Unser Team begleitet Sie von der ersten Einordnung bis zum finalen Abschluss Ihrer Anschlussfinanzierung."
      />

      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3b80_100%)] p-6 text-white shadow-[0_20px_60px_rgba(2,6,23,0.28)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 top-0 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/85">Nächster Schritt</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Jetzt direkt auf dieser Seite anfragen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-200/90 sm:text-base">
              Rechnerdaten prüfen, Bewertungen ansehen und dann per Kurzanfrage den Rückruf starten.
            </p>
          </div>

          <Link
            href="#kurzanfrage"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            Zur Kurzanfrage
          </Link>
        </div>
      </section>
    </div>
  )
}
