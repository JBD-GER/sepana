import Link from "next/link"

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">SEPANA</div>
            <p className="text-sm text-slate-600">
              Online-Kreditvergleich & Live-Beratung – klar strukturiert und effizient bis zur Bankentscheidung.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Vergleiche</div>
            <div className="grid gap-1 text-sm">
              <Link className="text-slate-600 hover:text-slate-900" href="/baufinanzierung">Baufinanzierung</Link>
              <Link className="text-slate-600 hover:text-slate-900" href="/privatkredit">Privatkredit</Link>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Rechtliches</div>
            <div className="grid gap-1 text-sm">
              <Link className="text-slate-600 hover:text-slate-900" href="/impressum">Impressum</Link>
              <Link className="text-slate-600 hover:text-slate-900" href="/datenschutz">Datenschutz</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200/70 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SEPANA</span>
          <span>Hinweis: Konditionen bonitäts- & objektabhängig.</span>
        </div>
      </div>
    </footer>
  )
}
