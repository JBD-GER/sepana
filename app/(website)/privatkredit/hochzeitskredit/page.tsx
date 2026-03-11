import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import WebsiteReviewsOverviewCard from "../../components/WebsiteReviewsOverviewCard"
import { TeamSection } from "../../components/marketing/sections"
import PrivatkreditContactForm from "../ui/PrivatkreditContactForm"
import WeddingBudgetCalculator from "./ui/WeddingBudgetCalculator"
import WeddingQuickStartForm from "./ui/WeddingQuickStartForm"

export const metadata: Metadata = {
  title: "Hochzeitskredit | Hochzeit finanzieren mit klarer Rate | SEPANA",
  description:
    "Hochzeitskredit mit Budgetrechner, Monatsraten und persönlicher Rückmeldung. Hochzeit finanzieren, Kosten einordnen und direkt anfragen.",
  alternates: { canonical: "/privatkredit/hochzeitskredit" },
}

const HIGHLIGHTS = [
  "Budget für Location, Catering, Ringe und Flitterwochen sauber einordnen",
  "Monatsrate direkt aus dem Finanzierungsbedarf ableiten",
  "Schneller Erstkontakt für Hochzeitskredit oder freie Finanzierung",
  "Persönliche Rückmeldung statt anonymer Standardstrecke",
]

const HERO_FACTS = [
  {
    label: "Budgetfokus",
    value: "Feier + Reise",
    text: "Alle typischen Kostenbausteine in einer Übersicht.",
  },
  {
    label: "Finanzierung",
    value: "Rate sofort sichtbar",
    text: "Finanzierungsbedarf und Monatsrate direkt vergleichen.",
  },
  {
    label: "Begleitung",
    value: "Persönlich",
    text: "Keine anonyme Strecke, sondern klare Rückmeldung.",
  },
]

const COST_BLOCKS = [
  {
    title: "Feier & Gäste",
    text: "Location, Catering, Musik und Dekoration machen oft den größten Anteil am Hochzeitsbudget aus.",
    tone: "rose",
  },
  {
    title: "Persönliche Details",
    text: "Outfits, Styling, Ringe und Foto/Video werden im Budget schnell unterschätzt.",
    tone: "amber",
  },
  {
    title: "Zusatzkosten",
    text: "Standesamt, Papeterie, Transport, Übernachtung oder Flitterwochen sollten mit einkalkuliert werden.",
    tone: "slate",
  },
] as const

const PROCESS = [
  {
    step: "01",
    title: "Budget aufstellen",
    text: "Sie sehen im Rechner, wie hoch Gesamtbudget, Eigenmittel und möglicher Finanzierungsbedarf ausfallen.",
  },
  {
    step: "02",
    title: "Hochzeitskredit anfragen",
    text: "Danach senden Sie Ihre Eckdaten mit Wunschsumme und Erreichbarkeit direkt an SEPANA.",
  },
  {
    step: "03",
    title: "Rate und Laufzeit abstimmen",
    text: "Wir ordnen ein, welche Laufzeit zur geplanten Monatsrate und zu Ihrem Budget passt.",
  },
]

const FAQ = [
  {
    q: "Wofür kann ein Hochzeitskredit genutzt werden?",
    a: "Typisch sind Location, Catering, Ringe, Foto/Video, Kleidung, Dekoration oder auch Flitterwochen als Teil des Gesamtbudgets.",
  },
  {
    q: "Ist der Budgetrechner verbindlich?",
    a: "Nein. Er dient zur Orientierung. Finale Konditionen hängen von Bonität, Bank und der konkreten Finanzierung ab.",
  },
  {
    q: "Kann ich nur einen Teil der Hochzeit finanzieren?",
    a: "Ja. Im Rechner können Sie Eigenmittel berücksichtigen. Daraus ergibt sich nur der verbleibende Finanzierungsbedarf.",
  },
  {
    q: "Wie schnell bekomme ich eine Rückmeldung?",
    a: "Bei vollständigen Angaben erfolgt die erste Rückmeldung in der Regel kurzfristig, oft noch am selben oder nächsten Werktag.",
  },
]

function costToneClasses(tone: (typeof COST_BLOCKS)[number]["tone"]) {
  if (tone === "rose") return "border-rose-200 bg-[linear-gradient(145deg,#fff1f2_0%,#ffffff_100%)]"
  if (tone === "amber") return "border-amber-200 bg-[linear-gradient(145deg,#fff7ed_0%,#ffffff_100%)]"
  return "border-slate-200 bg-[linear-gradient(145deg,#f8fafc_0%,#ffffff_100%)]"
}

