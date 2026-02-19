import Link from "next/link"

type Step = {
  id: string
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    id: "01",
    title: "Vergleich starten",
    text: "Sie erfassen die wichtigsten Eckdaten und erhalten sofort eine klare Ausgangslage.",
  },
  {
    id: "02",
    title: "Angebot auswählen",
    text: "Sie vergleichen Konditionen transparent und wählen den passenden Finanzierungsweg.",
  },
  {
    id: "03",
    title: "Unterlagen hochladen",
    text: "Der Upload erfolgt strukturiert im Portal - kein E-Mail-Chaos, keine offenen Enden.",
  },
  {
    id: "04",
    title: "Live finalisieren",
    text: "Wenn nötig, klären wir Details direkt in der Live-Session und bringen den Fall ins Ziel.",
  },
]

const MODULES = [
  {
    name: "Baufinanzierungsvergleich",
    status: "Live",
    text: "Von der Ersterfassung bis zum finalen Angebot in einem durchgängigen Flow.",
  },
  {
    name: "Dokumentenhub",
    status: "Live",
    text: "Sichere Uploads, Nachforderungen und Freigaben in einer zentralen Fallansicht.",
  },
  {
    name: "Live-Beratung",
    status: "Live",
    text: "Direkte Übergabe aus dem Vergleich in den digitalen Beratungsraum.",
  },
  {
    name: "Privatkredit",
    status: "Neu",
    text: "Neu verfügbar als direkter Anfrage-Flow mit Live-Beratung und schneller Rückmeldung.",
  },
]

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const isLive = normalized === "live"
  const isNew = normalized === "neu" || normalized === "new"

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
        isLive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isNew
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {value}
    </span>
  )
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-12 sm:space-y-14">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-[0_24px_70px_rgba(2,6,23,0.45)] sm:p-10">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100/90">
              SEPANA Plattform
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Baufinanzierung und Privatkredit: klar, schnell und voll digital.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              SEPANA verbindet Baufinanzierung und Privatkredit (allgemeiner Kredit) in einem klaren Prozess:
              Anfrage, Auswahl, Upload und Live-Beratung greifen nahtlos ineinander.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">DSGVO-konform</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Portal mit Echtzeitstatus</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Live-Session on demand</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/baufinanzierung"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Jetzt Baufinanzierung starten
                <Arrow />
              </Link>
              <Link
                href="/privatkredit"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <span>Privatkredit / allgemeiner Kredit</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  Neu
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Ihre Vorteile</div>
            <div className="mt-2 text-xl font-semibold">Warum Kunden SEPANA lieben</div>
            <p className="mt-2 text-sm text-slate-200/90">
              Wir kombinieren digitale Geschwindigkeit mit persönlicher Beratung - klar strukturiert,
              transparent und ohne Medienbruch.
            </p>

            <div className="mt-5 grid gap-2 text-sm">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">Klarer 4-Schritte-Prozess vom Start bis Abschluss</div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">Sicherer Upload statt unstrukturierter E-Mails</div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">Live-Beratung direkt im richtigen Moment</div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">Transparente Konditionen und klare nächste Schritte</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MODULES.map((module) => (
          <article key={module.name} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">{module.name}</h2>
              <StatusPill value={module.status} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{module.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ablauf</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">So läuft ein SEPANA-Fall</h2>
          </div>
          <Link href="/baufinanzierung" className="text-sm font-semibold text-slate-900 underline underline-offset-4">
            Direkt zum Vergleich
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {STEPS.map((step) => (
            <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Schritt {step.id}</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Neu im Produktbereich</div>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">Privatkredit - Neu</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Der Privatkredit ist jetzt live als Anfrage-Flow mit direkter Live-Beratung verfügbar.
            </p>
          </div>
          <Link
            href="/privatkredit"
            className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
          >
            Jetzt entdecken
          </Link>
        </div>
      </section>
    </div>
  )
}

