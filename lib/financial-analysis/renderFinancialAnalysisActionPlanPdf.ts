import fs from "fs/promises"
import path from "path"
import type { Color, PDFDocument, PDFFont, PDFPage } from "pdf-lib"
import {
  FINANCIAL_ANALYSIS_LEGAL_NOTE,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  formatFinancialAnalysisEuro,
  parseFinancialAnalysisHouseholdCalculation,
  trimOrNull,
  type FinancialAnalysisHouseholdCalculation,
} from "@/lib/financial-analysis/service"

type PdfLibModule = typeof import("pdf-lib")

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN_X = 42
const BOTTOM_MARGIN = 86

function formatDate(value: string | null | undefined) {
  const normalized = trimOrNull(value)
  if (!normalized) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(normalized))
}

function toWinAnsiSafe(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2192\u27f6\u21d2]/g, "->")
    .replace(/[\u2190\u27f5\u21d0]/g, "<-")
    .replace(/[\u2194\u27f7\u21d4]/g, "<->")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2022\u25cf\u25e6\u2043]/g, "-")
    .replace(/[\u2713\u2714]/g, "OK")
    .replace(/[\u2717\u2718]/g, "x")
    .replace(/\u20ac/g, "EUR")
    .replace(/[^\u0009\u000a\u000d\u0020-\u007e\u00a1-\u00ff]/g, "")
}

function drawSafeText(page: PDFPage, text: string, options: Parameters<PDFPage["drawText"]>[1]) {
  page.drawText(toWinAnsiSafe(text), options)
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = toWinAnsiSafe(text).split(/\s+/).filter(Boolean)
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
  return toWinAnsiSafe(value)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean)
}

