import type { Metadata } from "next"
import Link from "next/link"
import BaufiLeadFunnel from "./ui/BaufiLeadFunnel"

export const metadata: Metadata = {
  title: "Kostenloses Baufinanzierungs-Angebot anfordern | SEPANA",
  description:
    "Moderner Lead-Funnel für Baufinanzierung: Finanzierungsbedarf erfassen, kurze Kontaktdaten eingeben und kostenloses Angebot anfordern.",
  alternates: { canonical: "/baufinanzierung/anfrage" },
  openGraph: {
    title: "Kostenloses Baufinanzierungs-Angebot anfordern | SEPANA",
    description:
      "In wenigen Schritten zur Baufinanzierungs-Anfrage: modern, transparent und mit schneller persönlicher Rückmeldung.",
    url: "/baufinanzierung/anfrage",
    type: "website",
  },
}

const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gad_source",
  "gad_campaignid",
  "gbraid",
  "wbraid",
] as const

type SearchParams = Record<string, string | string[] | undefined>

function toFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function pickTracking(params: SearchParams) {
  const tracking: Record<string, string> = {}
  for (const key of TRACKING_KEYS) {
    const value = toFirstValue(params[key])
    if (!value) continue
    tracking[key] = value
  }
  return tracking
}

export default async function BaufiLeadRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const tracking = pickTracking(resolvedSearchParams)

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_22px_68px_rgba(15,23,42,0.36)] sm:p-8">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/80">Lead-Funnel</div>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Baufinanzierung anfragen: modern, schnell und unverbindlich
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-200/95 sm:text-base">
            Fordern Sie jetzt kostenlos ein Angebot an. Erst ein kurzer Bedarf-Check, dann Kontaktdaten - ohne lange Pflichtfelder.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="#anfrage"
              className="inline-flex items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Kostenloses Angebot anfordern
            </a>
            <Link
              href="/baufinanzierung"
              className="inline-flex items-center rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Zur klassischen Vergleichsseite
            </Link>
          </div>
        </div>
      </section>

      <section id="anfrage" className="scroll-mt-24">
        <BaufiLeadFunnel initialTracking={tracking} />
      </section>
    </div>
  )
}
