export type RatgeberCategorySlug = "baufinanzierung" | "privatkredit"

export type RatgeberArticleSection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export type RatgeberFaqItem = {
  question: string
  answer: string
}

export type RatgeberCategory = {
  slug: RatgeberCategorySlug
  name: string
  description: string
  seoTitle: string
  seoDescription: string
  heroTitle: string
  heroText: string
  ctaHref: string
  ctaLabel: string
  sortOrder: number
}

export type RatgeberTopic = {
  categorySlug: RatgeberCategorySlug
  slug: string
  name: string
  description: string
  heroTitle: string
  heroText: string
  seoTitle: string
  seoDescription: string
  sortOrder: number
  heroImagePath: string | null
  heroImageAlt: string
}

export type RatgeberArticle = {
  categorySlug: RatgeberCategorySlug
  topicSlug: string
  slug: string
  menuTitle: string
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  focusKeyword: string
  readingTimeMinutes: number
  publishedAt: string
  updatedAt: string
  sortOrder: number
  highlights: string[]
  outline: string[]
  heroImagePath: string | null
  heroImageAlt: string
  faq: RatgeberFaqItem[]
  sections: RatgeberArticleSection[]
}

export const RATGEBER_CATEGORIES: RatgeberCategory[] = [
  {
    slug: "baufinanzierung",
    name: "Baufinanzierung",
    description:
      "Ratgeber zur Baufinanzierung mit Fokus auf Hauskauf, Wohnungskauf, Anschlussfinanzierung, Eigenkapital und Nebenkosten.",
    seoTitle: "Ratgeber Baufinanzierung | Hauskauf, Wohnungskauf, Anschlussfinanzierung | SEPANA",
    seoDescription:
      "Der SEPANA Ratgeber zur Baufinanzierung erklaert Hauskauf, Wohnungskauf, Anschlussfinanzierung, Eigenkapital und Nebenkosten strukturiert und verstaendlich.",
    heroTitle: "Baufinanzierung verstehen und sauber vorbereiten.",
    heroText:
      "Wer eine Immobilie finanzieren will, braucht nicht nur einen Zinssatz, sondern Klarheit zu Budget, Eigenkapital, Nebenkosten und Timing. Genau dafuer ist dieser Bereich aufgebaut.",
    ctaHref: "/baufinanzierung",
    ctaLabel: "Zur Baufinanzierung",
    sortOrder: 1,
  },
  {
    slug: "privatkredit",
    name: "Privatkredit",
    description:
      "Ratgeber zum Privatkredit mit Fokus auf Umschuldung, Bonitaet, Zinsen, Voraussetzungen und sinnvolle Verwendungszwecke.",
    seoTitle: "Ratgeber Privatkredit | Umschuldung, Bonitaet, Zinsen & Voraussetzungen | SEPANA",
    seoDescription:
      "Der SEPANA Ratgeber zum Privatkredit erklaert Umschuldung, Bonitaet, Zinsen, Voraussetzungen und Verwendungszwecke klar und suchmaschinenstark.",
    heroTitle: "Privatkredit klar einordnen, bevor du anfragst.",
    heroText:
      "Beim Privatkredit entscheiden Bonitaet, Verwendungszweck, Rate und Unterlagen ueber die Qualitaet des Ergebnisses. Die wichtigsten Grundlagen findest du hier an einem Ort.",
    ctaHref: "/privatkredit",
    ctaLabel: "Zum Privatkredit",
    sortOrder: 2,
  },
]

