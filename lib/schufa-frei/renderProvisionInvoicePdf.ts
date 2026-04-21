import fs from "fs/promises"
import path from "path"
import type { Color, PDFFont, PDFPage } from "pdf-lib"
import {
  SCHUFA_FREE_PROVISION_BANK,
  SCHUFA_FREE_PROVISION_COMPANY,
  SCHUFA_FREE_PROVISION_VAT_RATE,
  buildLegacySchufaFreeProvisionCancellationDescription,
  buildLegacySchufaFreeProvisionDescription,
  buildSchufaFreeProvisionCancellationDescription,
  buildSchufaFreeProvisionDescription,
  formatEuro,
  formatPercent,
  getSchufaFreeProvisionBreakdown,
  getSchufaFreeProvisionBreakdownFromGrossAmount,
  getSchufaFreeProvisionInvoiceTitle,
  getSchufaFreeProvisionRefundLines,
  getSchufaFreeProvisionStatusLabel,
  getSchufaFreeServiceFeeInfoLines,
  isInternalSchufaFreeProvisionInvoiceType,
  isLegacySchufaFreeProvisionCancellationInvoiceType,
  isLegacySchufaFreeProvisionInvoiceType,
  isSchufaFreeProvisionCancellationInvoiceType,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"

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

export async function renderSchufaFreeProvisionInvoicePdf(input: {
  invoiceNumber: string
  createdAt: string
  caseRef: string
  paymentReference: string
  recipientName: string | null
  recipientEmail: string | null
  recipientStreet: string | null
  recipientHouseNumber: string | null
  recipientZipcode: string | null
  recipientCity: string | null
  loanAmount: number
  amountTotal: number
  status: string | null
  invoiceType?: string | null
  description?: string | null
}) {
  const pdfLib = await import("pdf-lib").catch(() => null)
  if (!pdfLib) throw new Error("pdf_lib_missing")
  const { PDFDocument, StandardFonts, rgb } = pdfLib

  const isCancellation = isSchufaFreeProvisionCancellationInvoiceType(input.invoiceType)
  const isLegacyAdvanceInvoice =
    isLegacySchufaFreeProvisionInvoiceType(input.invoiceType) ||
    isLegacySchufaFreeProvisionCancellationInvoiceType(input.invoiceType)
  const fallbackAmountTotal = Math.abs(Number(input.amountTotal ?? 0))
  const amountBreakdown = isLegacyAdvanceInvoice
    ? getSchufaFreeProvisionBreakdown(input.loanAmount)
    : getSchufaFreeProvisionBreakdownFromGrossAmount(fallbackAmountTotal)
  const { netAmount, vatAmount, grossAmount } = amountBreakdown
  const absoluteTotalAmount = grossAmount > 0 ? grossAmount : fallbackAmountTotal
  const displayNetAmount = isCancellation ? -Math.abs(netAmount) : netAmount
  const displayVatAmount = isCancellation ? -Math.abs(vatAmount) : vatAmount
  const displayTotalAmount = isCancellation ? -Math.abs(absoluteTotalAmount) : absoluteTotalAmount
  const recipientStreetLine = [input.recipientStreet, input.recipientHouseNumber].filter(Boolean).join(" ").trim() || "-"
  const recipientCityLine = [input.recipientZipcode, input.recipientCity].filter(Boolean).join(" ").trim() || "-"
  const title = getSchufaFreeProvisionInvoiceTitle(input.invoiceType)
  const description =
    trimOrNull(input.description) ??
    (isCancellation
      ? isLegacyAdvanceInvoice
        ? buildLegacySchufaFreeProvisionCancellationDescription({ loanAmount: input.loanAmount })
        : buildSchufaFreeProvisionCancellationDescription({ amountTotal: absoluteTotalAmount })
      : isLegacyAdvanceInvoice
        ? buildLegacySchufaFreeProvisionDescription(input.loanAmount)
        : buildSchufaFreeProvisionDescription(absoluteTotalAmount))

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
  page.drawText(`Status: ${getSchufaFreeProvisionStatusLabel(input.status, input.invoiceType)}`, { x: 40, y: 682, size: 10, font })

  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.name, { x: 40, y: 640, size: 11, font: bold })
  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.street, { x: 40, y: 624, size: 10, font })
  page.drawText(SCHUFA_FREE_PROVISION_COMPANY.city, { x: 40, y: 608, size: 10, font })
  page.drawText(`E-Mail: ${SCHUFA_FREE_PROVISION_COMPANY.email}`, { x: 40, y: 592, size: 10, font })
  page.drawText(`Telefon: ${SCHUFA_FREE_PROVISION_COMPANY.phone}`, { x: 40, y: 576, size: 10, font })
  page.drawText(`USt-IdNr.: ${SCHUFA_FREE_PROVISION_COMPANY.vatId}`, { x: 40, y: 560, size: 10, font })

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

  page.drawRectangle({ x: 40, y: 470, width: 515, height: 72, borderWidth: 1, borderColor: rgb(0.88, 0.9, 0.94) })
  page.drawText("Leistung", { x: 52, y: 523, size: 10, font: bold })
  drawRightAlignedText(page, bold, "Zwischensumme", summaryRightX, 523, 10)
  drawTextBlock(page, font, description, 52, 505, 10, 360, 13)
  drawRightAlignedText(page, bold, formatEuro(displayNetAmount), summaryRightX, 505, 11)

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
  drawRightAlignedText(page, bold, formatEuro(displayVatAmount), summaryRightX, 436, 11)

  page.drawRectangle({
    x: summaryX,
    y: 358,
    width: summaryWidth,
    height: 36,
    color: isCancellation ? rgb(0.55, 0.11, 0.11) : rgb(0.06, 0.09, 0.16),
  })
  page.drawText("Gesamtbetrag", {
    x: summaryX + summaryInset,
    y: 371,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  })
  drawRightAlignedText(page, bold, formatEuro(displayTotalAmount), summaryRightX, 371, 12, rgb(1, 1, 1))

  const detailsTitleY = isCancellation ? 318 : 392
  const detailsLine1Y = isCancellation ? 298 : 372
  const detailsLine2Y = isCancellation ? 282 : 356
  const detailsLine3Y = isCancellation ? 266 : 340
  const noticeTitleY = isCancellation ? 208 : 286
  const noticeBodyY = isCancellation ? 188 : 266

  if (isCancellation) {
    page.drawText("Stornierung", { x: 40, y: detailsTitleY, size: 12, font: bold })
    page.drawText("Keine Zahlung mehr erforderlich.", { x: 40, y: detailsLine1Y, size: 10, font })
    page.drawText(
      isLegacyAdvanceInvoice
        ? "Diese Stornorechnung hebt die vorherige Vorauszahlungsrechnung auf."
        : "Diese Stornorechnung hebt die interne Servicepauschalenrechnung auf.",
      { x: 40, y: detailsLine2Y, size: 10, font }
    )
    page.drawText("Die zugehoerige Kreditanfrage wurde ebenfalls storniert.", { x: 40, y: detailsLine3Y, size: 10, font })
  } else {
    page.drawText("Bankverbindung", { x: 40, y: detailsTitleY, size: 12, font: bold })
    page.drawText(`Kontoinhaber: ${SCHUFA_FREE_PROVISION_BANK.accountHolder}`, { x: 40, y: detailsLine1Y, size: 10, font })
    page.drawText(`IBAN: ${SCHUFA_FREE_PROVISION_BANK.iban}`, { x: 40, y: detailsLine2Y, size: 10, font })
    page.drawText(`BIC: ${SCHUFA_FREE_PROVISION_BANK.bic}`, { x: 40, y: detailsLine3Y, size: 10, font })
    page.drawText(`Verwendungszweck: ${input.paymentReference}`, { x: 40, y: 324, size: 10, font })
  }

  const noticeTitle = isCancellation
    ? "Hinweis zur Stornierung"
    : isInternalSchufaFreeProvisionInvoiceType(input.invoiceType)
      ? "Hinweis zur Servicepauschale"
      : "Hinweis zur Vorauszahlung"

  page.drawText(noticeTitle, { x: 40, y: noticeTitleY, size: 12, font: bold })
  let cursorY = noticeBodyY
  cursorY = drawTextBlock(
    page,
    font,
    isCancellation
      ? isLegacyAdvanceInvoice
        ? "Diese Stornorechnung dokumentiert die Aufhebung der vorherigen Vorauszahlungsrechnung. Die Kreditanfrage wird damit nicht weiterbearbeitet."
        : "Diese Stornorechnung dokumentiert die Aufhebung der intern angelegten Servicepauschale. Die Kreditanfrage wird damit nicht weiterbearbeitet."
      : isInternalSchufaFreeProvisionInvoiceType(input.invoiceType)
        ? "Diese Rechnung dokumentiert die intern angelegte Servicepauschale vor Vertragsunterzeichnung. Der Gesamtbetrag enthaelt 19 % MwSt."
        : "Diese Rechnung betrifft eine Vorauszahlung auf die Serviceprovision. Der Ueberweisungsbetrag enthaelt 19 % MwSt. Der Vertragsversand erfolgt erst nach bestaetigtem Zahlungseingang.",
    40,
    cursorY,
    10,
    515,
    14
  )
  cursorY -= 10

  const infoLines = isInternalSchufaFreeProvisionInvoiceType(input.invoiceType)
    ? getSchufaFreeServiceFeeInfoLines()
    : getSchufaFreeProvisionRefundLines()

  for (const line of infoLines) {
    cursorY = drawTextBlock(page, font, `- ${line}`, 50, cursorY, 10, 500, 14) - 4
  }

  page.drawText(`Registrierungsnummer: ${SCHUFA_FREE_PROVISION_COMPANY.registrationNumber}`, {
    x: 40,
    y: 56,
    size: 9,
    font,
    color: rgb(0.39, 0.45, 0.54),
  })

  return new Uint8Array(await pdfDoc.save())
}
