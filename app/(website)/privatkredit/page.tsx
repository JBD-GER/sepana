import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privatkredit | Bald eröffnet",
  description: "Das Privatkredit-Modul wird vorbereitet und folgt nach der aktuellen Baufinanzierungs-Roadmap.",
}

export default function PrivatkreditPage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative max-w-2xl">
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
            Bald eröffnet
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Privatkredit ist als nächstes dran</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Wir bauen das Modul aktuell auf denselben Standard wie die Baufinanzierung aus - inklusive Prozesslogik,
            Statussicht und Live-Anbindung.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/baufinanzierung"
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Zur Baufinanzierung
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
