import Link from "next/link"
import OpenConsentButton from "./OpenConsentButton"

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">SEPANA</div>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            Digitale Baufinanzierung mit klaren Schritten: Vergleich starten, Angebot wÃ¤hlen, Unterlagen sicher hochladen,
            auf Wunsch live finalisieren.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Plattformstatus: Operational
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Plattform</div>
          <div className="grid gap-1 text-sm">
            <Link className="text-slate-600 transition hover:text-slate-900" href="/baufinanzierung">
              Baufinanzierung
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/roadmap">
              Roadmap
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/status">
              Systemstatus
            </Link>
            <Link
              className="inline-flex items-center gap-2 text-emerald-700 transition hover:text-emerald-800"
              href="/privatkredit"
            >
              <span>Privatkredit</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                Neu
              </span>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Zugang</div>
          <div className="grid gap-1 text-sm">
            <Link className="text-slate-600 transition hover:text-slate-900" href="/login">
              Login
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/registrieren">
              Registrieren
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/impressum">
              Impressum
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/datenschutz">
              Datenschutz
            </Link>
            <Link className="text-slate-600 transition hover:text-slate-900" href="/agb">
              AGB
            </Link>
            <OpenConsentButton className="text-left text-slate-600 transition hover:text-slate-900" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Â© {new Date().getFullYear()} SEPANA</span>
          <span>Konditionen sind bonitÃ¤ts- und objektabhÃ¤ngig.</span>
        </div>
      </div>
    </footer>
  )
}