export default function HochzeitskreditPage() {
  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      <section className="relative overflow-hidden rounded-[34px] border border-rose-200/60 bg-[radial-gradient(circle_at_14%_16%,rgba(251,113,133,0.22),transparent_36%),radial-gradient(circle_at_90%_12%,rgba(251,191,36,0.18),transparent_32%),linear-gradient(145deg,#2a1321_0%,#5b2139_52%,#8c3654_100%)] p-4 text-white shadow-[0_28px_82px_rgba(15,23,42,0.32)] sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-amber-200/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-50">
                Privatkredit · Hochzeitskredit
              </div>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.06] tracking-tight sm:text-5xl">
                Hochzeit planen, Budget verstehen, Finanzierung passend aufsetzen.
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-rose-50/95 sm:text-base">
                Wenn Ihre Hochzeit größer wird als der aktuelle Budgetrahmen, hilft eine saubere Einordnung: Was kostet
                der Tag wirklich, wie viel Eigenmittel setzen Sie ein und welche Monatsrate fühlt sich tragbar an?
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {HIGHLIGHTS.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/12 bg-white/7 px-4 py-3 text-sm leading-relaxed text-rose-50/95 backdrop-blur"
                  >
                    <div className="flex gap-2">
                      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-200" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="#budgetrechner"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:w-auto"
                >
                  Budget berechnen
                </Link>
                <Link
                  href="#kontakt"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 sm:w-auto"
                >
                  Hochzeitskredit anfragen
                </Link>
              </div>

              <p className="mt-4 max-w-2xl text-xs leading-relaxed text-rose-100/85">
                Beispielrechnungen erfolgen mit 5,99 % p.a. als Orientierungszins. Die finalen Konditionen hängen von
                Bonität und Bank ab.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {HERO_FACTS.map((item) => (
                <article key={item.label} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100/70">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
                  <p className="mt-1 text-xs leading-relaxed text-rose-50/80">{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[30px] border border-white/16 bg-white/10 p-3 shadow-xl backdrop-blur">
              <div className="relative h-[260px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-900 sm:h-[340px]">
                <Image
                  src="/hochzeit.jpg"
                  alt="Hochzeitspaar bei der Feier"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1280px) 100vw, 50vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/62 via-slate-950/8 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">Hochzeit planen</div>
                  <div className="mt-1 text-base font-semibold">Kosten, Eigenmittel und Monatsrate auf einen Blick</div>
                </div>
              </div>
            </div>

            <WeddingQuickStartForm />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {COST_BLOCKS.map((item) => (
          <article
            key={item.title}
            className={`rounded-3xl border p-5 shadow-[0_16px_38px_rgba(15,23,42,0.06)] ${costToneClasses(item.tone)}`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Kostenblock</div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section id="budgetrechner" className="scroll-mt-24">
        <WeddingBudgetCalculator />
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ablauf</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            So läuft die Hochzeitsfinanzierung
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PROCESS.map((item) => (
            <article key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Schritt {item.step}</div>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <div id="kontakt" className="scroll-mt-24">
        <PrivatkreditContactForm
          eyebrow="Hochzeitskredit"
          title="Persönliche Anfrage für Ihre Hochzeitsfinanzierung"
          description="Senden Sie Ihr Vorhaben mit Wunschsumme und Erreichbarkeit. Wir melden uns mit einer klaren Einordnung zu Rate, Laufzeit und nächsten Schritten."
          submitLabel="Hochzeitskredit anfragen"
          initialPurpose="hochzeitskredit"
          lockPurpose
          successSource="hochzeitskredit"
          pagePath="/privatkredit/hochzeitskredit"
        />
      </div>

      <TeamSection
        eyebrow="Team"
        title="Persönliche Begleitung statt anonymer Vergleichsstrecke"
        description="Auch beim Hochzeitskredit erhalten Sie eine klare Rückmeldung und eine Struktur, die zu Ihrem Budget passt."
      />

      <WebsiteReviewsOverviewCard
        eyebrow="Bewertungen"
        title="Vertrauen vor der Anfrage"
        description="Transparenter Überblick über veröffentlichte Bewertungen aus Baufinanzierung und Privatkredit."
      />

      <section className="rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Häufige Fragen zum Hochzeitskredit
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
