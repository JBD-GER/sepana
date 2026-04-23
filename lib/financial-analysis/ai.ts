import { loadFinancialAnalysisDocuments } from "@/lib/financial-analysis/data"
import {
  getFinancialAnalysisDocumentKindLabel,
  trimOrNull,
  type FinancialAnalysisDocumentRow,
} from "@/lib/financial-analysis/service"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type FinancialAnalysisAdmin = ReturnType<typeof supabaseAdmin>

export type GeneratedFinancialAnalysisDraft = {
  householdOverview: string
  recommendations: string
  actionPlan: string
  schufaNotes: string
  documentSummary: string
}

type PreparedDocument = {
  row: FinancialAnalysisDocumentRow
  label: string
  extractedText: string
  attachmentBlock: Record<string, unknown> | null
}

const MAX_DOCUMENTS_FOR_AI = 10
const MAX_TEXT_CHARS_PER_DOCUMENT = 18000
const MAX_TOTAL_TEXT_CHARS = 70000
const MAX_ATTACHED_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_ATTACHED_BYTES = 18 * 1024 * 1024

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

function getIncompleteReason(payload: unknown) {
  const record = payload as {
    status?: unknown
    incomplete_details?: {
      reason?: unknown
    } | null
  } | null

  if (record?.status !== "incomplete") return null
  return typeof record?.incomplete_details?.reason === "string" ? record.incomplete_details.reason : "unknown"
}

function getApiErrorMessage(payload: unknown, status: number) {
  const record = payload as
    | {
        error?: {
          message?: unknown
        } | null
        message?: unknown
      }
    | null

  if (typeof record?.error?.message === "string" && record.error.message.trim()) {
    return record.error.message
  }
  if (typeof record?.message === "string" && record.message.trim()) {
    return record.message
  }
  return `OpenAI Anfrage fehlgeschlagen (${status})`
}

function asCleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}\n\n[Auszug gekürzt: Dokument enthält weitere Inhalte.]`
}

function isPdf(document: FinancialAnalysisDocumentRow) {
  const mime = String(document.mime_type ?? "").trim().toLowerCase()
  const fileName = String(document.file_name ?? "").trim().toLowerCase()
  return mime === "application/pdf" || fileName.endsWith(".pdf")
}

function isImage(document: FinancialAnalysisDocumentRow) {
  const mime = String(document.mime_type ?? "").trim().toLowerCase()
  return mime.startsWith("image/")
}

function toDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`
}

function normalizeMime(document: FinancialAnalysisDocumentRow) {
  const mime = trimOrNull(document.mime_type)?.toLowerCase()
  if (mime) return mime
  const fileName = String(document.file_name ?? "").toLowerCase()
  if (fileName.endsWith(".png")) return "image/png"
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg"
  if (fileName.endsWith(".webp")) return "image/webp"
  if (fileName.endsWith(".pdf")) return "application/pdf"
  return "application/octet-stream"
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    const pdfModule = await import("pdfjs-dist")
    const pdfjs: any = (pdfModule as any).default ?? pdfModule
    const task = pdfjs.getDocument({ data: bytes, disableWorker: true, useSystemFonts: true })
    const pdf = await task.promise
    const pageTexts: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = (Array.isArray(content?.items) ? content.items : [])
        .map((item: unknown) => {
          const textItem = item as { str?: unknown }
          return typeof textItem?.str === "string" ? textItem.str : ""
        })
        .filter(Boolean)
        .join(" ")
      if (text.trim()) {
        pageTexts.push(`Seite ${pageNumber}: ${text}`)
      }
    }

    return asCleanText(pageTexts.join("\n\n"))
  } catch {
    return ""
  }
}

async function downloadDocument(admin: FinancialAnalysisAdmin, document: FinancialAnalysisDocumentRow) {
  const filePath = trimOrNull(document.file_path)
  if (!filePath) return null

  const result = await admin.storage.from("case_documents").download(filePath)
  if (result.error || !result.data) return null

  const buffer = await result.data.arrayBuffer()
  return new Uint8Array(buffer)
}

