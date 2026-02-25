"use client"

import { useId, useState } from "react"
import type {
  WebsiteReview,
  WebsiteReviewCategory,
  WebsiteReviewSummarySet,
  WebsiteReviewTab,
} from "@/lib/websiteReviews"

type WebsiteReviewsSectionClientProps = {
  reviews: WebsiteReview[]
  summary: WebsiteReviewSummarySet
  initialTab: WebsiteReviewTab
  expandAllTabsByDefault?: boolean
  eyebrow?: string
  title?: string
  description?: string
  ctaHref?: string | null
  ctaLabel?: string | null
}

const TAB_ORDER: WebsiteReviewTab[] = ["overall", "baufi", "privatkredit"]

const TAB_LABELS: Record<WebsiteReviewTab, string> = {
  overall: "Insgesamt",
  baufi: "Baufinanzierung",
  privatkredit: "Privatkredit",
}

const CATEGORY_LABELS: Record<WebsiteReviewCategory, string> = {
  baufi: "Baufinanzierung",
  privatkredit: "Privatkredit",
}

const STAR_FILLED = "\u2605"
const STAR_OUTLINE = "\u2606"

function formatScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(d)
}

function stars(rating: number) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return `${STAR_FILLED.repeat(full)}${STAR_OUTLINE.repeat(Math.max(0, 5 - full))}`
}

function percent(part: number, total: number) {
  if (!total) return "0"
  return Math.round((part / total) * 100).toString()
}

function reviewStatsForTab(summary: WebsiteReviewSummarySet, tab: WebsiteReviewTab) {
  if (tab === "overall") return summary.overall
  if (tab === "baufi") return summary.baufi
  return summary.privatkredit
}

