import fs from "fs/promises"
import path from "path"
import type { Color, PDFDocument, PDFFont, PDFPage } from "pdf-lib"
import { FINANCIAL_ANALYSIS_LEGAL_NOTE, FINANCIAL_ANALYSIS_SERVICE_TITLE, trimOrNull } from "@/lib/financial-analysis/service"

type PdfLibModule = typeof import("pdf-lib")

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN_X = 42
const BOTTOM_MARGIN = 54

function formatDate(value: string | null | undefined) {
  const normalized = trimOrNull(value)
  if (!normalized) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(normalized))
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(next, size)
    if (width <= maxWidth || !current) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

function splitBlocks(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function normalizeBullet(value: string) {
  return value.replace(/^[-•*]\s*/g, "").trim()
}

function isHeading(value: string) {
  const normalized = value.trim()
  return normalized.length <= 80 && !normalized.endsWith(".") && !normalized.includes(": ")
}

function drawWrappedText(input: {
  page: PDFPage
  font: PDFFont
  text: string
  x: number
  y: number
  size: number
  maxWidth: number
  lineHeight?: number
  color?: Color
}) {
  const lines = wrapText(input.font, input.text, input.size, input.maxWidth)
  let cursorY = input.y
  for (const line of lines) {
    input.page.drawText(line, {
      x: input.x,
      y: cursorY,
      size: input.size,
      font: input.font,
      color: input.color,
    })
    cursorY -= input.lineHeight ?? input.size + 4
  }
  return cursorY
}

function drawPill(input: {
  page: PDFPage
  font: PDFFont
  text: string
  x: number
  y: number
  width: number
  bg: Color
  fg: Color
}) {
  input.page.drawRectangle({
    x: input.x,
    y: input.y,
    width: input.width,
    height: 24,
    color: input.bg,
    borderWidth: 0,
  })
  input.page.drawText(input.text, {
    x: input.x + 10,
    y: input.y + 8,
    size: 9,
    font: input.font,
    color: input.fg,
  })
}

function createPage(pdfDoc: PDFDocument, pdfLib: PdfLibModule) {
  const { rgb } = pdfLib
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.985, 0.992, 0.99) })
  page.drawCircle({ x: 516, y: 792, size: 112, color: rgb(0.86, 0.98, 0.95), opacity: 0.55 })
  page.drawCircle({ x: 46, y: 86, size: 92, color: rgb(0.88, 0.95, 1), opacity: 0.6 })
  return page
}

function drawHeader(input: {
  page: PDFPage
  logoImage?: unknown
  font: PDFFont
  bold: PDFFont
  pdfLib: PdfLibModule
  caseRef: string
}) {
  const { rgb } = input.pdfLib
  if (input.logoImage) {
    input.page.drawImage(input.logoImage as any, { x: MARGIN_X, y: 786, width: 104, height: 27 })
  } else {
    input.page.drawText("SEPANA", { x: MARGIN_X, y: 798, size: 18, font: input.bold, color: rgb(0.06, 0.09, 0.16) })
  }
  drawPill({
    page: input.page,
    font: input.bold,
    text: `Fall ${input.caseRef}`,
    x: 412,
    y: 792,
    width: 112,
    bg: rgb(0.9, 0.98, 0.96),
    fg: rgb(0.02, 0.37, 0.31),
  })
  input.page.drawLine({
    start: { x: MARGIN_X, y: 770 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 770 },
    thickness: 1,
    color: rgb(0.87, 0.9, 0.94),
  })
}

