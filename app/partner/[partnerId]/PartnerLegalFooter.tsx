"use client"

import { useEffect, useState } from "react"
import { DatenschutzContent, ImpressumContent } from "@/app/(website)/components/legal/LegalContent"

type LegalView = "impressum" | "datenschutz" | null

export default function PartnerLegalFooter() {
  const [activeView, setActiveView] = useState<LegalView>(null)

  useEffect(() => {
    if (!activeView) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveView(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [activeView])

  return (
    <>
      <footer className="rounded-[28px] border border-slate-200/70 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} SEPANA</div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("impressum")}
              className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900"
            >
              Impressum
            </button>
            <button
              type="button"
              onClick={() => setActiveView("datenschutz")}
              className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900"
            >
              Datenschutz
            </button>
          </div>
        </div>
      </footer>

      {activeView ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-[#f8fafc] shadow-[0_32px_90px_rgba(2,6,23,0.35)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rechtliches</div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
                  {activeView === "impressum" ? "Impressum" : "Datenschutz"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveView(null)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Schließen
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {activeView === "impressum" ? <ImpressumContent /> : <DatenschutzContent />}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