async function prepareDocuments(input: {
  admin: FinancialAnalysisAdmin
  documents: FinancialAnalysisDocumentRow[]
}) {
  const prepared: PreparedDocument[] = []
  let attachedBytes = 0

  for (const row of input.documents.slice(0, MAX_DOCUMENTS_FOR_AI)) {
    const bytes = await downloadDocument(input.admin, row)
    if (!bytes?.byteLength) continue

    const mimeType = normalizeMime(row)
    const label = `${getFinancialAnalysisDocumentKindLabel(row.document_kind)}: ${trimOrNull(row.file_name) ?? row.id}`
    const extractedText = isPdf(row) ? await extractPdfText(bytes) : ""

    let attachmentBlock: Record<string, unknown> | null = null
    if (bytes.byteLength <= MAX_ATTACHED_FILE_BYTES && attachedBytes + bytes.byteLength <= MAX_TOTAL_ATTACHED_BYTES) {
      if (isPdf(row)) {
        attachmentBlock = {
          type: "input_file",
          filename: trimOrNull(row.file_name) ?? `${row.id}.pdf`,
          file_data: toDataUrl(bytes, "application/pdf"),
        }
      } else if (isImage(row)) {
        attachmentBlock = {
          type: "input_image",
          image_url: toDataUrl(bytes, mimeType),
          detail: "high",
        }
      }
      if (attachmentBlock) {
        attachedBytes += bytes.byteLength
      }
    }

    prepared.push({
      row,
      label,
      extractedText: truncateText(extractedText, MAX_TEXT_CHARS_PER_DOCUMENT),
      attachmentBlock,
    })
  }

  return prepared
}

function buildDocumentText(prepared: PreparedDocument[]) {
  let usedChars = 0
  const blocks: string[] = []

  for (const item of prepared) {
    if (!item.extractedText) continue
    const remaining = MAX_TOTAL_TEXT_CHARS - usedChars
    if (remaining <= 0) break
    const text = truncateText(item.extractedText, remaining)
    usedChars += text.length
    blocks.push(
      [
        `--- ${item.label} ---`,
        `Datei: ${trimOrNull(item.row.file_name) ?? "-"}`,
        `Art: ${getFinancialAnalysisDocumentKindLabel(item.row.document_kind)}`,
        text,
      ].join("\n")
    )
  }

  return blocks.join("\n\n")
}

function parseGeneratedDraft(value: unknown): GeneratedFinancialAnalysisDraft {
  const record = value as Partial<GeneratedFinancialAnalysisDraft> | null
  return {
    householdOverview: asCleanText(record?.householdOverview),
    recommendations: asCleanText(record?.recommendations),
    actionPlan: asCleanText(record?.actionPlan),
    schufaNotes: asCleanText(record?.schufaNotes),
    documentSummary: asCleanText(record?.documentSummary),
  }
}

