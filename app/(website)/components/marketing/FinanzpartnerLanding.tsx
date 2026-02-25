import Image from "next/image"
import Link from "next/link"
import WebsiteReviewsOverviewCard from "../WebsiteReviewsOverviewCard"
import {
  BRAND_SLOGAN,
  BRAND_SUBLINE,
  ImageFeatureBlock,
  LeadCtaSection,
  ProductOverviewSection,
  TeamSection,
  ValueGridSection,
} from "./sections"

export type BankPartnerLogo = {
  id: string
  name: string
  src: string
}

type FinanzpartnerLandingProps = {
  bankPartnerLogos?: BankPartnerLogo[]
}

const VALUE_ITEMS = [
  {
    title: "Finanzpartner statt Formularflut",
    text: "SEPANA denkt Ihren Fall mit – von der Produktauswahl bis zur strukturierten Weitergabe in die richtigen nächsten Schritte.",
  },
  {
    title: "Klarer Start in die Kreditanfrage",
    text: "Baufinanzierung oder Privatkredit: Der Einstieg erfolgt über eine gemeinsame Kreditanfrage mit klaren Schritten.",
  },
  {
    title: "Beratung, Struktur und Ergebnis im Fokus",
    text: "Digitale Prozesse unterstützen die Anfrage – im Vordergrund stehen Orientierung, Klarheit und persönliche Begleitung.",
  },
]

const TRUST_ITEMS = [
  { label: "Bewertungen", value: "100+", note: "veröffentlichte Kundenstimmen" },
  { label: "Durchschnitt", value: "4,9", note: "starker Gesamteindruck" },
  { label: "Tempo", value: "48h", note: "Bankenanfrage vorbereitet*" },
]

export default function FinanzpartnerLanding({ bankPartnerLogos = [] }: FinanzpartnerLandingProps) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.18),transparent_38%),radial-gradient(circle_at_88%_14%,rgba(96,165,250,0.14),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_55%,#0f3c82_100%)] p-5 text-white shadow-[0_24px_70px_rgba(2,6,23,0.4)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/16 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-blue-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              SEPANA Finanzpartner
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Finanzierung neu gedacht.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-100/95 sm:text-lg">{BRAND_SLOGAN}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200/90 sm:text-base">{BRAND_SUBLINE}</p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Baufinanzierung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Privatkredit</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Persönliche Begleitung</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Digitale Antragsstrecke</span>
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

          <div className="rounded-[26px] border border-white/20 bg-white/10 p-3 backdrop-blur">
            <div className="relative h-[230px] overflow-hidden rounded-[18px] border border-white/10 bg-slate-900 sm:h-[290px]">
              <Image
                src="/familie_kueche.jpg"
                alt="Familie in der Küche"
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 1280px) 100vw, 42vw"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/15 to-transparent" />
              <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Klarer Start</div>
                <div className="mt-1 text-sm font-semibold text-white">Produktauswahl direkt in der Kreditanfrage</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <article key={item.label} className="rounded-2xl border border-white/16 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{item.value}</div>
              <div className="mt-1 text-xs text-slate-200/85">{item.note}</div>
            </article>
          ))}
        </div>
      </section>

      {bankPartnerLogos.length ? (
        <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bankpartner</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Starke Bankpartner als Teil des Prozesses
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Für die Baufinanzierung arbeiten wir mit starken Bankpartnern. Ihre Kreditanfrage wird strukturiert vorbereitet und passend weitergeführt.
              </p>
            </div>

            <Link
              href="/kreditanfrage"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Jetzt starten
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {bankPartnerLogos.map((logo) => (
              <div
                key={logo.id}
                className="flex h-16 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 shadow-sm"
              >
                {/* API logo URLs use query params and are blocked by next/image localPatterns in dev */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={logo.name}
                  width={140}
                  height={44}
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ProductOverviewSection />

      <ValueGridSection
        eyebrow="Vorteile"
        title="Warum SEPANA als Finanzpartner funktioniert"
        description="Klare Kreditanfrage, persönliche Begleitung und strukturierte Weiterleitung sorgen für einen ruhigen, nachvollziehbaren Ablauf."
        items={VALUE_ITEMS}
      />

      <ImageFeatureBlock
        imageSrc="/familie_haus.jpg"
        imageAlt="Familie vor dem Haus"
        eyebrow="Baufinanzierung"
        title="Baufinanzierung mit Struktur statt Überforderung"
        text="Ob Kauf, Neubau oder Anschlussfinanzierung: Wir ordnen Ihren Fall, priorisieren die wichtigen Daten und begleiten den nächsten Schritt."
        points={[
          "Objektdaten und Haushaltsinfos klar vorbereitet",
          "Persönliche Einordnung vor der nächsten Bankenansprache",
          "Kreditanfrage als gemeinsamer Start für alle Fälle",
        ]}
      />

      <ImageFeatureBlock
        imageSrc="/familie_umzug.jpg"
        imageAlt="Familie beim Umzug"
        eyebrow="Privatkredit"
        title="Privatkredit mit Tempo und klarer Kommunikation"
        text="Privatkredit-Anfragen sollen schnell sein, aber nicht anonym. Deshalb kombinieren wir zügige Erfassung mit persönlicher Begleitung."
        points={[
          "Schneller Start über dieselbe Antragsstrecke",
          "Klare Rückmeldung zu den nächsten Schritten",
          "Transparente Begleitung statt unklarer Standardstrecke",
        ]}
        reversed
      />

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Über 100 Bewertungen mit 4,9 Durchschnitt"
        description="Viele positive Rückmeldungen bestätigen unseren Anspruch an klare Abläufe, gute Erreichbarkeit und persönliche Begleitung."
      />

      <TeamSection />

      <LeadCtaSection />
    </div>
  )
}
