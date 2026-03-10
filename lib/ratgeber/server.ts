import "server-only"

import { cache } from "react"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import {
  type RatgeberArticle,
  type RatgeberArticleSection,
  type RatgeberCategory,
  type RatgeberFaqItem,
  type RatgeberTopic,
  getStaticRatgeberArticle,
  getStaticRatgeberArticles,
  getStaticRatgeberArticlesByCategory,
  getStaticRatgeberArticlesByTopic,
  getStaticRatgeberCategories,
  getStaticRatgeberCategory,
  getStaticRatgeberTopic,
  getStaticRatgeberTopics,
  getStaticRatgeberTopicsByCategory,
} from "./content"

type CategoryRow = {
  id: string
  slug: string
  name: string
  description: string
  seo_title: string
  seo_description: string
  hero_title: string
  hero_text: string
  cta_href: string
  cta_label: string
  sort_order: number
  is_published: boolean
}

type TopicRow = {
  id: string
  category_id: string
  slug: string
  name: string
  description: string
  hero_title: string
  hero_text: string
  seo_title: string
  seo_description: string
  sort_order: number
  is_published: boolean
  hero_image_path: string | null
  hero_image_alt: string | null
}

type ArticleRow = {
  slug: string
  topic_id: string
  menu_title: string
  title: string
  excerpt: string
  seo_title: string
  seo_description: string
  focus_keyword: string
  reading_time_minutes: number
  published_at: string
  updated_at: string
  sort_order: number
  is_published: boolean
  hero_image_path: string | null
  hero_image_alt: string | null
  outline: unknown
  highlights: unknown
  faq: unknown
  content: unknown
}

type RatgeberContentSet = {
  categories: RatgeberCategory[]
  topics: RatgeberTopic[]
  articles: RatgeberArticle[]
}

function isMissingRatgeberTable(message: string | undefined) {
  return Boolean(message && message.includes("public.ratgeber_"))
}

function hasSupabaseConfig() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE),
  )
}

function isSection(value: unknown): value is RatgeberArticleSection {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.heading === "string" &&
    Array.isArray(record.paragraphs) &&
    record.paragraphs.every((item) => typeof item === "string") &&
    (record.bullets == null ||
      (Array.isArray(record.bullets) && record.bullets.every((item) => typeof item === "string")))
  )
}

function parseSections(value: unknown) {
  if (!Array.isArray(value)) return null
  const sections = value.filter(isSection)
  return sections.length ? sections : null
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return null
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  return items.length ? items : null
}

function isFaqItem(value: unknown): value is RatgeberFaqItem {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.question === "string" && typeof record.answer === "string"
}

function parseFaq(value: unknown) {
  if (!Array.isArray(value)) return null
  const items = value.filter(isFaqItem)
  return items.length ? items : null
}

const loadDbContent = cache(async (): Promise<RatgeberContentSet | null> => {
  if (!hasSupabaseConfig()) return null

  try {
    const supabase = supabaseAdmin()
    const [
      { data: categoriesData, error: categoriesError },
      { data: topicsData, error: topicsError },
      { data: articlesData, error: articlesError },
    ] = await Promise.all([
      supabase
        .from("ratgeber_categories")
        .select(
          "id,slug,name,description,seo_title,seo_description,hero_title,hero_text,cta_href,cta_label,sort_order,is_published",
        )
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ratgeber_topics")
        .select(
          "id,category_id,slug,name,description,hero_title,hero_text,seo_title,seo_description,sort_order,is_published,hero_image_path,hero_image_alt",
        )
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("ratgeber_articles")
        .select(
          "slug,topic_id,menu_title,title,excerpt,seo_title,seo_description,focus_keyword,reading_time_minutes,published_at,updated_at,sort_order,is_published,hero_image_path,hero_image_alt,outline,highlights,faq,content",
        )
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
    ])

    if (categoriesError || topicsError || articlesError) {
      const errorMessage = categoriesError?.message || topicsError?.message || articlesError?.message || "unknown"
      if (isMissingRatgeberTable(errorMessage)) {
        return null
      }
      console.warn("[ratgeber] db query failed:", errorMessage)
      return null
    }

    const categoryRows = Array.isArray(categoriesData) ? (categoriesData as CategoryRow[]) : []
    const topicRows = Array.isArray(topicsData) ? (topicsData as TopicRow[]) : []
    const articleRows = Array.isArray(articlesData) ? (articlesData as ArticleRow[]) : []
    if (!categoryRows.length || !topicRows.length) return null

    const categoryMap = new Map<string, RatgeberCategory>()
    for (const row of categoryRows) {
      categoryMap.set(row.id, {
        slug: row.slug as RatgeberCategory["slug"],
        name: row.name,
        description: row.description,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        heroTitle: row.hero_title,
        heroText: row.hero_text,
        ctaHref: row.cta_href,
        ctaLabel: row.cta_label,
        sortOrder: Number(row.sort_order || 0),
      })
    }

    const topics = topicRows
      .map((row) => {
        const category = categoryMap.get(row.category_id)
        if (!category) return null
        return {
          categorySlug: category.slug,
          slug: row.slug,
          name: row.name,
          description: row.description,
          heroTitle: row.hero_title,
          heroText: row.hero_text,
          seoTitle: row.seo_title,
          seoDescription: row.seo_description,
          sortOrder: Number(row.sort_order || 0),
          heroImagePath: row.hero_image_path,
          heroImageAlt: row.hero_image_alt?.trim() || `${row.name} im SEPANA Ratgeber`,
        } satisfies RatgeberTopic
      })
      .filter((item): item is RatgeberTopic => item !== null)

    const topicById = new Map(
      topicRows
        .map((row) => {
          const category = categoryMap.get(row.category_id)
          if (!category) return null
          return [
            row.id,
            {
              categorySlug: category.slug,
              slug: row.slug,
              name: row.name,
            },
          ] as const
        })
        .filter((item): item is readonly [string, { categorySlug: RatgeberCategory["slug"]; slug: string; name: string }] => item !== null),
    )

    const articles = articleRows
      .map((row) => {
        const topic = topicById.get(row.topic_id)
        if (!topic) return null
        const staticFallback = getStaticRatgeberArticle(topic.categorySlug, topic.slug, row.slug)
        const sections = parseSections(row.content) ?? staticFallback?.sections
        const outline = parseStringArray(row.outline) ?? staticFallback?.outline ?? []
        const highlights = parseStringArray(row.highlights) ?? staticFallback?.highlights ?? []
        const faq = parseFaq(row.faq) ?? staticFallback?.faq ?? []
        if (!sections?.length) return null

        return {
          categorySlug: topic.categorySlug,
          topicSlug: topic.slug,
          slug: row.slug,
          menuTitle: row.menu_title,
          title: row.title,
          excerpt: row.excerpt,
          seoTitle: row.seo_title,
          seoDescription: row.seo_description,
          focusKeyword: row.focus_keyword,
          readingTimeMinutes: Number(row.reading_time_minutes || 4),
          publishedAt: row.published_at,
          updatedAt: row.updated_at || row.published_at,
          sortOrder: Number(row.sort_order || 0),
          outline,
          highlights,
          heroImagePath: row.hero_image_path ?? staticFallback?.heroImagePath ?? null,
          heroImageAlt:
            row.hero_image_alt?.trim() ||
            staticFallback?.heroImageAlt ||
            `${row.menu_title} im SEPANA Ratgeber`,
          faq,
          sections,
        } satisfies RatgeberArticle
      })
      .filter((item): item is RatgeberArticle => item !== null)

    return {
      categories: Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
      topics: topics.sort((a, b) => {
        if (a.categorySlug !== b.categorySlug) return a.categorySlug.localeCompare(b.categorySlug, "de")
        return a.sortOrder - b.sortOrder
      }),
      articles,
    }
  } catch (error) {
    console.warn("[ratgeber] unexpected db error:", error instanceof Error ? error.message : "unknown")
    return null
  }
})