export async function generateFinancialAnalysisDraft(input: {
  admin: FinancialAnalysisAdmin
  caseId: string
  serviceId: string
  caseRef?: string | null
  applicantName?: string | null
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false as const, error: "openai_not_configured" }
  }

  const allDocuments = await loadFinancialAnalysisDocuments(input.admin, input.serviceId)
  const documents = allDocuments.filter((document) => trimOrNull(document.file_path))
  const bankDocuments = documents.filter((document) => String(document.document_kind ?? "").trim().toLowerCase() === "bank_statement")
  const hasSchufaReport = documents.some((document) => String(document.document_kind ?? "").trim().toLowerCase() === "schufa_report")

  if (!documents.length) {
    return { ok: false as const, error: "financial_analysis_documents_missing" }
  }
  if (!bankDocuments.length) {
    return { ok: false as const, error: "financial_analysis_bank_statement_missing" }
  }

  const prioritizedDocuments = [
    ...bankDocuments,
    ...documents.filter((document) => String(document.document_kind ?? "").trim().toLowerCase() === "schufa_report"),
    ...documents.filter((document) => String(document.document_kind ?? "").trim().toLowerCase() === "supporting_document"),
  ]
  const prepared = await prepareDocuments({ admin: input.admin, documents: prioritizedDocuments })
  const documentText = buildDocumentText(prepared)
  const attachmentBlocks = prepared.map((item) => item.attachmentBlock).filter((block): block is Record<string, unknown> => Boolean(block))

  if (!documentText && attachmentBlocks.length === 0) {
    return { ok: false as const, error: "financial_analysis_documents_unreadable" }
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["householdOverview", "recommendations", "actionPlan", "schufaNotes", "documentSummary"],
    properties: {
      householdOverview: { type: "string" },
      recommendations: { type: "string" },
      actionPlan: { type: "string" },
      schufaNotes: { type: "string" },
      documentSummary: { type: "string" },
    },
  }

  const systemPrompt = [
    "Du bist ein erfahrener deutscher Finanzberater und erstellst interne Entwürfe für SEPANA.",
    "Arbeite ehrlich, vorsichtig und nachvollziehbar. Keine Erfolgsgarantien, keine rechtlichen Musterschreiben, keine Drohkulisse.",
    "Wenn Zahlen aus Kontoauszügen nicht eindeutig belegbar sind, formuliere als Schätzung oder Prüfpunkt.",
    "Erstelle eine bankenähnliche Haushaltsrechnung, konkrete Optimierungen und einen 90-Tage-Maßnahmenplan.",
    "Nimm in recommendations und actionPlan immer einen klaren Baustein auf: zusätzliche Einnahmen durch eine Nebentätigkeit prüfen und, wenn zeitlich, gesundheitlich und rechtlich realistisch möglich, aufnehmen. Formuliere seriös mit Hinweis auf Anmeldung, Steuer/Sozialversicherung und Belastbarkeit.",
    "Schufa-Hinweise dürfen nur erstellt werden, wenn ausdrücklich eine Schufa-Auskunft vorliegt. Ohne Schufa-Auskunft muss schufaNotes kurz erklären, dass dieser Teil nach Upload ergänzt wird.",
    "Formatiere die Texte gut lesbar mit kurzen Abschnitten, Überschriften und Bulletpoints als Klartext. Keine Markdown-Tabellen.",
  ].join("\n")

  const userPrompt = [
    `Fall: ${trimOrNull(input.caseRef) ?? input.caseId}`,
    `Kunde: ${trimOrNull(input.applicantName) ?? "nicht angegeben"}`,
    `Schufa-Auskunft vorhanden: ${hasSchufaReport ? "ja" : "nein"}`,
    "",
    "Aufgabe:",
    "1. Erstelle eine Haushaltsrechnung mit Einnahmen, Fixkosten, variablen Kosten, Verbindlichkeiten und realistischer freier Liquidität.",
    "2. Leite konkrete Empfehlungen ab, um die monatliche Kaufkraft und Bonitätswirkung zu verbessern. Die Empfehlungen müssen immer einen Punkt enthalten, dass der Kunde eine Nebentätigkeit prüfen und bei realistischen Rahmenbedingungen aufnehmen sollte, um zusätzliche Einnahmen aufzubauen.",
    "3. Erstelle einen 90-Tage-Maßnahmenplan mit Phasen Tag 1-30, Tag 31-60 und Tag 61-90. Der Plan muss immer einen praktischen Schritt zur Prüfung und möglichen Aufnahme einer Nebentätigkeit enthalten.",
    "4. Wenn eine Schufa-Auskunft vorhanden ist: gib vorsichtige Hinweise zu möglichen nächsten Schritten, z. B. Erledigungsvermerke, Klärung mit Vertragspartnern, Konsolidierung. Keine fertigen Vorlagen und keine Rechtsberatung.",
    "5. Erzeuge documentSummary als kurze interne Notiz, welche Dokumente ausgewertet wurden und wo Unsicherheiten bestehen.",
    "",
    "Ausgelesene Dokumenttexte:",
    documentText || "[Keine Texte extrahierbar. Nutze die angehängten Dokumente/Bilder, soweit vorhanden.]",
  ].join("\n")

  const content: Record<string, unknown>[] = [{ type: "input_text", text: userPrompt }, ...attachmentBlocks]
  const model = process.env.OPENAI_FINANCIAL_ANALYSIS_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini"

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
          content,
        },
      ],
      max_output_tokens: 9000,
      text: {
        format: {
          type: "json_schema",
          name: "financial_analysis_draft",
          schema,
          strict: true,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false as const, error: getApiErrorMessage(payload, response.status) }
  }

  const incompleteReason = getIncompleteReason(payload)
  if (incompleteReason) {
    return {
      ok: false as const,
      error:
        incompleteReason === "max_output_tokens"
          ? "financial_analysis_ai_output_truncated"
          : `financial_analysis_ai_incomplete_${incompleteReason}`,
    }
  }

  const outputText = extractOutputText(payload)
  if (!outputText) {
    return { ok: false as const, error: "financial_analysis_ai_empty_response" }
  }

  try {
    const generated = parseGeneratedDraft(JSON.parse(outputText))
    if (!generated.householdOverview || !generated.recommendations || !generated.actionPlan) {
      return { ok: false as const, error: "financial_analysis_ai_content_missing" }
    }
    return {
      ok: true as const,
      generated,
      documentCount: documents.length,
      hasSchufaReport,
    }
  } catch {
    return { ok: false as const, error: "financial_analysis_ai_invalid_json" }
  }
}
