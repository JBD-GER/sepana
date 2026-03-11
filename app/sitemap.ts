import type { MetadataRoute } from "next"
import {
  getRatgeberArticlePath,
  getRatgeberCategoryPath,
  getRatgeberTopicPath,
} from "@/lib/ratgeber/content"
import { getRatgeberArticles, getRatgeberCategories, getRatgeberTopics } from "@/lib/ratgeber/server"

const FALLBACK_SITE_URL = "https://www.sepana.de"
export const dynamic = "force-dynamic"
export const revalidate = 3600

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL
  return raw.replace(/\/+$/, "")
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const lastModified = new Date()

  const publicRoutes: Array<{
    path: string
    changeFrequency: "daily" | "weekly"
    priority: number
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/kreditanfrage", changeFrequency: "weekly", priority: 0.9 },
    { path: "/scheidung-kredit", changeFrequency: "weekly", priority: 0.8 },
    { path: "/baufinanzierung", changeFrequency: "weekly", priority: 0.9 },
    { path: "/baufinanzierung/anschlussfinanzierung", changeFrequency: "weekly", priority: 0.8 },
    { path: "/baufinanzierung/anfrage", changeFrequency: "weekly", priority: 0.8 },
    { path: "/privatkredit", changeFrequency: "weekly", priority: 0.9 },
    { path: "/privatkredit/anfrage", changeFrequency: "weekly", priority: 0.8 },
    { path: "/privatkredit/umschulden", changeFrequency: "weekly", priority: 0.8 },
    { path: "/privatkredit/kredit-pv-anlage", changeFrequency: "weekly", priority: 0.8 },
    { path: "/live-beratung", changeFrequency: "weekly", priority: 0.7 },
    { path: "/tippgeber-baufinanzierung", changeFrequency: "weekly", priority: 0.7 },
    { path: "/tippgeber-privatkredit", changeFrequency: "weekly", priority: 0.7 },
    { path: "/funnel-vorlage", changeFrequency: "weekly", priority: 0.6 },
    { path: "/bewertungen", changeFrequency: "weekly", priority: 0.7 },
    { path: "/ratgeber", changeFrequency: "weekly", priority: 0.85 },
    { path: "/agb", changeFrequency: "weekly", priority: 0.3 },
    { path: "/roadmap", changeFrequency: "weekly", priority: 0.4 },
    { path: "/status", changeFrequency: "weekly", priority: 0.4 },
  ]

  const [categories, topics, articles] = await Promise.all([
    getRatgeberCategories(),
    getRatgeberTopics(),
    getRatgeberArticles(),
  ])

  const ratgeberRoutes = [
    ...categories.map((category) => ({
      path: getRatgeberCategoryPath(category.slug),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...topics.map((topic) => ({
      path: getRatgeberTopicPath(topic),
      changeFrequency: "weekly" as const,
      priority: 0.78,
    })),
    ...articles.map((article) => ({
      path: getRatgeberArticlePath(article),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ]

  const uniqueRoutes = [...publicRoutes, ...ratgeberRoutes].filter(
    (route, index, allRoutes) => allRoutes.findIndex((item) => item.path === route.path) === index,
  )

  return uniqueRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
