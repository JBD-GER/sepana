import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Tippgeber Baufinanzierung | Partnerprogramm | SEPANA",
  description:
    "Tippgeber für Baufinanzierung: Empfehlungen digital einreichen, Status transparent verfolgen und Provisionen über das SEPANA Tippgeber-Dashboard verwalten.",
  alternates: { canonical: "/tippgeber-baufinanzierung" },
}

const BENEFITS = [
  {
    title: "Digitales Tippgeber-Dashboard",
    text: "Empfehlungen direkt online einreichen, Status verfolgen und Provisionen transparent einsehen.",
  },
  {
    title: "Schnelle Übergabe an Berater",
    text: "SEPANA übernimmt den Fall nach Zuweisung und lädt den Kunden wie gewohnt ins System ein.",
  },
  {
    title: "Klare Provisionslogik",
    text: "Nach Bankstatus wird die Provision automatisch vorgemerkt und im Dashboard sichtbar gemacht.",
  },
  {
    title: "Saubere Dokumentation",
    text: "Exposé-Upload, Gutschrift-Upload und Auszahlungsfreigabe laufen strukturiert über das System.",
  },
]

const FLOW = [
  {
    title: "1. Einladung durch SEPANA",
    text: "Wir legen Ihr Tippgeber-Profil an (Firma, Adresse, Kontakt) und senden Ihnen eine Einladung zum System.",
  },
  {
    title: "2. Zugang aktivieren",
    text: "Sie vergeben ein Passwort und landen direkt im Tippgeber-Dashboard.",
  },
  {
    title: "3. Tipp einreichen",
    text: "Kontaktdaten des Kunden erfassen und Exposé hochladen oder Objektdaten manuell eintragen.",
  },
  {
    title: "4. Berater übernimmt",
    text: "SEPANA weist den Tipp einem Berater zu. Der Kunde wird anschließend wie gewohnt eingeladen und betreut.",
  },
  {
    title: "5. Status & Provision",
    text: "Bankstatus und Provisionsstand werden im Tippgeber-Dashboard sichtbar. Relevante Updates kommen zusätzlich per E-Mail.",
  },
  {
    title: "6. Gutschrift & Auszahlung",
    text: "Nach interner Freigabe wird die Gutschrift bereitgestellt und die Auszahlung als bezahlt markiert.",
  },
]

const TARGET_GROUPS = [
  "Immobilienmakler und Maklerbüros",
  "Hausverwaltungen und Verwalter-Netzwerke",
  "Bauträger- und Vertriebsnetzwerke",
  "Finanzdienstleister mit Immobilienbezug",
  "Steuerberater / Rechtsanwälte mit passender Mandanten-Situation (Empfehlungsbasis)",
]

const FAQS = [
  {
    q: "Wie werde ich Tippgeber bei SEPANA?",
    a: "Das Tippgeber-Konto wird durch SEPANA erstellt und per Einladung freigeschaltet. Nach Annahme der Einladung vergeben Sie Ihr Passwort selbst.",
  },
  {
    q: "Welche Daten kann ich einreichen?",
    a: "Sie können die Kundendaten (Vorname, Nachname, Telefon, E-Mail) erfassen und zusätzlich ein Exposé hochladen oder Objektdaten manuell eintragen.",
  },
  {
    q: "Wie sehe ich meine Provisionen?",
    a: "Im Tippgeber-Dashboard sehen Sie eine Übersicht Ihrer Tipps sowie offene und ausgezahlte Provisionen inkl. Gutschrift-Download (wenn verfügbar).",
  },
  {
    q: "Wann erhalte ich eine Auszahlung?",
    a: "Die Provision wird nach Bankstatus zunächst als offen vorgemerkt. Die Auszahlung erfolgt nach interner Freigabe und wird anschließend im Dashboard als bezahlt markiert.",
  },
]

function SectionHeadline({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text?: string
}) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {text ? <p className="mt-2 max-w-3xl text-sm text-slate-600">{text}</p> : null}
    </div>
  )
}

