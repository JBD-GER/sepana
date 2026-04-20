export const runtime = "nodejs"

import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { getStaticRatgeberTopics } from "@/lib/ratgeber/content"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { slugify, trimToNull } from "@/lib/ratgeber/utils"
import { normalizeWebsiteHeaderPageHref } from "@/lib/website/navigation"

type ArticleSectionInput = {
  heading?: unknown
  paragraphs?: unknown
  bullets?: unknown
}

type FaqInput = {
  question?: unknown
  answer?: unknown
}

type SaveBody = {
  id?: unknown
  categorySlug?: unknown
  topicSlug?: unknown
  slug?: unknown
  menuTitle?: unknown
  title?: unknown
  excerpt?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
  focusKeyword?: unknown
  readingTimeMinutes?: unknown
  sortOrder?: unknown
  isPublished?: unknown
  heroImagePath?: unknown
  heroImageAlt?: unknown
  ctaPageHref?: unknown
  outline?: unknown
  highlights?: unknown
  faq?: unknown
  sections?: unknown
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback
}

function asPositiveInt(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function parseStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseFaq(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as FaqInput
      const question = asString(row?.question)
      const answer = asString(row?.answer)
      if (!question || !answer) return null
      return { question, answer }
    })
    .filter((item): item is { question: string; answer: string } => item !== null)
}

function parseSections(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as ArticleSectionInput
      const heading = asString(row?.heading)
      const paragraphs = parseStringList(row?.paragraphs)
      const bullets = parseStringList(row?.bullets)
      if (!heading || !paragraphs.length) return null
      return {
        heading,
        paragraphs,
        bullets: bullets.length ? bullets : undefined,
      }
    })
    .filter((item) => item !== null) as Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>
}

function isMissingArticleCtaPageColumn(message: string | undefined) {
  return Boolean(message && message.includes("cta_page_href"))
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as SaveBody

    const categorySlug = asString(body.categorySlug)
    const topicSlug = asString(body.topicSlug)
    const inferredCategorySlug = getStaticRatgeberTopics().find((item) => item.slug === topicSlug)?.categorySlug ?? ""
    const effectiveCategorySlug = categorySlug || inferredCategorySlug
    const title = asString(body.title)
    const menuTitle = asString(body.menuTitle) || title
    const slug = slugify(asString(body.slug) || title)
    const focusKeyword = asString(body.focusKeyword)
    const excerpt = asString(body.excerpt)
    const seoTitle = asString(body.seoTitle)
    const seoDescription = asString(body.seoDescription)
    const rawCtaPageHref = asString(body.ctaPageHref)
    const ctaPageHref = normalizeWebsiteHeaderPageHref(body.ctaPageHref)
    const sections = parseSections(body.sections)
    const outline = parseStringList(body.outline)
    const highlights = parseStringList(body.highlights)
    const faq = parseFaq(body.faq)

    if (!effectiveCategorySlug || !topicSlug) {
      return NextResponse.json({ ok: false, error: "Kategorie oder Unterkategorie fehlt." }, { status: 400 })
    }
    if (!title || !slug || !menuTitle || !focusKeyword || !excerpt || !seoTitle || !seoDescription) {
      return NextResponse.json({ ok: false, error: "Pflichtfelder fehlen." }, { status: 400 })
    }
    if (rawCtaPageHref && !ctaPageHref) {
      return NextResponse.json({ ok: false, error: "CTA-Ziel ist ungueltig." }, { status: 400 })
    }
    if (!sections.length) {
      return NextResponse.json({ ok: false, error: "Mindestens ein Textblock ist erforderlich." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: category, error: categoryError } = await admin
      .from("ratgeber_categories")
      .select("id")
      .eq("slug", effectiveCategorySlug)
      .maybeSingle()

    if (categoryError) throw categoryError
    if (!category?.id) {
      return NextResponse.json({ ok: false, error: "Kategorie nicht gefunden." }, { status: 404 })
    }

    const { data: topic, error: topicError } = await admin
      .from("ratgeber_topics")
      .select("id")
      .eq("category_id", category.id)
      .eq("slug", topicSlug)
      .maybeSingle()

    if (topicError) throw topicError
    if (!topic?.id) {
      return NextResponse.json({ ok: false, error: "Unterkategorie nicht gefunden." }, { status: 404 })
    }

    let sortOrder = asPositiveInt(body.sortOrder, 0)
    if (!sortOrder) {
      const { data: latest } = await admin
        .from("ratgeber_articles")
        .select("sort_order")
        .eq("topic_id", topic.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()
      sortOrder = asPositiveInt(latest?.sort_order, 0) + 1
    }

    const patch = {
      category_id: category.id,
      topic_id: topic.id,
      slug,
      menu_title: menuTitle,
      title,
      excerpt,
      seo_title: seoTitle,
      seo_description: seoDescription,
      focus_keyword: focusKeyword,
      reading_time_minutes: asPositiveInt(body.readingTimeMinutes, 6),
      sort_order: sortOrder,
      is_published: asBoolean(body.isPublished, true),
      hero_image_path: trimToNull(body.heroImagePath),
      hero_image_alt: trimToNull(body.heroImageAlt) || title,
      cta_page_href: ctaPageHref,
      outline,
      highlights,
      faq,
      content: sections,
      updated_at: new Date().toISOString(),
    }

    const articleId = asString(body.id)
    const runSave = async (includeCtaPage: boolean) => {
      const patchWithoutCtaPage = (({ cta_page_href: omitted, ...rest }) => {
        void omitted
        return rest
      })(patch)
      const resolvedPatch = includeCtaPage ? patch : patchWithoutCtaPage
      const saveQuery = articleId
        ? admin.from("ratgeber_articles").update(resolvedPatch).eq("id", articleId)
        : admin.from("ratgeber_articles").insert({
            ...resolvedPatch,
            published_at: new Date().toISOString(),
          })
      return await saveQuery
    }

    let { error } = await runSave(true)
    if (error && isMissingArticleCtaPageColumn(error.message)) {
      if (ctaPageHref) {
        return NextResponse.json(
          { ok: false, error: "Das CTA-Zielfeld fehlt noch in der Datenbank. Bitte zuerst die SQL-Migration ausfuehren." },
          { status: 500 },
        )
      }

      const fallback = await runSave(false)
      error = fallback.error
    }
    if (error) throw error

    const { data: saved, error: reloadError } = await admin
      .from("ratgeber_articles")
      .select("id")
      .eq("slug", slug)
      .eq("topic_id", topic.id)
      .maybeSingle()

    if (reloadError) throw reloadError

    const categoryPath = `/ratgeber/${effectiveCategorySlug}`
    const topicPath = `${categoryPath}/${topicSlug}`
    const articlePath = `${topicPath}/${slug}`

    revalidatePath("/ratgeber")
    revalidatePath(categoryPath)
    revalidatePath(topicPath)
    revalidatePath(articlePath)
    revalidatePath("/sitemap.xml")
    revalidatePath("/sitemap-index.xml")

    return NextResponse.json({ ok: true, id: saved?.id ?? (articleId || null) })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Serverfehler" },
      { status: 500 },
    )
  }
}
