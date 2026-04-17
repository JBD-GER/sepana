type RequestSummary = {
  title?: string | null
  required?: boolean | null
}

const SCHUFA_FREE_IBAN_PROOF_LABEL = "IBAN-Nachweis (Foto von der Karte)"
const SCHUFA_FREE_REGISTRATION_CERTIFICATE_LABEL = "Meldebescheinigung"

export const DEFAULT_SCHUFA_FREE_IMPORTANT_DOCUMENTS = [
  "Personalausweis oder Reisepass",
  "Letzte 3 Gehaltsabrechnungen",
  "Kontoauszuege der letzten 3 Monate",
  SCHUFA_FREE_IBAN_PROOF_LABEL,
]

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeTitleKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isSchufaFreeRegistrationCertificate(value: unknown) {
  return normalizeTitleKey(value) === "meldebescheinigung"
}

function isSchufaFreeIbanProof(value: unknown) {
  const normalized = normalizeTitleKey(value)
  return normalized === "iban nachweis ec karte" || normalized === "iban nachweis oder ec karte"
}

export function getSchufaFreeDocumentDisplayTitle(value: unknown) {
  if (isSchufaFreeIbanProof(value)) return SCHUFA_FREE_IBAN_PROOF_LABEL
  if (isSchufaFreeRegistrationCertificate(value)) return SCHUFA_FREE_REGISTRATION_CERTIFICATE_LABEL
  return trimOrNull(value)
}

export function getSchufaFreeDocumentRequired(value: unknown, required: boolean | null | undefined) {
  if (isSchufaFreeRegistrationCertificate(value)) return false
  return Boolean(required)
}

export function normalizeSchufaFreeDocumentRequest<T extends RequestSummary>(request: T): T {
  return {
    ...request,
    title: getSchufaFreeDocumentDisplayTitle(request?.title) ?? request?.title ?? null,
    required: getSchufaFreeDocumentRequired(request?.title, request?.required),
  }
}

function uniqueTitles(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const items: string[] = []

  for (const value of values) {
    const title = trimOrNull(value)
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(title)
  }

  return items
}

export function deriveImportantSchufaFreeDocuments(
  requests: RequestSummary[] | null | undefined,
  maxItems = 5
) {
  const normalizedRequests = (Array.isArray(requests) ? requests : []).map(normalizeSchufaFreeDocumentRequest)
  const requiredTitles = uniqueTitles(
    normalizedRequests.filter((request) => Boolean(request?.required)).map((request) => request.title)
  )

  if (requiredTitles.length) {
    return requiredTitles.slice(0, Math.max(1, maxItems))
  }

  return DEFAULT_SCHUFA_FREE_IMPORTANT_DOCUMENTS.slice(0, Math.max(1, maxItems))
}