export default function TippgeberBaufinanzierungPage() {
  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_88%_8%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(135deg,#0f172a_0%,#10243d_48%,#0f3b46_100%)] p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100/95">
                Partnerprogramm
              </span>
              <span className="inline-flex items-center rounded-full border border-emerald-200/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Tippgeber Baufinanzierung
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Baufinanzierungs-Tipps digital einreichen. Transparente Provisionen im Dashboard.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              SEPANA bietet ein strukturiertes Tippgeber-System für Baufinanzierung: Einladung, Dashboard-Zugang,
              Tipp-Erfassung, Status-Updates und Provisionsübersicht in einem klaren Prozess.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Einladung durch SEPANA</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Exposé-Upload möglich</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Provision & Gutschrift im Portal</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="mailto:info@sepana.de?subject=Tippgeber%20Baufinanzierung%20anfragen"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Tippgeber-Zugang anfragen
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bereits eingeladen? Zum Login
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Provisionsmodell (aktuell)</div>
            <div className="mt-2 text-xl font-semibold">Klare Regeln statt Blackbox</div>
            <p className="mt-2 text-sm text-slate-200/90">
              Provisionen werden nach Bankstatus im System vorgemerkt und bis zur Auszahlungsfreigabe transparent angezeigt.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-slate-300">Bankstatus abgelehnt</div>
                <div className="mt-1 text-lg font-semibold text-white">100 EUR zzgl. MwSt.</div>
                <div className="mt-1 text-xs text-slate-200/80">Als offene Provision im Dashboard sichtbar.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200/30 bg-emerald-300/10 p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-emerald-100">Bankstatus angenommen</div>
                <div className="mt-1 text-lg font-semibold text-white">30 % der SEPANA-Provision zzgl. MwSt.</div>
                <div className="mt-1 text-xs text-slate-200/85">
                  Basis ist die intern erfasste Provision nach Bankannahme. Freigabe und Auszahlung über den Admin-Prozess.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200/90">
              Hinweis: Auszahlungen erfolgen nach interner Freigabe und üblicherweise nach Eingang der SEPANA-Provision.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BENEFITS.map((item) => (
          <article key={item.title} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Für wen"
          title="Geeignet für Partner mit Immobilienbezug"
          text="Das Tippgeber-Modell richtet sich an Partner, die regelmäßig Kundenkontakte oder Objektanfragen im Baufinanzierungsumfeld haben."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {TARGET_GROUPS.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Ablauf"
          title="So funktioniert das Tippgeber-System bei SEPANA"
          text="Von der Einladung bis zur Auszahlung läuft alles nachvollziehbar über feste Prozessschritte."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {FLOW.map((step) => (
            <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-base font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline
          eyebrow="Dashboard"
          title="Was Tippgeber im Portal sehen"
          text="Das Portal ist auf Übersicht und schnelle Erfassung ausgelegt."
        />
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="text-sm font-semibold text-slate-900">Auf der Startseite</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Übersicht gesamte Tipps</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Ausgezahlte Provision (YTD)</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Offene Provision (YTD)</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Direktes Formular für neue Tipps</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="text-sm font-semibold text-slate-900">In der Tipp-Übersicht</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Status pro Tipp</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Verknüpfung zum Fall (wenn vorhanden)</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Provision je Tipp</li>
              <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />Exposé- und Gutschrift-Downloads</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <SectionHeadline eyebrow="FAQ" title="Häufige Fragen zum Tippgeber-Modell" />
        <div className="grid gap-3">
          {FAQS.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-sm font-semibold text-slate-900">{item.q}</div>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-white via-emerald-50/70 to-cyan-50/80 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Anfrage</div>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Tippgeber-Zugang für Baufinanzierung anfragen</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Sie möchten als Unternehmen Tipps digital einreichen und transparent abrechnen? Dann fordern Sie eine Einladung an.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:info@sepana.de?subject=Tippgeber%20Baufinanzierung%20anfragen"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Einladung anfragen
            </a>
            <Link
              href="/baufinanzierung"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Zur Baufinanzierung
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
