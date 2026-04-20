export type WebsiteHeaderPage = {
  href: string
  label: string
  description: string
  featured?: boolean
  ctaLabel?: string
  ctaTitle?: string
  ctaText?: string
}

export type WebsiteHeaderPageGroup = {
  id: "baufinanzierung" | "privatkredit" | "ratgeber" | "live"
  label: string
  items: WebsiteHeaderPage[]
}

export const WEBSITE_HEADER_PAGE_GROUPS: WebsiteHeaderPageGroup[] = [
  {
    id: "baufinanzierung",
    label: "Baufinanzierung",
    items: [
      {
        href: "/baufinanzierung",
        label: "Übersicht Baufinanzierung",
        description: "Kauf, Neubau und strukturierter Einstieg",
        ctaLabel: "Zur Baufinanzierung",
        ctaTitle: "Baufinanzierung direkt weiterdenken",
        ctaText:
          "Wenn das Thema fuer Ihr Vorhaben relevant ist, wechseln Sie direkt in unseren Bereich zur Baufinanzierung und ordnen Sie Ihre naechsten Schritte sauber ein.",
      },
      {
        href: "/baufinanzierung/anschlussfinanzierung",
        label: "Anschlussfinanzierung",
        description: "Forward-Darlehen und Restschuld strategisch planen",
        ctaLabel: "Zur Anschlussfinanzierung",
        ctaTitle: "Anschlussfinanzierung direkt vertiefen",
        ctaText:
          "Wenn Sie Ihre Restschuld und die naechste Zinsphase konkret einordnen wollen, wechseln Sie direkt in unseren Bereich zur Anschlussfinanzierung.",
      },
    ],
  },
  {
    id: "privatkredit",
    label: "Privatkredit",
    items: [
      {
        href: "/onlinekredit",
        label: "Onlinekredit",
        description: "15 Minuten · 100 % digitaler Einstieg in die Kreditstrecke",
        featured: true,
        ctaLabel: "Zum Onlinekredit",
        ctaTitle: "Onlinekredit direkt starten",
        ctaText:
          "Wenn Sie Ihren Kreditwunsch direkt digital anstossen wollen, wechseln Sie jetzt in unseren Onlinekredit-Ablauf.",
      },
      {
        href: "/kredit-ohne-schufa",
        label: "Kredit ohne Schufa",
        description: "Kredit trotz negativer Schufa, Online abschließbar.",
        ctaLabel: "Zum Kredit ohne Schufa",
        ctaTitle: "Kredit ohne Schufa direkt pruefen",
        ctaText:
          "Wenn fuer Sie ein Kredit ohne Schufa relevant ist, wechseln Sie direkt in unseren passenden Ablauf und pruefen Sie die Voraussetzungen strukturiert.",
      },
      {
        href: "/privatkredit/hochzeitskredit",
        label: "Hochzeitskredit",
        description: "Budgetrechner und Finanzierung für die Hochzeit",
        ctaLabel: "Zum Hochzeitskredit",
        ctaTitle: "Hochzeitsbudget direkt planen",
        ctaText:
          "Wenn Sie die Finanzierung Ihrer Hochzeit konkret planen wollen, wechseln Sie direkt in unseren Bereich fuer den Hochzeitskredit.",
      },
      {
        href: "/privatkredit/kredit-pv-anlage",
        label: "Kredit PV Anlage",
        description: "PV-Anlage 100 % finanzieren",
        ctaLabel: "Zur PV-Finanzierung",
        ctaTitle: "Photovoltaik direkt finanzieren",
        ctaText:
          "Wenn die Finanzierung Ihrer PV-Anlage der naechste Schritt ist, wechseln Sie direkt in unseren passenden Bereich fuer die PV-Finanzierung.",
      },
      {
        href: "/privatkredit/umschulden",
        label: "Umschulden",
        description: "Rate reduzieren und Kredite neu ordnen",
        ctaLabel: "Zur Umschuldung",
        ctaTitle: "Umschuldung direkt einordnen",
        ctaText:
          "Wenn Sie bestehende Raten neu ordnen oder senken wollen, wechseln Sie direkt in unseren Bereich fuer die Umschuldung.",
      },
    ],
  },
  {
    id: "ratgeber",
    label: "Ratgeber",
    items: [
      {
        href: "/ratgeber",
        label: "Ratgeber Übersicht",
        description: "Alle Themencluster für Baufinanzierung und Privatkredit",
        ctaLabel: "Zum Ratgeber",
        ctaTitle: "Weitere Themen direkt vertiefen",
        ctaText:
          "Wenn Sie sich erst breiter orientieren wollen, wechseln Sie direkt in die Ratgeber-Uebersicht.",
      },
      {
        href: "/ratgeber/baufinanzierung",
        label: "Ratgeber Baufinanzierung",
        description: "Hauskauf, Wohnungskauf, Anschlussfinanzierung und mehr",
        ctaLabel: "Zum Ratgeber Baufinanzierung",
        ctaTitle: "Mehr zur Baufinanzierung lesen",
        ctaText:
          "Wenn Sie weitere Inhalte zur Baufinanzierung lesen wollen, wechseln Sie direkt in den passenden Ratgeber-Bereich.",
      },
      {
        href: "/ratgeber/privatkredit",
        label: "Ratgeber Privatkredit",
        description: "Umschuldung, Bonität, Zinsen und Voraussetzungen",
        ctaLabel: "Zum Ratgeber Privatkredit",
        ctaTitle: "Mehr zum Privatkredit lesen",
        ctaText:
          "Wenn Sie weitere Inhalte zum Privatkredit lesen wollen, wechseln Sie direkt in den passenden Ratgeber-Bereich.",
      },
    ],
  },
  {
    id: "live",
    label: "Live-Beratung",
    items: [
      {
        href: "/live-beratung",
        label: "Live-Beratung",
        description: "Direkt mit einem Berater sprechen und Fragen live klären",
        ctaLabel: "Zur Live-Beratung",
        ctaTitle: "Direkt in die Live-Beratung",
        ctaText:
          "Wenn Sie das Thema lieber direkt mit einem Berater einordnen wollen, wechseln Sie jetzt in unsere Live-Beratung.",
      },
    ],
  },
]

export const BAUFINANZIERUNG_HEADER_PAGES = WEBSITE_HEADER_PAGE_GROUPS[0].items
export const PRIVATKREDIT_HEADER_PAGES = WEBSITE_HEADER_PAGE_GROUPS[1].items
export const RATGEBER_HEADER_PAGES = WEBSITE_HEADER_PAGE_GROUPS[2].items

export const WEBSITE_HEADER_PAGES = WEBSITE_HEADER_PAGE_GROUPS.flatMap((group) => group.items)

const WEBSITE_HEADER_PAGE_HREFS = new Set(WEBSITE_HEADER_PAGES.map((item) => item.href))

export function getWebsiteHeaderPageByHref(href: string | null | undefined) {
  if (!href) return null
  return WEBSITE_HEADER_PAGES.find((item) => item.href === href) ?? null
}

export function isWebsiteHeaderPageHref(value: string) {
  return WEBSITE_HEADER_PAGE_HREFS.has(value)
}

export function normalizeWebsiteHeaderPageHref(value: unknown) {
  const href = typeof value === "string" ? value.trim() : ""
  if (!href) return null
  return isWebsiteHeaderPageHref(href) ? href : null
}
