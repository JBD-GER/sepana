import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Produkt-Roadmap für die SEPANA Plattform.",
}

type RoadmapItem = {
  title: string
  status: "Live" | "In Arbeit" | "Geplant"
  detail: string
}

const TRACKS: Array<{ name: string; items: RoadmapItem[] }> = [
  {
    name: "Core Plattform",
    items: [
      { title: "Website Relaunch auf Baufinanzierung", status: "Live", detail: "Kompletter Fokus auf den Baufinanzierungsflow." },
      { title: "Einheitliches Dashboard-Design", status: "Live", detail: "Kunden- und Berateransicht mit gleicher Designlinie." },
      { title: "Statusseite mit Serviceüberblick", status: "In Arbeit", detail: "Live-Health und Incident-Feed werden ausgebaut." },
    ],
  },
  {
    name: "Baufinanzierung",
    items: [
      { title: "Wizard + Fallanlage", status: "Live", detail: "Erfassung, Haushaltsrechnung und Fallübergabe stehen produktiv." },
      { title: "Live-Sitzung aus Termin und Queue", status: "Live", detail: "Direkter Start aus Terminplanung oder Warteschlange." },
      { title: "Dokumenten-Automation", status: "In Arbeit", detail: "Automatische Anforderung fehlender Unterlagen je Fallstatus." },
      { title: "Signaturstrecke", status: "Geplant", detail: "Durchgängiger digitaler Abschluss im Fallkontext." },
    ],
  },
  {
    name: "Nächste Produkte",
    items: [
      { title: "Privatkredit Modul", status: "Geplant", detail: "Launch nach Abschluss der Baufinanzierungs-Meilensteine." },
      { title: "Partner-Dashboard", status: "Geplant", detail: "Externe Vermittler erhalten eigene Pipelineansicht." },
      { title: "Reporting Hub", status: "Geplant", detail: "Produkt- und Team-KPIs in Echtzeit für Ops und Management." },
    ],
  },
]

function statusClass(status: RoadmapItem["status"]) {
  if (status === "Live") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "In Arbeit") return "border-sky-200 bg-sky-50 text-sky-700"
  return "border-amber-200 bg-amber-50 text-amber-700"
}

export default function RoadmapPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-6 text-white shadow-[0_24px_60px_rgba(2,6,23,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Roadmap</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Was wir bauen - und wann</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200/95 sm:text-base">
            Transparente Produktplanung für Team, Kunden und Partner. Der Fokus bleibt auf maximaler Qualität im
            Baufinanzierungsprozess, bevor weitere Module live gehen.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {TRACKS.map((track) => (
          <article key={track.name} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{track.name}</h2>

            <div className="mt-4 space-y-3">
              {track.items.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Release Takt</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Wie wir deployen</h2>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Wöchentlich</div>
            <p className="mt-2 text-sm text-slate-600">UI- und Workflow-Verbesserungen für aktive Kernmodule.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Zweiwöchentlich</div>
            <p className="mt-2 text-sm text-slate-600">Funktions-Updates für Beraterdashboard, Termine und Live-Queue.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Monatlich</div>
            <p className="mt-2 text-sm text-slate-600">Plattform-Release Notes mit Highlights, Metriken und nächsten Prioritäten.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
