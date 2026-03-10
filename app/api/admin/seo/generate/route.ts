export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { getStaticRatgeberCategory, getStaticRatgeberTopic, getStaticRatgeberTopics } from "@/lib/ratgeber/content"
import { parseLines } from "@/lib/ratgeber/utils"

type GenerateBody = {
  categorySlug?: unknown
  topicSlug?: unknown
  categoryName?: unknown
  topicName?: unknown
  title?: unknown
  focusKeyword?: unknown
  outline?: unknown
  supportingKeywords?: unknown
}

type RequiredField = "category" | "topic" | "title" | "focusKeyword" | "outline"

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function extractOutputText(payload: unknown): string {
  const record = payload as {
    output_text?: unknown
    output?: Array<{
      content?: Array<{
        text?: unknown
      }>
    }>
  } | null

  if (typeof record?.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim()
  }

  const parts = Array.isArray(record?.output) ? record.output : []
  const texts: string[] = []
  for (const item of parts) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const block of content) {
      if (typeof block?.text === "string" && block.text.trim()) {
        texts.push(block.text.trim())
      }
    }
  }

  return texts.join("\n").trim()
}

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "OPENAI_API_KEY ist nicht gesetzt. Wenn der Wert gerade in .env.local hinterlegt wurde, den Dev-Server einmal neu starten.",
        },
        { status: 500 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as GenerateBody
    const categorySlug = asString(body.categorySlug)
    const topicSlug = asString(body.topicSlug)
    const categoryName = asString(body.categoryName)
    const topicName = asString(body.topicName)
    const title = asString(body.title)
    const focusKeyword = asString(body.focusKeyword)
    const outline = Array.isArray(body.outline)
      ? body.outline.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : []
    const supportingKeywords = Array.isArray(body.supportingKeywords)
      ? body.supportingKeywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : parseLines(asString(body.supportingKeywords))

    const inferredCategorySlug = getStaticRatgeberTopics().find((item) => item.slug === topicSlug)?.categorySlug ?? ""
    const effectiveCategorySlug = categorySlug || inferredCategorySlug
    const resolvedCategoryName =
      categoryName || getStaticRatgeberCategory(effectiveCategorySlug)?.name || effectiveCategorySlug
    const resolvedTopicName =
      topicName || getStaticRatgeberTopic(effectiveCategorySlug, topicSlug)?.name || topicSlug

    const missingFields: RequiredField[] = []
    if (!resolvedCategoryName) missingFields.push("category")
    if (!resolvedTopicName) missingFields.push("topic")
    if (!title) missingFields.push("title")
    if (!focusKeyword) missingFields.push("focusKeyword")
    if (!outline.length) missingFields.push("outline")

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kategorie, Unterkategorie, Titel, Fokus-Keyword und Outline sind erforderlich.",
          missingFields,
        },
        { status: 400 },
      )
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "excerpt",
        "seoTitle",
        "seoDescription",
        "readingTimeMinutes",
        "highlights",
        "sections",
        "faq",
      ],
      properties: {
        excerpt: { type: "string" },
        seoTitle: { type: "string" },
        seoDescription: { type: "string" },
        readingTimeMinutes: { type: "integer", minimum: 5, maximum: 20 },
        highlights: {
          type: "array",
          minItems: 3,
          maxItems: 4,
          items: { type: "string" },
        },
        sections: {
          type: "array",
          minItems: outline.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["heading", "paragraphs", "bullets"],
            properties: {
              heading: { type: "string" },
              paragraphs: {
                type: "array",
                minItems: 3,
                maxItems: 4,
                items: { type: "string" },
              },
              bullets: {
                type: "array",
                minItems: 0,
                maxItems: 4,
                items: { type: "string" },
              },
            },
          },
        },
        faq: {
          type: "array",
          minItems: 3,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["question", "answer"],
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
            },
          },
        },
      },
    }

    const systemPrompt =
      "Du bist Senior SEO Editor fuer eine deutsche Finanzplattform. Schreibe auf Deutsch, klar, vertrauenswuerdig und conversion-orientiert. Die Inhalte muessen substanziell sein: pro Abschnitt 3 bis 4 vollwertige, informative Absaetze mit jeweils 2 bis 4 ganzen Saetzen, keine Floskeln, keine Platzhalter, keine Markdown-Ueberschriftenzeichen, keine Tabellen. Vermeide erfundene Zahlen, rechtliche Zusagen und unklare Fachbehauptungen. Formuliere suchmaschinenstark, aber nicht spammy. Das Ergebnis soll zu einem cleanen Ratgeber-Layout mit linker Inhaltsnavigation und FAQ-Endblock passen."

    const userPrompt = [
      `Kategorie: ${resolvedCategoryName}`,
      `Unterkategorie: ${resolvedTopicName}`,
      `Titel: ${title}`,
      `Fokus-Keyword: ${focusKeyword}`,
      `Weitere Keywords: ${supportingKeywords.join(", ") || "keine"}`,
      `Outline: ${outline.join(" | ")}`,
      "Erzeuge eine SEO-starke Artikelbasis fuer einen Ratgeberbeitrag.",
      "Wichtig:",
      "- excerpt: 2 bis 3 saubere Saetze fuer Intro und Kartenansicht.",
      "- seoTitle: maximal ca. 60 Zeichen, mit Fokus-Keyword moeglichst weit vorne.",
      "- seoDescription: ca. 150 bis 160 Zeichen, klickstark, ohne Keyword-Stuffing.",
      "- highlights: 3 bis 4 kurze, starke Kernaussagen.",
      "- sections: exakt entlang der Outline, pro Abschnitt 3 bis 4 inhaltlich starke Absaetze mit jeweils mehreren Saetzen; wenn sinnvoll 2 bis 4 Bullet Points.",
      "- faq: 3 bis 4 reale Nutzerfragen mit hilfreichen, konkret formulierten Antworten fuer den festen FAQ-Bereich am Artikelende.",
    ].join("\n")

    const model = process.env.OPENAI_RATGEBER_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini"
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
        max_output_tokens: 4000,
        text: {
          format: {
            type: "json_schema",
            name: "ratgeber_article",
            schema,
            strict: true,
          },
        },
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `OpenAI Anfrage fehlgeschlagen (${response.status})`
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    const outputText = extractOutputText(payload)
    if (!outputText) {
      return NextResponse.json({ ok: false, error: "Keine KI-Antwort erhalten." }, { status: 500 })
    }

    const generated = JSON.parse(outputText)
    return NextResponse.json({ ok: true, generated })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Serverfehler" },
      { status: 500 },
    )
  }
}
