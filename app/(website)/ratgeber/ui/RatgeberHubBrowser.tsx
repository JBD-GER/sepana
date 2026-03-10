"use client"

import { useEffect, useState } from "react"
import RatgeberArticleCard from "./RatgeberArticleCard"

type HubCategory = {
  slug: string
  name: string
  topicCount: number
}

type HubTopic = {
  slug: string
  name: string
  description: string
  href: string
  categorySlug: string
  categoryName: string
  articleCount: number
}

type HubArticle = {
  slug: string
  title: string
  excerpt: string
  href: string
  categorySlug: string
  categoryName: string
  topicSlug: string
  topicName: string
  heroImageSrc: string | null
  heroImageAlt: string
  publishedAt: string
  readingTimeMinutes: number
}

type RatgeberHubBrowserProps = {
  categories: HubCategory[]
  topics: HubTopic[]
  articles: HubArticle[]
}

type FilterState = "all" | string

function getTopicFilterKey(categorySlug: string, topicSlug: string) {
  return `${categorySlug}:${topicSlug}`
}

export default function RatgeberHubBrowser({ categories, topics, articles }: RatgeberHubBrowserProps) {
  const [categoryFilter, setCategoryFilter] = useState<FilterState>("all")
  const [topicFilter, setTopicFilter] = useState<FilterState>("all")

  const visibleTopics =
    categoryFilter === "all" ? topics : topics.filter((topic) => topic.categorySlug === categoryFilter)

  useEffect(() => {
    setTopicFilter("all")
  }, [categoryFilter])

  const visibleArticles = articles.filter((article) => {
    const matchesCategory = categoryFilter === "all" || article.categorySlug === categoryFilter
    const matchesTopic =
      topicFilter === "all" || getTopicFilterKey(article.categorySlug, article.topicSlug) === topicFilter
    return matchesCategory && matchesTopic
  })

  const activeCategory =
    categoryFilter === "all" ? null : categories.find((category) => category.slug === categoryFilter) ?? null
  const activeTopic =
    topicFilter === "all"
      ? null
      : topics.find((topic) => getTopicFilterKey(topic.categorySlug, topic.slug) === topicFilter) ?? null

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-slate-200 bg-slate-50 px-5 py-10 text-center sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ratgeber</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {"F\u00FCr was interessierst du dich?"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {
              "W\u00E4hle erst die Hauptkategorie und danach die passende Unterkategorie. Die Blogbeitr\u00E4ge darunter filtern sich direkt mit."
            }
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                categoryFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              Alle Kategorien ({topics.length})
            </button>
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => setCategoryFilter(category.slug)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  categoryFilter === category.slug
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                {category.name} ({category.topicCount})
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unterkategorien</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setTopicFilter("all")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  topicFilter === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                Alle Unterkategorien ({visibleTopics.length})
              </button>
              {visibleTopics.map((topic) => (
                <button
                  key={`${topic.categorySlug}-${topic.slug}`}
                  type="button"
                  onClick={() => setTopicFilter(getTopicFilterKey(topic.categorySlug, topic.slug))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    topicFilter === getTopicFilterKey(topic.categorySlug, topic.slug)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {topic.name} ({topic.articleCount})
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {"Blogbeitr\u00E4ge"}
            </div>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {activeTopic
                ? `Beitr\u00E4ge zu ${activeTopic.name}`
                : activeCategory
                  ? `Beitr\u00E4ge zu ${activeCategory.name}`
                  : "Alle Blogbeitr\u00E4ge"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              {activeTopic
                ? activeTopic.description
                : activeCategory
                  ? `Hier findest du alle Blogbeitr\u00E4ge aus ${activeCategory.name}.`
                  : "Hier findest du alle ver\u00F6ffentlichten Blogbeitr\u00E4ge aus dem Ratgeber."}
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {visibleArticles.length} {"Beitr\u00E4ge"}
          </div>
        </div>

        {visibleArticles.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleArticles.map((article) => (
              <RatgeberArticleCard
                key={`${article.categorySlug}-${article.topicSlug}-${article.slug}`}
                href={article.href}
                title={article.title}
                excerpt={article.excerpt}
                imageSrc={article.heroImageSrc}
                imageAlt={article.heroImageAlt}
                topicName={article.topicName}
                categoryName={article.categoryName}
                publishedAt={article.publishedAt}
                readingTimeMinutes={article.readingTimeMinutes}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            {"F\u00FCr diese Auswahl gibt es aktuell noch keine ver\u00F6ffentlichten Blogbeitr\u00E4ge."}
          </div>
        )}
      </section>
    </div>
  )
}
