import "server-only"

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import type { RatgeberArticleSection, RatgeberFaqItem } from "./content"
import { getStaticRatgeberCategories, getStaticRatgeberTopics } from "./content"

export type AdminRatgeberCategory = {
  slug: string
  name: string
}

export type AdminRatgeberTopic = {
  categorySlug: string
  slug: string
  name: string
}

export type AdminRatgeberArticle = {
  id: string
  categorySlug: string
  topicSlug: string
  topicName: string
  slug: string
  menuTitle: string
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  focusKeyword: string
  readingTimeMinutes: number
  sortOrder: number
  isPublished: boolean
  heroImagePath: string | null
  heroImageAlt: string
  outline: string[]
  highlights: string[]
  faq: RatgeberFaqItem[]
  sections: RatgeberArticleSection[]
  updatedAt: string | null
}

export type AdminRatgeberState = {
  dbReady: boolean
  categories: AdminRatgeberCategory[]
  topics: AdminRatgeberTopic[]
  articles: AdminRatgeberArticle[]
}

type CategoryRow = {
  slug: string
  name: string
}

type TopicRow = {
  slug: string
  name: string
  ratgeber_categories:
    | {
        slug: string
      }[]
    | null
}

type ArticleRow = {
  id: string
  slug: string
  menu_title: string
  title: string
  excerpt: string
  seo_title: string
  seo_description: string
  focus_keyword: string
  reading_time_minutes: number
  sort_order: number
  is_published: boolean
  hero_image_path: string | null
  hero_image_alt: string | null
  outline: unknown
  highlights: unknown
  faq: unknown
  content: unknown
  updated_at: string | null
  ratgeber_topics:
    | {
        slug: string
        name: string
        ratgeber_categories:
          | {
              slug: string
            }[]
          | null
      }[]
    | null
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function parseSections(value: unknown) {
  if (!Array.isArray(value)) return [] as RatgeberArticleSection[]
  return value.filter((item): item is RatgeberArticleSection => {
    if (!item || typeof item !== "object") return false
    const record = item as Record<string, unknown>
    return (
      typeof record.heading === "string" &&
      Array.isArray(record.paragraphs) &&
      record.paragraphs.every((entry) => typeof entry === "string") &&
      (record.bullets == null ||
        (Array.isArray(record.bullets) && record.bullets.every((entry) => typeof entry === "string")))
    )
  })
}

function parseFaq(value: unknown) {
  if (!Array.isArray(value)) return [] as RatgeberFaqItem[]
  return value.filter((item): item is RatgeberFaqItem => {
    if (!item || typeof item !== "object") return false
    const record = item as Record<string, unknown>
    return typeof record.question === "string" && typeof record.answer === "string"
  })
}

function hasSupabaseConfig() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE),
  )
}

export async function getRatgeberAdminState(): Promise<AdminRatgeberState> {
  const categories = getStaticRatgeberCategories().map((item) => ({ slug: item.slug, name: item.name }))
  const topics = getStaticRatgeberTopics().map((item) => ({
    categorySlug: item.categorySlug,
    slug: item.slug,
    name: item.name,
  }))

  if (!hasSupabaseConfig()) {
    return {
      dbReady: false,
      categories,
      topics,
      articles: [],
    }
  }

  try {
    const admin = supabaseAdmin()
    const [{ data: categoryRows, error: categoryError }, { data: topicRows, error: topicError }, { data: articleRows, error: articleError }] =
      await Promise.all([
        admin.from("ratgeber_categories").select("slug,name").order("sort_order", { ascending: true }),
        admin
          .from("ratgeber_topics")
          .select("slug,name,ratgeber_categories!inner(slug)")
          .order("sort_order", { ascending: true }),
        admin
          .from("ratgeber_articles")
          .select(
            "id,slug,menu_title,title,excerpt,seo_title,seo_description,focus_keyword,reading_time_minutes,sort_order,is_published,hero_image_path,hero_image_alt,outline,highlights,faq,content,updated_at,ratgeber_topics!inner(slug,name,ratgeber_categories!inner(slug))",
          )
          .order("updated_at", { ascending: false }),
      ])

    const errorMessage = categoryError?.message || topicError?.message || articleError?.message || ""
    if (errorMessage.includes("public.ratgeber_")) {
      return {
        dbReady: false,
        categories,
        topics,
        articles: [],
      }
    }

    if (categoryError) throw categoryError
    if (topicError) throw topicError
    if (articleError) throw articleError

    const loadedCategories = (categoryRows as CategoryRow[] | null)?.map((item) => ({
      slug: item.slug,
      name: item.name,
    })) ?? categories

    const loadedTopics = (topicRows as TopicRow[] | null)?.map((item) => ({
      categorySlug: item.ratgeber_categories?.[0]?.slug ?? "",
      slug: item.slug,
      name: item.name,
    })) ?? topics

    const articles = (((articleRows as unknown) as ArticleRow[] | null) ?? []).map((row) => ({
      id: row.id,
      categorySlug: row.ratgeber_topics?.[0]?.ratgeber_categories?.[0]?.slug ?? "",
      topicSlug: row.ratgeber_topics?.[0]?.slug ?? "",
      topicName: row.ratgeber_topics?.[0]?.name ?? "",
      slug: row.slug,
      menuTitle: row.menu_title,
      title: row.title,
      excerpt: row.excerpt,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      focusKeyword: row.focus_keyword,
      readingTimeMinutes: Number(row.reading_time_minutes || 4),
      sortOrder: Number(row.sort_order || 1),
      isPublished: Boolean(row.is_published),
      heroImagePath: row.hero_image_path,
      heroImageAlt: row.hero_image_alt ?? "",
      outline: parseStringArray(row.outline),
      highlights: parseStringArray(row.highlights),
      faq: parseFaq(row.faq),
      sections: parseSections(row.content),
      updatedAt: row.updated_at,
    }))

    return {
      dbReady: true,
      categories: loadedCategories,
      topics: loadedTopics,
      articles,
    }
  } catch (error) {
    console.warn("[ratgeber-admin] load failed:", error instanceof Error ? error.message : "unknown")
    return {
      dbReady: false,
      categories,
      topics,
      articles: [],
    }
  }
}
