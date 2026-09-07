import { readFile } from "node:fs/promises"
import path from "node:path"
import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont } from "pdf-lib"
import type { AgreementDocument, SignatureStroke } from "./partnershipAgreement"

export async function renderPartnershipAgreementPdf(input: {
  document: AgreementDocument
  signedAt: string
  documentHash: string
  signature: SignatureStroke[]
}) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "lib/tippgeber/fonts/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "lib/tippgeber/fonts/NotoSans-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/og.png")),
  ])
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const bold = await pdf.embedFont(boldBytes, { subset: true })
  const logo = await pdf.embedPng(logoBytes)
  const logoSize = logo.scaleToFit(120, 30)
  const { document, signedAt, documentHash, signature } = input
  pdf.setTitle(document.title)
  pdf.setAuthor(document.provider.name)
  pdf.setSubject(`Vertragsfassung ${document.version}`)
  pdf.setCreationDate(new Date(signedAt))
  pdf.setModificationDate(new Date(signedAt))

  const ink = rgb(0.09, 0.15, 0.22)
  const muted = rgb(0.36, 0.42, 0.47)
  const margin = 48
  const width = 595.28
  const height = 841.89
  const contentWidth = width - margin * 2
  let page = pdf.addPage([width, height])
  let y = height - 93

  function addPage() {
    page = pdf.addPage([width, height])
    y = height - 93
  }
  function ensure(space: number) {
    if (y - space < 62) addPage()
  }
  function lines(text: string, font: PDFFont, size: number) {
    const result: string[] = []
    let line = ""
    // Split overlong tokens too (email addresses and company names).
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= contentWidth) { line = candidate; continue }
      if (line) result.push(line)
      line = ""
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > contentWidth) { result.push(line); line = "" }
        line += char
      }
    }
    if (line) result.push(line)
    return result
  }
  function text(value: string, options: { font?: PDFFont; size?: number; gap?: number } = {}) {
    const font = options.font ?? regular
    const size = options.size ?? 9.4
    const leading = size * 1.5
    const wrapped = lines(value, font, size)
    // Keep short blocks together and avoid a single orphaned first line.
    ensure(Math.min(wrapped.length, 3) * leading)
    for (const line of wrapped) {
      ensure(leading)
      page.drawText(line, { x: margin, y, size, font, color: ink })
      y -= leading
    }
    y -= options.gap ?? 8
  }

  text("Partnerschaftsvertrag", { font: bold, size: 24, gap: 0 })
  text("Baufinanzierung · Lead-Zusammenarbeit", { size: 13, gap: 18 })
  text("25 % der erhaltenen Provision einschließlich gegebenenfalls anfallender Umsatzsteuer", { font: bold, size: 11, gap: 18 })
  text("VERTRAGSPARTEIEN", { font: bold, size: 9, gap: 5 })
  text(`${document.provider.name} · ${document.provider.street} · ${document.provider.city}`, { font: bold, gap: 2 })
  text(document.provider.email, { gap: 12 })
  text(document.partner.companyName, { font: bold, gap: 2 })
  text(`${document.partner.street} ${document.partner.houseNumber} · ${document.partner.zip} ${document.partner.city}`, { gap: 2 })
  text(`Vertreten durch: ${document.partner.signerName}`, { gap: 2 })
  text(`E-Mail: ${document.partner.email}`, { gap: 18 })

  for (const section of document.sections) {
    ensure(75)
    text(section.title, { font: bold, size: 11, gap: 6 })
    for (const paragraph of section.paragraphs) text(paragraph)
    y -= 5
  }

  ensure(260)
  text("Elektronische Annahme und Unterschrift", { font: bold, size: 13 })
  text(document.acceptanceText)
  text(`${document.partner.signerName} für ${document.partner.companyName}`, { font: bold })
  const displayDate = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long", timeStyle: "long", timeZone: "Europe/Berlin",
  }).format(new Date(signedAt))
  text(`Unterzeichnet am ${displayDate}`, { gap: 6 })
  const signatureWidth = 280
  const signatureHeight = 88
  page.drawRectangle({ x: margin, y: y - signatureHeight, width: signatureWidth, height: signatureHeight, color: rgb(0.96, 0.98, 0.97) })
  for (const stroke of signature) {
    for (let i = 1; i < stroke.length; i++) {
      page.drawLine({
        start: { x: margin + 8 + stroke[i - 1].x * (signatureWidth - 16), y: y - 6 - stroke[i - 1].y * (signatureHeight - 12) },
        end: { x: margin + 8 + stroke[i].x * (signatureWidth - 16), y: y - 6 - stroke[i].y * (signatureHeight - 12) },
        thickness: 1.3, color: ink,
      })
    }
  }
  y -= signatureHeight + 17
  text(`Partnerkonto: ${document.partner.userId}`, { size: 8, gap: 3 })
  text(`Vertragsfassung: ${document.version} · Zustimmung im angemeldeten Partnerkonto bestätigt.`, { size: 8, gap: 3 })
  text(`Prüfsumme des angenommenen Vertrags (SHA-256): ${documentHash}`, { size: 7.3 })

  const pages = pdf.getPages()
  pages.forEach((current, index) => {
    current.drawImage(logo, { x: margin, y: height - 48, ...logoSize })
    current.drawText("PARTNERSCHAFT · BAUFINANZIERUNG", { x: 290, y: height - 40, size: 8, font: bold, color: muted })
    current.drawLine({ start: { x: margin, y: height - 57 }, end: { x: width - margin, y: height - 57 }, thickness: 0.6, color: rgb(0.83, 0.89, 0.86) })
    current.drawText(`Fassung ${document.version} | Elektronisch unterzeichnet`, { x: margin, y: 35, size: 7.5, font: regular, color: muted })
    current.drawText(`${index + 1} / ${pages.length}`, { x: width - margin - 30, y: 35, size: 8, font: bold, color: muted })
  })
  return pdf.save()
}
