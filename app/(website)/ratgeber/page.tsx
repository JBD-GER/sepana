import type { Metadata } from "next"
import Link from "next/link"
import { getRatgeberCategories, getRatgeberArticles, getRatgeberTopicWithCount } from "@/lib/ratgeber/server"
import { getRatgeberArticlePath, getRatgeberCategoryPath, getRatgeberTopicPath } from "@/lib/ratgeber/content"
import { absoluteUrl, buildBreadcrumbList, buildOrganization, jsonLd } from "@/lib/ratgeber/seo"
import { getRatgeberImageSrc } from "@/lib/ratgeber/utils"
import RatgeberHubBrowser from "./ui/RatgeberHubBrowser"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Ratgeber Baufinanzierung & Privatkredit | SEPANA",
  description:
    "Der SEPANA Ratgeber erklaert Baufinanzierung und Privatkredit mit strukturierten Themenclustern zu Hauskauf, Anschlussfinanzierung, Umschuldung, Bonität und Zinsen.",
  alternates: { canonical: "/ratgeber" },
  openGraph: {
    title: "Ratgeber Baufinanzierung & Privatkredit | SEPANA",
    description:
      "Themenseiten und Artikel zu Baufinanzierung und Privatkredit mit sauberer interner Verlinkung und klarer Orientierung.",
    url: "/ratgeber",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ratgeber Baufinanzierung & Privatkredit | SEPANA",
    description:
      "Ratgeberbereich fuer Baufinanzierung und Privatkredit mit klaren Kategorien, Artikelkarten und sauberen SEO-Landingpages.",
  },
}

export default async function RatgeberPage() {
  const categories = await getRatgeberCategories()
  const [sections, articles] = await Promise.all([
    Promise.all(
    categories.map(async (category) => ({
      category,
      topics: await getRatgeberTopicWithCount(category.slug),
    })),
    ),
    getRatgeberArticles(),
  ])

  const topicLookup = new Map(
    sections.flatMap(({ category, topics }) =>
      topics.map(({ topic }) => [
        `${category.slug}:${topic.slug}`,
        {
          name: topic.name,
          categorySlug: category.slug,
          categoryName: category.name,
        },
      ] as const),
    ),
  )

  const browserCategories = sections.map(({ category, topics }) => ({
    slug: category.slug,
    name: category.name,
    topicCount: topics.length,
  }))

  const browserTopics = sections.flatMap(({ category, topics }) =>
    topics.map(({ topic, articleCount }) => ({
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      href: getRatgeberTopicPath(topic),
      categorySlug: category.slug,
      categoryName: category.name,
      articleCount,
    })),
  )

  const browserArticles = articles.map((article) => {
    const topic = topicLookup.get(`${article.categorySlug}:${article.topicSlug}`)

    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      href: getRatgeberArticlePath(article),
      categorySlug: article.categorySlug,
      categoryName: topic?.categoryName ?? article.categorySlug,
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
    name: "SEPANA Ratgeber",
    description:
      "Ratgeberbereich fuer Baufinanzierung und Privatkredit mit strukturierten Themenclustern und indexierbaren Artikeln.",
    url: absoluteUrl("/ratgeber"),
    about: ["Baufinanzierung", "Privatkredit"],
    publisher: buildOrganization(),
    hasPart: sections.flatMap(({ topics }) =>
      topics.map(({ topic }) => ({
        "@type": "CollectionPage",
        headline: topic.name,
        url: absoluteUrl(getRatgeberTopicPath(topic)),
      })),
    ),
  }

  const breadcrumbs = buildBreadcrumbList([
    { name: "Startseite", path: "/" },
    { name: "Ratgeber", path: "/ratgeber" },
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
          <span className="text-slate-900">Ratgeber</span>
        </div>
      </nav>

      <RatgeberHubBrowser categories={browserCategories} topics={browserTopics} articles={browserArticles} />
    </div>
  )
}
