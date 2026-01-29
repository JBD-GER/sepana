import { requireCustomer } from "@/lib/app/requireCustomer"

export default async function OnlineFilialePage() {
  await requireCustomer()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Online Filiale</h1>
        <p className="mt-1 text-sm text-slate-600">
          Laden Sie Unterlagen hoch und behalten Sie den Status im Blick.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Hinweis</div>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          Die Upload-Funktion bauen wir als nächstes (Storage + Signed URLs + Status pro Dokument).
          Aktuell dient diese Seite als zentrale “Filiale” – sauber, mobil und ohne Chaos.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
          <div className="text-sm font-medium text-slate-900">Tipp</div>
          <div className="mt-1 text-sm text-slate-700">
            Wenn Sie Einkommensnachweise, Kontoauszüge und Eigenkapital-Nachweise vollständig bereitstellen,
            kann die Bankprüfung deutlich schneller laufen.
          </div>
        </div>
      </div>
    </div>
  )
}
