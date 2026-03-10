import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  getRatgeberArticlePath,
  getRatgeberCategoryPath,
  getStaticRatgeberTopics,
  getRatgeberTopicPath,
} from "@/lib/ratgeber/content"
import {
  getRatgeberArticlesByTopic,
  getRatgeberCategoryBySlug,
  getRatgeberTopicBySlug,
  getRatgeberTopicsByCategory,
} from "@/lib/ratgeber/server"
import { absoluteUrl, buildBreadcrumbList, buildOrganization, jsonLd } from "@/lib/ratgeber/seo"
import { getRatgeberImageSrc } from "@/lib/ratgeber/utils"
import RatgeberArticleCard from "../../ui/RatgeberArticleCard"

export const revalidate = 3600

export async function generateStaticParams() {
  return getStaticRatgeberTopics().map((topic) => ({
    category: topic.categorySlug,
    topic: topic.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; topic: string }>
}): Promise<Metadata> {
  const { category: categorySlug, topic: topicSlug } = await params
  const topic = await getRatgeberTopicBySlug(categorySlug, topicSlug)
  if (!topic) {
    return {}
  }

  const canonicalPath = getRatgeberTopicPath(topic)

  return {
    title: topic.seoTitle,
    description: topic.seoDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: topic.seoTitle,
      description: topic.seoDescription,
      url: canonicalPath,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: topic.seoTitle,
      description: topic.seoDescription,
    },
  }
}

export default async function RatgeberTopicPage({
  params,
}: {
  params: Promise<{ category: string; topic: string }>
}) {
  const { category: categorySlug, topic: topicSlug } = await params
  const [category, topic, articles, siblingTopics] = await Promise.all([
    getRatgeberCategoryBySlug(categorySlug),
    getRatgeberTopicBySlug(categorySlug, topicSlug),
    getRatgeberArticlesByTopic(categorySlug, topicSlug),
    getRatgeberTopicsByCategory(categorySlug),
  ])

  if (!category || !topic) notFound()

  const relatedTopics = siblingTopics.filter((item) => item.slug !== topic.slug).slice(0, 4)
  const heroImageSrc = getRatgeberImageSrc(topic.heroImagePath)

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${topic.name} Ratgeber`,
    description: topic.seoDescription,
    url: absoluteUrl(getRatgeberTopicPath(topic)),
    about: [category.name, topic.name],
    publisher: buildOrganization(),
    hasPart: articles.map((article) => ({
      "@type": "Article",
      headline: article.title,
      url: absoluteUrl(getRatgeberArticlePath(article)),
    })),
  }

  const breadcrumbs = buildBreadcrumbList([
    { name: "Startseite", path: "/" },
    { name: "Ratgeber", path: "/ratgeber" },
    { name: category.name, path: getRatgeberCategoryPath(category.slug) },
    { name: topic.name, path: getRatgeberTopicPath(topic) },
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
          <Link href={getRatgeberCategoryPath(category.slug)} className="transition hover:text-slate-900">
            {category.name}
          </Link>
          <span>/</span>
          <span className="text-slate-900">{topic.name}</span>
        </div>
      </nav>

      <section className="rounded-[32px] border border-slate-200 bg-slate-100 px-5 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] lg:items-center">
          <div className="relative h-[220px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200 sm:h-[260px] lg:h-[280px]">
            {heroImageSrc ? (
              <Image
                src={heroImageSrc}
                alt={topic.heroImageAlt}
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 360px"
                unoptimized
              />
            ) : null}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Unterkategorie
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {topic.heroTitle}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-700">{topic.heroText}</p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{category.name}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {articles.length} Beiträge
              </span>
            </div>

            <Link
              href={category.ctaHref}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {category.ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Blogbeiträge</div>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Eigene Beiträge zu {topic.name}
            </h2>
          </div>
          <div className="text-sm text-slate-600">{articles.length} veröffentlichte Beiträge</div>
        </div>

        {articles.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {articles.map((article) => {
              const articleImageSrc = getRatgeberImageSrc(article.heroImagePath)

              return (
                <RatgeberArticleCard
                  key={article.slug}
                  href={getRatgeberArticlePath(article)}
                  title={article.title}
                  excerpt={article.excerpt}
                  imageSrc={articleImageSrc}
                  imageAlt={article.heroImageAlt}
                  topicName={topic.name}
                  categoryName={category.name}
                  publishedAt={article.publishedAt}
                  readingTimeMinutes={article.readingTimeMinutes}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Für diese Unterkategorie gibt es aktuell noch keine eigenen Blogbeiträge.
          </div>
        )}
      </section>

      {relatedTopics.length ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Weitere Themen</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {relatedTopics.map((item) => (
              <Link
                key={item.slug}
                href={getRatgeberTopicPath(item)}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition hover:bg-white"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {category.name}
                </div>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">{item.name}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
