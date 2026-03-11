import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getRatgeberArticlePath, getRatgeberCategoryPath, getRatgeberTopicPath } from "@/lib/ratgeber/content"
import {
  getRatgeberArticleBySlug,
  getRatgeberArticlesByTopic,
  getRatgeberCategoryBySlug,
  getRatgeberTopicBySlug,
} from "@/lib/ratgeber/server"
import { absoluteUrl, buildBreadcrumbList, buildOrganization, jsonLd } from "@/lib/ratgeber/seo"
import { buildArticleCta, buildArticleFaq, getRatgeberImageSrc, slugify } from "@/lib/ratgeber/utils"

export const revalidate = 3600

const relatedDateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" })

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; topic: string; slug: string }>
}): Promise<Metadata> {
  const { category: categorySlug, topic: topicSlug, slug } = await params
  const article = await getRatgeberArticleBySlug(categorySlug, topicSlug, slug)
  const category = await getRatgeberCategoryBySlug(categorySlug)
  if (!article || !category) return {}

  const canonicalPath = getRatgeberArticlePath(article)
  const heroImageSrc = getRatgeberImageSrc(article.heroImagePath)

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    keywords: [article.focusKeyword, category.name, article.menuTitle, "SEPANA"],
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: article.seoTitle,
      description: article.seoDescription,
      url: canonicalPath,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      section: category.name,
      tags: [article.focusKeyword, category.name, article.menuTitle],
      images: heroImageSrc ? [{ url: heroImageSrc, alt: article.heroImageAlt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.seoDescription,
      images: heroImageSrc ? [heroImageSrc] : undefined,
    },
  }
}

