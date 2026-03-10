import type { RatgeberArticle, RatgeberArticleSection, RatgeberFaqItem } from "./content"

export const RATGEBER_STORAGE_BUCKET = "website_media"

export type GeneratedRatgeberArticle = {
  excerpt: string
  seoTitle: string
  seoDescription: string
  readingTimeMinutes: number
  highlights: string[]
  sections: RatgeberArticleSection[]
  faq: RatgeberFaqItem[]
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

export function trimToNull(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildArticleOutline(article: Pick<RatgeberArticle, "outline" | "sections">) {
  return article.outline.length ? article.outline : article.sections.map((section) => section.heading)
}

export function buildArticleFaq(
  article: Pick<
    RatgeberArticle,
    "faq" | "focusKeyword" | "menuTitle" | "excerpt" | "highlights" | "sections" | "title"
  >,
  categoryName?: string,
) {
  if (article.faq.length >= 3) {
    return article.faq
  }

  const sectionHeading = article.sections[0]?.heading ?? article.menuTitle
  const secondHeading = article.sections[1]?.heading ?? article.focusKeyword
  const highlightText =
    article.highlights.slice(0, 2).join(", ") ||
    "die passende Monatsrate, vollständige Unterlagen und eine realistische Planung"
  const topic = article.menuTitle || article.focusKeyword || article.title
  const category = categoryName ? ` im Bereich ${categoryName}` : ""

  return [
    {
      question: `Was ist bei ${topic} besonders wichtig?`,
      answer: `${article.excerpt} Besonders wichtig sind eine realistische Einordnung des Vorhabens, passende monatliche Spielraeume und ein sauber vorbereiteter Vergleich der Optionen.`,
    },
    {
      question: `Fuer wen ist ${topic}${category} relevant?`,
      answer: `${topic} ist vor allem fuer Menschen relevant, die ihr Vorhaben strukturiert vorbereiten und typische Fehler vor einer Anfrage vermeiden wollen. Der Ratgeber hilft dabei, ${sectionHeading.toLowerCase()} und die naechsten Schritte besser einzuordnen.`,
    },
    {
      question: `Worauf sollte man bei ${topic} konkret achten?`,
      answer: `Im Kern geht es um ${highlightText}. Zudem sollte immer geprueft werden, wie ${secondHeading.toLowerCase()} mit Budget, Unterlagen und langfristiger Tragfaehigkeit zusammenhaengt.`,
    },
    {
      question: `Wie geht es nach dem Ratgeber zu ${topic} weiter?`,
      answer: `Nach dem fachlichen Ueberblick sollte das eigene Vorhaben mit den wichtigsten Eckdaten vorbereitet werden. So laesst sich schneller bewerten, welche Loesung realistisch ist und welche Anfrage sinnvoll zum Thema ${topic} passt.`,
    },
  ]
}

export function getRatgeberImageSrc(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  if (clean.startsWith("/") || /^https?:\/\//i.test(clean) || clean.startsWith("data:")) return clean
  return `/api/baufi/logo?bucket=${encodeURIComponent(RATGEBER_STORAGE_BUCKET)}&path=${encodeURIComponent(clean)}`
}

export function buildArticleCta(articleTitle: string, categorySlug: string) {
  if (categorySlug === "baufinanzierung") {
    return {
      buttonLabel: "Baufinanzierung starten",
      text: "Wenn das Thema fuer Ihr Vorhaben relevant ist, starten Sie direkt die Kreditanfrage und lassen Sie die Eckdaten sauber einordnen.",
      href: "/kreditanfrage",
      title: articleTitle,
    }
  }

  return {
    buttonLabel: "Privatkredit starten",
    text: "Wenn Sie das Thema jetzt konkret fuer Ihren Kreditwunsch pruefen wollen, starten Sie direkt die SEPANA Kreditanfrage.",
    href: "/kreditanfrage",
    title: articleTitle,
  }
}
