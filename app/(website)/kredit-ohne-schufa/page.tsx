import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import SchufaFreePrecheck from "@/components/schufa-frei/SchufaFreePrecheck"
import { getRatgeberArticlePath } from "@/lib/ratgeber/content"
import { getRatgeberArticlesByCategory } from "@/lib/ratgeber/server"
import { getRatgeberImageSrc } from "@/lib/ratgeber/utils"
import {
  SCHUFA_FREE_AMOUNT_OPTIONS,
  getSchufaFreeMonthlyRate,
} from "@/lib/schufa-frei/precheck"
import {
  buildWebsiteReviewSummarySet,
  getPublishedWebsiteReviews,
  type WebsiteReview,
} from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Kredit ohne Schufa | Kredit trotz negativer Schufa | SEPANA",
  description:
    "Kredit ohne Schufa anfragen: auch bei negativer Schufa. Diskrete Vorprüfung, klare Einschätzung und digitaler Ablauf.",
  alternates: { canonical: "/kredit-ohne-schufa" },
  openGraph: {
    title: "Kredit ohne Schufa | Kredit trotz negativer Schufa | SEPANA",
    description:
      "Diskrete Vorprüfung für Kredit ohne Schufa. Klarer Ablauf, persönliche Begleitung und digitaler Antrag bei passender Strecke.",
    url: "/kredit-ohne-schufa",
    type: "website",
  },
}

type ReviewCard = {
  quote: string
  city: string
}

const HERO_CHIPS = [
  "Kredit ohne Schufa",
  "Kredit trotz negativer Schufa",
  "Ohne klassische Schufa-Abfrage",
] as const

const TRUST_ITEMS = [
  { label: "Bewertung", value: "4,9 / 5", note: "starker Gesamteindruck" },
  { label: "Vertrauen", value: "+10.000", note: "zufriedene Kunden" },
  { label: "Auszahlung", value: "In 1-2 Tagen", note: "Digitaler Abschluss mit persönlicher Beratung." },
] as const

const BENEFIT_ITEMS = [
  "Für Fälle mit negativer Schufa oder bewusst ohne klassische Schufa-Strecke.",
  "Diskreter Einstieg mit klarer erster Einschätzung.",
  "Online anfragbar und strukturiert begleitet.",
  "Vollständiger Antrag erst nach positiver Vorprüfung.",
] as const

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Vorprüfung starten",
    text: "Sie geben nur die wichtigsten Eckdaten ein und sehen sofort, ob die Strecke grundsätzlich passt.",
  },
  {
    step: "02",
    title: "Antrag vervollständigen",
    text: "Erst danach folgt der vollständige Antrag mit allen weiteren Angaben für die finale Prüfung.",
  },
  {
    step: "03",
    title: "Unterlagen und Bearbeitung",
    text: "Nach dem Vollantrag geht es mit Unterlagen, weiterer Prüfung und den nächsten Schritten weiter.",
  },
] as const

const CONTENT_SECTIONS = [
  {
    eyebrow: "Kredit trotz negativer Schufa",
    title: "Wofür diese Anfrage gedacht ist",
    paragraphs: [
      "Diese Strecke richtet sich an Menschen, die eine diskrete Anfrage außerhalb der üblichen klassischen Schufa-Strecke suchen und dabei erst mit wenig sensiblen Angaben starten möchten.",
      "Mit Kredit ohne Schufa ist meist eine Anfrage gemeint, die nicht über die übliche klassische Schufa-Strecke aus einem Standardvergleich läuft. Genau das ist für viele Interessenten relevant, wenn bereits eine negative Schufa vorliegt oder kein zusätzlicher klassischer Eintrag aus der üblichen Anfrage gewünscht ist.",
      "Entscheidend ist dabei eine saubere Reihenfolge: zuerst die erste Vorprüfung mit wenig sensiblen Angaben, danach erst der vollständige Antrag. So bleibt der Einstieg einfacher und gleichzeitig klar.",
    ],
  },
  {
    eyebrow: "Mehr zum Thema",
    title: "Bonität, Voraussetzungen und Kreditprüfung",
    paragraphs: [
      "Eine negative Schufa bedeutet nicht automatisch, dass jede Möglichkeit ausgeschlossen ist. Relevant sind auch Beschäftigungsdauer, Staatsangehörigkeit, Familienstand, Unterhaltspflichten und die späteren vollständigen Antragsdaten.",
      "Deshalb ist diese Anfrage bewusst nicht als überladenes Standardformular gebaut. Erst wenn die Strecke grundsätzlich passt, werden die vollständigen Antragsdaten erfasst.",
    ],
  },
] as const

