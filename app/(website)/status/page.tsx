import type { Metadata } from "next"
import SystemStatusBoard from "../components/SystemStatusBoard"

export const metadata: Metadata = {
  title: "Systemstatus",
  description: "Aktueller Plattformstatus für Website, Baufinanzierungsflow und Live-Module.",
}

export default function StatusPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-[0_24px_60px_rgba(2,6,23,0.36)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Systemstatus</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Die Plattform in Echtzeit</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200/95 sm:text-base">
            Diese Seite zeigt den Zustand der wichtigsten SEPANA-Services inklusive Latenzen, Uptime und zuletzt
            gelösten Ereignissen.
          </p>
        </div>
      </section>

      <SystemStatusBoard />
    </div>
  )
}
