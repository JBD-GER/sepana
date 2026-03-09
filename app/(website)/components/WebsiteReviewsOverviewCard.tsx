import Link from "next/link"
import {
  getPublishedWebsiteReviewSummarySet,
  type WebsiteReviewSummarySet,
} from "@/lib/websiteReviews"

type WebsiteReviewsOverviewCardProps = {
  eyebrow?: string
  title?: string
  description?: string
  ctaHref?: string
  ctaLabel?: string
  summary?: WebsiteReviewSummarySet
}

const STAR_FILLED = "★"
const STAR_OUTLINE = "☆"

function formatScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function percent(part: number, total: number) {
  if (!total) return "0"
  return Math.round((part / total) * 100).toString()
}

function stars(value: number | null) {
  if (value == null) return STAR_OUTLINE.repeat(5)
  const full = Math.max(0, Math.min(5, Math.round(value)))
  return `${STAR_FILLED.repeat(full)}${STAR_OUTLINE.repeat(5 - full)}`
}

export default async function WebsiteReviewsOverviewCard({
  eyebrow = "Bewertungen",
  title = "Kundenzufriedenheit auf einen Blick",
  description = "Gesamtbewertung über alle veröffentlichten Stimmen aus Baufinanzierung und Privatkredit. Die komplette Liste finden Sie auf der Bewertungsseite.",
  ctaHref = "/bewertungen",
  ctaLabel = "Alle Bewertungen ansehen",
  summary,
}: WebsiteReviewsOverviewCardProps) {
  const resolvedSummary = summary ?? (await getPublishedWebsiteReviewSummarySet())
  const stats = resolvedSummary.overall

  if (!stats.count) return null

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_88%_14%,rgba(59,130,246,0.16),transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-12 h-40 w-40 rounded-full bg-blue-200/30 blur-3xl" />

      <div className="relative grid gap-5 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>

          <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-cyan-200/80 bg-white/90 px-4 py-3 shadow-sm">
            <div className="text-2xl leading-none text-cyan-500">{stars(stats.average)}</div>
            <div className="h-8 w-px bg-slate-200" aria-hidden />
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {formatScore(stats.average)} <span className="text-sm font-medium text-slate-500">/ 5,0</span>
              </div>
              <div className="text-xs text-slate-500">{stats.count} veröffentlichte Bewertungen</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">5 Sterne</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {percent(stats.fiveStarCount, stats.count)}%
              </div>
              <div className="text-xs text-slate-600">{stats.fiveStarCount} Bewertungen</div>
            </div>

            <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">4 Sterne</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {percent(stats.fourStarCount, stats.count)}%
              </div>
              <div className="text-xs text-slate-600">{stats.fourStarCount} Bewertungen</div>
            </div>
          </div>

          <Link
            href={ctaHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[#0b1f5e] bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}


