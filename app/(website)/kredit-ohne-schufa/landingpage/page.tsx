import type { Metadata } from "next"
import Image from "next/image"
import SchufaFreePrecheck from "@/components/schufa-frei/SchufaFreePrecheck"
import {
  SCHUFA_FREE_AMOUNT_OPTIONS,
  SCHUFA_FREE_MAX_AGE_YEARS,
  getSchufaFreeMinimumIncome,
  getSchufaFreeMonthlyRate,
} from "@/lib/schufa-frei/precheck"
import {
  buildWebsiteReviewSummarySet,
  getPublishedWebsiteReviews,
  type WebsiteReview,
} from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Dringend Geld benötigt? Jetzt schnell Geld erhalten | Kredit ohne Schufa | SEPANA",
  description:
    "Landingpage für Kredit ohne Schufa mit diskreter Vorprüfung, klaren Kriterien, digitalem Ablauf und sauberer mobiler Optimierung.",
  alternates: { canonical: "/kredit-ohne-schufa/landingpage" },
  openGraph: {
    title: "Dringend Geld benötigt? Jetzt schnell Geld erhalten | Kredit ohne Schufa | SEPANA",
    description:
      "Kredit ohne Schufa mit digitaler Vorprüfung, klaren Voraussetzungen und sauberem Ablauf bis zum vollständigen Antrag.",
    url: "/kredit-ohne-schufa/landingpage",
    type: "website",
  },
}

type ReviewCard = {
  quote: string
  city: string
  initials: string
}

const HERO_BADGES = [
  "Kredit ohne Schufa",
  "Vorprüfung in wenigen Minuten",
  "Digitale Antragstrecke",
  "Auszahlung innerhalb von 24-48 Stunden möglich",
  "Persönliche Begleitung",
] as const

const TRUST_STRIP = [
  { label: "Vorgänge", value: "3.500-10.000 EUR", note: "vier feste Varianten" },
  { label: "Laufzeit", value: "40 Monate", note: "klare Monatsrate je Variante" },
  { label: "Ablauf", value: "Digital", note: "mit persönlicher Rückmeldung" },
] as const

const ELIGIBILITY_ITEMS = [
  {
    title: "Alter",
    value: `Bis einschließlich ${SCHUFA_FREE_MAX_AGE_YEARS} Jahre`,
    text: "Die erste Vorprüfung ist aktuell nur bis einschließlich 65 Jahre vorgesehen.",
  },
  {
    title: "Staatsangehörigkeit",
    value: "DE oder EU/CH",
    text: "Andere Nationalitätsgruppen werden in dieser Vorprüfung derzeit nicht positiv geprüft.",
  },
  {
    title: "Beschäftigung",
    value: "Fester Arbeitgeber",
    text: "Je nach Variante und Nationalität wird eine Mindestdauer beim aktuellen Arbeitgeber verlangt.",
  },
  {
    title: "Nettoeinkommen",
    value: "Variantenabhängig",
    text: "Das benötigte Nettoeinkommen richtet sich nach Kreditsumme und Anzahl unterhaltspflichtiger Kinder.",
  },
] as const

const REQUIREMENT_DETAILS = [
  "3.500 EUR, 5.000 EUR, 7.500 EUR oder 10.000 EUR sind die festen Varianten dieser Strecke.",
  "Bei deutschen Staatsangehörigen gelten für 3.500 EUR bis 7.500 EUR in der Regel mindestens 12 Monate beim aktuellen Arbeitgeber.",
  "Bei 10.000 EUR sind für deutsche Staatsangehörige mindestens 36 Monate beim aktuellen Arbeitgeber erforderlich.",
  "Bei EU-/CH-Bürgern sind in dieser Vorprüfung mindestens 60 Monate beim aktuellen Arbeitgeber erforderlich.",
  "Das benötigte Nettoeinkommen steigt mit Kreditsumme und Anzahl der unterhaltspflichtigen Kinder.",
] as const

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Vorprüfung starten",
    text: "Sie geben im ersten Schritt nur die wichtigsten Eckdaten an. Direkt danach steht fest, ob die Strecke grundsätzlich passt.",
  },
  {
    step: "02",
    title: "Vollantrag ausfüllen",
    text: "Nur bei positiver Vorprüfung geht es in den zweiten Schritt mit den vollständigen Daten für die weitere Bearbeitung.",
  },
  {
    step: "03",
    title: "Unterlagen und Identifikation",
    text: "Im weiteren Verlauf werden Unterlagen, Identifikation und die nächsten Pflichtschritte sauber nachgezogen.",
  },
  {
    step: "04",
    title: "Prüfung und nächster Schritt",
    text: "Nach vollständiger Prüfung folgt die Rückmeldung zum weiteren Verlauf. Eine Auszahlung erfolgt erst nach finaler Bearbeitung und Freigabe.",
  },
] as const

