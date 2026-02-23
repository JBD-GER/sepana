import type { Metadata } from "next"
import Link from "next/link"
import ScheidungKreditLeadForm from "./ui/ScheidungKreditLeadForm"

export const metadata: Metadata = {
  title: "Kredit bei Scheidung oder Trennung | SEPANA",
  description:
    "Landingpage für Kredit bei Scheidung und Trennung: Neustart-Privatkredit oder Hauskredit-Umschuldung. Kostenloser Service mit Anfrageformular.",
  keywords: [
    "scheidung kredit",
    "ehepartner auszahlen haus kredit",
    "kredit im trennungsjahr zugewinn",
    "scheidung hauskredit",
    "kredit für scheidung",
    "kredit bei scheidung",
    "kredit bei trennung",
    "hauskredit bei trennung",
  ],
  alternates: { canonical: "/scheidung-kredit" },
}

const PRODUCTS = [
  {
    badge: "Privatkredit",
    title: "Neustart-Finanzierung nach Trennung",
    subtitle: "Für den direkten Neustart im Alltag",
    points: [
      "Umzug + Kaution + Einrichtung + Überbrückung in einer Anfrage bündeln",
      "Menschlicher Anlass, klare Kommunikation, kurze Entscheidungswege",
      "Geeignet als Neustart-Kredit nach Trennung oder Scheidung",
    ],
    ctaHref: "#anfrage-formular",
    ctaLabel: "Zum Anfrageformular",
  },
  {
    badge: "Immobilienkredit",
    title: "Umschuldung bei Trennung / Scheidung (Hauskredit)",
    subtitle: "Nur Umschuldung / Anschlussfinanzierung auf dieser Landingpage",
    points: [
      "Fokus auf Umschuldung, nicht auf Schuldhaftentlassung oder Bürgschaftsberatung",
      "Passender Weg für scheidung hauskredit / hauskredit bei trennung",
      "Kann relevant sein, wenn ein Ehepartner ausgezahlt wird und die Finanzierung neu strukturiert werden muss",
    ],
    ctaHref: "#anfrage-formular",
    ctaLabel: "Zum Anfrageformular",
  },
]

const PROCESS = [
  {
    step: "1",
    title: "Telefongespräch",
    text: "Wir klären Anlass, Kreditart und benötigte Summe. Danach wissen Sie, welcher Weg passt.",
  },
  {
    step: "2",
    title: "Kredit beantragen",
    text: "Mit den relevanten Angaben wird der Antrag gezielt weitergeführt. Ohne unnötige Umwege.",
  },
  {
    step: "3",
    title: "Auszahlung",
    text: "Bei positiver Entscheidung und vollständigen Unterlagen folgt die Auszahlung.",
  },
]

const TESTIMONIALS = [
  {
    name: "M. K. (anonymisiert)",
    title: "Neustart nach Trennung",
    quote:
      "Die Anfrage war schnell erledigt. Besonders gut war, dass direkt verstanden wurde, warum ich Umzug, Kaution und Einrichtung zusammen finanzieren musste.",
  },
  {
    name: "S. und T. (anonymisiert)",
    title: "Hauskredit bei Trennung",
    quote:
      "Wir brauchten eine klare Richtung für die Umschuldung. SEPANA hat den Ablauf sauber strukturiert und die nächsten Schritte verständlich gemacht.",
  },
  {
    name: "A. L. (anonymisiert)",
    title: "Kredit bei Scheidung",
    quote:
      "Kein komplizierter Vergleichsdschungel, sondern ein echtes Gespräch. Das hat in der Situation viel Druck rausgenommen.",
  },
]

const FAQ = [
  {
    q: "Ist der gesamte Service kostenlos?",
    a: "Ja. Die Anfrage, Erstprüfung und Rückmeldung über SEPANA sind für Sie kostenlos.",
  },
  {
    q: "Bietet ihr Beratung zu Schuldhaftentlassung oder Bürgschaft an?",
    a: "Nein. Auf dieser Landingpage geht es nur um Finanzierungsanfragen für Privatkredit sowie Immobilienkredit-Umschuldung / Anschlussfinanzierung.",
  },
  {
    q: "Ist das eine Rechtsberatung zum Thema Zugewinn im Trennungsjahr?",
    a: "Nein. Wenn Sie nach 'kredit im trennungsjahr zugewinn' suchen: Wir leisten keine Rechts- oder Steuerberatung, sondern unterstützen nur bei der Finanzierung.",
  },
  {
    q: "Kann ich hier einen Hauskredit bei Trennung anfragen?",
    a: "Ja, wenn es um Umschuldung / Anschlussfinanzierung geht. Für komplexe juristische Fragestellungen bieten wir keine Beratung an.",
  },
]