function normalizeBullet(value: string) {
  return toWinAnsiSafe(value).replace(/^[-\u2022*]\s*/g, "").trim()
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
    drawSafeText(input.page, line, {
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

function drawRightText(input: {
  page: PDFPage
  font: PDFFont
  text: string
  rightX: number
  y: number
  size: number
  color?: Color
}) {
  const safeText = toWinAnsiSafe(input.text)
  drawSafeText(input.page, safeText, {
    x: input.rightX - input.font.widthOfTextAtSize(safeText, input.size),
    y: input.y,
    size: input.size,
    font: input.font,
    color: input.color,
  })
}

function drawCenteredText(input: {
  page: PDFPage
  font: PDFFont
  text: string
  centerX: number
  y: number
  size: number
  color?: Color
}) {
  const safeText = toWinAnsiSafe(input.text)
  drawSafeText(input.page, safeText, {
    x: input.centerX - input.font.widthOfTextAtSize(safeText, input.size) / 2,
    y: input.y,
    size: input.size,
    font: input.font,
    color: input.color,
  })
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
  drawSafeText(input.page, input.text, {
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
    drawSafeText(input.page, "SEPANA", { x: MARGIN_X, y: 798, size: 18, font: input.bold, color: rgb(0.06, 0.09, 0.16) })
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
  drawSafeText(page, "SEPANA Finanzanalyse - vertraulich", { x: MARGIN_X, y: 24, size: 8, font, color: rgb(0.39, 0.45, 0.54) })
  drawSafeText(page, `Seite ${pageNumber}`, { x: PAGE_WIDTH - MARGIN_X - 40, y: 24, size: 8, font, color: rgb(0.39, 0.45, 0.54) })
}

function drawTimeline(page: PDFPage, bold: PDFFont, font: PDFFont, pdfLib: PdfLibModule, y: number) {
  const { rgb } = pdfLib
  const leftCenter = MARGIN_X + 58
  const middleCenter = PAGE_WIDTH / 2
  const rightCenter = PAGE_WIDTH - MARGIN_X - 58
  const steps = [
    { title: "Tag 1-30", sub: "Stabilisieren", centerX: leftCenter, color: rgb(0.02, 0.37, 0.31) },
    { title: "Tag 31-60", sub: "Optimieren", centerX: middleCenter, color: rgb(0.03, 0.31, 0.62) },
    { title: "Tag 61-90", sub: "Nachhalten", centerX: rightCenter, color: rgb(0.49, 0.24, 0.02) },
  ]

  page.drawLine({
    start: { x: steps[0].centerX, y: y + 18 },
    end: { x: steps[2].centerX, y: y + 18 },
    thickness: 5,
    color: rgb(0.83, 0.9, 0.92),
  })

  for (const step of steps) {
    page.drawCircle({ x: step.centerX, y: y + 18, size: 18, color: step.color })
    drawCenteredText({ page, text: step.title, centerX: step.centerX, y: y - 18, size: 10, font: bold, color: rgb(0.06, 0.09, 0.16) })
    drawCenteredText({ page, text: step.sub, centerX: step.centerX, y: y - 34, size: 9, font, color: rgb(0.39, 0.45, 0.54) })
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
  drawSafeText(page, input.title, { x: MARGIN_X, y: cursorY, size: 17, font: input.bold, color: rgb(0.06, 0.09, 0.16) })
  cursorY -= 24

  for (const block of splitBlocks(input.text)) {
    ensureSpace(70)
    if (isHeading(block)) {
      drawSafeText(page, block.replace(/:$/g, ""), { x: MARGIN_X, y: cursorY, size: 12, font: input.bold, color: rgb(0.02, 0.37, 0.31) })
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

function getHouseholdTotalCosts(calculation: FinancialAnalysisHouseholdCalculation) {
  if (calculation.totalCostsMonthly != null) return calculation.totalCostsMonthly
  const costParts = [
    calculation.provenFixedCostsMonthly,
    calculation.bankHouseholdAllowanceMonthly,
    calculation.obligationsMonthly,
    calculation.variableCostsMonthly,
    calculation.safetyBufferMonthly,
  ]
  const hasCostParts = costParts.some((value) => value != null && Number.isFinite(Number(value)))
  return hasCostParts ? costParts.reduce<number>((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0) : null
}

function drawHouseholdCalculationBlock(input: {
  pdfDoc: PDFDocument
  pdfLib: PdfLibModule
  font: PDFFont
  bold: PDFFont
  logoImage?: unknown
  caseRef: string
  page: PDFPage
  cursorY: number
  pageNumber: number
  calculation: FinancialAnalysisHouseholdCalculation
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

  const calculation = input.calculation
  const totalCosts = getHouseholdTotalCosts(calculation)
  const freeLiquidity =
    calculation.freeLiquidityMonthly ??
    (calculation.incomeMonthly != null && totalCosts != null ? Number(calculation.incomeMonthly) - Number(totalCosts) : null)
  const resultPositive = freeLiquidity == null || Number(freeLiquidity) >= 0

  ensureSpace(260)
  drawSafeText(page, "Haushaltsrechnung nach Banklogik", {
    x: MARGIN_X,
    y: cursorY,
    size: 17,
    font: input.bold,
    color: rgb(0.06, 0.09, 0.16),
  })
  cursorY -= 28

  const metrics = [
    {
      label: "Einnahmen pro Monat",
      value: formatFinancialAnalysisEuro(calculation.incomeMonthly),
      bg: rgb(0.91, 0.98, 0.95),
      fg: rgb(0.02, 0.37, 0.31),
    },
    {
      label: "Kosten nach Banklogik",
      value: formatFinancialAnalysisEuro(totalCosts),
      bg: rgb(0.96, 0.98, 1),
      fg: rgb(0.06, 0.09, 0.16),
    },
    {
      label: "Bank-Pauschale",
      value: formatFinancialAnalysisEuro(calculation.bankHouseholdAllowanceMonthly),
      bg: rgb(0.9, 0.97, 1),
      fg: rgb(0.03, 0.31, 0.62),
    },
    {
      label: "Freie Liquidität",
      value: formatFinancialAnalysisEuro(freeLiquidity),
      bg: resultPositive ? rgb(0.9, 0.98, 0.95) : rgb(1, 0.93, 0.93),
      fg: resultPositive ? rgb(0.02, 0.37, 0.31) : rgb(0.59, 0.05, 0.12),
    },
  ]
  const cardWidth = 248
  const cardHeight = 54
  const cardGap = 15
  const cardTopY = cursorY

  for (const [index, metric] of metrics.entries()) {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = MARGIN_X + col * (cardWidth + cardGap)
    const y = cardTopY - cardHeight - row * (cardHeight + 10)
    page.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      color: metric.bg,
      borderWidth: 1,
      borderColor: rgb(0.82, 0.88, 0.91),
    })
    drawSafeText(page, metric.label, { x: x + 12, y: y + 34, size: 8, font: input.bold, color: rgb(0.39, 0.45, 0.54) })
    drawSafeText(page, metric.value, { x: x + 12, y: y + 13, size: 15, font: input.bold, color: metric.fg })
  }

  cursorY = cardTopY - cardHeight * 2 - 34

  const rows = [
    { label: "Einnahmen gesamt", value: calculation.incomeMonthly, kind: "income" },
    { label: "Belegte Fixkosten", value: calculation.provenFixedCostsMonthly, kind: "cost" },
    { label: "Bankübliche Haushaltspauschale", value: calculation.bankHouseholdAllowanceMonthly, kind: "cost" },
    { label: "Laufende Verpflichtungen/Raten", value: calculation.obligationsMonthly, kind: "cost" },
    { label: "Variable Kosten", value: calculation.variableCostsMonthly, kind: "cost" },
    { label: "Sicherheitsabschlag", value: calculation.safetyBufferMonthly, kind: "cost" },
    { label: "Gesamtausgaben nach Bankrechnung", value: totalCosts, kind: "total" },
    { label: "Freie Liquidität nach Bankrechnung", value: freeLiquidity, kind: "result" },
  ]
  const tableX = MARGIN_X
  const tableWidth = PAGE_WIDTH - MARGIN_X * 2
  const rowHeight = 27

  ensureSpace(rows.length * rowHeight + 26)
  drawSafeText(page, "Monatliche Rechnung", { x: tableX, y: cursorY, size: 12, font: input.bold, color: rgb(0.02, 0.37, 0.31) })
  cursorY -= 18

  for (const [index, row] of rows.entries()) {
    ensureSpace(rowHeight + 4)
    const isEmphasis = row.kind === "total" || row.kind === "result"
    const rowY = cursorY - rowHeight
    const valueColor =
      row.kind === "income"
        ? rgb(0.02, 0.37, 0.31)
        : row.kind === "result" && !resultPositive
          ? rgb(0.59, 0.05, 0.12)
          : rgb(0.06, 0.09, 0.16)

    page.drawRectangle({
      x: tableX,
      y: rowY,
      width: tableWidth,
      height: rowHeight,
      color: isEmphasis ? rgb(0.93, 0.97, 0.96) : index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
      borderWidth: 0.5,
      borderColor: rgb(0.86, 0.9, 0.94),
    })
    drawSafeText(page, row.label, {
      x: tableX + 12,
      y: rowY + 9,
      size: isEmphasis ? 10 : 9.5,
      font: isEmphasis ? input.bold : input.font,
      color: rgb(0.2, 0.25, 0.33),
    })
    drawRightText({
      page,
      font: isEmphasis ? input.bold : input.font,
      text: formatFinancialAnalysisEuro(row.value),
      rightX: tableX + tableWidth - 12,
      y: rowY + 9,
      size: isEmphasis ? 10 : 9.5,
      color: valueColor,
    })
    cursorY -= rowHeight
  }

  const assessment = trimOrNull(calculation.assessment)
  if (assessment) {
    const assessmentLines = wrapText(input.font, assessment, 9.5, tableWidth)
    ensureSpace(Math.min(230, 38 + assessmentLines.length * 13))
    cursorY -= 16
    drawSafeText(page, "Einordnung", { x: tableX, y: cursorY, size: 12, font: input.bold, color: rgb(0.02, 0.37, 0.31) })
    cursorY -= 18
    for (const line of assessmentLines) {
      ensureSpace(21)
      drawSafeText(page, line, {
        x: tableX,
        y: cursorY,
        size: 9.5,
        font: input.font,
        color: rgb(0.2, 0.25, 0.33),
      })
      cursorY -= 13
    }
  }

  const items = (calculation.items ?? []).slice(0, 10)
  if (items.length) {
    const itemRows = items.map((item) => {
      const label = trimOrNull(item.label) ?? "Position"
      const labelLines = wrapText(input.bold, label, 8.6, tableWidth - 150)
      const rowHeight = Math.max(34, 18 + labelLines.length * 10)
      return {
        item,
        labelLines,
        rowHeight,
        category: trimOrNull(item.category) ?? trimOrNull(item.basis) ?? "Position",
      }
    })
    const totalItemsHeight = 42 + itemRows.reduce<number>((sum, row) => sum + row.rowHeight, 0)

    ensureSpace(totalItemsHeight)
    cursorY -= 16
    drawSafeText(page, "Erkannte Detailpositionen", { x: tableX, y: cursorY, size: 12, font: input.bold, color: rgb(0.02, 0.37, 0.31) })
    cursorY -= 20

    for (const [index, row] of itemRows.entries()) {
      ensureSpace(row.rowHeight + 4)
      const rowY = cursorY - row.rowHeight
      page.drawRectangle({
        x: tableX,
        y: rowY,
        width: tableWidth,
        height: row.rowHeight,
        color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
        borderWidth: 0.5,
        borderColor: rgb(0.88, 0.91, 0.94),
      })
      let labelY = rowY + row.rowHeight - 13
      for (const labelLine of row.labelLines.slice(0, 2)) {
        drawSafeText(page, labelLine, {
          x: tableX + 12,
          y: labelY,
          size: 8.6,
          font: input.bold,
          color: rgb(0.06, 0.09, 0.16),
        })
        labelY -= 10
      }
      drawSafeText(page, row.category, {
        x: tableX + 12,
        y: rowY + 4,
        size: 7.5,
        font: input.font,
        color: rgb(0.39, 0.45, 0.54),
      })
      drawRightText({
        page,
        font: input.bold,
        text: formatFinancialAnalysisEuro(row.item.amountMonthly),
        rightX: tableX + tableWidth - 12,
        y: rowY + Math.max(10, row.rowHeight / 2 - 4),
        size: 9.5,
        color: rgb(0.06, 0.09, 0.16),
      })
      cursorY -= row.rowHeight
    }
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
  drawSafeText(page, "90-Tage-Maßnahmenplan", { x: 64, y: 696, size: 27, font: bold, color: rgb(1, 1, 1) })
  drawSafeText(page, FINANCIAL_ANALYSIS_SERVICE_TITLE, { x: 64, y: 668, size: 13, font, color: rgb(0.82, 0.9, 0.96) })
  drawSafeText(page, `Kunde: ${trimOrNull(input.customerName) ?? "-"}`, { x: 64, y: 638, size: 10, font, color: rgb(0.91, 0.96, 1) })
  drawSafeText(page, `Stand: ${formatDate(input.publishedAt ?? input.createdAt ?? new Date().toISOString())}`, {
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
  drawSafeText(page, "Ziel der nächsten 90 Tage", { x: 62, y: 456, size: 13, font: bold, color: rgb(0.02, 0.37, 0.31) })
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

  const householdCalculation = parseFinancialAnalysisHouseholdCalculation(input.householdOverview)
  if (householdCalculation) {
    state = drawHouseholdCalculationBlock({
      pdfDoc,
      pdfLib,
      font,
      bold,
      logoImage,
      caseRef: input.caseRef,
      page,
      cursorY: state.cursorY - 8,
      pageNumber,
      calculation: householdCalculation,
    })
    page = state.page
    pageNumber = state.pageNumber
  } else if (trimOrNull(input.householdOverview)) {
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
    cursorY: state.cursorY - 42,
    title: "Hinweis",
    text: `${FINANCIAL_ANALYSIS_LEGAL_NOTE}\n\nDieser Maßnahmenplan ersetzt keine steuerliche oder rechtliche Beratung. Angaben basieren auf den bereitgestellten Unterlagen und sollten bei neuen Informationen aktualisiert werden.`,
    pageNumber,
  })
  drawFooter(legalState.page, font, pdfLib, legalState.pageNumber)

  return new Uint8Array(await pdfDoc.save())
}