function drawFooter(page: PDFPage, font: PDFFont, pdfLib: PdfLibModule, pageNumber: number) {
  const { rgb } = pdfLib
  page.drawLine({
    start: { x: MARGIN_X, y: 42 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
    thickness: 1,
    color: rgb(0.87, 0.9, 0.94),
  })
  page.drawText("SEPANA Finanzanalyse · vertraulich", { x: MARGIN_X, y: 24, size: 8, font, color: rgb(0.39, 0.45, 0.54) })
  page.drawText(`Seite ${pageNumber}`, { x: PAGE_WIDTH - MARGIN_X - 40, y: 24, size: 8, font, color: rgb(0.39, 0.45, 0.54) })
}

function drawTimeline(page: PDFPage, bold: PDFFont, font: PDFFont, pdfLib: PdfLibModule, y: number) {
  const { rgb } = pdfLib
  const steps = [
    { title: "Tag 1-30", sub: "Stabilisieren", x: 82, color: rgb(0.02, 0.37, 0.31) },
    { title: "Tag 31-60", sub: "Optimieren", x: 247, color: rgb(0.03, 0.31, 0.62) },
    { title: "Tag 61-90", sub: "Nachhalten", x: 412, color: rgb(0.49, 0.24, 0.02) },
  ]

  page.drawLine({
    start: { x: steps[0].x + 18, y: y + 18 },
    end: { x: steps[2].x + 18, y: y + 18 },
    thickness: 5,
    color: rgb(0.83, 0.9, 0.92),
  })

  for (const step of steps) {
    page.drawCircle({ x: step.x + 18, y: y + 18, size: 18, color: step.color })
    page.drawText(step.title, { x: step.x - 10, y: y - 18, size: 10, font: bold, color: rgb(0.06, 0.09, 0.16) })
    page.drawText(step.sub, { x: step.x - 10, y: y - 34, size: 9, font, color: rgb(0.39, 0.45, 0.54) })
  }
}

function drawContentBlocks(input: {
  pdfDoc: PDFDocument
  pdfLib: PdfLibModule
  font: PDFFont
  bold: PDFFont
  logoImage?: unknown
  caseRef: string
  page: PDFPage
  cursorY: number
  title: string
  text: string
  pageNumber: number
}) {
  const { rgb } = input.pdfLib
  let page = input.page
  let cursorY = input.cursorY
  let pageNumber = input.pageNumber

  const ensureSpace = (height: number) => {
    if (cursorY - height > BOTTOM_MARGIN) return
    drawFooter(page, input.font, input.pdfLib, pageNumber)
    pageNumber += 1
    page = createPage(input.pdfDoc, input.pdfLib)
    drawHeader({ page, logoImage: input.logoImage, font: input.font, bold: input.bold, pdfLib: input.pdfLib, caseRef: input.caseRef })
    cursorY = 728
  }

  ensureSpace(54)
  page.drawText(input.title, { x: MARGIN_X, y: cursorY, size: 17, font: input.bold, color: rgb(0.06, 0.09, 0.16) })
  cursorY -= 24

  for (const block of splitBlocks(input.text)) {
    ensureSpace(70)
    if (isHeading(block)) {
      page.drawText(block.replace(/:$/g, ""), { x: MARGIN_X, y: cursorY, size: 12, font: input.bold, color: rgb(0.02, 0.37, 0.31) })
      cursorY -= 18
      continue
    }

    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      ensureSpace(34)
      const isBullet = /^[-•*]\s*/.test(line)
      if (isBullet) {
        page.drawCircle({ x: MARGIN_X + 5, y: cursorY + 4, size: 2.4, color: rgb(0.02, 0.37, 0.31) })
        cursorY = drawWrappedText({
          page,
          font: input.font,
          text: normalizeBullet(line),
          x: MARGIN_X + 18,
          y: cursorY,
          size: 10,
          maxWidth: 472,
          lineHeight: 14,
          color: rgb(0.2, 0.25, 0.33),
        })
      } else {
        cursorY = drawWrappedText({
          page,
          font: input.font,
          text: line,
          x: MARGIN_X,
          y: cursorY,
          size: 10,
          maxWidth: 508,
          lineHeight: 14,
          color: rgb(0.2, 0.25, 0.33),
        })
      }
      cursorY -= 7
    }
    cursorY -= 4
  }

  return { page, cursorY, pageNumber }
}