export default async function RatgeberArticlePage({
  params,
}: {
  params: Promise<{ category: string; topic: string; slug: string }>
}) {
  const { category: categorySlug, topic: topicSlug, slug } = await params
  const [article, category, topic] = await Promise.all([
    getRatgeberArticleBySlug(categorySlug, topicSlug, slug),
    getRatgeberCategoryBySlug(categorySlug),
    getRatgeberTopicBySlug(categorySlug, topicSlug),
  ])
  if (!article || !category || !topic) notFound()

  const relatedArticles = (await getRatgeberArticlesByTopic(category.slug, topic.slug))
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3)
  const cta = buildArticleCta(article.title, category.slug)
  const heroImageSrc = getRatgeberImageSrc(article.heroImagePath)
  const faqItems = buildArticleFaq(article, category.name)
  const updatedLabel = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(article.updatedAt))
  const sectionAnchors = article.sections.map((section, index) => ({
    id: slugify(section.heading) || `abschnitt-${index + 1}`,
    label: section.heading,
  }))
  const ctaChecklist =
    category.slug === "baufinanzierung"
      ? [
          "Finanzierungsrahmen realistisch einordnen",
          "Monatsrate und Nebenkosten zusammen betrachten",
          "Unterlagen sauber für die Anfrage vorbereiten",
        ]
      : [
          "Kreditrate und Laufzeit sauber abstimmen",
          "Bonität und Unterlagen realistisch einschätzen",
          "Anfrage strukturiert und ohne Umwege starten",
        ]
  const inlineCtaText =
    category.slug === "baufinanzierung"
      ? "Wenn Sie das Thema für Ihr eigenes Vorhaben direkt einordnen wollen, wechseln Sie nach dem Lesen strukturiert in die passende Finanzierungsanfrage."
      : "Wenn Sie das Thema für Ihren Kreditwunsch direkt einordnen wollen, wechseln Sie nach dem Lesen strukturiert in die passende Kreditanfrage."

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.seoDescription,
    mainEntityOfPage: absoluteUrl(getRatgeberArticlePath(article)),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    articleSection: category.name,
    timeRequired: `PT${article.readingTimeMinutes}M`,
    keywords: [article.focusKeyword, article.menuTitle, category.name, topic.name].join(", "),
    author: buildOrganization(),
    publisher: buildOrganization(),
    about: [article.focusKeyword, category.name, topic.name, article.menuTitle],
    image: heroImageSrc
      ? [/^https?:\/\//i.test(heroImageSrc) ? heroImageSrc : absoluteUrl(heroImageSrc)]
      : undefined,
  }

  const breadcrumbs = buildBreadcrumbList([
    { name: "Startseite", path: "/" },
    { name: "Ratgeber", path: "/ratgeber" },
    { name: category.name, path: getRatgeberCategoryPath(category.slug) },
    { name: topic.name, path: getRatgeberTopicPath(topic) },
    { name: article.menuTitle, path: getRatgeberArticlePath(article) },
  ])

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }} />

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
          <Link href={getRatgeberTopicPath(topic)} className="transition hover:text-slate-900">
            {topic.name}
          </Link>
          <span>/</span>
          <span className="text-slate-900">{article.menuTitle}</span>
        </div>
      </nav>

      <section className="rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ratgeberbeitrag</div>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-[2.35rem] xl:text-[2.7rem]">
                {article.title}
              </h1>
              <p className="mt-4 max-w-3xl text-[1.05rem] leading-relaxed text-slate-700">{article.excerpt}</p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{category.name}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{topic.name}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  {article.readingTimeMinutes} Min. Lesezeit
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  Aktualisiert am {updatedLabel}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="max-w-2xl">
                  <div className="text-sm font-semibold text-slate-900">Sinnvoller nächster Schritt</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{inlineCtaText}</p>
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Link
                    href={`#${sectionAnchors[0]?.id ?? "faq"}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Direkt zum Inhalt
                  </Link>
                  <Link
                    href={cta.href}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {cta.buttonLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {heroImageSrc ? (
            <div className="w-full overflow-hidden rounded-[30px] border border-slate-200 bg-slate-100 shadow-sm xl:mx-0 xl:max-w-none">
              <div className="relative aspect-[5/4] w-full sm:aspect-[6/5] xl:aspect-[4/5]">
                <Image
                  src={heroImageSrc}
                  alt={article.heroImageAlt}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1279px) 100vw, 340px"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/35 to-transparent" />
                <div className="absolute bottom-4 left-4 inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                  {category.name} / {topic.name}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Das Wichtigste in Kürze
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Die zentralen Punkte auf einen Blick
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600">
              Die vier wichtigsten Aussagen aus dem Beitrag, komprimiert für einen schnellen Überblick.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {article.highlights.map((item, index) => (
              <article key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-900">
                  {index + 1}
                </div>
                <p className="mt-4 text-base leading-relaxed text-slate-700">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:hidden">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">In diesem Artikel</div>
        <div className="mt-3 grid gap-2">
          {sectionAnchors.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-white"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#faq"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-white"
          >
            Häufige Fragen
          </a>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">In diesem Artikel</div>
              <nav className="mt-4 grid gap-2">
                {sectionAnchors.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="rounded-2xl border border-transparent px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="#faq"
                  className="rounded-2xl border border-transparent px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  Häufige Fragen
                </a>
              </nav>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Weiterführend</div>
              <div className="mt-3 grid gap-2">
                <Link
                  href={getRatgeberTopicPath(topic)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-white"
                >
                  Zur Unterkategorie {topic.name}
                </Link>
                <Link
                  href={getRatgeberCategoryPath(category.slug)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-white"
                >
                  Mehr zu {category.name}
                </Link>
              </div>
            </section>
          </div>
        </aside>

        <article className="space-y-6">
          <header className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-900">
                  SR
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">SEPANA Redaktion</div>
                  <div className="text-sm text-slate-600">
                    {category.name} / {topic.name}
                  </div>
                </div>
              </div>
              <div className="text-sm text-slate-600">Aktualisiert am {updatedLabel}</div>
            </div>
          </header>

          <section className="rounded-[30px] border border-[#b9d7c5] bg-[linear-gradient(135deg,#effaf3_0%,#f7fbf8_55%,#edf7ff_100%)] p-6 shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Passend zu diesem Beitrag
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {category.slug === "baufinanzierung"
                    ? "Finanzierungsrahmen direkt für Ihr Vorhaben einschätzen"
                    : "Kreditoptionen direkt für Ihr Vorhaben einordnen"}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-700">{cta.text}</p>
              </div>
              <div className="flex flex-wrap gap-3 lg:flex-col lg:items-stretch">
                <Link
                  href={cta.href}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {cta.buttonLabel}
                </Link>
                <Link
                  href={getRatgeberTopicPath(topic)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Mehr zu {topic.name}
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {ctaChecklist.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          {article.sections.map((section, index) => {
            const anchor = sectionAnchors[index]
            return (
              <section
                key={section.heading}
                id={anchor?.id}
                className="scroll-mt-28 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
              >
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{section.heading}</h2>
                <div className="mt-5 space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-lg leading-relaxed text-slate-700">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets?.length ? (
                  <ul className="mt-6 space-y-3">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-3 text-lg leading-relaxed text-slate-700">
                        <span className="mt-[10px] h-2.5 w-2.5 rounded-full bg-slate-900" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })}

          <section id="faq" className="scroll-mt-28 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Häufige Fragen zu {article.menuTitle}
            </h2>
            <div className="mt-6 space-y-3">
              {faqItems.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left marker:hidden">
                    <span className="text-lg font-semibold text-slate-900">{item.question}</span>
                    <span className="mt-1 text-xl leading-none text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 pr-8 text-base leading-relaxed text-slate-700">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-900 bg-slate-900 p-6 text-white shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Nächster Schritt
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{cta.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-300">{cta.text}</p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href={cta.href}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  {cta.buttonLabel}
                </Link>
                <Link
                  href={getRatgeberTopicPath(topic)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Mehr zu {topic.name}
                </Link>
              </div>
            </div>
          </section>

          {relatedArticles.length ? (
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Weitere Beiträge in {topic.name}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Weitere passende Artikel aus dieser Unterkategorie.
              </div>
              <div className="mt-5 -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
                {relatedArticles.map((item) => (
                  <Link
                    key={item.slug}
                    href={getRatgeberArticlePath(item)}
                    className="min-w-[280px] max-w-[320px] snap-start rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <span>{category.name}</span>
                      <span>/</span>
                      <span>{topic.name}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold leading-snug text-slate-900">{item.title}</h3>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Veröffentlicht am {relatedDateFormatter.format(new Date(item.publishedAt))}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        {item.readingTimeMinutes} Min. Lesezeit
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </div>
  )
}