async function getContentSet(): Promise<RatgeberContentSet> {
  const dbContent = await loadDbContent()
  if (dbContent) return dbContent
  return {
    categories: getStaticRatgeberCategories(),
    topics: getStaticRatgeberTopics(),
    articles: getStaticRatgeberArticles(),
  }
}

export async function getRatgeberCategories() {
  const content = await getContentSet()
  return content.categories
}

export async function getRatgeberCategoryBySlug(slug: string) {
  const content = await getContentSet()
  return content.categories.find((item) => item.slug === slug) ?? getStaticRatgeberCategory(slug)
}

export async function getRatgeberTopics() {
  const content = await getContentSet()
  return content.topics
}

export async function getRatgeberTopicsByCategory(categorySlug: string) {
  const content = await getContentSet()
  const items = content.topics.filter((item) => item.categorySlug === categorySlug)
  return items.length ? items : getStaticRatgeberTopicsByCategory(categorySlug)
}

export async function getRatgeberTopicBySlug(categorySlug: string, topicSlug: string) {
  const content = await getContentSet()
  return (
    content.topics.find((item) => item.categorySlug === categorySlug && item.slug === topicSlug) ??
    getStaticRatgeberTopic(categorySlug, topicSlug)
  )
}

export async function getRatgeberArticles() {
  const content = await getContentSet()
  return content.articles
}

export async function getRatgeberArticlesByCategory(categorySlug: string) {
  const content = await getContentSet()
  const items = content.articles.filter((item) => item.categorySlug === categorySlug)
  return items.length ? items : getStaticRatgeberArticlesByCategory(categorySlug)
}

export async function getRatgeberArticlesByTopic(categorySlug: string, topicSlug: string) {
  const content = await getContentSet()
  const items = content.articles.filter(
    (item) => item.categorySlug === categorySlug && item.topicSlug === topicSlug,
  )
  return items.length ? items : getStaticRatgeberArticlesByTopic(categorySlug, topicSlug)
}

export async function getRatgeberArticleBySlug(categorySlug: string, topicSlug: string, slug: string) {
  const content = await getContentSet()
  return (
    content.articles.find(
      (item) => item.categorySlug === categorySlug && item.topicSlug === topicSlug && item.slug === slug,
    ) ?? getStaticRatgeberArticle(categorySlug, topicSlug, slug)
  )
}

export async function getRatgeberTopicCountsByCategory() {
  const [topics, articles] = await Promise.all([getRatgeberTopics(), getRatgeberArticles()])
  return topics.map((topic) => ({
    topic,
    articleCount: articles.filter(
      (article) => article.categorySlug === topic.categorySlug && article.topicSlug === topic.slug,
    ).length,
  }))
}

export async function getRatgeberTopicWithCount(categorySlug: string) {
  const [topics, articles] = await Promise.all([
    getRatgeberTopicsByCategory(categorySlug),
    getRatgeberArticlesByCategory(categorySlug),
  ])

  return topics.map((topic) => ({
    topic,
    articleCount: articles.filter((article) => article.topicSlug === topic.slug).length,
  }))
}