const FAQ_ITEMS = [
  {
    question: "Kann ich auch mit negativer Schufa anfragen?",
    answer:
      "Ja. Genau für solche Fälle ist diese Strecke gedacht. Die erste Vorprüfung zeigt, ob Ihr Fall grundsätzlich in diese Richtung passt.",
  },
  {
    question: "Wie schnell geht die erste Vorprüfung?",
    answer:
      "Die Vorprüfung ist bewusst schlank aufgebaut und kann in wenigen Minuten ausgefüllt werden. Der vollständige Antrag folgt erst danach.",
  },
  {
    question: "Welche Kreditsummen sind möglich?",
    answer:
      "Aktuell sind 3.500 EUR, 5.000 EUR, 7.500 EUR und 10.000 EUR mit einer festen Laufzeit von 40 Monaten vorgesehen.",
  },
  {
    question: "Brauche ich sofort Unterlagen oder Bankdaten?",
    answer:
      "Nein. Im ersten Schritt geht es nur um die Vorprüfung. Weitere Angaben und Unterlagen folgen erst im späteren Ablauf.",
  },
  {
    question: "Ist eine Auszahlung in 24 Stunden garantiert?",
    answer:
      "Nein. Die Auszahlung hängt von vollständigen Daten, dem weiteren Prüfverlauf und der finalen Freigabe ab. Deshalb sprechen wir hier bewusst nur von einer möglichen schnellen Bearbeitung.",
  },
  {
    question: "Was passiert nach einer positiven Vorprüfung?",
    answer:
      "Dann wechseln Sie direkt in den vollständigen Antrag und ergänzen dort alle restlichen Daten für die weitere Bearbeitung.",
  },
] as const

