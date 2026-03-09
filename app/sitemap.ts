import type { MetadataRoute } from "next"

const FALLBACK_SITE_URL = "https://www.sepana.de"

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL
  return raw.replace(/\/+$/, "")
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const lastModified = new Date()

  const publicRoutes = [
    "/",
    "/kreditanfrage",
    "/scheidung-kredit",
    "/tippgeber-baufinanzierung",
    "/baufinanzierung",
    "/baufinanzierung/anschlussfinanzierung",
    "/baufinanzierung/anfrage",
    "/privatkredit",
    "/privatkredit/anfrage",
    "/privatkredit/umschulden",
    "/privatkredit/kredit-pv-anlage",
    "/bewertungen",
    "/agb",
    "/roadmap",
    "/status",
  ]

  return publicRoutes.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }))
}
