const FALLBACK_SITE_URL = "https://www.sepana.de"

export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL
  return raw.replace(/\/+$/, "")
}

export function absoluteUrl(path: string) {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

export function jsonLd<T>(data: T) {
  return JSON.stringify(data)
}

export function buildBreadcrumbList(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function buildOrganization() {
  return {
    "@type": "Organization",
    name: "SEPANA",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/og.png"),
  }
}
