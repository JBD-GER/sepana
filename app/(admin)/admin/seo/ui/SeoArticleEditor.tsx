"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { RatgeberArticleSection, RatgeberFaqItem } from "@/lib/ratgeber/content"
import type {
  AdminRatgeberArticle,
  AdminRatgeberCategory,
  AdminRatgeberTopic,
} from "@/lib/ratgeber/adminServer"
import { type GeneratedRatgeberArticle, getRatgeberImageSrc, parseLines, slugify } from "@/lib/ratgeber/utils"

type SeoArticleEditorProps = {
  dbReady: boolean
  categories: AdminRatgeberCategory[]
  topics: AdminRatgeberTopic[]
  articles: AdminRatgeberArticle[]
}

type DraftState = {
  id: string | null
  categorySlug: string
  topicSlug: string
  title: string
  menuTitle: string
  slug: string
  focusKeyword: string
  supportingKeywordsText: string
  outlineText: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  readingTimeMinutes: number
  sortOrder: number
  isPublished: boolean
  heroImagePath: string | null
  heroImageAlt: string
  highlights: string[]
  faq: RatgeberFaqItem[]
  sections: RatgeberArticleSection[]
}

const MAX_HERO_IMAGE_SIZE_BYTES = 30 * 1024 * 1024

function buildDraft(topics: AdminRatgeberTopic[], article?: AdminRatgeberArticle): DraftState {
  if (!article) {
    return {
      id: null,
      categorySlug: topics[0]?.categorySlug ?? "baufinanzierung",
      topicSlug: topics[0]?.slug ?? "",
      title: "",
      menuTitle: "",
      slug: "",
      focusKeyword: "",
      supportingKeywordsText: "",
      outlineText: "",
      excerpt: "",
      seoTitle: "",
      seoDescription: "",
      readingTimeMinutes: 6,
      sortOrder: 1,
      isPublished: true,
      heroImagePath: null,
      heroImageAlt: "",
      highlights: [],
      faq: [],
      sections: [],
    }
  }

  const topicFromCategory = topics.find(
    (item) => item.categorySlug === article.categorySlug && item.slug === article.topicSlug,
  )
  const topicBySlug = topics.find((item) => item.slug === article.topicSlug)
  const fallbackCategorySlug = topics[0]?.categorySlug ?? "baufinanzierung"
  const resolvedCategorySlug =
    (article.categorySlug && topics.some((item) => item.categorySlug === article.categorySlug)
      ? article.categorySlug
      : topicBySlug?.categorySlug) ?? fallbackCategorySlug
  const topicsForCategory = topics.filter((item) => item.categorySlug === resolvedCategorySlug)
  const resolvedTopicSlug =
    topicFromCategory?.slug ??
    topicsForCategory.find((item) => item.slug === article.topicSlug)?.slug ??
    topicsForCategory[0]?.slug ??
    ""

  return {
    id: article.id,
    categorySlug: resolvedCategorySlug,
    topicSlug: resolvedTopicSlug,
    title: article.title,
    menuTitle: article.menuTitle,
    slug: article.slug,
    focusKeyword: article.focusKeyword,
    supportingKeywordsText: "",
    outlineText: article.outline.join("\n"),
    excerpt: article.excerpt,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    readingTimeMinutes: article.readingTimeMinutes,
    sortOrder: article.sortOrder,
    isPublished: article.isPublished,
    heroImagePath: article.heroImagePath,
    heroImageAlt: article.heroImageAlt,
    highlights: article.highlights,
    faq: article.faq,
    sections: article.sections,
  }
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function resolveDraftSelection(
  categories: AdminRatgeberCategory[],
  topics: AdminRatgeberTopic[],
  draft: Pick<DraftState, "categorySlug" | "topicSlug">,
) {
  const fallbackCategorySlug = topics[0]?.categorySlug ?? categories[0]?.slug ?? "baufinanzierung"
  const inferredCategorySlug = topics.find((item) => item.slug === draft.topicSlug)?.categorySlug ?? ""
  const categorySlug =
    (draft.categorySlug && categories.some((item) => item.slug === draft.categorySlug)
      ? draft.categorySlug
      : inferredCategorySlug) || fallbackCategorySlug
  const availableTopics = topics.filter((item) => item.categorySlug === categorySlug)
  const topicSlug =
    (draft.topicSlug && availableTopics.some((item) => item.slug === draft.topicSlug) ? draft.topicSlug : "") ||
    availableTopics[0]?.slug ||
    ""

  return { categorySlug, topicSlug, availableTopics }
}

export default function SeoArticleEditor({ dbReady, categories, topics, articles }: SeoArticleEditorProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(articles[0]?.id ?? null)
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(topics, articles[0]))
  const [message, setMessage] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)

  const inputBase =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"

  const resolvedSelection = useMemo(
    () => resolveDraftSelection(categories, topics, draft),
    [categories, topics, draft],
  )
  const availableTopics = resolvedSelection.availableTopics
  const selectedCategorySlug = resolvedSelection.categorySlug
  const selectedTopicSlug = resolvedSelection.topicSlug
  const selectedCategoryName =
    categories.find((item) => item.slug === selectedCategorySlug)?.name ?? selectedCategorySlug
  const selectedTopicName = availableTopics.find((item) => item.slug === selectedTopicSlug)?.name ?? selectedTopicSlug
  const heroImageSrc = getRatgeberImageSrc(draft.heroImagePath)

  useEffect(() => {
    if (draft.categorySlug === selectedCategorySlug && draft.topicSlug === selectedTopicSlug) return
    setDraft((current) => ({
      ...current,
      categorySlug: selectedCategorySlug,
      topicSlug: selectedTopicSlug,
    }))
  }, [draft.categorySlug, draft.topicSlug, selectedCategorySlug, selectedTopicSlug])

  function chooseArticle(articleId: string | null) {
    setMessage(null)
    setUploadMessage(null)
    setSelectedArticleId(articleId)
    if (!articleId) {
      setDraft(buildDraft(topics))
      return
    }

    const article = articles.find((item) => item.id === articleId)
    setDraft(buildDraft(topics, article))
  }

  function updateTitle(nextTitle: string) {
    setDraft((current) => ({
      ...current,
      title: nextTitle,
      menuTitle: current.menuTitle || nextTitle,
      slug: current.slug || slugify(nextTitle),
      heroImageAlt: current.heroImageAlt || nextTitle,
    }))
  }

  function handleCategoryChange(nextCategorySlug: string) {
    const nextTopics = topics.filter((item) => item.categorySlug === nextCategorySlug)
    setDraft((current) => ({
      ...current,
      categorySlug: nextCategorySlug,
      topicSlug: nextTopics.find((item) => item.slug === current.topicSlug)?.slug ?? nextTopics[0]?.slug ?? "",
    }))
  }

  async function handleGenerate() {
    setMessage(null)
    const outline = parseLines(draft.outlineText)
    if (!draft.title.trim() || !draft.focusKeyword.trim() || outline.length === 0 || !selectedTopicSlug) {
      setMessage("Titel, Unterkategorie, Fokus-Keyword und Outline sind erforderlich.")
      return
    }

    setGenerateLoading(true)
    try {
      const res = await fetch("/api/admin/seo/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categorySlug: selectedCategorySlug,
          topicSlug: selectedTopicSlug,
          categoryName: selectedCategoryName,
          topicName: selectedTopicName,
          title: draft.title,
          focusKeyword: draft.focusKeyword,
          outline,
          supportingKeywords: parseLines(draft.supportingKeywordsText),
        }),
      })

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        missingFields?: string[]
        generated?: GeneratedRatgeberArticle
      }
      if (!res.ok || !json.ok || !json.generated) {
        const detail =
          Array.isArray(json.missingFields) && json.missingFields.length > 0
            ? ` Fehlende Felder: ${json.missingFields.join(", ")}.`
            : ""
        throw new Error((json.error || "Generierung fehlgeschlagen.") + detail)
      }

      setDraft((current) => ({
        ...current,
        excerpt: json.generated?.excerpt ?? current.excerpt,
        seoTitle: json.generated?.seoTitle ?? current.seoTitle,
        seoDescription: json.generated?.seoDescription ?? current.seoDescription,
        readingTimeMinutes: json.generated?.readingTimeMinutes ?? current.readingTimeMinutes,
        highlights: json.generated?.highlights ?? current.highlights,
        sections: json.generated?.sections ?? current.sections,
        faq: json.generated?.faq ?? current.faq,
      }))
      setMessage("SEO-Text erfolgreich generiert.")
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Generierung fehlgeschlagen.")
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleSave() {
    if (!dbReady) {
      setMessage("Bitte zuerst die SQL-Migration fuer den Ratgeber ausfuehren.")
      return
    }

    setSaveLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/seo/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          categorySlug: selectedCategorySlug,
          topicSlug: selectedTopicSlug,
          title: draft.title,
          menuTitle: draft.menuTitle || draft.title,
          slug: draft.slug || slugify(draft.title),
          focusKeyword: draft.focusKeyword,
          excerpt: draft.excerpt,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          readingTimeMinutes: draft.readingTimeMinutes,
          sortOrder: draft.sortOrder,
          isPublished: draft.isPublished,
          heroImagePath: draft.heroImagePath,
          heroImageAlt: draft.heroImageAlt || draft.title,
          outline: parseLines(draft.outlineText),
          highlights: draft.highlights,
          faq: draft.faq,
          sections: draft.sections,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string | null }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Speichern fehlgeschlagen.")
      }

      setSelectedArticleId(json.id ?? selectedArticleId)
      setMessage("Beitrag gespeichert.")
      startTransition(() => router.refresh())
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.")
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_HERO_IMAGE_SIZE_BYTES) {
      setUploadMessage("Das Bild ist zu gross. Bitte eine Datei unter 30 MB hochladen.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadLoading(true)
    setUploadMessage(null)
    try {
      const form = new FormData()
      form.append("file", file)

      const slug = draft.slug || slugify(draft.title || "ratgeber")
      const res = await fetch(`/api/admin/seo/upload-image?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        body: form,
      })

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        path?: string
      }
      if (!res.ok || !json.ok || !json.path) {
        throw new Error(json.error || "Upload fehlgeschlagen.")
      }

      setDraft((current) => ({
        ...current,
        heroImagePath: json.path || current.heroImagePath,
        heroImageAlt: current.heroImageAlt || current.title,
      }))
      setUploadMessage("Bild hochgeladen.")
    } catch (error: unknown) {
      setUploadMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen.")
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">SEO Bereich</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Blog & Ratgeber</div>
            </div>
            <button
              type="button"
              onClick={() => chooseArticle(null)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Neu
            </button>
          </div>

          {!dbReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Die neuen Ratgeber-Tabellen sind noch nicht in Supabase vorhanden. Fuehre zuerst die SQL-Migration aus,
              dann kannst du hier Beitraege speichern und Bilder hochladen.
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Bestehende Beitraege</div>
          <div className="mt-4 space-y-3">
            {articles.map((article) => {
              const active = article.id === selectedArticleId
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => chooseArticle(article.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                    {article.categorySlug} / {article.topicSlug}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{article.title}</div>
                  <div className="mt-1 text-xs opacity-75">Aktualisiert: {formatUpdatedAt(article.updatedAt)}</div>
                </button>
              )
            })}

            {articles.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Noch keine DB-Beitraege vorhanden.
              </div>
            ) : null}
          </div>
        </section>
      </aside>

      <section className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Editor</div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Blogbeitrag fuer Unterkategorie</h1>
              <p className="mt-1 text-sm text-slate-600">
                Jeder Beitrag haengt jetzt an einer Unterkategorie und erscheint nur auf deren eigener Hub-Seite.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateLoading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60"
              >
                {generateLoading ? "Generiert..." : "KI-Text generieren"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading || isPending}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saveLoading || isPending ? "Speichert..." : "Beitrag speichern"}
              </button>
            </div>
          </div>

          {message ? <div className="mt-4 text-sm text-slate-600">{message}</div> : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Kategorie</label>
                  <select
                    value={selectedCategorySlug}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                    className={inputBase}
                  >
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Unterkategorie</label>
                  <select
                    value={selectedTopicSlug}
                    onChange={(event) => setDraft((current) => ({ ...current, topicSlug: event.target.value }))}
                    className={inputBase}
                  >
                    {availableTopics.map((topic) => (
                      <option key={topic.slug} value={topic.slug}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Fokus-Keyword</label>
                  <input
                    value={draft.focusKeyword}
                    onChange={(event) => setDraft((current) => ({ ...current, focusKeyword: event.target.value }))}
                    className={inputBase}
                    placeholder="z. B. Anschlussfinanzierung Tipps"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Slug</label>
                  <input
                    value={draft.slug}
                    onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))}
                    className={inputBase}
                    placeholder="blogbeitrag-slug"
                  />
                </div>

                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">Titel</label>
                  <input
                    value={draft.title}
                    onChange={(event) => updateTitle(event.target.value)}
                    className={inputBase}
                    placeholder="Artikel-Titel"
                  />
                </div>

                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">Menue-Titel</label>
                  <input
                    value={draft.menuTitle}
                    onChange={(event) => setDraft((current) => ({ ...current, menuTitle: event.target.value }))}
                    className={inputBase}
                    placeholder="Kurzer Titel fuer Karten"
                  />
                </div>

                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">Weitere Keywords fuer die KI (eine Zeile je Keyword)</label>
                  <textarea
                    value={draft.supportingKeywordsText}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, supportingKeywordsText: event.target.value }))
                    }
                    className={`${inputBase} min-h-[110px]`}
                    placeholder={"z. B. zinsbindung\nrestschuld\nvergleich"}
                  />
                </div>

                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">Outline / Zwischenueberschriften</label>
                  <textarea
                    value={draft.outlineText}
                    onChange={(event) => setDraft((current) => ({ ...current, outlineText: event.target.value }))}
                    className={`${inputBase} min-h-[180px]`}
                    placeholder={"Einordnung des Themas\nWichtige Voraussetzungen\nTypische Fehler\nNaechste Schritte"}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">Excerpt</label>
                  <textarea
                    value={draft.excerpt}
                    onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))}
                    className={`${inputBase} min-h-[110px]`}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">SEO Title</label>
                  <input
                    value={draft.seoTitle}
                    onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value }))}
                    className={inputBase}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Lesezeit (Minuten)</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.readingTimeMinutes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        readingTimeMinutes: Number(event.target.value || current.readingTimeMinutes),
                      }))
                    }
                    className={inputBase}
                  />
                </div>
                <div className="grid gap-2 lg:col-span-2">
                  <label className="text-xs text-slate-600">SEO Description</label>
                  <textarea
                    value={draft.seoDescription}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, seoDescription: event.target.value }))
                    }
                    className={`${inputBase} min-h-[100px]`}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Sortierung</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sortOrder: Number(event.target.value || current.sortOrder),
                      }))
                    }
                    className={inputBase}
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.isPublished}
                      onChange={(event) => setDraft((current) => ({ ...current, isPublished: event.target.checked }))}
                    />
                    Veroeffentlicht
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Hero-Bild</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Upload in Supabase Storage `website_media` oder manuelle Pfadangabe.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!dbReady || uploadLoading}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:opacity-60"
                >
                  {uploadLoading ? "Laedt..." : "Bild hochladen"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Bildpfad / URL</label>
                  <input
                    value={draft.heroImagePath ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, heroImagePath: event.target.value || null }))
                    }
                    className={inputBase}
                    placeholder="ratgeber/slug/datei.jpg oder /familie_haus.jpg"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-600">Alt-Text</label>
                  <input
                    value={draft.heroImageAlt}
                    onChange={(event) => setDraft((current) => ({ ...current, heroImageAlt: event.target.value }))}
                    className={inputBase}
                    placeholder="Alt-Text fuer das Bild"
                  />
                </div>
              </div>
              {uploadMessage ? <div className="mt-3 text-sm text-slate-600">{uploadMessage}</div> : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Preview</div>
              <div className="mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 p-3 shadow-sm">
                <div className="relative h-[220px] overflow-hidden rounded-[22px] border border-slate-200 bg-slate-200">
                  {heroImageSrc ? (
                    <Image
                      src={heroImageSrc}
                      alt={draft.heroImageAlt || draft.title || "Ratgeberbild"}
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 1280px) 100vw, 40vw"
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {selectedCategoryName} / {selectedTopicName || "Unterkategorie"}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{draft.title || "Noch kein Titel"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Highlights</div>
              <div className="mt-4 grid gap-2">
                {draft.highlights.length ? (
                  draft.highlights.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Noch keine Highlights generiert.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Textbloecke</div>
              <div className="mt-4 space-y-3">
                {draft.sections.length ? (
                  draft.sections.map((section, index) => (
                    <div key={section.heading} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Block {index + 1}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">{section.heading}</div>
                      <div className="mt-2 text-sm text-slate-600">
                        {section.paragraphs.length} Absaetze
                        {section.bullets?.length ? ` · ${section.bullets.length} Bullet Points` : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Noch keine Textbloecke generiert.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">FAQ</div>
              <div className="mt-4 space-y-3">
                {draft.faq.length ? (
                  draft.faq.map((item) => (
                    <div key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">{item.question}</div>
                      <div className="mt-2 text-sm text-slate-600">{item.answer}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Noch keine FAQ generiert.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
