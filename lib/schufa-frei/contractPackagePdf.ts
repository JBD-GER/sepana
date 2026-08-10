import type { SchufaFreeContractPackageLayout } from "@/lib/schufa-frei/contractPackage"

const BROKERAGE_MANDATE_SEARCH_KEY = "kreditvermittlungsauftrag"
const LEGACY_ASSIGNMENT_HEADING = "$%75(781*6(5./b581*"

const LEGACY_SIGMA_HEADING_CHARACTERS = new Map<string, string>([
  ["<", "k"],
  ["Z", "r"],
  ["\u001b", "e"],
  ["\u001c", "e"],
  ["\u0018", "d"],
  ["/", "i"],
  ["d", "t"],
  ["s", "v"],
  ["D", "m"],
  [">", "l"],
  ["h", "u"],
  ["E", "n"],
  ["'", "g"],
  ["^", "s"],
  ["\u0004", "a"],
  ["&", "f"],
])

const LEGACY_SIGMA_BODY_CHARACTERS = new Map<string, string>([
  ["\u0003", " "],
  ["\u0018", "d"],
  ["h", "u"],
  ["s", "v"],
  ["<", "k"],
  ["/", "i"],
  ["Ğ", "e"],
  ["ƌ", "r"],
  ["ŵ", "m"],
  ["ŝ", "i"],
  ["ƚ", "t"],
  ["ů", "l"],
  ["Ŷ", "n"],
  ["Ɛ", "s"],
  ["Đ", "c"],
  ["Ś", "h"],
  ["Ĩ", "f"],
  ["Ƶ", "u"],
  ["Ě", "d"],
  ["ď", "b"],
  ["Ă", "a"],
  ["Ő", "g"],
  ["Ž", "o"],
  ["ǀ", "v"],
  ["ǌ", "z"],
  ["ǁ", "w"],
])

function compactPdfSearchText(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
}

function isLegacySigmaBrokerageHeading(value: string) {
  const compact = value.replace(/[ \t\r\n]+/g, "")
  const decoded = Array.from(compact, (character) => LEGACY_SIGMA_HEADING_CHARACTERS.get(character) ?? "").join("")
  return decoded === BROKERAGE_MANDATE_SEARCH_KEY
}

function decodeLegacySigmaBodyText(value: string) {
  return Array.from(value, (character) => LEGACY_SIGMA_BODY_CHARACTERS.get(character) ?? character).join("")
}

function isLegacySigmaBrokeragePage(textItems: string[]) {
  const decoded = compactPdfSearchText(textItems.map(decodeLegacySigmaBodyText).join(" "))
  return (
    decoded.includes("derkundebeauftragt") &&
    decoded.includes("unterschriftkunde") &&
    decoded.includes("unterschriftvermittler")
  )
}

type PdfTextItem = {
  str: string
  transform: number[] | null
}

function isCustomerSignatureLabel(value: string) {
  const plain = compactPdfSearchText(value)
  const legacy = compactPdfSearchText(decodeLegacySigmaBodyText(value))
  return plain.includes("unterschriftkunde") || legacy.includes("unterschriftkunde")
}

function isInsurancePage(textItems: string[]) {
  const searchable = compactPdfSearchText(textItems.join(" "))
  return (
    searchable.includes("ratenausfallschutz") &&
    searchable.includes("sepalastschriftmandat") &&
    searchable.includes("einrichtungdauerauftrag")
  )
}

function isServiceFeePage(textItems: string[]) {
  const values = textItems.map((value) => value.replace(/\s+/g, "").trim()).filter(Boolean)
  const amountCounts = new Map<string, number>()

  for (const value of values) {
    if (!/^\d+(?:\.\d{3})*,\d{2}$/.test(value)) continue
    amountCounts.set(value, (amountCounts.get(value) ?? 0) + 1)
  }

  const hasRepeatedAmount = Array.from(amountCounts.values()).some((count) => count >= 2)
  const hasAccountNumber = values.some((value) => /^\d{20}$/.test(value))
  const hasDate = values.some((value) => /^\d{2}\.\d{2}\.\d{4}$/.test(value))
  return hasRepeatedAmount && hasAccountNumber && hasDate
}

function isPrecontractStartPage(textItems: string[]) {
  const plain = compactPdfSearchText(textItems.join(" "))
  const legacy = compactPdfSearchText(textItems.map(decodeLegacySigmaBodyText).join(" "))
  return plain.includes("vorvertraglicheinformationen") || legacy.includes("vorvertraglicheinformationen")
}

function uniquePages(pages: number[]) {
  return Array.from(new Set(pages)).sort((left, right) => left - right)
}

function requireSinglePage(pages: number[], label: string) {
  const unique = uniquePages(pages)
  if (unique.length !== 1) {
    throw new Error(
      unique.length === 0 ? `${label} wurde im PDF nicht gefunden.` : `${label} wurde im PDF mehrfach gefunden.`
    )
  }
  return unique[0]
}