export const RATGEBER_TOPICS: RatgeberTopic[] = [
  {
    categorySlug: "baufinanzierung",
    slug: "hauskauf",
    name: "Hauskauf",
    description: "Alles rund um Finanzierung, Budget, Rate und Planung beim Hauskauf.",
    heroTitle: "Hauskauf sauber vorbereiten und Finanzierung realistisch planen.",
    heroText:
      "Diese Unterkategorie sammelt kuenftig alle Beitraege rund um Budget, Kaufpreis, Monatsrate und die typischen Entscheidungen vor dem Hauskauf.",
    seoTitle: "Hauskauf Ratgeber | Beitraege zu Finanzierung, Budget und Planung | SEPANA",
    seoDescription:
      "Unterkategorie Hauskauf im SEPANA Ratgeber mit eigenen Beitraegen zu Finanzierung, Budget, Unterlagen und typischen Fehlern.",
    sortOrder: 1,
    heroImagePath: "/familie_haus.jpg",
    heroImageAlt: "Hauskauf im SEPANA Ratgeber",
  },
  {
    categorySlug: "baufinanzierung",
    slug: "wohnungskauf",
    name: "Wohnungskauf",
    description: "Beitraege zu Eigentumswohnung, Hausgeld, Ruecklagen und Finanzierung.",
    heroTitle: "Wohnungskauf besser einordnen und typische Sonderthemen verstehen.",
    heroText:
      "Hier liegen kuenftig alle Beitraege rund um Eigentumswohnungen, Hausgeld, Gemeinschaftseigentum und die richtige Finanzierungsstruktur.",
    seoTitle: "Wohnungskauf Ratgeber | Beitraege zu Finanzierung und Hausgeld | SEPANA",
    seoDescription:
      "Unterkategorie Wohnungskauf im SEPANA Ratgeber mit eigenen Beitraegen zu Finanzierung, Hausgeld, Ruecklagen und Objektpruefung.",
    sortOrder: 2,
    heroImagePath: "/familie_kueche.jpg",
    heroImageAlt: "Wohnungskauf im SEPANA Ratgeber",
  },
  {
    categorySlug: "baufinanzierung",
    slug: "anschlussfinanzierung",
    name: "Anschlussfinanzierung",
    description: "Beitraege zu Restschuld, Timing, Forward-Darlehen und Zinsbindung.",
    heroTitle: "Anschlussfinanzierung frueh planen und Optionen sauber vergleichen.",
    heroText:
      "In dieser Unterkategorie entstehen kuenftig Beitraege zu Restschuld, Sollzinsbindung, Forward-Darlehen und dem richtigen Zeitpunkt fuer die Folgefinanzierung.",
    seoTitle: "Anschlussfinanzierung Ratgeber | Beitraege zu Restschuld und Timing | SEPANA",
    seoDescription:
      "Unterkategorie Anschlussfinanzierung im SEPANA Ratgeber mit eigenen Beitraegen zu Restschuld, Forward-Darlehen und Zinsstrategie.",
    sortOrder: 3,
    heroImagePath: "/familie_kueche.jpg",
    heroImageAlt: "Anschlussfinanzierung im SEPANA Ratgeber",
  },
  {
    categorySlug: "baufinanzierung",
    slug: "eigenkapital",
    name: "Eigenkapital",
    description: "Beitraege zu Eigenmitteln, Reserve, Quote und Finanzierungsstruktur.",
    heroTitle: "Eigenkapital richtig einordnen statt Reserven falsch zu verbrauchen.",
    heroText:
      "Hier kommen kuenftig alle Beitraege rund um Eigenmittel, Reserveplanung, Kaufnebenkosten und die richtige Balance in der Baufinanzierung zusammen.",
    seoTitle: "Eigenkapital Ratgeber | Beitraege zu Reserve und Baufinanzierung | SEPANA",
    seoDescription:
      "Unterkategorie Eigenkapital im SEPANA Ratgeber mit eigenen Beitraegen zu Reserve, Nebenkosten und Finanzierungsspielraum.",
    sortOrder: 4,
    heroImagePath: "/familie_umzug.jpg",
    heroImageAlt: "Eigenkapital im SEPANA Ratgeber",
  },
  {
    categorySlug: "baufinanzierung",
    slug: "nebenkosten",
    name: "Nebenkosten",
    description: "Beitraege zu Notar, Grundbuch, Grunderwerbsteuer und Startkosten.",
    heroTitle: "Nebenkosten transparent machen, bevor das Budget kippt.",
    heroText:
      "Diese Unterkategorie buendelt kuenftig alle Beitraege zu Kaufnebenkosten, Finanzierungsquote und den Kosten, die neben dem eigentlichen Kaufpreis anfallen.",
    seoTitle: "Nebenkosten Ratgeber | Beitraege zu Immobilienkauf und Budget | SEPANA",
    seoDescription:
      "Unterkategorie Nebenkosten im SEPANA Ratgeber mit eigenen Beitraegen zu Grunderwerbsteuer, Notar, Makler und Liquiditaetsplanung.",
    sortOrder: 5,
    heroImagePath: "/familie_haus.jpg",
    heroImageAlt: "Nebenkosten im SEPANA Ratgeber",
  },
  {
    categorySlug: "privatkredit",
    slug: "umschuldung",
    name: "Umschuldung",
    description: "Beitraege zu Kreditbuendelung, Ablosung und neuer Ratenstruktur.",
    heroTitle: "Umschuldung strukturiert pruefen und Kreditlast neu ordnen.",
    heroText:
      "In dieser Unterkategorie entstehen kuenftig Beitraege zu Umschuldung, Kreditbuendelung, Restschuld und sinnvoller monatlicher Entlastung.",
    seoTitle: "Umschuldung Ratgeber | Beitraege zu Kreditwechsel und Rate | SEPANA",
    seoDescription:
      "Unterkategorie Umschuldung im SEPANA Ratgeber mit eigenen Beitraegen zu Kreditbuendelung, Restschuld und neuer Rate.",
    sortOrder: 1,
    heroImagePath: "/happy_family.jpg",
    heroImageAlt: "Umschuldung im SEPANA Ratgeber",
  },
  {
    categorySlug: "privatkredit",
    slug: "bonitaet",
    name: "Bonitaet",
    description: "Beitraege zu Einkommen, Haushaltslage, SCHUFA und Kreditpruefung.",
    heroTitle: "Bonitaet besser verstehen und die Anfrage sauber vorbereiten.",
    heroText:
      "Hier sammeln sich kuenftig Beitraege zu SCHUFA, Haushaltsrechnung, Einkommen, laufenden Verpflichtungen und der Qualitaet einer Kreditanfrage.",
    seoTitle: "Bonitaet Ratgeber | Beitraege zu Kreditpruefung und SCHUFA | SEPANA",
    seoDescription:
      "Unterkategorie Bonitaet im SEPANA Ratgeber mit eigenen Beitraegen zu Einkommen, SCHUFA und besser vorbereiteten Kreditanfragen.",
    sortOrder: 2,
    heroImagePath: "/familie_umzug.jpg",
    heroImageAlt: "Bonitaet im SEPANA Ratgeber",
  },
  {
    categorySlug: "privatkredit",
    slug: "zinsen",
    name: "Zinsen",
    description: "Beitraege zu Effektivzins, Laufzeit, Rate und Gesamtkosten.",
    heroTitle: "Zinsen richtig lesen und Angebote sinnvoll vergleichen.",
    heroText:
      "Diese Unterkategorie deckt kuenftig Beitraege zu Sollzins, Effektivzins, Laufzeit, Kreditbetrag und realer Monatsbelastung ab.",
    seoTitle: "Zinsen Ratgeber | Beitraege zu Effektivzins und Kreditrate | SEPANA",
    seoDescription:
      "Unterkategorie Zinsen im SEPANA Ratgeber mit eigenen Beitraegen zu Effektivzins, Rate, Laufzeit und Gesamtkosten.",
    sortOrder: 3,
    heroImagePath: "/happy_family.jpg",
    heroImageAlt: "Zinsen im SEPANA Ratgeber",
  },
  {
    categorySlug: "privatkredit",
    slug: "voraussetzungen",
    name: "Voraussetzungen",
    description: "Beitraege zu Unterlagen, Einkommen, Tragfaehigkeit und Identitaet.",
    heroTitle: "Voraussetzungen fuer den Privatkredit klar und realistisch einordnen.",
    heroText:
      "Hier erscheinen kuenftig Beitraege zu Einkommensnachweisen, Haushaltsrechnung, Unterlagen und den typischen Anforderungen fuer einen Privatkredit.",
    seoTitle: "Voraussetzungen Ratgeber | Beitraege zu Privatkredit und Unterlagen | SEPANA",
    seoDescription:
      "Unterkategorie Voraussetzungen im SEPANA Ratgeber mit eigenen Beitraegen zu Einkommen, Unterlagen und Kreditpruefung.",
    sortOrder: 4,
    heroImagePath: "/familie_umzug.jpg",
    heroImageAlt: "Voraussetzungen im SEPANA Ratgeber",
  },
  {
    categorySlug: "privatkredit",
    slug: "verwendungszwecke",
    name: "Verwendungszwecke",
    description: "Beitraege zu freier Verwendung, Anschaffungen, Renovierung und Ordnung im Haushalt.",
    heroTitle: "Verwendungszwecke richtig einordnen und Kredite sinnvoll einsetzen.",
    heroText:
      "In dieser Unterkategorie landen kuenftig Beitraege zu sinnvoller Kreditnutzung, freier Verwendung, groesseren Anschaffungen und sauberer Haushaltsplanung.",
    seoTitle: "Verwendungszwecke Ratgeber | Beitraege zu sinnvoller Kreditnutzung | SEPANA",
    seoDescription:
      "Unterkategorie Verwendungszwecke im SEPANA Ratgeber mit eigenen Beitraegen zu Anschaffungen, Umschuldung und freier Verwendung.",
    sortOrder: 5,
    heroImagePath: "/happy_family.jpg",
    heroImageAlt: "Verwendungszwecke im SEPANA Ratgeber",
  },
]

