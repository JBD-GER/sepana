import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import WebsiteReviewsOverviewCard from "../components/WebsiteReviewsOverviewCard"
import {
  BRAND_SLOGAN,
  ImageFeatureBlock,
  LeadCtaSection,
  TeamSection,
  ValueGridSection,
} from "../components/marketing/sections"

export const metadata: Metadata = {
  title: "Privatkredit | SEPANA Finanzpartner",
  description:
    "Privatkredit mit SEPANA als Finanzpartner: klare Kreditanfrage, schnelle Rückmeldung und persönliche Begleitung statt anonymer Standardstrecke.",
  alternates: { canonical: "/privatkredit" },
}

const PRIVAT_VALUES = [
  {
    title: "Schneller Einstieg",
    text: "Die Anfrage startet in einem klaren Funnel ohne unnötige Hürden - passend für schnelle Privatkredit-Fälle.",
  },
  {
    title: "Persönlicher Ansprechpartner",
    text: "Auch beim Privatkredit bleibt die Kommunikation persönlich und nachvollziehbar.",
  },
  {
    title: "Klare nächste Schritte",
    text: "Statt unklarer Statusmeldungen erhalten Sie eine strukturierte Einordnung und konkrete Rückmeldung.",
  },
]

const PRIVAT_POINTS = [
  "Privatkredit im Funnel auswählen",
  "Wichtige Angaben strukturiert erfassen",
  "Rückmeldung und nächste Schritte abstimmen",
  "Weitere Bearbeitung mit klarer Kommunikation",
]

export default function PrivatkreditPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.18),transparent_36%),radial-gradient(circle_at_90%_14%,rgba(56,189,248,0.14),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_55%,#0f3d82_100%)] p-5 text-white shadow-[0_22px_66px_rgba(2,6,23,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-emerald-300/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-cyan-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              Privatkredit
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Privatkredit modern, klar und persönlich begleitet.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              {BRAND_SLOGAN} Gerade beim Privatkredit zahlt sich ein sauberer Start aus: schnelle Anfrage, klare Kommunikation
              und eine Strecke, die nicht wie eine App aussieht, sondern wie eine moderne Finanzpartner-Seite.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Privatkredit</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Schnelle Rückmeldung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Persönliche Begleitung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Klarer Funnel</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/privatkredit/umschulden"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Rate reduzieren
              </Link>
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Kreditanfrage starten
              </Link>
              <Link
                href="/bewertungen"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Bewertungen ansehen
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-[24px] border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="relative h-[250px] overflow-hidden rounded-[18px] border border-white/10 bg-slate-900 sm:h-[300px]">
                <Image
                  src="/familie_umzug.jpg"
                  alt="Familie beim Umzug"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Privatkredit</div>
                  <div className="mt-1 text-sm font-semibold sm:text-base">Ein Anfrageweg, klare Kommunikation, schnelle Weiterleitung</div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Tempo</div>
              <div className="mt-2 text-lg font-semibold text-white">Fokus auf schnelle Bearbeitung</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Vollständige Angaben im Funnel helfen dabei, Rückfragen zu reduzieren und schneller weiterzuarbeiten.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Vertrauen</div>
              <div className="mt-2 text-lg font-semibold text-white">Persönlich statt anonym</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Privatkredit bleibt bei SEPANA ein berateter Prozess - modern, clean und trotzdem menschlich.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ValueGridSection
        eyebrow="Privatkredit"
        title="Was den Privatkredit-Prozess bei SEPANA stark macht"
        description="Die Antragsstrecke ist klar aufgebaut, damit der Start schnell gelingt. Die Qualität entsteht in der Struktur und in der anschließenden Begleitung."
        items={PRIVAT_VALUES}
      />

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Umschuldung</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Bestehende Rate neu sortieren?
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Für laufende Kredite gibt es jetzt eine eigene Unterseite. Dort startet die Anfrage direkt mit dem Zweck
              Umschuldung und dem klaren CTA zur Ratenreduzierung.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/privatkredit/umschulden"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f5e] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Rate reduzieren
            </Link>
          </div>
        </div>
      </section>

      <ImageFeatureBlock
        imageSrc="/familie_kueche.jpg"
        imageAlt="Familie in der Küche"
        eyebrow="Ablauf"
        title="Privatkredit ohne Umwege starten"
        text="Auch Privatkredit-Anfragen starten über die gemeinsame Kreditanfrage. Dort erfolgt direkt die Produktauswahl, danach führt die Antragsstrecke Schritt für Schritt weiter."
        points={PRIVAT_POINTS}
      />

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Vertrauen sichtbar vor der Privatkreditanfrage"
        description="Bewertungen schaffen Vertrauen und geben einen schnellen Eindruck zur Qualität unserer Begleitung im Privatkredit."
      />

      <TeamSection
        eyebrow="Team Privatkredit"
        title="Das Team hinter Ihrer Privatkreditanfrage"
        description="Pfad, Wagner und Müller begleiten auch schnelle Privatkredit-Fälle mit klarer Kommunikation und sauberer Struktur."
      />

      <LeadCtaSection
        title="Privatkredit starten"
        text="Starten Sie die gemeinsame Kreditanfrage und wählen Sie im ersten Schritt Privatkredit. Der Funnel führt Sie direkt weiter."
      />
    </div>
  )
}