export async function detectSchufaFreeContractPackageLayout(
  pdfBytes: Uint8Array
): Promise<SchufaFreeContractPackageLayout> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes.slice(),
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const headingMatches: Array<{ page: number; customerSignatureLabel: PdfTextItem | null; width: number; height: number }> = []
  const templateMatches: Array<{ page: number; customerSignatureLabel: PdfTextItem | null; width: number; height: number }> = []
  const insuranceMatches: number[] = []
  const serviceFeeMatches: number[] = []
  const assignmentAliasMatches: number[] = []
  const assignmentTextMatches: number[] = []
  const precontractMatches: number[] = []

  try {
    if (pdf.numPages !== 17 && pdf.numPages !== 19) {
      throw new Error(
        `Das hochgeladene Dokument hat ${pdf.numPages} Seiten. Unterstützt werden 17- und 19-seitige Vertragspakete.`
      )
    }

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const items: PdfTextItem[] = (Array.isArray(content.items) ? content.items : [])
        .map((item: unknown) => {
          const value = (item as { str?: unknown }).str
          const transform = (item as { transform?: unknown }).transform
          return {
            str: typeof value === "string" ? value : "",
            transform: Array.isArray(transform) ? transform.map(Number) : null,
          }
        })
        .filter((item) => Boolean(item.str))
      const textItems = items.map((item) => item.str)

      const searchablePageText = compactPdfSearchText(textItems.join(" "))
      const hasHeading =
        searchablePageText.includes(BROKERAGE_MANDATE_SEARCH_KEY) || textItems.some(isLegacySigmaBrokerageHeading)

      const [viewX1, viewY1, viewX2, viewY2] = page.view
      const pageWidth = Math.abs(viewX2 - viewX1)
      const pageHeight = Math.abs(viewY2 - viewY1)
      const customerSignatureLabel = items.find((item) => isCustomerSignatureLabel(item.str)) ?? null

      if (hasHeading) {
        headingMatches.push({ page: pageNumber, customerSignatureLabel, width: pageWidth, height: pageHeight })
      } else if (isLegacySigmaBrokeragePage(textItems)) {
        templateMatches.push({ page: pageNumber, customerSignatureLabel, width: pageWidth, height: pageHeight })
      }

      if (isInsurancePage(textItems)) insuranceMatches.push(pageNumber)
      if (isServiceFeePage(textItems)) serviceFeeMatches.push(pageNumber)
      if (textItems.some((value) => value.trim() === LEGACY_ASSIGNMENT_HEADING)) {
        assignmentAliasMatches.push(pageNumber)
      }
      if (textItems.some((value) => compactPdfSearchText(value) === "abtretungserklarung")) {
        assignmentTextMatches.push(pageNumber)
      }
      if (isPrecontractStartPage(textItems)) precontractMatches.push(pageNumber)
    }

    const brokerageMatches = headingMatches.length ? headingMatches : templateMatches
    if (brokerageMatches.length !== 1) {
      throw new Error(
        brokerageMatches.length === 0
          ? "Der Kreditvermittlungsauftrag wurde im PDF nicht gefunden."
          : "Der Kreditvermittlungsauftrag wurde im PDF mehrfach gefunden."
      )
    }
    const brokerageMatch = brokerageMatches[0]

    const transform = brokerageMatch.customerSignatureLabel?.transform
    const labelX = Number(transform?.[4])
    const labelY = Number(transform?.[5])
    if (
      !Number.isFinite(labelX) ||
      !Number.isFinite(labelY) ||
      brokerageMatch.width <= 0 ||
      brokerageMatch.height <= 0
    ) {
      throw new Error("Das Kunden-Unterschriftsfeld im Kreditvermittlungsauftrag wurde nicht eindeutig gefunden.")
    }

    const insurancePages = uniquePages(insuranceMatches)
    if (insurancePages.length > 1) throw new Error("Der Ratenschutz wurde im PDF mehrfach gefunden.")
    const insurancePage = insurancePages[0] ?? null
    const serviceFeePage = requireSinglePage(serviceFeeMatches, "Die Serviceprovision")
    const precontractPageFrom = requireSinglePage(precontractMatches, "Der Beginn der vorvertraglichen Informationen")

    const assignmentAliasPages = uniquePages(assignmentAliasMatches)
    if (assignmentAliasPages.length > 1) throw new Error("Die Abtretungserklärung wurde im PDF mehrfach gefunden.")

    let assignmentPageFrom = assignmentAliasPages[0] ?? null
    if (!assignmentPageFrom) {
      const assignmentTextPages = uniquePages(assignmentTextMatches)
      if (assignmentTextPages.length) {
        const firstTextPage = assignmentTextPages[0]
        assignmentPageFrom = firstTextPage === precontractPageFrom - 1 ? firstTextPage - 1 : firstTextPage
      }
    }

    const precedingOptionalPage = insurancePage ?? brokerageMatch.page
    const structureIsValid =
      brokerageMatch.page >= 2 &&
      precedingOptionalPage >= brokerageMatch.page &&
      serviceFeePage === precedingOptionalPage + 1 &&
      (assignmentPageFrom
        ? assignmentPageFrom === serviceFeePage + 2 && precontractPageFrom === assignmentPageFrom + 2
        : precontractPageFrom === serviceFeePage + 2) &&
      precontractPageFrom <= pdf.numPages

    if (!structureIsValid) {
      throw new Error("Die Reihenfolge der Vertragsunterlagen konnte nicht eindeutig erkannt werden.")
    }

    const labelTop = ((brokerageMatch.height - labelY) / brokerageMatch.height) * 100
    return {
      pageCount: pdf.numPages,
      brokerageMandatePage: brokerageMatch.page,
      brokerageMandateField: {
        x: (labelX / brokerageMatch.width) * 100,
        y: Math.max(0, Math.min(94, labelTop - 7.5)),
        width: 32,
        height: 6,
      },
      insurancePage,
      serviceFeePage,
      assignmentPageFrom,
      precontractPageFrom,
    }
  } finally {
    await pdf.destroy()
  }
}
