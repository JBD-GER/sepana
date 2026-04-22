import fs from "node:fs/promises"
import path from "node:path"
import type { PDFImage, PDFFont, PDFPage } from "pdf-lib"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import {
  SCHUFA_FREE_PROVISION_BANK,
  SCHUFA_FREE_PROVISION_COMPANY,
  buildSchufaFreeProvisionPaymentReference,
  formatEuro,
  getSchufaFreeProvisionInvoiceNumber,
} from "@/lib/schufa-frei/provisionInvoice"

type SignatureField = {
  id: string
  owner: "customer" | "advisor"
  type: "signature" | "checkbox" | "text"
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const PAGE_MARGIN_X = 40
const PAGE_TOP_Y = 748
const PAGE_CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2
const PAGE_BOTTOM_Y = 78

function formatDate(value?: string | null) {
  const raw = String(value ?? "").trim()
  const date = raw ? new Date(raw) : new Date()
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (!current || font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

function drawParagraph(
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
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color: rgb(0.12, 0.16, 0.22),
    })
    cursorY -= lineHeight
  }

  return cursorY
}

function toPercentField(input: SignatureField): SignatureField {
  return {
    ...input,
    x: (input.x / PAGE_WIDTH) * 100,
    y: ((PAGE_HEIGHT - input.y - input.height) / PAGE_HEIGHT) * 100,
    width: (input.width / PAGE_WIDTH) * 100,
    height: (input.height / PAGE_HEIGHT) * 100,
  }
}

function drawSlipField(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 9.5
) {
  page.drawText(value, {
    x: x + 2,
    y,
    size,
    font,
    color: rgb(0.15, 0.15, 0.15),
  })
}

function clearSlipArea(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
  })
}

function normalizeParagraphs(text: string) {
  return String(text ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

async function buildLogo(pdfDoc: PDFDocument) {
  const logoPath = path.join(process.cwd(), "public", "og.png")
  try {
    const logoBytes = new Uint8Array(await fs.readFile(logoPath))
    return await pdfDoc.embedPng(logoBytes)
  } catch {
    return null
  }
}

function createMandatePage(input: {
  pdfDoc: PDFDocument
  logo: PDFImage | null
  title: string
  subtitle?: string | null
  font: PDFFont
  bold: PDFFont
}) {
  const { pdfDoc, logo, title, subtitle, font, bold } = input
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  if (logo) {
    page.drawImage(logo, { x: PAGE_MARGIN_X, y: 786, width: 110, height: 28 })
  }

  page.drawText(title, {
    x: PAGE_MARGIN_X,
    y: PAGE_TOP_Y,
    size: 19,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  })

  if (subtitle) {
    page.drawText(subtitle, {
      x: PAGE_MARGIN_X,
      y: PAGE_TOP_Y - 18,
      size: 10,
      font,
      color: rgb(0.42, 0.46, 0.54),
    })
  }

  return page
}

function drawInfoCard(input: {
  page: PDFPage
  x: number
  y: number
  width: number
  title: string
  lines: string[]
  font: PDFFont
  bold: PDFFont
}) {
  const { page, x, y, width, title, lines, font, bold } = input
  const height = 26 + lines.length * 14 + 14

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0.86, 0.89, 0.93),
    color: rgb(0.98, 0.99, 1),
  })

  page.drawText(title, {
    x: x + 14,
    y: y - 18,
    size: 10.5,
    font: bold,
    color: rgb(0.09, 0.12, 0.18),
  })

  let lineY = y - 38
  for (const line of lines) {
    page.drawText(line, {
      x: x + 14,
      y: lineY,
      size: 9.5,
      font,
      color: rgb(0.16, 0.2, 0.28),
    })
    lineY -= 14
  }
}

