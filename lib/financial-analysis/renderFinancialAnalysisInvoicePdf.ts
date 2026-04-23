import fs from "fs/promises"
import path from "path"
import type { Color, PDFFont, PDFPage } from "pdf-lib"
import { FINANCIAL_ANALYSIS_DEFAULT_SUMMARY, FINANCIAL_ANALYSIS_LEGAL_NOTE } from "@/lib/financial-analysis/service"
import {
  FINANCIAL_ANALYSIS_INVOICE_BANK,
  FINANCIAL_ANALYSIS_INVOICE_COMPANY,
  getFinancialAnalysisInvoiceBreakdownFromGrossAmount,
  getFinancialAnalysisInvoiceStatusLabel,
  getFinancialAnalysisInvoiceTitle,
} from "@/lib/financial-analysis/invoice"
import { SCHUFA_FREE_PROVISION_VAT_RATE, formatEuro, formatPercent, trimOrNull } from "@/lib/schufa-frei/provisionInvoice"

function formatDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(raw))
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

function drawTextBlock(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  lineHeight = 14
) {
  const lines = wrapText(font, text, size, maxWidth)
  let cursorY = y
  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size, font })
    cursorY -= lineHeight
  }
  return cursorY
}

function drawRightAlignedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color?: Color
) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  })
}