const FALLBACK_REVIEWS: ReviewCard[] = [
  {
    quote: "Die Vorprüfung war klar, schnell und deutlich übersichtlicher als bei anderen Anfragen.",
    city: "Nordrhein-Westfalen",
    initials: "MK",
  },
  {
    quote: "Der Ablauf war sauber erklärt und am Handy ohne Umwege ausfüllbar.",
    city: "Bayern",
    initials: "SP",
  },
  {
    quote: "Gut gelöst, weil erst einmal nur die wichtigsten Punkte abgefragt wurden.",
    city: "Hessen",
    initials: "AL",
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
  const prioritized = reviews
    .filter((item) => item.category === "schufa_frei")
    .slice(0, 6)
    .map((item) => ({
      quote: item.quote,
      city: item.reviewerCity,
      initials: item.reviewerInitials,
    }))

  if (prioritized.length) return prioritized

  const fallback = reviews
    .filter((item) => item.category === "privatkredit")
    .slice(0, 6)
    .map((item) => ({
      quote: item.quote,
      city: item.reviewerCity,
      initials: item.reviewerInitials,
    }))

  return fallback.length ? fallback : [...FALLBACK_REVIEWS]
}

export default async function SchufaFreeLandingpagePage() {
  const publishedReviews = await getPublishedWebsiteReviews()
  const reviewSummary = buildWebsiteReviewSummarySet(publishedReviews)
  const reviewStats = reviewSummary.schufa_frei.count
    ? reviewSummary.schufa_frei
    : reviewSummary.privatkredit.count
      ? reviewSummary.privatkredit
      : reviewSummary.overall
  const featuredReviews = mapReviews(publishedReviews)
  const leadReview = featuredReviews[0] ?? FALLBACK_REVIEWS[0]
  const offerCards = SCHUFA_FREE_AMOUNT_OPTIONS.map((amount) => ({
    amount,
    monthlyRate: getSchufaFreeMonthlyRate(amount, 40),
    minimumIncome: getSchufaFreeMinimumIncome(amount, 40, 0),
  }))

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_36%),radial-gradient(circle_at_80%_12%,rgba(96,165,250,0.18),transparent_30%),linear-gradient(135deg,#07162f_0%,#0b1f5e_52%,#0d4f8b_100%)] px-4 py-5 text-white shadow-[0_24px_72px_rgba(2,6,23,0.38)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-cyan-300/18 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-blue-300/16 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.18fr_0.82fr] xl:items-center">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/16 bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-cyan-100 backdrop-blur">
              Für Geldnöte
            </div>

            <h1 className="mt-4 max-w-none text-[2.1rem] font-semibold leading-[1] tracking-[-0.05em] text-white sm:text-[2.45rem] lg:text-[2.8rem] xl:text-[3rem]">
              <span className="block lg:whitespace-nowrap">Dringend Geld benötigt?</span>
              <span className="mt-2 block text-cyan-200 lg:whitespace-nowrap">Jetzt schnell Geld erhalten</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100/95 sm:text-base sm:leading-8">
              Diese Seite ist für Menschen gedacht, die schnell Klarheit wollen, ob ein
              <span className="font-semibold text-white"> Kredit ohne Schufa</span> grundsätzlich passt.
              Sie starten mit einer diskreten Vorprüfung, erst danach folgt bei positiver Rückmeldung der vollständige Antrag.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {HERO_BADGES.map((item) => (
                <div
                  key={item}
                  className="max-w-full rounded-full border border-white/16 bg-white/10 px-3 py-2 text-xs font-semibold leading-5 text-white/95 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-3 text-[11px] leading-5 text-slate-200/85">
              Hinweis: Schnelle Auszahlung nur nach vollständiger Prüfung und finaler Freigabe.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#vorpruefung"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Vorprüfung starten
              </a>
              <a
                href="#kriterien"
                className="inline-flex items-center justify-center rounded-2xl border border-white/16 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/14"
              >
                Kriterien ansehen
              </a>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-white/14 bg-white/10 p-3 backdrop-blur">
              <div className="relative h-[240px] overflow-hidden rounded-[22px] border border-white/10 bg-slate-950 sm:h-[320px]">
                <Image
                  src="/happy_family.jpg"
                  alt="Kreditberatung bei SEPANA"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1280px) 100vw, 42vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/14 bg-white/12 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Kundenbewertung
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="text-lg tracking-[0.18em] text-amber-300">★★★★★</div>
                    <div className="text-sm font-semibold text-white">{formatScore(reviewStats.average)} / 5</div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-100/95">&bdquo;{leadReview.quote}&ldquo;</p>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200/85">
                    {leadReview.initials} aus {leadReview.city}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {TRUST_STRIP.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[22px] border border-white/14 bg-white/10 px-4 py-4 backdrop-blur"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200/80">
                    {item.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{item.value}</div>
                  <div className="mt-1 text-xs leading-6 text-slate-200/85">{item.note}</div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="vorpruefung" className="scroll-mt-24">
        <SchufaFreePrecheck />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
          <div className="max-w-md">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bewertungen</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                So wird die Strecke aktuell wahrgenommen
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Nach der Vorprüfung sehen Interessenten direkt, dass die Strecke klar geführt, mobil gut bedienbar und nachvollziehbar aufgebaut ist.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredReviews.map((item) => (
              <article
                key={`${item.initials}-${item.city}`}
                className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                    {item.initials}
                  </div>
                  <div className="text-sm tracking-[0.18em] text-amber-500">★★★★★</div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">&bdquo;{item.quote}&ldquo;</p>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.city}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="kriterien"
        className="scroll-mt-24 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Kriterien für die Vorprüfung
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Diese Punkte müssen grundsätzlich passen
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Die Vorprüfung ist bewusst klar aufgebaut. Damit Sie nicht unnötig Zeit verlieren, sehen Sie hier die wichtigsten Anforderungen schon vor dem Start.
              </p>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
              <div className="relative h-[250px] sm:h-[320px]">
                <Image
                  src="/familie_umzug.jpg"
                  alt="Voraussetzungen für die Vorprüfung"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1280px) 100vw, 40vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Wichtiger Hinweis
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/95">
                    Eine positive Vorprüfung ist noch keine endgültige Zusage. Sie sorgt aber für eine klare erste Einordnung, bevor der vollständige Antrag startet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {ELIGIBILITY_ITEMS.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.title}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{item.value}</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Die wichtigsten Regeln im Detail</div>
              <div className="mt-4 space-y-3">
                {REQUIREMENT_DETAILS.map((item, index) => (
                  <div key={item} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 text-sm leading-7 text-slate-700">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verfügbare Varianten</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Feste Kreditsummen mit klarer Monatsrate
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Die Strecke arbeitet mit festen Varianten. So ist direkt klar, welche Monatsrate zu welcher Kreditsumme gehört.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {offerCards.map((item) => (
            <article
              key={item.amount}
              className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Variante</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {formatWholeEuro(item.amount)}
              </div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Monatsrate
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatEuro(item.monthlyRate)}</div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Mindestnetto ohne Kinder
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{formatWholeEuro(item.minimumIncome ?? 0)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ablauf</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            So läuft die Strecke Schritt für Schritt
          </h2>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {PROCESS_STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="max-w-4xl">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Häufige Fragen zur Landingpage und zur Vorprüfung
          </h2>
        </div>

        <div className="mt-5 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left marker:hidden">
                <span className="text-base font-semibold text-slate-950">{item.question}</span>
                <span className="mt-1 text-xl leading-none text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pr-8 text-sm leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-900 bg-slate-900 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Nächster Schritt</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Wenn es schnell gehen soll, starten Sie direkt mit der Vorprüfung
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              Die Seite ist bewusst für einen schnellen mobilen Einstieg aufgebaut. Über die Vorprüfung kommen Sie ohne Umwege in den nächsten Schritt.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#vorpruefung"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Jetzt Vorprüfung starten
            </a>
            <a
              href="#faq"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              FAQ ansehen
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
