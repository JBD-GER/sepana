import type { Metadata } from "next"
import Link from "next/link"
import FunnelTemplate from "../funnel-vorlage/ui/FunnelTemplate"
import { getPublishedWebsiteReviewSummarySet } from "@/lib/websiteReviews"

export const metadata: Metadata = {
  title: "Kreditanfrage | SEPANA",
  description:
    "Einfacher Funnel für Baufinanzierung und Privatkredit mit Produktauswahl am Anfang.",
  alternates: { canonical: "/kreditanfrage" },
}

function formatScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function percent(part: number, total: number) {
  if (!total) return "0"
  return Math.round((part / total) * 100).toString()
}

export default async function KreditanfragePage() {
  const summary = await getPublishedWebsiteReviewSummarySet()
  const stats = summary.overall

  return (
    <div className="space-y-8 sm:space-y-10">
      <FunnelTemplate
        variant="kreditanfrage"
        eyebrow="Kreditanfrage"
        heading="Kreditanfrage"
        description="Starten Sie mit der Auswahl: Baufinanzierung oder Privatkredit."
        heroImageSrc="/familie_kueche.jpg"
        heroImageAlt="Familie in der Küche"
      />

      <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bewertungen</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Vertrauen durch echte Rückmeldungen
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Eine kompakte Bewertungsbox unter dem Funnel. Das Formular bleibt im Vordergrund, Bewertungen liefern den sozialen Beleg.
            </p>
          </div>
          <Link
            href="/bewertungen"
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Alle Bewertungen
          </Link>
        </div>

        {stats.count > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Gesamtwertung</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {formatScore(stats.average)} <span className="text-sm font-medium text-slate-500">/ 5,0</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Bewertungen</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.count}</div>
              <div className="text-xs text-slate-500">veröffentlicht</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">5 Sterne</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {percent(stats.fiveStarCount, stats.count)}%
              </div>
              <div className="text-xs text-slate-600">{stats.fiveStarCount} Stimmen</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">4 Sterne</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {percent(stats.fourStarCount, stats.count)}%
              </div>
              <div className="text-xs text-slate-600">{stats.fourStarCount} Stimmen</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            Bewertungsdaten werden geladen oder stehen aktuell noch nicht bereit.
          </div>
        )}
      </section>
    </div>
  )
}