export default function WebsiteReviewsSectionClient({
  reviews,
  summary,
  initialTab,
  expandAllTabsByDefault = false,
  eyebrow,
  title,
  description,
  ctaHref,
  ctaLabel,
}: WebsiteReviewsSectionClientProps) {
  const [activeTab, setActiveTab] = useState<WebsiteReviewTab>(initialTab)
  const [expanded, setExpanded] = useState<Record<WebsiteReviewTab, boolean>>({
    overall: expandAllTabsByDefault,
    baufi: expandAllTabsByDefault,
    privatkredit: expandAllTabsByDefault,
  })
  const tablistId = useId()
  const activeTabButtonId = `${tablistId}-${activeTab}`
  const panelId = `${tablistId}-panel`

  const filteredReviews =
    activeTab === "overall" ? reviews : reviews.filter((item) => item.category === activeTab)

  const activeStats = reviewStatsForTab(summary, activeTab)
  const isExpanded = expanded[activeTab]
  const previewLimit = activeTab === "overall" ? 8 : 6
  const visibleReviews = isExpanded ? filteredReviews : filteredReviews.slice(0, previewLimit)
  const hiddenCount = Math.max(filteredReviews.length - visibleReviews.length, 0)
  const latestOverallDate = formatDate(summary.overall.latestReviewedOn)

  const overallFiveStarPct = percent(summary.overall.fiveStarCount, summary.overall.count)
  return (
    <section className="rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.08),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(59,130,246,0.08),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-8">
      <div>
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm ring-1 ring-white/70 sm:p-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {eyebrow ?? "Bewertungen"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {title ?? "Echte Stimmen zur digitalen Beratung"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                {description ??
                  "Transparente Abläufe, persönliche Ansprechpartner und ein sauberer digitaler Prozess sind die Punkte, die Kundinnen und Kunden bei SEPANA am häufigsten hervorheben."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  {summary.overall.count} veröffentlichte Bewertungen
                </span>
                {latestOverallDate ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    Letzte Bewertung: {latestOverallDate}
                  </span>
                ) : null}
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
                  Intern geprüft & anonymisiert
                </span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Gesamtbewertung SEPANA
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-4xl font-semibold leading-none tracking-tight text-slate-900">
                      {formatScore(summary.overall.average)}
                    </div>
                    <div className="pb-1 text-sm text-slate-500">/ 5,0</div>
                  </div>
                  <div className="mt-2 text-xl leading-none text-cyan-500">{STAR_FILLED.repeat(5)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2">
                      <div className="text-cyan-700">5 Sterne</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{overallFiveStarPct}%</div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
                      <div className="text-blue-700">Mit 4 Sternen</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{summary.overall.fourStarCount}</div>
                    </div>
                  </div>

                  {ctaHref && ctaLabel ? (
                    <div className="mt-auto pt-4">
                      <a
                        href={ctaHref}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-[#0b1f5e] bg-[#0b1f5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                      >
                        {ctaLabel}
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(["baufi", "privatkredit"] as const).map((category) => {
                    const stats = summary[category]
                    return (
                      <article
                        key={category}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {CATEGORY_LABELS[category]}
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                          <div className="text-2xl font-semibold leading-none text-slate-900">
                            {formatScore(stats.average)}
                          </div>
                          <div className="pb-0.5 text-xs text-slate-500">/ 5,0</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          {stats.count} Bewertungen · {percent(stats.fiveStarCount, stats.count)}% 5 Sterne
                        </div>
                      </article>
                    )
                  })}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Häufig gelobt
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Beratung ohne Druck</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Klare nächste Schritte</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Digitale Signatur</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Strukturierter Upload</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-7" role="tablist" aria-label="Bewertungskategorien" id={tablistId}>
          <div className="flex flex-wrap gap-2">
            {TAB_ORDER.map((tab) => {
              const selected = tab === activeTab
              const stats = reviewStatsForTab(summary, tab)
              return (
                <button
                  key={tab}
                  type="button"
                  id={`${tablistId}-${tab}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{TAB_LABELS[tab]}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {stats.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div id={panelId} role="tabpanel" aria-labelledby={activeTabButtonId} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {activeTab === "overall" ? "Durchschnitt gesamt" : "Durchschnitt"}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {formatScore(activeStats.average)} <span className="text-sm font-medium text-slate-500">/ 5,0</span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Bewertungen</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{activeStats.count}</div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">5 Sterne</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {percent(activeStats.fiveStarCount, activeStats.count)}%
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Letzte Stimme</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(activeStats.latestReviewedOn) ?? "-"}</div>
            </article>
          </div>

          {activeTab === "overall" ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(["baufi", "privatkredit"] as const).map((category) => {
                const stats = summary[category]
                return (
                  <article key={category} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{CATEGORY_LABELS[category]}</div>
                        <div className="mt-1 text-xs text-slate-500">{stats.count} Bewertungen</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900">{formatScore(stats.average)} / 5,0</div>
                        <div className="text-xs text-slate-500">{percent(stats.fiveStarCount, stats.count)}% 5 Sterne</div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {activeTab === "overall"
                    ? "Auszug aus allen veröffentlichten Bewertungen"
                    : `Auszug ${TAB_LABELS[activeTab]}`}
                </div>
                <div className="text-xs text-slate-500">
                  Fokus auf Beratung, Erreichbarkeit, Struktur und digitalen Ablauf.
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b1f5e]">Verifiziert intern erfasst</div>
            </div>

            <div className="space-y-3">
              {visibleReviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-cyan-700">{stars(review.rating)}</div>
                      {activeTab === "overall" ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            review.category === "baufi"
                              ? "bg-cyan-50 text-cyan-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {CATEGORY_LABELS[review.category]}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{formatDate(review.reviewedOn)}</div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-[15px]">{review.quote}</p>

                  <div className="mt-3 text-xs font-medium text-slate-500">
                    Bewertung von {review.reviewerInitials} aus {review.reviewerCity}
                  </div>
                </article>
              ))}
            </div>

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [activeTab]: !current[activeTab],
                  }))
                }
                className="mt-4 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isExpanded ? "Weniger anzeigen" : `${hiddenCount} weitere Bewertungen anzeigen`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

