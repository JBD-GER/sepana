import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Abschluss starten – Baufinanzierung",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; caseId?: string; caseRef?: string; existing?: string }>
}) {
  const sp = await searchParams
  const bank = sp.bank || ""
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const back = `/baufinanzierung/auswahl?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${
    existing ? "&existing=1" : ""
  }`

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Abschluss (Online) – kommt als nächstes
        </h1>

        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Hier kommt später der Flow, in dem der Kunde den Abschluss bei der ausgewählten Bank startet.
        </p>

        <div className="mt-4 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
          <div className="text-xs text-slate-600">Auswahl</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{bank || "—"}</div>
          <div className="mt-2 text-xs text-slate-500 break-all">Case-ID: {caseId || "—"} · Fall: {caseRef || "—"}</div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-sm opacity-60 sm:w-auto"
            style={{ background: ACCENT }}
          >
            Abschluss starten (bald)
          </button>

          <Link
            href={back}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl transition hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.99] sm:w-auto"
          >
            Zurück zur Auswahl
          </Link>
        </div>
      </div>
    </div>
  )
}
