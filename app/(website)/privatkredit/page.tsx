import type { Metadata } from "next"
import PrivatkreditLiveStart from "./ui/PrivatkreditLiveStart"
import PrivatkreditContactForm from "./ui/PrivatkreditContactForm"

export const metadata: Metadata = {
  title: "Privatkredit Anfrage | SEPANA",
  description:
    "Privatkredit als direkte Anfrage: Zinssatz in Echtzeit pruefen, direkte Rueckmeldung erhalten und bei positiver Entscheidung Auszahlung in 48 Stunden.",
  alternates: { canonical: "/privatkredit" },
}

const FLOW = [
  {
    title: "1. Anfrage senden",
    text: "Sie senden Ihre Eckdaten ueber das Kontaktformular oder starten direkt die Live-Beratung.",
  },
  {
    title: "2. Zinssatz in Echtzeit pruefen",
    text: "Im Gespraech oder direkt nach Eingang Ihrer Daten pruefen wir die passende Zinsspanne fuer Ihren Fall.",
  },
  {
    title: "3. Direkte Rueckmeldung",
    text: "Sie erhalten direkt eine klare Rueckmeldung, welche Unterlagen wir benoetigen und wie es weitergeht.",
  },
  {
    title: "4. Auszahlung in 48 Stunden",
    text: "Bei positiver Entscheidung und vollstaendigen Unterlagen kann die Auszahlung in bis zu 48 Stunden erfolgen.",
  },
]

const PROMISES = [
  "Kein klassischer Vergleich mit langen Tabellen.",
  "Persoenliche Einschaetzung statt anonymem Selbstlauf.",
  "Fokus auf schnelle Entscheidung und klare naechste Schritte.",
]

export default function PrivatkreditPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_20px_64px_rgba(15,23,42,0.38)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Privatkredit Anfrage</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Schnell zum Kredit, ohne klassischen Vergleich
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200/95 sm:text-base">
              Diese Seite ist bewusst als Anfrage-Flow aufgebaut: Zinssatz in Echtzeit pruefen, direkte Rueckmeldung erhalten,
              Auszahlung in bis zu 48 Stunden.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-slate-100/95">
              {PROMISES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200/80">Ihr Ablauf in kurz</div>
            <div className="mt-2 space-y-2 text-sm text-slate-100">
              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">Zinssatz pruefen in Echtzeit</div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">Direkte Rueckmeldung</div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">Auszahlung in 48 Stunden*</div>
            </div>
            <div className="mt-2 text-[11px] text-slate-200/90">
              * Bei positiver Entscheidung und vollstaendigen Unterlagen.
            </div>
          </div>
        </div>
      </section>

      <PrivatkreditLiveStart />
      <PrivatkreditContactForm />

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">So laeuft es ab</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Klare Schritte statt Vergleichsstrecke</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {FLOW.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