const FAQ_ITEMS = [
  {
    question: "Kann ich auch mit negativer Schufa anfragen?",
    answer:
      "Ja. Genau dafür ist diese Strecke gedacht. Die erste Vorprüfung zeigt, ob Ihr Fall grundsätzlich passt.",
  },
  {
    question: "Kann ich den Antrag online abschließen?",
    answer:
      "Ja. Die Strecke ist digital aufgebaut und führt Sie Schritt für Schritt von der Vorprüfung bis in den vollständigen Antrag.",
  },
  {
    question: "Brauche ich direkt IBAN oder Unterlagen?",
    answer:
      "Nein. Bankdaten und Unterlagen gehören nicht in den ersten Schritt. Diese Angaben folgen erst später im Ablauf.",
  },
  {
    question: "Warum gibt es die Serviceprovision und ist das Geld dann weg?",
    answer:
      "Die Provisionsvereinbarung wird im weiteren Verlauf transparent ausgewiesen. Eine Vorauszahlung im ersten Schritt gibt es nicht. Fällig wird die Provisionszahlung erst nach Kreditauszahlung und nach Ablauf des 14-tägigen Widerrufsrechts.",
  },
  {
    question: "Welche Kreditsummen sind möglich?",
    answer:
      "Typische Varianten dieser Strecke liegen bei 3.500 EUR, 5.000 EUR, 7.500 EUR und 10.000 EUR mit vorgegebenen Laufzeiten.",
  },
  {
    question: "Was bedeutet ohne klassischen Schufa-Eintrag?",
    answer:
      "Gemeint ist der Wunsch, nicht über die übliche klassische Vergleichs- und Anfrage-Strecke zu gehen. Genau dafür ist diese Seite aufgebaut.",
  },
  {
    question: "Wie geht es nach der Vorprüfung weiter?",
    answer:
      "Wenn die erste Vorprüfung positiv ausfällt, gelangen Sie direkt in den vollständigen Antrag und ergänzen dort die restlichen Angaben.",
  },
] as const

const FALLBACK_REVIEWS: ReviewCard[] = [
  {
    quote: "Die erste Prüfung war klar, schnell und deutlich übersichtlicher als bei anderen Anfragen.",
    city: "Nordrhein-Westfalen",
  },
  {
    quote: "Gut gelöst, weil der Ablauf von Anfang an klar und diskret war.",
    city: "Hessen",
  },
  {
    quote: "Strukturiert, diskret und ohne unnötige Hürden am Start.",
    city: "Bayern",
  },
] as const

function formatScore(value: number | null) {
  if (value == null) return "4,9"
  return value.toFixed(1).replace(".", ",")
}

function formatWholeEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatEuro(value: number | null) {
  if (value == null || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function mapReviews(reviews: WebsiteReview[]): ReviewCard[] {
  const schufaReviews = reviews
    .filter((item) => item.category === "schufa_frei")
    .slice(0, 3)
    .map((item) => ({
      quote: item.quote,
      city: item.reviewerCity,
    }))

  if (schufaReviews.length) return schufaReviews

  const privatkreditReviews = reviews
    .filter((item) => item.category === "privatkredit")
    .slice(0, 3)
    .map((item) => ({
      quote: item.quote,
      city: item.reviewerCity,
    }))

  return privatkreditReviews.length ? privatkreditReviews : [...FALLBACK_REVIEWS]
}

function formatArticleDate(value: string) {
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return value
  }
}

export default async function SchufaFreeLandingPage() {
  const [publishedReviews, ratgeberArticles] = await Promise.all([
    getPublishedWebsiteReviews(),
    getRatgeberArticlesByCategory("privatkredit"),
  ])

  const reviewSummary = buildWebsiteReviewSummarySet(publishedReviews)
  const reviewStats = reviewSummary.schufa_frei.count
    ? reviewSummary.schufa_frei
    : reviewSummary.privatkredit.count
      ? reviewSummary.privatkredit
      : reviewSummary.overall
  const featuredReviews = mapReviews(publishedReviews)
  const featuredArticles = ratgeberArticles.slice(0, 3)

  const trustItems = [
    { ...TRUST_ITEMS[0], value: `${formatScore(reviewStats.average)} / 5` },
    TRUST_ITEMS[1],
    TRUST_ITEMS[2],
  ]

  const productOverview = SCHUFA_FREE_AMOUNT_OPTIONS.map((amount) => ({
    amount,
    termMonths: 40,
    monthlyRate: getSchufaFreeMonthlyRate(amount, 40),
  }))

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.18),transparent_38%),radial-gradient(circle_at_88%_14%,rgba(96,165,250,0.14),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_55%,#0f3c82_100%)] p-5 text-white shadow-[0_24px_70px_rgba(2,6,23,0.4)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/16 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-blue-300/14 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              SEPANA Sonderstrecke
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Kredit ohne Schufa.
              <br />
              Trotz negativer Schufa.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-100/95 sm:text-lg">
              Sie erhalten bei Banken nur Absagen auf Ihren Kreditwunsch?
              <br />
              Für Fälle, in denen keine klassische Schufa-Abfrage im üblichen Anfrageprozess gewünscht ist. Die
              Vorprüfung startet diskret und prüft Schritt für Schritt, welche Möglichkeiten bestehen.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-100/95">
              {HERO_CHIPS.map((chip) => (
                <span key={chip} className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#vorpruefung"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Kredit beantragen
              </a>
              <a
                href="#fragen"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Fragen ansehen
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="relative h-[230px] overflow-hidden rounded-[18px] border border-white/10 bg-slate-900 sm:h-[290px]">
                <Image
                  src="/happy_family.jpg"
                  alt="Familie im Gespräch"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1280px) 100vw, 42vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/15 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                    Kredit trotz negativer Schufa
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    Sie erhalten nur Ablehnungen bei den Banken? Bei uns nicht.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/16 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">
                Kundenstimme
              </div>
              <div className="mt-2 text-sm leading-7 text-slate-100">
                „{featuredReviews[0]?.quote ?? FALLBACK_REVIEWS[0].quote}“
              </div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                Kunde aus {featuredReviews[0]?.city ?? FALLBACK_REVIEWS[0].city}
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          {trustItems.map((item) => (
            <article key={item.label} className="rounded-2xl border border-white/16 bg-white/10 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">
                {item.label}
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">{item.value}</div>
              <div className="mt-1 text-xs text-slate-200/85">{item.note}</div>
            </article>
          ))}
        </div>
      </section>

      <section id="vorpruefung">
        <SchufaFreePrecheck />
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-stretch">
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {CONTENT_SECTIONS[0].eyebrow}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {CONTENT_SECTIONS[0].title}
              </h2>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900 shadow-sm">
              <div className="relative h-[280px] sm:h-[340px]">
                <Image
                  src="/familie_umzug.jpg"
                  alt="Familie bei der Klärung ihrer Finanzierung"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1279px) 100vw, 42vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                    Diskreter Einstieg
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    Erst prüfen, dann erst die sensiblen Angaben im vollständigen Antrag ergänzen.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {BENEFIT_ITEMS.map((item, index) => (
              <article
                key={item}
                className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 py-5 shadow-sm"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                  0{index + 1}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">{item}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-5">
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            {CONTENT_SECTIONS[0].paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ablauf</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            So geht es nach der Vorprüfung weiter
          </h2>
        </div>

        <div className="mt-5 space-y-3">
          {PROCESS_STEPS.map((item) => (
            <div key={item.step} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                  {item.step}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-1 text-sm leading-7 text-slate-600">{item.text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Varianten</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Typische Kreditsummen im Überblick
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Die monatliche Rate hängt von der Variante ab. Kreditsumme, Laufzeit und Rate sehen Sie direkt im
            Überblick.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {productOverview.map((product) => (
            <div key={product.amount} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Kreditsumme
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {formatWholeEuro(product.amount)}
              </div>

              <div className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Laufzeit
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{product.termMonths} Monate</div>

              <div className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Rate pro Monat
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(product.monthlyRate)}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-900">
          Erst wenn die Vorprüfung grundsätzlich passt, folgt der vollständige Antrag mit den restlichen Angaben.
        </div>
      </section>

      <section id="fragen" className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fragen & Antworten</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Die wichtigsten Punkte vor dem Start
          </h2>
        </div>

        <div className="mt-5 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-slate-950">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {CONTENT_SECTIONS[1].eyebrow}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {CONTENT_SECTIONS[1].title}
          </h2>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
          {CONTENT_SECTIONS[1].paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {featuredArticles.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {featuredArticles.map((article) => (
              <Link
                key={article.slug}
                href={getRatgeberArticlePath(article)}
                className="block overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 transition hover:border-slate-300 hover:bg-white"
              >
                {getRatgeberImageSrc(article.heroImagePath) ? (
                  <div className="relative h-48 overflow-hidden border-b border-slate-200 bg-slate-200">
                    <Image
                      src={getRatgeberImageSrc(article.heroImagePath) ?? ""}
                      alt={article.heroImageAlt}
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 1279px) 100vw, 33vw"
                    />
                  </div>
                ) : null}

                <div className="px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Veröffentlicht am {formatArticleDate(article.publishedAt)}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{article.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{article.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
            Im SEPANA Ratgeber finden Sie zusätzliche Inhalte zu Bonität, Voraussetzungen, Zinsen und einer sauber
            vorbereiteten Kreditanfrage.
          </div>
        )}

        <div className="mt-5">
          <Link
            href="/ratgeber"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Zum Ratgeber
          </Link>
        </div>
      </section>
    </div>
  )
}