export function buildSchufaFreeSeparateMandateLegalText() {
  const companyAddress = `${SCHUFA_FREE_PROVISION_COMPANY.name}, ${SCHUFA_FREE_PROVISION_COMPANY.street}, ${SCHUFA_FREE_PROVISION_COMPANY.city}`

  return `
Widerrufsbelehrung zum gesonderten Vermittlungsauftrag

Abschnitt 1

Widerrufsrecht

Sie können Ihre Vertragserklärung innerhalb von 14 Tagen ohne Angabe von Gründen mittels einer eindeutigen Erklärung widerrufen. Die Frist beginnt nach Abschluss des Vertrags und nachdem Sie die Vertragsbestimmungen einschließlich der Allgemeinen Geschäftsbedingungen sowie alle nachstehend unter Abschnitt 2 aufgeführten Informationen auf einem dauerhaften Datenträger (z. B. Brief, Telefax, E-Mail) erhalten haben. Zur Wahrung der Widerrufsfrist genügt die rechtzeitige Absendung des Widerrufs, wenn die Erklärung auf einem dauerhaften Datenträger erfolgt.

Der Widerruf ist zu richten an:

${companyAddress}

Abschnitt 2

Für den Beginn der Widerrufsfrist erforderliche Informationen

Die Informationen im Sinne des Abschnitts 1 Satz 2 umfassen folgende Angaben:

1. die Identität des Unternehmers; anzugeben ist auch das öffentliche Unternehmensregister, bei dem der Rechtsträger eingetragen ist, und die zugehörige Registernummer oder gleichwertige Kennung;
2. die Hauptgeschäftstätigkeit des Unternehmers und die für seine Zulassung zuständige Aufsichtsbehörde;
3. zur Anschrift:
   a. die ladungsfähige Anschrift des Unternehmers und jede andere Anschrift, die für die Geschäftsbeziehung zwischen dem Unternehmer und dem Verbraucher maßgeblich ist, bei juristischen Personen, Personenvereinigungen oder Personengruppen auch den Namen des Vertretungsberechtigten;
   b. jede andere Anschrift, die für die Geschäftsbeziehung zwischen dem Verbraucher und einem Vertreter des Unternehmers oder einer anderen gewerblich tätigen Person als dem Unternehmer, wenn der Verbraucher mit dieser Person geschäftlich zu tun hat, maßgeblich ist, bei juristischen Personen, Personenvereinigungen oder Personengruppen auch den Namen des Vertretungsberechtigten;
4. die wesentlichen Merkmale der Finanzdienstleistung sowie Informationen darüber, wie der Vertrag zustande kommt;
5. den Gesamtpreis der Finanzdienstleistung einschließlich aller damit verbundenen Preisbestandteile sowie alle über den Unternehmer abgeführten Steuern oder, wenn kein genauer Preis angegeben werden kann, seine Berechnungsgrundlage, die dem Verbraucher eine Überprüfung des Preises ermöglicht;
6. gegebenenfalls zusätzlich anfallende Kosten sowie einen Hinweis auf mögliche weitere Steuern oder Kosten, die nicht über den Unternehmer abgeführt oder von ihm in Rechnung gestellt werden;
7. Einzelheiten hinsichtlich der Zahlung und der Erfüllung;
8. das Bestehen oder Nichtbestehen eines Widerrufsrechts sowie die Bedingungen, Einzelheiten der Ausübung, insbesondere Name und Anschrift desjenigen, gegenüber dem der Widerruf zu erklären ist, und die Rechtsfolgen des Widerrufs einschließlich Informationen über den Betrag, den der Verbraucher im Fall des Widerrufs für die erbrachte Leistung zu zahlen hat, sofern er zur Zahlung von Wertersatz verpflichtet ist (zugrunde liegende Vorschrift: § 357a des Bürgerlichen Gesetzbuchs);
9. die Mindestlaufzeit des Vertrags, wenn dieser eine dauernde oder regelmäßig wiederkehrende Leistung zum Inhalt hat;
10. die vertraglichen Kündigungsbedingungen einschließlich etwaiger Vertragsstrafen;
11. die Mitgliedstaaten der Europäischen Union, deren Recht der Unternehmer der Aufnahme von Beziehungen zum Verbraucher vor Abschluss des Vertrags zugrunde legt;
12. eine Vertragsklausel über das auf den Vertrag anwendbare Recht oder über das zuständige Gericht;
13. die Sprachen, in denen die Vertragsbedingungen und die in dieser Widerrufsbelehrung genannten Vorabinformationen mitgeteilt werden, sowie die Sprachen, in denen sich der Unternehmer verpflichtet, mit Zustimmung des Verbrauchers die Kommunikation während der Laufzeit dieses Vertrags zu führen;
14. den Hinweis, ob der Verbraucher ein außergerichtliches Beschwerde- und Rechtsbehelfsverfahren, dem der Unternehmer unterworfen ist, nutzen kann, und gegebenenfalls dessen Zugangsvoraussetzungen.

Abschnitt 3

Widerrufsfolgen

Im Fall eines wirksamen Widerrufs sind die beiderseits empfangenen Leistungen zurückzugewähren.

Sie sind zur Zahlung von Wertersatz für die bis zum Widerruf erbrachte Dienstleistung verpflichtet, wenn Sie vor Abgabe Ihrer Vertragserklärung auf diese Rechtsfolge hingewiesen wurden und ausdrücklich zugestimmt haben, dass vor dem Ende der Widerrufsfrist mit der Ausführung der Gegenleistung begonnen werden kann. Besteht eine Verpflichtung zur Zahlung von Wertersatz, kann dies dazu führen, dass Sie die vertraglichen Zahlungsverpflichtungen für den Zeitraum bis zum Widerruf dennoch erfüllen müssen. Ihr Widerrufsrecht erlischt vorzeitig, wenn der Vertrag von beiden Seiten auf Ihren ausdrücklichen Wunsch vollständig erfüllt ist, bevor Sie Ihr Widerrufsrecht ausgeübt haben. Verpflichtungen zur Erstattung von Zahlungen müssen innerhalb von 30 Tagen erfüllt werden. Diese Frist beginnt für Sie mit der Absendung Ihrer Widerrufserklärung, für uns mit deren Empfang.

Ende der Widerrufsbelehrung
`
}

