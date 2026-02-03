import type { MetadataRoute } from "next"

const FALLBACK_SITE_URL = "https://www.sepana.de"

function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL
  return raw.replace(/\/+$/, "")
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/advisor",
          "/app",
          "/api",
          "/live",
          "/baufinanzierung/auswahl",
          "/einladung",
          "/login",
          "/registrieren",
          "/passwort-vergessen",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

