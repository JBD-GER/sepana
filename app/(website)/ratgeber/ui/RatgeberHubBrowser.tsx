import Link from "next/link"
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
  selectedCategorySlug: FilterState
  selectedTopicKey: FilterState
}

type FilterState = "all" | string

function getTopicFilterKey(categorySlug: string, topicSlug: string) {
  return `${categorySlug}:${topicSlug}`
}

function buildHubHref(categorySlug: FilterState, topicKey: FilterState) {
  const params = new URLSearchParams()
  if (categorySlug !== "all") {
    params.set("category", categorySlug)
  }
  if (topicKey !== "all") {
    params.set("topic", topicKey)
  }
  const query = params.toString()
  return query ? `/ratgeber?${query}` : "/ratgeber"
}

export default function RatgeberHubBrowser({
  categories,
  topics,
  articles,
  selectedCategorySlug,
  selectedTopicKey,
}: RatgeberHubBrowserProps) {
  const visibleTopics =
    selectedCategorySlug === "all"
      ? topics
      : topics.filter((topic) => topic.categorySlug === selectedCategorySlug)

  const visibleArticles = articles.filter((article) => {
    const matchesCategory = selectedCategorySlug === "all" || article.categorySlug === selectedCategorySlug
    const matchesTopic =
      selectedTopicKey === "all" || getTopicFilterKey(article.categorySlug, article.topicSlug) === selectedTopicKey
    return matchesCategory && matchesTopic
  })

  const activeCategory =
    selectedCategorySlug === "all"
      ? null
      : categories.find((category) => category.slug === selectedCategorySlug) ?? null
  const activeTopic =
    selectedTopicKey === "all"
      ? null
      : topics.find((topic) => getTopicFilterKey(topic.categorySlug, topic.slug) === selectedTopicKey) ?? null

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-slate-200/80 bg-[linear-gradient(145deg,#f8fafc_0%,#ffffff_65%)] px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ratgeber</div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {"F\u00FCr was interessierst du dich?"}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
            {
              "W\u00E4hle erst die Hauptkategorie und danach die passende Unterkategorie. Die Blogbeitr\u00E4ge darunter filtern sich direkt mit."
            }
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hauptkategorien</div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  href={buildHubHref("all", "all")}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                    selectedCategorySlug === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Alle Kategorien ({topics.length})
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={buildHubHref(category.slug, "all")}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      selectedCategorySlug === category.slug
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {category.name} ({category.topicCount})
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm sm:p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unterkategorien</div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  href={buildHubHref(selectedCategorySlug, "all")}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                    selectedTopicKey === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Alle Unterkategorien ({visibleTopics.length})
                </Link>
                {visibleTopics.map((topic) => (
                  <Link
                    key={`${topic.categorySlug}-${topic.slug}`}
                    href={buildHubHref(selectedCategorySlug, getTopicFilterKey(topic.categorySlug, topic.slug))}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      selectedTopicKey === getTopicFilterKey(topic.categorySlug, topic.slug)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {topic.name} ({topic.articleCount})
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="font-medium text-slate-900">Aktive Auswahl:</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {activeCategory ? activeCategory.name : "Alle Kategorien"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {activeTopic ? activeTopic.name : "Alle Unterkategorien"}
            </span>
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