export async function renderFinancialAnalysisInvoicePdf(input: {
  invoiceNumber: string
  createdAt: string | null | undefined
  caseRef: string
  paymentReference: string
  recipientName: string | null
  recipientEmail: string | null
  recipientStreet: string | null
  recipientHouseNumber: string | null
  recipientZipcode: string | null
  recipientCity: string | null
  amountTotal: number
  status: string | null
  description?: string | null
}) {
  const pdfLib = await import("pdf-lib").catch(() => null)
  if (!pdfLib) throw new Error("pdf_lib_missing")
  const { PDFDocument, StandardFonts, rgb } = pdfLib

  const { netAmount, vatAmount, grossAmount } = getFinancialAnalysisInvoiceBreakdownFromGrossAmount(input.amountTotal)
  const recipientStreetLine = [input.recipientStreet, input.recipientHouseNumber].filter(Boolean).join(" ").trim() || "-"
  const recipientCityLine = [input.recipientZipcode, input.recipientCity].filter(Boolean).join(" ").trim() || "-"
  const title = getFinancialAnalysisInvoiceTitle()
  const description = trimOrNull(input.description) ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const logoPath = path.join(process.cwd(), "public", "og.png")
  try {
    const logoBytes = new Uint8Array(await fs.readFile(logoPath))
    const logoImage = await pdfDoc.embedPng(logoBytes)
    page.drawImage(logoImage, { x: 40, y: 786, width: 110, height: 28 })
  } catch {}

  page.drawText(title, { x: 40, y: 740, size: 20, font: bold, color: rgb(0.06, 0.09, 0.16) })
  page.drawText(`Rechnungsnummer: ${input.invoiceNumber}`, { x: 40, y: 714, size: 10, font: bold })
  page.drawText(`Rechnungsdatum: ${formatDate(input.createdAt)}`, { x: 40, y: 698, size: 10, font })
  page.drawText(`Status: ${getFinancialAnalysisInvoiceStatusLabel(input.status)}`, { x: 40, y: 682, size: 10, font })

  page.drawText(FINANCIAL_ANALYSIS_INVOICE_COMPANY.name, { x: 40, y: 640, size: 11, font: bold })
  page.drawText(FINANCIAL_ANALYSIS_INVOICE_COMPANY.street, { x: 40, y: 624, size: 10, font })
  page.drawText(FINANCIAL_ANALYSIS_INVOICE_COMPANY.city, { x: 40, y: 608, size: 10, font })
  page.drawText(`E-Mail: ${FINANCIAL_ANALYSIS_INVOICE_COMPANY.email}`, { x: 40, y: 592, size: 10, font })
  page.drawText(`Telefon: ${FINANCIAL_ANALYSIS_INVOICE_COMPANY.phone}`, { x: 40, y: 576, size: 10, font })
  page.drawText(`USt-IdNr.: ${FINANCIAL_ANALYSIS_INVOICE_COMPANY.vatId}`, { x: 40, y: 560, size: 10, font })

  const recipientTop = 640
  page.drawText("Rechnung an", { x: 330, y: recipientTop, size: 11, font: bold })
  page.drawText(input.recipientName || "-", { x: 330, y: recipientTop - 16, size: 10, font })
  page.drawText(recipientStreetLine, { x: 330, y: recipientTop - 32, size: 10, font })
  page.drawText(recipientCityLine, { x: 330, y: recipientTop - 48, size: 10, font })
  page.drawText(input.recipientEmail || "-", { x: 330, y: recipientTop - 64, size: 10, font })
  page.drawText(`Fallnummer: ${input.caseRef}`, { x: 330, y: recipientTop - 80, size: 10, font })

  const summaryX = 330
  const summaryWidth = 225
  const summaryInset = 16
  const summaryRightX = summaryX + summaryWidth - summaryInset

  page.drawRectangle({ x: 40, y: 470, width: 515, height: 84, borderWidth: 1, borderColor: rgb(0.88, 0.9, 0.94) })
  page.drawText("Leistung", { x: 52, y: 535, size: 10, font: bold })
  drawRightAlignedText(page, bold, "Zwischensumme", summaryRightX, 535, 10)
  drawTextBlock(page, font, description, 52, 517, 10, 360, 13)
  drawRightAlignedText(page, bold, formatEuro(netAmount), summaryRightX, 517, 11)

  page.drawRectangle({
    x: summaryX,
    y: 410,
    width: summaryWidth,
    height: 56,
    borderWidth: 1,
    borderColor: rgb(0.88, 0.9, 0.94),
    color: rgb(0.995, 0.997, 1),
  })
  page.drawText("zzgl. MwSt.", { x: summaryX + summaryInset, y: 444, size: 10, font: bold })
  page.drawText(`${formatPercent(SCHUFA_FREE_PROVISION_VAT_RATE)} MwSt.`, {
    x: summaryX + summaryInset,
    y: 428,
    size: 10,
    font,
  })
  drawRightAlignedText(page, bold, formatEuro(vatAmount), summaryRightX, 436, 11)

  page.drawRectangle({
    x: summaryX,
    y: 358,
    width: summaryWidth,
    height: 36,
    color: rgb(0.06, 0.09, 0.16),
  })
  page.drawText("Gesamtbetrag", {
    x: summaryX + summaryInset,
    y: 371,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  })
  drawRightAlignedText(page, bold, formatEuro(grossAmount), summaryRightX, 371, 12, rgb(1, 1, 1))

  page.drawText("Bankverbindung", { x: 40, y: 392, size: 12, font: bold })
  page.drawText(`Kontoinhaber: ${FINANCIAL_ANALYSIS_INVOICE_BANK.accountHolder}`, { x: 40, y: 372, size: 10, font })
  page.drawText(`IBAN: ${FINANCIAL_ANALYSIS_INVOICE_BANK.iban}`, { x: 40, y: 356, size: 10, font })
  page.drawText(`BIC: ${FINANCIAL_ANALYSIS_INVOICE_BANK.bic}`, { x: 40, y: 340, size: 10, font })
  page.drawText(`Verwendungszweck: ${input.paymentReference}`, { x: 40, y: 324, size: 10, font })

  page.drawText("Hinweis zur Freischaltung", { x: 40, y: 286, size: 12, font: bold })
  let cursorY = drawTextBlock(
    page,
    font,
    "Der Service startet erst nach bestätigtem Zahlungseingang. Ab diesem Zeitpunkt wird der Zugang zur Finanzanalyse freigeschaltet und die 90-Tage-Laufzeit beginnt.",
    40,
    266,
    10,
    515,
    14
  )
  cursorY -= 8
  cursorY = drawTextBlock(page, font, FINANCIAL_ANALYSIS_LEGAL_NOTE, 40, cursorY, 10, 515, 14)
  cursorY -= 8
  drawTextBlock(
    page,
    font,
    "Bitte überweisen Sie den Rechnungsbetrag mit dem angegebenen Verwendungszweck. Sobald die Zahlung intern markiert wurde, können Unterlagen hochgeladen und die Analyse gestartet werden.",
    40,
    cursorY,
    10,
    515,
    14
  )

  page.drawText(`Registrierungsnummer: ${FINANCIAL_ANALYSIS_INVOICE_COMPANY.registrationNumber}`, {
    x: 40,
    y: 56,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.54),
  })

  return new Uint8Array(await pdfDoc.save())
}
