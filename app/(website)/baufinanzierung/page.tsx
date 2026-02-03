import type { Metadata } from "next"
import BaufiStart from "./ui/BaufiStart"

export const metadata: Metadata = {
  title: "Baufinanzierung Vergleich | SEPANA",
  description:
    "Baufinanzierung digital starten: Eckdaten eingeben, Angebote vergleichen, Upload-Link erhalten und optional live finalisieren.",
  alternates: { canonical: "/baufinanzierung" },
}

const STEPS = [
  {
    title: "Eckdaten erfassen",
    text: "Vorhaben, Objektart und Kaufpreis reichen für den Start.",
  },
  {
    title: "Haushalt vervollständigen",
    text: "Einnahmen, Ausgaben und optionale Mitantragsteller transparent eintragen.",
  },
  {
    title: "Vorschlag auswählen",
    text: "Konditionen vergleichen und den passenden Weg für Ihren Fall festlegen.",
  },
  {
    title: "Upload und Abschluss",
    text: "Unterlagen sicher hochladen und bei Bedarf direkt live mit Beratern finalisieren.",
  },
]

const FAQ = [
  {
    q: "Ist der Vergleich kostenlos?",
    a: "Ja, der Start ist kostenlos. Sie erhalten eine strukturierte Einordnung für Ihren Finanzierungsfall.",
  },
  {
    q: "Kann ich weitere Kreditnehmer hinzufügen?",
    a: "Ja, Mitantragsteller können direkt im Wizard erfasst werden. Das Einkommen wird automatisch berücksichtigt.",
  },
  {
    q: "Wie schnell erhalte ich ein Ergebnis?",
    a: "Nach der Dateneingabe wird der Fall sofort verarbeitet und im Portal bereitgestellt.",
  },
  {
    q: "Gibt es Live-Beratung?",
    a: "Ja. Sobald der Fall vorbereitet ist, können Sie direkt in die Live-Session wechseln.",
  },
]

export default function BaufinanzierungPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_20px_64px_rgba(15,23,42,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Baufinanzierung</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Der digitale Weg zur Finanzierung</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200/95 sm:text-base">
            SEPANA führt Sie in klaren Schritten vom Erstvergleich bis zum finalen Abschluss - inklusive Portal,
            Dokumentenlogik und Live-Beratung.
          </p>
        </div>
      </section>

      <BaufiStart />

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">In vier Schritten zum Ziel</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {STEPS.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Was wird benötigt</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Die wichtigsten Angaben</h3>

          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Objektdaten und Finanzierungszweck</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Haushaltsrechnung mit Einnahmen und Ausgaben</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Kontaktinformationen für Portal und Rückfragen</li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Optional: Mitantragsteller mit Einkommen</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktuell live</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Plattformmodule</h3>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Vergleichswizard</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Angebotsauswahl</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Dokumentenhub</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Live-Beratung</div>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">FAQ</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Häufige Fragen</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