export async function renderFinancialAnalysisActionPlanPdf(input: {
  caseRef: string
  customerName?: string | null
  actionPlan: string
  householdOverview?: string | null
  recommendations?: string | null
  createdAt?: string | null
  publishedAt?: string | null
}) {
  const pdfLib = await import("pdf-lib").catch(() => null)
  if (!pdfLib) throw new Error("pdf_lib_missing")
  const { PDFDocument, StandardFonts, rgb } = pdfLib

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let logoImage: unknown = null
  try {
    const logoBytes = new Uint8Array(await fs.readFile(path.join(process.cwd(), "public", "og.png")))
    logoImage = await pdfDoc.embedPng(logoBytes)
  } catch {}

  let pageNumber = 1
  let page = createPage(pdfDoc, pdfLib)
  drawHeader({ page, logoImage, font, bold, pdfLib, caseRef: input.caseRef })

  page.drawRectangle({ x: MARGIN_X, y: 598, width: 511, height: 142, color: rgb(0.06, 0.09, 0.16) })
  page.drawCircle({ x: 506, y: 714, size: 70, color: rgb(0.02, 0.37, 0.31), opacity: 0.75 })
  page.drawText("90-Tage-Maßnahmenplan", { x: 64, y: 696, size: 27, font: bold, color: rgb(1, 1, 1) })
  page.drawText(FINANCIAL_ANALYSIS_SERVICE_TITLE, { x: 64, y: 668, size: 13, font, color: rgb(0.82, 0.9, 0.96) })
  page.drawText(`Kunde: ${trimOrNull(input.customerName) ?? "-"}`, { x: 64, y: 638, size: 10, font, color: rgb(0.91, 0.96, 1) })
  page.drawText(`Stand: ${formatDate(input.publishedAt ?? input.createdAt ?? new Date().toISOString())}`, {
    x: 64,
    y: 622,
    size: 10,
    font,
    color: rgb(0.91, 0.96, 1),
  })

  drawTimeline(page, bold, font, pdfLib, 528)

  page.drawRectangle({
    x: MARGIN_X,
    y: 398,
    width: 511,
    height: 86,
    color: rgb(0.94, 0.99, 0.97),
    borderWidth: 1,
    borderColor: rgb(0.73, 0.91, 0.84),
  })
  page.drawText("Ziel der nächsten 90 Tage", { x: 62, y: 456, size: 13, font: bold, color: rgb(0.02, 0.37, 0.31) })
  drawWrappedText({
    page,
    font,
    text:
      "Die folgenden Schritte sollen Einnahmen, Ausgaben und Verpflichtungen klar strukturieren, kurzfristig Liquidität schaffen und die Grundlage für bessere finanzielle Entscheidungen legen.",
    x: 62,
    y: 434,
    size: 10,
    maxWidth: 470,
    lineHeight: 14,
    color: rgb(0.2, 0.25, 0.33),
  })

  let state = drawContentBlocks({
    pdfDoc,
    pdfLib,
    font,
    bold,
    logoImage,
    caseRef: input.caseRef,
    page,
    cursorY: 356,
    title: "Maßnahmenplan",
    text: input.actionPlan,
    pageNumber,
  })
  page = state.page
  pageNumber = state.pageNumber

  if (trimOrNull(input.recommendations)) {
    state = drawContentBlocks({
      pdfDoc,
      pdfLib,
      font,
      bold,
      logoImage,
      caseRef: input.caseRef,
      page,
      cursorY: state.cursorY - 8,
      title: "Wichtige Empfehlungen",
      text: input.recommendations ?? "",
      pageNumber,
    })
    page = state.page
    pageNumber = state.pageNumber
  }

  if (trimOrNull(input.householdOverview)) {
    state = drawContentBlocks({
      pdfDoc,
      pdfLib,
      font,
      bold,
      logoImage,
      caseRef: input.caseRef,
      page,
      cursorY: state.cursorY - 8,
      title: "Kurzüberblick Haushaltsrechnung",
      text: input.householdOverview ?? "",
      pageNumber,
    })
    page = state.page
    pageNumber = state.pageNumber
  }

  const legalState = drawContentBlocks({
    pdfDoc,
    pdfLib,
    font,
    bold,
    logoImage,
    caseRef: input.caseRef,
    page,
    cursorY: state.cursorY - 8,
    title: "Hinweis",
    text: `${FINANCIAL_ANALYSIS_LEGAL_NOTE}\n\nDieser Maßnahmenplan ersetzt keine steuerliche oder rechtliche Beratung. Angaben basieren auf den bereitgestellten Unterlagen und sollten bei neuen Informationen aktualisiert werden.`,
    pageNumber,
  })
  drawFooter(legalState.page, font, pdfLib, legalState.pageNumber)

  return new Uint8Array(await pdfDoc.save())
}
