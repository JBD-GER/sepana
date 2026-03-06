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
  title: "Baufinanzierung | SEPANA Finanzpartner",
  description:
    "Baufinanzierung mit SEPANA als Finanzpartner: strukturierte Anfrage, persönliche Begleitung und klarer Einstieg über die gemeinsame Kreditanfrage.",
  alternates: { canonical: "/baufinanzierung" },
}

const BAUFI_VALUES = [
  {
    title: "Struktur vor Geschwindigkeit",
    text: "Wir ordnen Objekt, Eigenkapital und Haushaltsdaten so, dass die weitere Bearbeitung effizient und nachvollziehbar bleibt.",
  },
  {
    title: "Persönliche Begleitung",
    text: "Sie haben feste Ansprechpartner statt eines reinen Self-Service-Portals ohne Einordnung.",
  },
  {
    title: "Vergleich als Werkzeug",
    text: "Die Vergleichslogik bleibt vorhanden, aber Ihr Finanzierungsfall steht im Mittelpunkt - nicht die Portaloberfläche.",
  },
]

const BAUFI_STEPS = [
  "Kreditanfrage starten und Baufinanzierung auswählen",
  "Vorhaben, Objekt und Haushaltsdaten strukturiert erfassen",
  "Unterlagen und nächste Schritte gemeinsam vorbereiten",
  "Passende Bankenansprache und weitere Begleitung abstimmen",
]

export default function BaufinanzierungPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_90%_14%,rgba(96,165,250,0.14),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_55%,#0f3d82_100%)] p-5 text-white shadow-[0_22px_66px_rgba(2,6,23,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-16 h-64 w-64 rounded-full bg-cyan-300/14 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-blue-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              Baufinanzierung
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Baufinanzierung mit Finanzpartner-Ansatz statt Portal-Denke.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              {BRAND_SLOGAN} Für die Baufinanzierung bedeutet das: klare Struktur, persönliche Einordnung und ein Einstieg,
              der nicht mit Tool-Komplexität startet, sondern mit Ihrer Anfrage.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Kauf</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Neubau</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Anschlussfinanzierung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Forward-Darlehen</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Persönliche Begleitung</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
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
                  src="/familie_haus.jpg"
                  alt="Familie vor einem Haus"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Baufinanzierung</div>
                  <div className="mt-1 text-sm font-semibold sm:text-base">Klarer Einstieg über die gemeinsame Kreditanfrage</div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Prozess</div>
              <div className="mt-2 text-lg font-semibold text-white">Schritt für Schritt statt Sprung ins Tool</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Erst Anfrage und Einordnung, dann weitere Verarbeitung. So wirkt die Seite wie Finanzpartner - nicht wie eine App.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Hinweis</div>
              <div className="mt-2 text-lg font-semibold text-white">Vergleichsportal bleibt verfügbar</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                Untergeordnet im Menü als Werkzeug, wenn Sie tiefer in die Baufinanzierung einsteigen möchten.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ValueGridSection
        eyebrow="Baufinanzierung"
        title="So begleiten wir Ihre Baufinanzierung"
        description="Nicht alles muss sofort ausgefüllt sein. Wichtig ist ein starker Startpunkt, damit wir die nächsten Schritte sinnvoll priorisieren können."
        items={BAUFI_VALUES}
      />

      <ImageFeatureBlock
        imageSrc="/familie_kueche.jpg"
        imageAlt="Familie in der Küche"
        eyebrow="Ablauf"
        title="Einfach starten, strukturiert weitergehen"
        text="Die Baufinanzierung startet über dieselbe Kreditanfrage wie alle anderen Wege. Dort wählen Sie Ihr Produkt und werden klar durch die Antragsstrecke geführt."
        points={BAUFI_STEPS}
      />

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unterpunkt Baufinanzierung</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Anschlussfinanzierung und Forward-Darlehen
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Ihre Zinsbindung läuft aus? Unsere neue Landingpage zeigt den Ablauf für Anschlussfinanzierung, erklärt das
              Forward-Darlehen und führt Sie direkt in die Anfrage.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Restschuld planen</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Zinsen früh sichern</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Timing klar steuern</span>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3b80_100%)] p-5 text-white shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Neue Unterseite</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Zur Landingpage Anschlussfinanzierung</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
              Alle Infos zu Umschuldung, Forward Darlehen sowie die direkte Möglichkeit zur Kontaktaufnahme.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/baufinanzierung/anschlussfinanzierung"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Seite ansehen
              </Link>
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Anfrage starten
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vergleichsportal</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Vergleichsportal für den vertieften Vergleich</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Das Vergleichsportal bleibt ein wichtiger Baustein für die Baufinanzierung. Nach der Kreditanfrage kann dort der Vergleich vertieft und gezielt weitergeführt werden.
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
            <div className="text-sm font-semibold text-slate-900">Klarer Einstieg in die Kreditanfrage</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Neue Anfragen starten strukturiert über die Kreditanfrage. So entsteht ein einheitlicher, nachvollziehbarer Ablauf mit klaren nächsten Schritten.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/kreditanfrage"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Kreditanfrage starten
              </Link>
              <Link
                href="/baufinanzierung/auswahl"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Vergleichsportal ansehen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Vertrauen vor dem nächsten Schritt"
        description="Bevor Sie Ihre Baufinanzierungsanfrage starten, sehen Sie die veröffentlichten Rückmeldungen zu SEPANA auf einen Blick."
      />

      <TeamSection
        eyebrow="Team Baufinanzierung"
        title="Das Team hinter Ihrer Baufinanzierungsanfrage"
        description="Pfad, Wagner und Müller begleiten die Anfrage mit Fokus auf Struktur, Rückfragenmanagement und saubere nächste Schritte."
      />

      <LeadCtaSection
        title="Baufinanzierung starten"
        text="Wählen Sie im Funnel einfach Baufinanzierung aus und starten Sie mit den ersten Eckdaten. Der Prozess führt Sie klar weiter."
      />
    </div>
  )
}

