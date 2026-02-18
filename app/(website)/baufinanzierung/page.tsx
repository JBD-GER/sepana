import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { toNumber } from "@/lib/baufi/calc"
import BaufiStart from "./ui/BaufiStart"
import BaufiLiveStart from "./ui/BaufiLiveStart"

export const metadata: Metadata = {
  title: "Baufinanzierung Bankenvergleich | SEPANA",
  description:
    "Baufinanzierung mit transparentem Bankenvergleich: Eckdaten eingeben, Konditionsrahmen sehen, Angebote vergleichen und optional live finalisieren.",
  alternates: { canonical: "/baufinanzierung" },
}

type Provider = {
  id: string
  name: string
  slug: string
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: string | null
}

type ProviderItem = {
  provider: Provider
  term: {
    as_of_date: string
    apr_from: string | null
    apr_example: string | null
  } | null
}

type ProvidersResponse = {
  ok: boolean
  items: ProviderItem[]
}

const STEPS = [
  {
    title: "Eckdaten erfassen",
    text: "Vorhaben, Objektart und Kaufpreis reichen für den Start.",
  },
  {
    title: "Haushalt vervollständigen",
    text: "Einnahmen, Ausgaben und optionale Mitantragsteller transparent eintragen.",
  },
  {
    title: "Bankvorschläge vergleichen",
    text: "Passende Banken inklusive Konditionshinweisen und Verfügbarkeit auswählen.",
  },
  {
    title: "Upload und Abschluss",
    text: "Unterlagen sicher hochladen und bei Bedarf direkt live mit Beratern finalisieren.",
  },
]

const FAQ = [
  {
    q: "Ist der Vergleich kostenlos?",
    a: "Ja, der Start ist kostenlos. Sie erhalten eine strukturierte Einordnung für Ihren Finanzierungsfall.",
  },
  {
    q: "Wie transparent sind die Zinsen?",
    a: "Wir zeigen einen aktuellen Konditionsrahmen mit Stand-Datum und ergänzen im Vergleich bankindividuelle Hinweise.",
  },
  {
    q: "Wie viele Banken vergleichen Sie?",
    a: "Wir vergleichen ein breites Netzwerk mit über 500 Banken und zeigen Ihnen nur die relevanten Ergebnisse für Ihren Fall.",
  },
  {
    q: "Gibt es Live-Beratung?",
    a: "Ja. Sobald der Fall vorbereitet ist, können Sie direkt in die Live-Session wechseln.",
  },
]

function formatPct(value: number) {
  return `${value.toFixed(2).replace(".", ",")} %`
}

function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

function logoSrc(provider: Provider) {
  const file = provider?.logo_horizontal_path || provider?.logo_icon_path
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchProviders(): Promise<ProviderItem[]> {
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

export default async function BaufinanzierungPage() {
  const providers = await fetchProviders()
  const coverageLabel = "+500 Banken im Vergleich"

  const terms = providers.flatMap((item) => (item.term ? [item.term] : []))
  const aprFromValues = terms.map((term) => toNumber(term.apr_from)).filter((value) => value > 0)
  const aprExampleValues = terms.map((term) => toNumber(term.apr_example)).filter((value) => value > 0)
  const lowestApr = aprFromValues.length ? Math.min(...aprFromValues) : null
  const representativeApr = median(aprExampleValues)
  const latestAsOf =
    terms
      .map((term) => term.as_of_date)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null

  const lowestAprLabel = lowestApr != null ? `ab ${formatPct(lowestApr)} eff.` : "tagesaktuell"
  const representativeAprLabel = representativeApr != null ? `${formatPct(representativeApr)} eff.` : "fallabhängig"
  const latestAsOfLabel = formatDate(latestAsOf)

  const logos = providers
    .filter((item) => !!item.term)
    .map((item) => {
      const src = logoSrc(item.provider)
      if (!src) return null
      return { id: item.provider.id, name: item.provider.name, src }
    })
    .filter((item): item is { id: string; name: string; src: string } => item !== null)
    .slice(0, 6)

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_20px_64px_rgba(15,23,42,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Nur online beantragen</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Baufinanzierung/Hauskredit Vergleich</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200/95 sm:text-base">
            SEPANA führt Sie vom Erstvergleich bis zum Abschluss: transparent, digital und mit optionaler Expertenberatung.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/baufinanzierung/anfrage"
              className="inline-flex items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Kostenloses Angebot anfordern
            </Link>
            <a
              href="#vergleich-start"
              className="inline-flex items-center rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Direkt zum Vergleich
            </a>
          </div>

          <div className="mt-4 w-full">
            <BaufiLiveStart />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Konditionsrahmen</div>
              <div className="mt-1 text-lg font-semibold text-white">{lowestAprLabel}</div>
              <div className="mt-1 text-xs text-slate-200/90">
                {latestAsOfLabel ? `Stand: ${latestAsOfLabel}` : "Stand je Angebot im Vergleich"}
              </div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Beispielwert</div>
              <div className="mt-1 text-lg font-semibold text-white">{representativeAprLabel}</div>
              <div className="mt-1 text-xs text-slate-200/90">aus aktuellen Partnerkonditionen</div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Bankenabdeckung</div>
              <div className="mt-1 text-lg font-semibold text-white">{coverageLabel}</div>
              <div className="mt-1 text-xs text-slate-200/90">Nur die relevantesten Ergebnisse für Ihren Fall</div>
            </article>
          </div>

          {logos.length ? (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200/80">Auszug relevanter Banken aus dem Netzwerk</div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {logos.map((logo) => (
                  <div key={logo.id} className="flex h-14 items-center justify-center rounded-xl border border-white/20 bg-white/90 px-3">
                    <img src={logo.src} alt={logo.name} className="h-7 w-auto max-w-[130px] object-contain" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-slate-200/85">
            Hinweis: Werte sind unverbindliche Orientierungen. Finale Konditionen sind tagesaktuell sowie bonitäts- und objektabhängig.
          </p>
        </div>
      </section>

      <section id="vergleich-start" className="scroll-mt-24">
        <BaufiStart />
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">In vier Schritten zum Ziel</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {STEPS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Was wird benötigt</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Die wichtigsten Angaben</h3>

          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Objektdaten und Finanzierungszweck</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Haushaltsrechnung mit Einnahmen und Ausgaben</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Kontaktinformationen für Portal und Rückfragen</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Optional: Mitantragsteller mit Einkommen</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Vertrauen</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Darauf können Sie sich verlassen</h3>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Transparenter Konditionsrahmen mit Stand-Datum</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Bankenvergleich mit Verfügbarkeitsstatus</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">DSGVO-konformer Dokumentenhub</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Expertenberatung per Live-Session auf Wunsch</div>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FAQ</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Häufige Fragen</h2>
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

