import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  getRatgeberArticlePath,
  getRatgeberCategoryPath,
  getRatgeberTopicPath,
  getStaticRatgeberCategories,
} from "@/lib/ratgeber/content"
import { getRatgeberArticlesByCategory, getRatgeberCategoryBySlug, getRatgeberTopicWithCount } from "@/lib/ratgeber/server"
import { absoluteUrl, buildBreadcrumbList, buildOrganization, jsonLd } from "@/lib/ratgeber/seo"
import { getRatgeberImageSrc } from "@/lib/ratgeber/utils"
import RatgeberCategoryBrowser from "../ui/RatgeberCategoryBrowser"

export const revalidate = 3600

export async function generateStaticParams() {
  return getStaticRatgeberCategories().map((category) => ({
    category: category.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category: categorySlug } = await params
  const category = await getRatgeberCategoryBySlug(categorySlug)
  if (!category) {
    return {}
  }

  const canonicalPath = getRatgeberCategoryPath(category.slug)

  return {
    title: category.seoTitle,
    description: category.seoDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: category.seoTitle,
      description: category.seoDescription,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: category.seoTitle,
      description: category.seoDescription,
    },
  }
}

export default async function RatgeberCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categorySlug } = await params
  const category = await getRatgeberCategoryBySlug(categorySlug)
  if (!category) notFound()

  const [topics, articles] = await Promise.all([
    getRatgeberTopicWithCount(category.slug),
    getRatgeberArticlesByCategory(category.slug),
  ])
  const topicLookup = new Map(topics.map(({ topic }) => [topic.slug, topic]))
  const browserTopics = topics.map(({ topic, articleCount }) => ({
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    href: getRatgeberTopicPath(topic),
    articleCount,
  }))
  const browserArticles = articles.map((article) => {
    const topic = topicLookup.get(article.topicSlug)

    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      href: getRatgeberArticlePath(article),
      topicSlug: article.topicSlug,
      topicName: topic?.name ?? article.topicSlug,
      heroImageSrc: getRatgeberImageSrc(article.heroImagePath),
      heroImageAlt: article.heroImageAlt,
      publishedAt: article.publishedAt,
      readingTimeMinutes: article.readingTimeMinutes,
    }
  })

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} Ratgeber`,
    description: category.seoDescription,
    url: absoluteUrl(getRatgeberCategoryPath(category.slug)),
    about: category.name,
    publisher: buildOrganization(),
    hasPart: topics.map(({ topic }) => ({
      "@type": "CollectionPage",
      headline: topic.name,
      url: absoluteUrl(getRatgeberTopicPath(topic)),
    })),
  }

  const breadcrumbs = buildBreadcrumbList([
    { name: "Startseite", path: "/" },
    { name: "Ratgeber", path: "/ratgeber" },
    { name: category.name, path: getRatgeberCategoryPath(category.slug) },
  ])

  return (
    <div className="space-y-8 sm:space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="transition hover:text-slate-900">
            Home
          </Link>
          <span>/</span>
          <Link href="/ratgeber" className="transition hover:text-slate-900">
            Ratgeber
          </Link>
          <span>/</span>
          <span className="text-slate-900">{category.name}</span>
        </div>
      </nav>

      <section className="rounded-[32px] border border-slate-200 bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
        <div className="max-w-4xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ratgeber {category.name}
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {category.heroTitle}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-700">{category.heroText}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {topics.map(({ topic, articleCount }) => (
              <span
                key={topic.slug}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                {topic.name} ({articleCount})
              </span>
            ))}
          </div>
        </div>
      </section>

      <RatgeberCategoryBrowser
        categoryName={category.name}
        categoryCtaHref={category.ctaHref}
        categoryCtaLabel={category.ctaLabel}
        topics={browserTopics}
        articles={browserArticles}
      />
    </div>
  )
}
