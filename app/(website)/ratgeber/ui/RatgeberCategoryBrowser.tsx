import Link from "next/link"
import RatgeberArticleCard from "./RatgeberArticleCard"

type CategoryTopic = {
  slug: string
  name: string
  description: string
  href: string
  articleCount: number
}

type CategoryArticle = {
  slug: string
  title: string
  excerpt: string
  href: string
  topicSlug: string
  topicName: string
  heroImageSrc: string | null
  heroImageAlt: string
  publishedAt: string
  readingTimeMinutes: number
}

type RatgeberCategoryBrowserProps = {
  categoryName: string
  categoryCtaHref: string
  categoryCtaLabel: string
  topics: CategoryTopic[]
  articles: CategoryArticle[]
  selectedTopicSlug: FilterState
}

type FilterState = "all" | string

function buildCategoryHref(selectedTopicSlug: FilterState) {
  if (selectedTopicSlug === "all") return "."
  return `?topic=${encodeURIComponent(selectedTopicSlug)}`
}

export default function RatgeberCategoryBrowser({
  categoryName,
  categoryCtaHref,
  categoryCtaLabel,
  topics,
  articles,
  selectedTopicSlug,
}: RatgeberCategoryBrowserProps) {
  const activeTopic =
    selectedTopicSlug === "all" ? null : topics.find((topic) => topic.slug === selectedTopicSlug) ?? null
  const filteredArticles =
    selectedTopicSlug === "all"
      ? articles
      : articles.filter((article) => article.topicSlug === selectedTopicSlug)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unterkategorien</div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {"Themen und Beitr\u00E4ge zu "}{categoryName}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            {
              "W\u00E4hle eine Unterkategorie als Toggle. Darunter erscheinen direkt die passenden Beitr\u00E4ge mit Datum und Lesezeit."
            }
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {activeTopic ? (
            <Link
              href={activeTopic.href}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Unterseite {activeTopic.name}
            </Link>
          ) : null}
          <Link
            href={categoryCtaHref}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {categoryCtaLabel}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={buildCategoryHref("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            selectedTopicSlug === "all"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
          }`}
        >
          {"Alle Beitr\u00E4ge"} ({articles.length})
        </Link>
        {topics.map((topic) => (
          <Link
            key={topic.slug}
            href={buildCategoryHref(topic.slug)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              selectedTopicSlug === topic.slug
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-100"
            }`}
          >
            {topic.name} ({topic.articleCount})
          </Link>
        ))}
      </div>

      <section className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {"Blogbeitr\u00E4ge"}
            </div>
            <h3 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {activeTopic ? `Beitr\u00E4ge zu ${activeTopic.name}` : `Alle Beitr\u00E4ge zu ${categoryName}`}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              {activeTopic
                ? activeTopic.description
                : `Hier laufen alle ver\u00F6ffentlichten Beitr\u00E4ge aus ${categoryName} zusammen.`}
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {filteredArticles.length} {"Beitr\u00E4ge"}
          </div>
        </div>

        {filteredArticles.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredArticles.map((article) => (
              <RatgeberArticleCard
                key={article.slug}
                href={article.href}
                title={article.title}
                excerpt={article.excerpt}
                imageSrc={article.heroImageSrc}
                imageAlt={article.heroImageAlt}
                topicName={article.topicName}
                categoryName={categoryName}
                publishedAt={article.publishedAt}
                readingTimeMinutes={article.readingTimeMinutes}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            {"F\u00FCr diese Unterkategorie gibt es aktuell noch keine ver\u00F6ffentlichten Beitr\u00E4ge."}
          </div>
        )}
      </section>
    </section>
  )
}