export const RATGEBER_ARTICLES: RatgeberArticle[] = []

export function getRatgeberCategoryPath(slug: RatgeberCategorySlug) {
  return `/ratgeber/${slug}`
}

export function getRatgeberTopicPath(topic: Pick<RatgeberTopic, "categorySlug" | "slug">) {
  return `/ratgeber/${topic.categorySlug}/${topic.slug}`
}

export function getRatgeberArticlePath(
  article: Pick<RatgeberArticle, "categorySlug" | "topicSlug" | "slug">,
) {
  return `/ratgeber/${article.categorySlug}/${article.topicSlug}/${article.slug}`
}

export function getStaticRatgeberCategories() {
  return [...RATGEBER_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getStaticRatgeberTopics() {
  return [...RATGEBER_TOPICS].sort((a, b) => {
    if (a.categorySlug !== b.categorySlug) return a.categorySlug.localeCompare(b.categorySlug, "de")
    return a.sortOrder - b.sortOrder
  })
}

export function getStaticRatgeberTopicsByCategory(categorySlug: string) {
  return getStaticRatgeberTopics().filter((item) => item.categorySlug === categorySlug)
}

export function getStaticRatgeberTopic(categorySlug: string, slug: string) {
  return getStaticRatgeberTopics().find((item) => item.categorySlug === categorySlug && item.slug === slug) ?? null
}

export function getStaticRatgeberCategory(slug: string) {
  return RATGEBER_CATEGORIES.find((item) => item.slug === slug) ?? null
}

export function getStaticRatgeberArticles() {
  return [...RATGEBER_ARTICLES]
}

export function getStaticRatgeberArticlesByCategory(categorySlug: string) {
  return getStaticRatgeberArticles().filter((item) => item.categorySlug === categorySlug)
}

export function getStaticRatgeberArticlesByTopic(categorySlug: string, topicSlug: string) {
  return getStaticRatgeberArticles().filter(
    (item) => item.categorySlug === categorySlug && item.topicSlug === topicSlug,
  )
}

export function getStaticRatgeberArticle(categorySlug: string, topicSlug: string, slug: string) {
  return (
    getStaticRatgeberArticles().find(
      (item) => item.categorySlug === categorySlug && item.topicSlug === topicSlug && item.slug === slug,
    ) ?? null
  )
}
