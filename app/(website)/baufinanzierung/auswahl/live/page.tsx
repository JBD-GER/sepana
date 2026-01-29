import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Live-Beratung – Baufinanzierung",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; caseRef?: string; existing?: string }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const backToAuswahl = `/baufinanzierung/auswahl?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${
    existing ? "&existing=1" : ""
  }`

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Pill>DSGVO-konform</Pill>
          <Pill>Live-Beratung</Pill>
          {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
          Live-Beratung (kommt als nächstes)
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Diese Seite ist bewusst noch leer. Hier bauen wir später den Live-Abschluss inkl. Termin/Booking.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-slate-600">Fall-Referenz</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{caseRef || "—"}</div>
            <div className="mt-1 text-xs text-slate-500 break-all">Case-ID: {caseId || "—"}</div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-slate-600">Nächste Schritte (später)</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• Termin auswählen</li>
              <li>• Kurz Telefon/Video</li>
              <li>• Danach: klare Empfehlung + Abschluss-Route</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-sm opacity-60 sm:w-auto"
            style={{ background: ACCENT }}
          >
            Termin buchen (bald)
          </button>

          <Link
            href={backToAuswahl}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl transition hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.99] sm:w-auto"
          >
            Zur Bankenauswahl
          </Link>
        </div>
      </div>
    </div>
  )
}
