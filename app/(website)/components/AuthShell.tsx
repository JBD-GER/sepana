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
  return (
    <div className="relative min-h-[calc(100dvh-72px)] bg-white">
      {/* Subtle premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-40 top-[-140px] h-[420px] w-[420px] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: ACCENT }}
        />
        <div
          className="absolute -right-40 top-[120px] h-[520px] w-[520px] rounded-full opacity-[0.10] blur-3xl"
          style={{ background: ACCENT }}
        />
        <div className="absolute inset-0 opacity-[0.045] [background-image:radial-gradient(#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      {/* Main */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:py-14">
        {/* Left side */}
        <div className="lg:col-span-6">
          {/* Customer badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-700 backdrop-blur">
            <span className="text-slate-700">🛡️</span>
            Sicheres Kundenportal
          </div>

          {/* Headline: slightly smaller + cleaner */}
          <h1 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
            Sicherer Zugriff.
            <br />
            <span style={{ color: ACCENT }}>Alles im Blick.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            Verwalten Sie Ihren Kreditvorgang an einem Ort: Dokumente hochladen, Status prüfen,
            Angebote erhalten – klar, sicher, nachvollziehbar.
          </p>

          {/* Trust tiles: customer focused */}
          <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Dokumente</div>
              <p className="mt-1 text-sm text-slate-600">Sicher hochladen & verwalten</p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Status</div>
              <p className="mt-1 text-sm text-slate-600">Fortschritt jederzeit prüfen</p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Angebote</div>
              <p className="mt-1 text-sm text-slate-600">Transparente Konditionen</p>
            </div>
          </div>

        </div>

        {/* Right side card */}
        <div className="lg:col-span-6">
          <div className="mx-auto w-full max-w-xl">
            <div className="rounded-[28px] border border-slate-200/70 bg-white/85 p-6 shadow-[0_10px_30px_rgba(2,6,23,0.08)] backdrop-blur sm:p-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
                {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
              </div>

              <div className="mt-6">{children}</div>

              {/* Bottom trust line: customer wording */}
              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-600 backdrop-blur">
                <span className="inline-flex items-center gap-2">
                  <span className="text-slate-700">✅</span> DSGVO-konform
                </span>
                <span className="hidden sm:inline-flex items-center gap-2">
                  <span className="text-slate-700">🔒</span> Sicherer Upload-Bereich
                </span>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Tipp: Nutzen Sie das Portal für Uploads & Status – keine langen E-Mail-Verläufe.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