export default function ScheidungKreditPage() {
  return (
    <div className="space-y-8 sm:space-y-12">
      <section
        id="anfrage"
        className="relative overflow-hidden rounded-[34px] border border-slate-200/40 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.22),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.16),transparent_36%),linear-gradient(135deg,#081326_0%,#0b1f3a_46%,#0f3148_100%)] p-5 text-white shadow-[0_28px_80px_rgba(2,6,23,0.42)] sm:p-8 lg:p-10"
      >
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative space-y-8">
          <div className="text-center">
            <div className="inline-flex flex-wrap justify-center gap-2">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-100">
                Kredit bei Scheidung / Trennung
              </span>
              <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-100">
                Service kostenlos
              </span>
            </div>

            <h1 className="mx-auto mt-4 max-w-5xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Kredit bei Scheidung oder Trennung:
              <span className="block text-slate-100">Neustart-Kredit oder Hauskredit-Umschuldung</span>
            </h1>

            <p className="mx-auto mt-4 max-w-4xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Diese Landingpage ist für Anfragen wie <strong>kredit bei scheidung</strong>, <strong>kredit bei trennung</strong>,{" "}
              <strong>scheidung hauskredit</strong> oder <strong>hauskredit bei trennung</strong>.
            </p>
            <p className="mx-auto mt-3 max-w-4xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Ob Privatkredit für den Neustart oder Immobilienkredit als reine Umschuldung: Sie starten oben direkt mit
              einem Mehrschrittformular.
            </p>
          </div>

          <div id="anfrage-formular" className="scroll-mt-24">
            <ScheidungKreditLeadForm />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Kosten</div>
              <div className="mt-1 text-lg font-semibold text-white">0 EUR Service</div>
              <div className="mt-1 text-xs text-slate-300">Anfrage und Rückmeldung kostenlos</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Auswahl</div>
              <div className="mt-1 text-lg font-semibold text-white">Privat oder Immobilie</div>
              <div className="mt-1 text-xs text-slate-300">Produktwahl im ersten Schritt</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Ablauf</div>
              <div className="mt-1 text-lg font-semibold text-white">Telefon &rarr; Antrag &rarr; Auszahlung</div>
              <div className="mt-1 text-xs text-slate-300">Klar und menschlich</div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
            <a
              href="#anfrage-formular"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:flex-1"
            >
              Anfrage jetzt starten
            </a>
            <a
              href="#produkte"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:flex-1"
            >
              Produkte ansehen
            </a>
          </div>

          <div className="mx-auto max-w-5xl rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">
            Hinweis: Im Immobilienbereich bieten wir auf dieser Seite nur Umschuldung / Anschlussfinanzierung an. Keine
            Beratung zu Schuldhaftentlassung oder Bürgschaft.
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">So funktioniert es</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Genau wie gewünscht: <strong>Telefongespräch</strong>, <strong>Kredit beantragen</strong>, <strong>Auszahlung</strong>.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PROCESS.map((item) => (
            <article key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt {item.step}</div>
              <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bewertungen & Stimmen</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Rückmeldungen (anonymisierte Platzhalter)</h2>
          <p className="mt-2 text-sm text-slate-600">Diese Sektion kann später mit echten Bewertungen ersetzt werden.</p>
          <div className="mt-4 space-y-3">
            {TESTIMONIALS.map((item) => (
              <div key={item.name + item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.name}</div>
                  </div>
                  <div className="text-amber-500" aria-label="5 Sterne">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Einordnung</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Was diese Landingpage abdeckt</h3>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Kostenloser Service für Anfrage, Erstprüfung und Rückmeldung
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Privatkredit: Neustart-Finanzierung nach Trennung
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Immobilienkredit: nur Umschuldung / Anschlussfinanzierung
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              Keine Rechtsberatung (z. B. Zugewinn im Trennungsjahr), keine Schuldhaftentlassung/Bürgschaftsberatung
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Beispiel: ehepartner auszahlen haus kredit</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Wenn ein Partner die Immobilie übernimmt und der andere ausgezahlt wird, kann eine neue Strukturierung des
              Hauskredits nötig sein. Hier prüfen wir nur den Finanzierungsweg über Umschuldung / Anschlussfinanzierung.
            </p>
          </div>
        </article>
      </section>

      <section id="produkte" className="scroll-mt-24">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Kreditvorschläge</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Kreditvorschläge bei Trennung / Scheidung
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {PRODUCTS.map((product) => (
            <article key={product.title} className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {product.badge}
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{product.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{product.subtitle}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {product.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link
                  href={product.ctaHref}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  {product.ctaLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FAQ</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Häufige Fragen zu Kredit bei Trennung / Scheidung</h2>
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

      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-16 h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Anfragen</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Jetzt kostenlos anfragen</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Ob <strong>kredit für scheidung</strong>, <strong>kredit bei trennung</strong> oder <strong>scheidung hauskredit</strong>:
              Starten Sie oben im Mehrschrittformular.
            </p>
          </div>
          <a
            href="#anfrage-formular"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Zum Anfrageformular
          </a>
        </div>
      </section>
    </div>
  )
}