export async function fillSchufaFreeServiceProvisionSlipPdf(input: {
  originalBytes: Uint8Array
  amountTotal: number
  invoiceNumber?: string | null
  caseRef?: string | null
}) {
  const pdfDoc = await PDFDocument.load(input.originalBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const page = pdfDoc.getPages()[0]

  if (!page) return input.originalBytes

  const paymentReference =
    buildSchufaFreeProvisionPaymentReference(
      getSchufaFreeProvisionInvoiceNumber(input.invoiceNumber),
      String(input.caseRef ?? "").trim() || null
    ) ?? (getSchufaFreeProvisionInvoiceNumber(input.invoiceNumber) ?? "")

  // Remove the printed amount boxes entirely; they are not needed on this slip.
  clearSlipArea(page, 394, 118, 122, 30)
  clearSlipArea(page, 16, 120, 86, 26)

  drawSlipField(page, font, SCHUFA_FREE_PROVISION_BANK.accountHolder, 198, 232, 290, 9)
  drawSlipField(page, font, SCHUFA_FREE_PROVISION_BANK.iban, 198, 208, 240, 9)
  drawSlipField(page, font, SCHUFA_FREE_PROVISION_BANK.bic, 198, 180, 170, 9)

  if (paymentReference) {
    drawSlipField(page, font, paymentReference, 198, 134, 340, 8.5)
    drawSlipField(page, font, paymentReference, 21, 125, 118, 8.5)
  }

  return new Uint8Array(await pdfDoc.save())
}

export async function renderSchufaFreeSeparateMandatePdf(input: {
  caseRef: string
  amountTotal: number
  createdAt?: string | null
  customerName: string | null
  customerCity: string | null
  advisorName: string | null
  legalText?: string | null
}) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logo = await buildLogo(pdfDoc)
  const title = "Gesonderter Vermittlungsauftrag"
  const subtitle = `Fall ${input.caseRef} · Betrag laut Rechnung ${formatEuro(input.amountTotal)}`
  const fields: SignatureField[] = []

  let pageNumber = 1
  let currentPage = createMandatePage({
    pdfDoc,
    logo,
    title,
    subtitle,
    font,
    bold,
  })
  let cursorY = 694

  const advisorName = String(input.advisorName ?? "").trim() || "SEPANA"
  const customerName = String(input.customerName ?? "").trim() || "Auftraggeber"
  const customerCity = String(input.customerCity ?? "").trim() || "Ort"

  drawInfoCard({
    page: currentPage,
    x: PAGE_MARGIN_X,
    y: cursorY,
    width: 238,
    title: "Auftraggeber",
    lines: [customerName, `Ort: ${customerCity}`],
    font,
    bold,
  })
  drawInfoCard({
    page: currentPage,
    x: PAGE_MARGIN_X + 254,
    y: cursorY,
    width: 261,
    title: "Auftragnehmer",
    lines: [
      SCHUFA_FREE_PROVISION_COMPANY.name,
      SCHUFA_FREE_PROVISION_COMPANY.street,
      SCHUFA_FREE_PROVISION_COMPANY.city,
      `Vertreten durch ${advisorName}`,
    ],
    font,
    bold,
  })

  currentPage.drawRectangle({
    x: PAGE_MARGIN_X,
    y: 568,
    width: PAGE_CONTENT_WIDTH,
    height: 58,
    borderWidth: 1,
    borderColor: rgb(0.77, 0.86, 0.98),
    color: rgb(0.95, 0.98, 1),
  })
  currentPage.drawText("Pauschale laut Rechnung", {
    x: PAGE_MARGIN_X + 16,
    y: 606,
    size: 10,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  })
  currentPage.drawText(formatEuro(input.amountTotal), {
    x: PAGE_MARGIN_X + 16,
    y: 583,
    size: 18,
    font: bold,
    color: rgb(0.02, 0.36, 0.64),
  })
  drawParagraph(
    currentPage,
    font,
    "Fällig erst nach Kreditauszahlung und nach Ablauf des 14-tägigen Widerrufsrechts.",
    PAGE_MARGIN_X + 180,
    592,
    9.5,
    300,
    12
  )

  cursorY = 550

  const introParagraphs = [
    `Hiermit beauftrage ich die ${SCHUFA_FREE_PROVISION_COMPANY.name}, ${SCHUFA_FREE_PROVISION_COMPANY.street}, ${SCHUFA_FREE_PROVISION_COMPANY.city}, vertreten durch ${advisorName}, ergänzend zu dem bestehenden Darlehensvermittlungsvertrag mit der Beschaffung eines schufafreien Darlehens.`,
    `Der Auftraggeber zahlt für die erhaltenen Beratungs- und Vermittlungsleistungen in Bezug auf die Beschaffung eines schufafreien Darlehens eine pauschale Vergütung in Höhe von ${formatEuro(input.amountTotal)} an den Auftragnehmer.`,
    "Der Betrag ist erst mit Gewährung des Darlehens durch die finanzierende Bank zur Zahlung fällig und wird gegenüber dem Auftraggeber mittels gesonderter Rechnung abgerechnet.",
    "Die Vergütung deckt ausschließlich die Leistungen des Auftragnehmers ab und ist unabhängig von den weiteren Kosten und Gebühren des Kredites, die sich aus den vorvertraglichen Informationen der finanzierenden Bank ergeben.",
    "Der Auftrag kommt mit der Vornahme der Vermittlungsleistungen durch den Auftragnehmer zustande. Der Auftraggeber verzichtet auf den Zugang einer gesonderten Annahmeerklärung.",
  ]

  for (const paragraph of introParagraphs) {
    cursorY = drawParagraph(currentPage, font, paragraph, PAGE_MARGIN_X, cursorY, 10.4, PAGE_CONTENT_WIDTH, 15) - 10
  }

  const checkboxText =
    "Ich wurde über mein Widerrufsrecht informiert und bitte den Auftragnehmer ausdrücklich darum, umgehend mit der Bearbeitung meines Finanzierungswunsches zu beginnen. Mir ist bekannt, dass ich daher im Falle eines Widerrufs dieses Vertrages für die bis zum Widerruf erbrachten Leistungen gegebenenfalls Wertersatz zu zahlen habe."

  currentPage.drawRectangle({
    x: PAGE_MARGIN_X,
    y: cursorY - 10,
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: rgb(0.4, 0.45, 0.54),
  })
  fields.push(
    toPercentField({
      id: "customer_mandate_checkbox",
      label: "Widerrufsrecht bestätigt",
      owner: "customer",
      type: "checkbox",
      page: pageNumber,
      x: PAGE_MARGIN_X,
      y: cursorY - 10,
      width: 14,
      height: 14,
    })
  )
  cursorY = drawParagraph(currentPage, font, checkboxText, PAGE_MARGIN_X + 22, cursorY, 10, PAGE_CONTENT_WIDTH - 22, 14) - 18

  const legalParagraphs = normalizeParagraphs(input.legalText ?? buildSchufaFreeSeparateMandateLegalText())

  for (const paragraph of legalParagraphs) {
    const isHeading =
      /^widerrufsbelehrung/i.test(paragraph) ||
      /^abschnitt\s+\d/i.test(paragraph) ||
      /^widerrufsrecht$/i.test(paragraph) ||
      /^widerrufsfolgen$/i.test(paragraph) ||
      /^für den beginn/i.test(paragraph)

    const fontToUse = isHeading ? bold : font
    const size = isHeading ? 11.2 : 9.3
    const lineHeight = isHeading ? 16 : 13
    const minSpace = isHeading ? 76 : 48

    if (cursorY < PAGE_BOTTOM_Y + minSpace) {
      pageNumber += 1
      currentPage = createMandatePage({
        pdfDoc,
        logo,
        title,
        subtitle,
        font,
        bold,
      })
      cursorY = 712
    }

    cursorY =
      drawParagraph(currentPage, fontToUse, paragraph, PAGE_MARGIN_X, cursorY, size, PAGE_CONTENT_WIDTH, lineHeight) -
      (isHeading ? 6 : 4)
  }

  if (cursorY < PAGE_BOTTOM_Y + 90) {
    pageNumber += 1
    currentPage = createMandatePage({
      pdfDoc,
      logo,
      title,
      subtitle,
      font,
      bold,
    })
    cursorY = 712
  }

  currentPage.drawText("Ort, Datum", {
    x: PAGE_MARGIN_X,
    y: cursorY,
    size: 10,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  })
  currentPage.drawText(`${customerCity}, ${formatDate(input.createdAt)}`, {
    x: PAGE_MARGIN_X,
    y: cursorY - 22,
    size: 10,
    font,
    color: rgb(0.16, 0.2, 0.28),
  })
  currentPage.drawLine({
    start: { x: PAGE_MARGIN_X, y: cursorY - 26 },
    end: { x: 220, y: cursorY - 26 },
    thickness: 0.8,
    color: rgb(0.75, 0.78, 0.84),
  })

  currentPage.drawText("Unterschrift des Auftraggebers", {
    x: 280,
    y: cursorY,
    size: 10,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  })
  currentPage.drawLine({
    start: { x: 280, y: cursorY - 26 },
    end: { x: 540, y: cursorY - 26 },
    thickness: 0.8,
    color: rgb(0.75, 0.78, 0.84),
  })

  fields.push(
    toPercentField({
      id: "customer_mandate_signature",
      label: "Unterschrift Auftraggeber",
      owner: "customer",
      type: "signature",
      page: pageNumber,
      x: 280,
      y: cursorY - 24,
      width: 250,
      height: 28,
    })
  )

  return {
    bytes: new Uint8Array(await pdfDoc.save()),
    fields,
  }
}
