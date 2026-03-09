import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import WebsiteReviewsOverviewCard from "../../components/WebsiteReviewsOverviewCard"
import { TeamSection } from "../../components/marketing/sections"
import PrivatkreditContactForm from "../ui/PrivatkreditContactForm"
import { getPublishedWebsiteReviewSummarySet } from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Umschulden | SEPANA",
  description:
    "Umschuldung mit SEPANA: bestehende Kredite neu strukturieren, monatliche Rate reduzieren und die Anfrage direkt digital starten.",
  alternates: { canonical: "/privatkredit/umschulden" },
}

const HERO_POINTS = [
  "Bestehende Raten prüfen und neu strukturieren",
  "Monatliche Belastung sauber neu einordnen",
  "Klare Rückmeldung statt anonymer Standardstrecke",
]

const TRUST_ITEMS = [
  "Sichere Anfrage über die SEPANA-Strecke",
  "Persönliche Rückmeldung durch das Privatkredit-Team",
  "Klare Einschätzung, ob Umschuldung realistisch passt",
  "Auf Wunsch direkte Abstimmung der nächsten Schritte",
]

const USE_CASES = [
  {
    question: "Mehrere laufende Kredite machen die Monatsrate unübersichtlich",
    answer:
      "Wenn verschiedene Verpflichtungen parallel laufen, kann eine Umschuldung helfen, die Belastung neu zu bündeln und wieder planbarer zu machen.",
  },
  {
    question: "Die aktuelle Rate ist zu hoch geworden",
    answer:
      "Gerade wenn sich Haushaltsbudget, Lebenssituation oder laufende Kosten verändert haben, lohnt ein strukturierter Blick auf eine reduzierte Monatsrate.",
  },
  {
    question: "Sie möchten bessere Übersicht statt Stückwerk",
    answer:
      "Umschuldung ist nicht nur ein Zinssatz-Thema. Oft geht es darum, die gesamte Finanzierungsstruktur klarer und belastbarer aufzustellen.",
  },
]

const FAQ = [
  {
    q: "Kann ich mit SEPANA mehrere bestehende Kredite zusammenführen?",
    a: "Ja, genau dafür ist die Strecke gedacht. Wir prüfen mit Ihren Angaben, ob eine Umschuldung zur Bündelung und Entlastung sinnvoll darstellbar ist.",
  },
  {
    q: "Muss ich sofort alle Vertragsunterlagen hochladen?",
    a: "Nein. Für den Start reichen die wichtigsten Eckdaten. Wenn die Umschuldung grundsätzlich passt, besprechen wir die nächsten Unterlagen im Anschluss.",
  },
  {
    q: "Ist die Anfrage schon verbindlich?",
    a: "Nein. Die Anfrage dient zunächst der Einordnung. Erst nach Prüfung und Rückmeldung besprechen wir, welcher konkrete Weg sinnvoll ist.",
  },
  {
    q: "Wie schnell bekomme ich eine Rückmeldung?",
    a: "Bei vollständigen Angaben meldet sich SEPANA in der Regel zeitnah mit einer klaren Einschätzung und den nächsten Schritten.",
  },
]

function formatScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function stars(value: number | null) {
  if (value == null) return "☆☆☆☆☆"
  const full = Math.max(0, Math.min(5, Math.round(value)))
  return `${"★".repeat(full)}${"☆".repeat(5 - full)}`
}

