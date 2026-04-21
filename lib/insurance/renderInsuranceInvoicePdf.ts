import fs from "fs/promises"
import path from "path"
import type { Color, PDFFont, PDFPage } from "pdf-lib"
import {
  INSURANCE_PARTNER_VAT_RATE,
  formatEuro,
  formatPercent,
  getInsuranceInvoiceBreakdownFromGrossAmount,
  getInsuranceInvoiceStatusLabel,
} from "@/lib/insurance/invoice"
import { SCHUFA_FREE_PROVISION_COMPANY } from "@/lib/schufa-frei/provisionInvoice"

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

export async function renderInsuranceInvoicePdf(input: {
  invoiceNumber: string
  createdAt: string
  caseRef: string
  paymentReference: string
  recipientName: string | null
  recipientEmail: string | null
  partnerCode: string | null
  amountTotal: number
  status: string | null
  description: string | null
}) {
  const pdfLib = await import("pdf-lib").catch(() => null)
  if (!pdfLib) throw new Error("pdf_lib_missing")
  const { PDFDocument, StandardFonts, rgb } = pdfLib

  const breakdown = getInsuranceInvoiceBreakdownFromGrossAmount(input.amountTotal)
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

  page.drawText("Versicherungsprovisionsrechnung", {
    x: 40,
    y: 740,
    size: 20,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  })
  page.drawText(`Rechnungsnummer: ${input.invoiceNumber}`, { x: 40, y: 714, size: 10, font: bold })
  page.drawText(`Rechnungsdatum: ${formatDate(input.createdAt)}`, { x: 40, y: 698, size: 10, font })
  page.drawText(`Status: ${getInsuranceInvoiceStatusLabel(input.status)}`, { x: 40, y: 682, size: 10, font })

  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.name, { x: 40, y: 640, size: 11, font: bold })
  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.street, { x: 40, y: 624, size: 10, font })
  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.city, { x: 40, y: 608, size: 10, font })
  page.drawText(`E-Mail: ${SCHUFA_FREE_PROVISION_COMPANY.email}`, { x: 40, y: 592, size: 10, font })
  page.drawText(`Telefon: ${SCHUFA_FREE_PROVISION_COMPANY.phone}`, { x: 40, y: 576, size: 10, font })
  page.drawText(`USt-IdNr.: ${SCHUFA_FREE_PROVISION_COMPANY.vatId}`, { x: 40, y: 560, size: 10, font })

  const recipientTop = 640
  page.drawText("Rechnung an", { x: 330, y: recipientTop, size: 11, font: bold })
  page.drawText(input.recipientName || "-", { x: 330, y: recipientTop - 16, size: 10, font })
  page.drawText(input.recipientEmail || "-", { x: 330, y: recipientTop - 32, size: 10, font })
  page.drawText(`Fallnummer: ${input.caseRef}`, { x: 330, y: recipientTop - 48, size: 10, font })
  page.drawText(`Partner-ID: ${input.partnerCode || "-"}`, { x: 330, y: recipientTop - 64, size: 10, font })
  page.drawText(`Verwendungszweck: ${input.paymentReference || "-"}`, { x: 330, y: recipientTop - 80, size: 10, font })

  const summaryX = 330
  const summaryWidth = 225
  const summaryInset = 16
  const summaryRightX = summaryX + summaryWidth - summaryInset

  page.drawRectangle({ x: 40, y: 470, width: 515, height: 72, borderWidth: 1, borderColor: rgb(0.88, 0.9, 0.94) })
  page.drawText("Leistung", { x: 52, y: 523, size: 10, font: bold })
  drawRightAlignedText(page, bold, "Zwischensumme", summaryRightX, 523, 10)
  drawTextBlock(page, font, input.description || "Versicherungsprovision", 52, 505, 10, 360, 13)
  drawRightAlignedText(page, bold, formatEuro(breakdown.netAmount), summaryRightX, 505, 11)

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
  page.drawText(`${formatPercent(INSURANCE_PARTNER_VAT_RATE)} MwSt.`, {
    x: summaryX + summaryInset,
    y: 428,
    size: 10,
    font,
  })
  drawRightAlignedText(page, bold, formatEuro(breakdown.vatAmount), summaryRightX, 436, 11)

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
  drawRightAlignedText(page, bold, formatEuro(breakdown.grossAmount), summaryRightX, 371, 12, rgb(1, 1, 1))

  page.drawText("Hinweis", { x: 40, y: 286, size: 12, font: bold })
  let cursorY = 266
  cursorY = drawTextBlock(
    page,
    font,
    "Diese Rechnung dokumentiert die intern angelegte Versicherungsprovision fuer den weitergeleiteten Kredit-ohne-Schufa-Fall.",
    40,
    cursorY,
    10,
    515,
    14
  )
  cursorY -= 10
  cursorY = drawTextBlock(
    page,
    font,
    "Der eingegebene Betrag ist ein Bruttobetrag inklusive 19 % MwSt. und bleibt ausschliesslich im internen Backend sichtbar.",
    40,
    cursorY,
    10,
    515,
    14
  )

  page.drawText(`Registrierungsnummer: ${SCHUFA_FREE_PROVISION_COMPANY.registrationNumber}`, {
    x: 40,
    y: 56,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.54),
  })

  return new Uint8Array(await pdfDoc.save())
}
