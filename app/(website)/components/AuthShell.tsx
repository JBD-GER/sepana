import Link from "next/link"
import { ACCENT } from "./auth/ui"

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const highlights = [
    {
      title: "Upload-Zentrale",
      text: "Dokumente sicher und strukturiert an einem Ort.",
    },
    {
      title: "Live-Status",
      text: "Jeder Schritt klar und transparent sichtbar.",
    },
    {
      title: "Direkter Kontakt",
      text: "Schnelle Abstimmung mit Beratern ohne Umwege.",
    },
  ]

  return (
    <div className="relative isolate mx-auto w-full max-w-6xl">
      <div className="pointer-events-none absolute -left-8 top-2 h-40 w-40 rounded-full bg-sky-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 top-14 h-52 w-52 rounded-full bg-emerald-100/80 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-40 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.18),transparent_70%)]" />

      <div className="relative grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <section className="order-2 rounded-[28px] border border-slate-200/80 bg-white/80 p-6 text-slate-900 shadow-[0_28px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8 lg:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            SEPANA Zugang
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Sicher anmelden.
            <br />
            <span style={{ color: ACCENT }}>Klar weiterarbeiten.</span>
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Ihr kompletter Baufinanzierungsprozess in einem Portal: Vergleich, Unterlagen, Termine und Status in einer klaren Linie.
          </p>

          <div className="mt-6 grid gap-3">
            {highlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/85 p-4">
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <p className="mt-1 text-xs text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Link
              href="/baufinanzierung"
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Vergleich starten
            </Link>
            <Link
              href="/status"
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              Systemstatus
            </Link>
          </div>
        </section>

        <section className="order-1 w-full rounded-[28px] border border-slate-200/80 bg-white p-6 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.16)] sm:p-8 lg:order-2">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Zugang
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>

          <div className="mt-6">{children}</div>

          <div className="mt-6 grid gap-2 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3 text-xs text-slate-600 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> DSGVO-konform
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden /> Verschlüsselte Üertragung
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