export default async function PrivatkreditUmschuldenPage() {
  const reviewSummary = await getPublishedWebsiteReviewSummarySet()
  const overallStats = reviewSummary.overall

  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_14%_10%,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_90%_12%,rgba(14,165,233,0.18),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3d82_100%)] p-5 text-white shadow-[0_22px_66px_rgba(2,6,23,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-emerald-300/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-cyan-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              Privatkredit · Umschulden
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Rate reduzieren statt weiter unter Druck finanzieren.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Wenn bestehende Kredite drücken, hilft oft eine sauber strukturierte Umschuldung. SEPANA prüft mit Ihnen,
              wie sich Belastung, Laufzeit und Monatsrate sinnvoll neu aufstellen lassen.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-100/95">
              {HERO_POINTS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#umschulden-form"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Rate reduzieren
              </Link>
              <Link
                href="/bewertungen"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Bewertungen ansehen
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="relative h-[280px] overflow-hidden rounded-[22px] border border-white/15 bg-slate-900 sm:h-[340px]">
                <Image
                  src="/happy_family.jpg"
                  alt="Familie beim Neuordnen ihrer Finanzen"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Umschuldung</div>
                  <div className="mt-1 text-sm font-semibold sm:text-base">Weniger Druck in der Monatsrate, mehr Klarheit im Kreditbild</div>
                </div>
              </div>
            </div>

            {overallStats.count ? (
              <div className="rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/85">Bewertungen</div>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-2xl leading-none text-amber-300">{stars(overallStats.average)}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {formatScore(overallStats.average)} <span className="text-sm font-medium text-slate-300">/ 5,0</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-200/85">{overallStats.count} veröffentlichte Bewertungen</div>
                  </div>
                  <Link
                    href="/bewertungen"
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Alle ansehen
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <TeamSection
        eyebrow="Beraterteam"
        title="Die Berater hinter Ihrer Umschuldungsanfrage"
        description="Keine anonyme Weiterleitung: Ihr Fall landet bei einem Team, das Privatkredite, Haushaltsplanung und klare Rückmeldungen strukturiert begleitet."
        liveCtaLabel="Jetzt live Umschuldung berechnen"
      />

      <section
        id="umschulden-form"
        className="scroll-mt-24 rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm sm:p-6"
      >
        <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
          <PrivatkreditContactForm
            eyebrow="Umschulden"
            title="Rate reduzieren"
            description="Tragen Sie Ihre Kontaktdaten und den gewünschten Kreditrahmen ein. Wir prüfen die Umschuldung und melden uns mit einer klaren Einschätzung."
            submitLabel="Rate reduzieren"
            initialPurpose="umschuldung"
            lockPurpose
            successSource="privatkredit_umschulden"
            pagePath="/privatkredit/umschulden"
          />

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mehr Vertrauen vor dem Absenden</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Was nach Ihrer Anfrage passiert</h2>
              <div className="mt-4 space-y-3">
                {TRUST_ITEMS.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      ✓
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-slate-900 shadow-sm">
                <div className="relative h-[240px] sm:h-[280px]">
                  <Image
                    src="/familie_haus.jpg"
                    alt="Beratungssituation bei der Umschuldung"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1280px) 100vw, 40vw"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/5 to-transparent" />
                </div>
              </div>

              <div className="rounded-[26px] border border-cyan-200/70 bg-cyan-50/70 p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Orientierung</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Nicht nur günstiger, sondern sauberer strukturiert</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Eine gute Umschuldung reduziert nicht nur die Rate auf dem Papier. Entscheidend ist, dass die neue
                  Struktur zu Ihrem Haushalt, Ihrer Laufzeit und Ihrer realen Belastung passt.
                </p>
                <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700">
                  SEPANA prüft Ihre Anfrage nicht wie ein starres Formular, sondern als nachvollziehbare Finanzierungssituation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-slate-900">
            <div className="relative h-[260px] sm:h-[320px] lg:h-full lg:min-h-[360px]">
              <Image
                src="/familie_kueche.jpg"
                alt="Familie im Gespräch zur Neuordnung ihrer Finanzen"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
          </div>

          <div className="rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Wann sinnvoll</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Wann eine Umschuldung sinnvoll sein kann</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Umschuldung ist vor allem dann interessant, wenn laufende Verpflichtungen unübersichtlich werden oder die aktuelle Monatsrate nicht mehr sauber zum Haushalt passt.
            </p>

            <div className="mt-4 space-y-2">
              {USE_CASES.map((item) => (
                <div key={item.question} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <span className="mt-[1px] text-[#0b1f5e]">◉</span>
                  <span>{item.question}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="mb-5 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Einordnung</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Was hinter einer sinnvollen Umschuldung steckt
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Nicht jede Neuordnung ist automatisch besser. Wichtig ist, dass Rate, Laufzeit und Gesamtbild am Ende für Ihre
            Situation wirklich tragfähig sind.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {USE_CASES.map((item) => (
            <article
              key={item.question}
              className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">Typische Situation</div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="mb-5 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Häufige Fragen zur Umschuldung
          </h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <WebsiteReviewsOverviewCard
        eyebrow="Vertrauen & Erfolg"
        title="Vertrauen schaffen, Umschuldung sicher starten"
        description="Die veröffentlichten Bewertungen zeigen, wie SEPANA Kundinnen und Kunden bei Finanzierung, Strukturierung und erfolgreicher Umsetzung begleitet."
        ctaHref="#umschulden-form"
        ctaLabel="Jetzt Rate reduzieren"
      />
    </div>
  )
}
