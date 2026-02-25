import type { Metadata } from "next"
import Link from "next/link"
import BaufiLeadFunnel from "../baufinanzierung/anfrage/ui/BaufiLeadFunnel"
import WebsiteReviewsOverviewCard from "../components/WebsiteReviewsOverviewCard"
import { getPublishedWebsiteReviewSummarySet } from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Finanzierungsanfrage | SEPANA",
  description:
    "Offizielle Finanzierungsanfrage fuer Baufinanzierung: Bedarf erfassen, Kontaktdaten senden und direkte Rueckmeldung erhalten.",
  alternates: { canonical: "/funnel-vorlage" },
  openGraph: {
    title: "Finanzierungsanfrage | SEPANA",
    description:
      "Finanzierungsbedarf direkt anfragen, Daten absenden und die naechsten Schritte mit SEPANA abstimmen.",
    url: "/funnel-vorlage",
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

const PROCESS_STEPS = [
  {
    title: "1. Bedarf angeben",
    text: "Sie geben Finanzierungsbedarf, Vorhaben und Objektart ein. Die Rate wird sofort als Orientierung dargestellt.",
  },
  {
    title: "2. Kontakt absenden",
    text: "Mit wenigen Pflichtfeldern senden Sie Ihre Anfrage. Kein langes Formular, kein Dokumentenupload im ersten Schritt.",
  },
  {
    title: "3. Rueckmeldung erhalten",
    text: "Sie erhalten eine Bestaetigung per E-Mail. Anschliessend meldet sich SEPANA mit einer ersten Einschaetzung.",
  },
  {
    title: "4. Naechste Schritte klaeren",
    text: "Wenn es passt, gehen wir in den Vergleich und begleiten die Umsetzung bis zum Abschluss.",
  },
] as const

const TRUST_POINTS = [
  "Datenschutz-Einwilligung direkt im Formular integriert.",
  "Nach Absenden Weiterleitung auf die Danke-Seite fuer Conversion-Tracking.",
  "Bestaetigungs-E-Mail an Kundinnen und Kunden sowie Benachrichtigung an SEPANA.",
] as const

type SearchParams = Record<string, string | string[] | undefined>

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

export default async function FunnelVorlagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [resolvedSearchParams, reviewSummary] = await Promise.all([
    searchParams,
    getPublishedWebsiteReviewSummarySet(),
  ])

  const tracking = pickTracking(resolvedSearchParams)
  const hasReviews = reviewSummary.overall.count > 0

  return (
    <div className="space-y-8 sm:space-y-12 lg:space-y-14">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_88%_16%,rgba(34,211,238,0.16),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.10)] sm:rounded-[36px] sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -bottom-16 h-56 w-56 rounded-full bg-cyan-200/35 blur-3xl" />

        <div className="relative grid min-h-[calc(100svh-9rem)] gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-center">
          <div className="space-y-3" id="anfrage">
            <BaufiLeadFunnel initialTracking={tracking} initialStep="details" pagePath="/funnel-vorlage" />

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Hinweis</div>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-emerald-900">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-7">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              SEPANA - Offizielle Finanzierungsanfrage
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.8rem] lg:leading-tight">
              Finanzierung anfragen. Direkt starten statt lange lesen.
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              Das Formular steht direkt oben. Sie starten sofort mit dem Finanzierungsbedarf und senden im zweiten Schritt nur die wichtigsten Kontaktdaten.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Was Sie hier bekommen</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Orientierende Monatsrate direkt im Funnel</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Kurze Anfrage statt Vollantrag im ersten Schritt</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Persoenliche Rueckmeldung statt Standardstrecke</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800">Fokus</div>
                <p className="mt-2 text-sm leading-relaxed text-cyan-950/90">
                  Anfragen werden gespeichert und nach dem Absenden direkt zur Danke-Seite weitergeleitet.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="#anfrage"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Zum Formular
              </a>
              <Link
                href="/baufinanzierung"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Zur Baufinanzierungsseite
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">So laeuft die Anfrage ab</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {PROCESS_STEPS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      {hasReviews ? (
        <WebsiteReviewsOverviewCard
          eyebrow="Bewertung"
          title="So bewerten uns Kundinnen und Kunden"
          description="Zusammenfassung der veroeffentlichten Bewertungen auf SEPANA in einer kompakten Uebersicht."
          ctaHref="/bewertungen"
          ctaLabel="Bewertungen ansehen"
          summary={reviewSummary}
        />
      ) : (
        <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bewertung</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Bewertungen</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Bewertungsdaten werden hier angezeigt, sobald veroeffentlichte Stimmen geladen werden koennen.
          </p>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ueber uns</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">SEPANA begleitet die Finanzierung strukturiert und persoenlich</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Wir kombinieren digitale Anfrageprozesse mit persoenlicher Rueckmeldung. So erhalten Sie schnell eine erste Orientierung und im Anschluss einen klaren naechsten Schritt statt eines anonymen Standardformulars.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Ziel dieser Seite ist eine saubere Erstaufnahme: kurz genug fuer eine hohe Conversion und zugleich strukturiert genug, damit wir Ihre Anfrage direkt sinnvoll einordnen koennen.
            </p>
          </div>

          <div className="grid gap-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Direktstart</div>
              <p className="mt-2 text-sm text-slate-700">Formular steht im ersten Viewport-Bereich und startet direkt im Bedarfsschritt.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lead-Prozess</div>
              <p className="mt-2 text-sm text-slate-700">Anfrage wird als Lead gespeichert und fuer das Admin-Team sichtbar eingespielt.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kommunikation</div>
              <p className="mt-2 text-sm text-slate-700">Bestaetigung an Kunden plus Benachrichtigung intern; danach Weiterleitung auf die Danke-Seite.</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  )
}
