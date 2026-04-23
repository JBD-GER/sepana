import { PDFDocument } from "pdf-lib"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeSchufaFreeDocumentRequest } from "@/lib/schufa-frei/documentRecommendations"
import { getSchufaFreeSignatureRequestMeta, isSignatureRequestComplete } from "@/lib/schufa-frei/contractPackage"
import { renderSignedPdf } from "@/lib/signatures/renderSignedPdf"

type AdminClient = SupabaseClient

type DocumentRequestRow = {
  id?: string | null
  title?: string | null
  required?: boolean | null
  created_at?: string | null
}

type CaseDocumentRow = {
  id?: string | null
  request_id?: string | null
  signature_request_id?: string | null
  document_kind?: string | null
  file_name?: string | null
  file_path?: string | null
  mime_type?: string | null
  created_at?: string | null
}

type SignatureRequestRow = {
  id?: string | null
  title?: string | null
  requires_wet_signature?: boolean | null
  fields?: SignatureFieldRow[] | null
  advisor_signed_at?: string | null
  customer_signed_at?: string | null
  status?: string | null
  created_at?: string | null
}

type SignatureFieldRow = {
  id?: string | null
  owner?: string | null
  type?: string | null
  label?: string | null
  page?: number | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
}

type SignatureValueRow = {
  request_id?: string | null
  actor_id?: string | null
  values?: Record<string, unknown> | null
}

type ProfileRoleRow = {
  user_id?: string | null
  role?: string | null
}

type BundleBinary = {
  label: string
  fileName: string
  bytes: Uint8Array
  mimeType: string | null
}

type BundleSource = {
  order: number
  label: string
  optional: boolean
  binary: BundleBinary
}

type SignatureValuesByRole = {
  advisor?: Record<string, unknown>
  customer?: Record<string, unknown>
}

export type SchufaFreeBankSubmissionBuildResult =
  | {
      ok: true
      pdfBytes: Uint8Array
      fileName: string
      included: string[]
      missing: string[]
    }
  | {
      ok: false
      included: string[]
      missing: string[]
    }

const REQUEST_ORDER = new Map<string, number>([
  [normalizeTitleKey("Personalausweis / Reisepass (Vorder- & Rueckseite)"), 10],
  [normalizeTitleKey("Meldebescheinigung"), 20],
  [normalizeTitleKey("Letzte 3 Gehaltsabrechnungen"), 30],
  [normalizeTitleKey("Kontoauszug vom Gehaltseingang"), 40],
  [normalizeTitleKey("Kontoauszuege der letzten 3 Monate vom Gehaltskonto (Gehaltseingang sichtbar)"), 40],
  [normalizeTitleKey("IBAN-Nachweis (Foto von der Karte)"), 50],
  [normalizeTitleKey("Weitere Unterlagen laut Pruefung"), 90],
  [normalizeTitleKey("Rechtliche Unterlagen"), 90],
])

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
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function safeFileName(value: string) {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function fileExt(fileName: string | null | undefined) {
  const raw = String(fileName ?? "")
  const index = raw.lastIndexOf(".")
  if (index < 0) return ""
  return raw.slice(index + 1).trim().toLowerCase()
}

function inferMimeType(mimeType: string | null | undefined, fileName: string | null | undefined) {
  const explicit = trimOrNull(mimeType)?.toLowerCase()
  if (explicit) return explicit

  const ext = fileExt(fileName)
  if (ext === "pdf") return "application/pdf"
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  return null
}

function buildBundleFileName(caseRef: string | null | undefined) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  const ref = safeFileName(trimOrNull(caseRef) ?? "Schufa_Frei")
  return `${ref}_Bankeinreichung_${stamp}.pdf`
}

function normalizeSignatureFields(fields: SignatureFieldRow[] | null | undefined) {
  return (Array.isArray(fields) ? fields : []).map(
    (field): {
      id: string
      owner: "advisor" | "customer"
      type: "signature" | "checkbox" | "text"
      label: string
      page: number
      x: number
      y: number
      width: number
      height: number
    } => ({
      id: trimOrNull(field.id) ?? crypto.randomUUID(),
      owner: String(field.owner ?? "").trim().toLowerCase() === "customer" ? "customer" : "advisor",
      type:
        String(field.type ?? "").trim().toLowerCase() === "signature"
          ? "signature"
          : String(field.type ?? "").trim().toLowerCase() === "checkbox"
            ? "checkbox"
            : "text",
      label: trimOrNull(field.label) ?? "Feld",
      page: Math.max(1, Number(field.page ?? 1)),
      x: Number(field.x ?? 0),
      y: Number(field.y ?? 0),
      width: Number(field.width ?? 0),
      height: Number(field.height ?? 0),
    })
  )
}

function compareByCreatedAtAsc<T extends { created_at?: string | null }>(left: T, right: T) {
  const leftTs = left.created_at ? new Date(left.created_at).getTime() : 0
  const rightTs = right.created_at ? new Date(right.created_at).getTime() : 0
  return leftTs - rightTs
}

function pickLatestDocument(
  docs: CaseDocumentRow[],
  kind: "signature_original" | "signature_signed"
) {
  return docs
    .filter((doc) => String(doc.document_kind ?? "").trim().toLowerCase() === kind)
    .sort(compareByCreatedAtAsc)
    .at(-1) ?? null
}

async function downloadStoredDocument(admin: AdminClient, doc: CaseDocumentRow, label: string) {
  const filePath = trimOrNull(doc.file_path)
  if (!filePath) {
    throw new Error(`${label}: Dateipfad fehlt.`)
  }

  const download = await admin.storage.from("case_documents").download(filePath)
  if (download.error || !download.data) {
    throw new Error(`${label}: Datei konnte nicht geladen werden.`)
  }

  return {
    bytes: new Uint8Array(await download.data.arrayBuffer()),
    mimeType: inferMimeType(trimOrNull(doc.mime_type) ?? trimOrNull(download.data.type), doc.file_name ?? null),
    fileName: trimOrNull(doc.file_name) ?? "dokument",
  }
}

async function appendBinaryToPdf(target: PDFDocument, binary: BundleBinary) {
  const mimeType = inferMimeType(binary.mimeType, binary.fileName)
  if (mimeType === "application/pdf") {
    let source: PDFDocument
    try {
      source = await PDFDocument.load(binary.bytes)
    } catch (error) {
      const message = String((error as Error | null)?.message ?? "").toLowerCase()
      if (!message.includes("encrypted")) {
        throw new Error(`${binary.label}: PDF konnte nicht verarbeitet werden.`)
      }
      source = await PDFDocument.load(binary.bytes, { ignoreEncryption: true })
    }

    const pageIndexes = source.getPageIndices()
    const copiedPages = await target.copyPages(source, pageIndexes)
    copiedPages.forEach((page) => target.addPage(page))
    return
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg") {
    const image =
      mimeType === "image/png" ? await target.embedPng(binary.bytes) : await target.embedJpg(binary.bytes)
    const page = target.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    return
  }

  throw new Error(
    `${binary.label}: ${binary.fileName} kann nicht in die Bankeinreichung übernommen werden. Unterstützt sind PDF, JPG und PNG.`
  )
}

async function loadSignatureValuesMap(admin: AdminClient, requestIds: string[]) {
  const valuesMap = new Map<string, SignatureValuesByRole>()
  if (!requestIds.length) return valuesMap

  const { data: valueRows } = await admin
    .from("case_signature_field_values")
    .select("request_id,actor_id,values")
    .in("request_id", requestIds)

  const normalizedValueRows = ((valueRows ?? []) as SignatureValueRow[]).filter(
    (row) => trimOrNull(row.request_id) && trimOrNull(row.actor_id)
  )
  if (!normalizedValueRows.length) return valuesMap

  const actorIds = Array.from(
    new Set(normalizedValueRows.map((row) => trimOrNull(row.actor_id)).filter((value): value is string => Boolean(value)))
  )
  const { data: profiles } = actorIds.length
    ? await admin.from("profiles").select("user_id,role").in("user_id", actorIds)
    : { data: [] as ProfileRoleRow[] }

  const roleMap = new Map<string, string>()
  for (const profile of (profiles ?? []) as ProfileRoleRow[]) {
    const userId = trimOrNull(profile.user_id)
    const role = trimOrNull(profile.role)?.toLowerCase()
    if (userId && role) roleMap.set(userId, role)
  }

  for (const row of normalizedValueRows) {
    const requestId = trimOrNull(row.request_id)
    const actorId = trimOrNull(row.actor_id)
    if (!requestId || !actorId) continue

    if (!valuesMap.has(requestId)) valuesMap.set(requestId, {})
    const entry = valuesMap.get(requestId)!
    const role = roleMap.get(actorId)
    if (role === "advisor" || role === "admin") entry.advisor = row.values ?? {}
    if (role === "customer") entry.customer = row.values ?? {}
  }

  return valuesMap
}

async function buildRenderedDigitalSignatureBinary(input: {
  admin: AdminClient
  caseId: string
  request: SignatureRequestRow
  requestDocs: CaseDocumentRow[]
  valuesByRole: SignatureValuesByRole
}) {
  const originalDoc = pickLatestDocument(input.requestDocs, "signature_original")
  const fallbackSignedDoc = pickLatestDocument(input.requestDocs, "signature_signed")

  if (!originalDoc) {
    if (!fallbackSignedDoc) {
      throw new Error(`${trimOrNull(input.request.title) ?? "Dokument"}: Originaldokument fehlt.`)
    }
    const fallback = await downloadStoredDocument(input.admin, fallbackSignedDoc, trimOrNull(input.request.title) ?? "Dokument")
    return {
      label: trimOrNull(input.request.title) ?? "Dokument",
      fileName: fallback.fileName,
      bytes: fallback.bytes,
      mimeType: fallback.mimeType,
    } satisfies BundleBinary
  }

  const original = await downloadStoredDocument(input.admin, originalDoc, trimOrNull(input.request.title) ?? "Dokument")

  try {
    const rendered = await renderSignedPdf({
      originalBytes: original.bytes,
      originalMime: original.mimeType,
      fields: normalizeSignatureFields(input.request.fields),
      values: input.valuesByRole,
      events: [],
      auditTitle: `${trimOrNull(input.request.title) ?? "Dokument"} · ${input.caseId}`,
      includeAudit: false,
    })

    return {
      label: trimOrNull(input.request.title) ?? "Dokument",
      fileName: original.fileName,
      bytes: rendered,
      mimeType: "application/pdf",
    } satisfies BundleBinary
  } catch (error) {
    if (!fallbackSignedDoc) throw error
    const fallback = await downloadStoredDocument(input.admin, fallbackSignedDoc, trimOrNull(input.request.title) ?? "Dokument")
    return {
      label: trimOrNull(input.request.title) ?? "Dokument",
      fileName: fallback.fileName,
      bytes: fallback.bytes,
      mimeType: fallback.mimeType,
    } satisfies BundleBinary
  }
}

export async function buildSchufaFreeBankSubmission(
  admin: AdminClient,
  input: {
    caseId: string
    caseRef?: string | null
  }
): Promise<SchufaFreeBankSubmissionBuildResult> {
  const [requestRowsResult, documentRowsResult, signatureRowsResult] = await Promise.all([
    admin
      .from("document_requests")
      .select("id,title,required,created_at")
      .eq("case_id", input.caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("documents")
      .select("id,request_id,signature_request_id,document_kind,file_name,file_path,mime_type,created_at")
      .eq("case_id", input.caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("case_signature_requests")
      .select("id,title,requires_wet_signature,fields,advisor_signed_at,customer_signed_at,status,created_at")
      .eq("case_id", input.caseId)
      .order("created_at", { ascending: true }),
  ])

  if (requestRowsResult.error) throw new Error(requestRowsResult.error.message)
  if (documentRowsResult.error) throw new Error(documentRowsResult.error.message)
  if (signatureRowsResult.error) throw new Error(signatureRowsResult.error.message)

  const requestRows = ((requestRowsResult.data ?? []) as DocumentRequestRow[]).map((request) =>
    normalizeSchufaFreeDocumentRequest(request)
  )
  const documentRows = (documentRowsResult.data ?? []) as CaseDocumentRow[]
  const signatureRows = (signatureRowsResult.data ?? []) as SignatureRequestRow[]

  const requestDocsById = new Map<string, CaseDocumentRow[]>()
  const signatureDocsById = new Map<string, CaseDocumentRow[]>()
  const freeGeneralDocs: CaseDocumentRow[] = []

  for (const document of documentRows) {
    const requestId = trimOrNull(document.request_id)
    const signatureRequestId = trimOrNull(document.signature_request_id)
    const documentKind = normalizeTitleKey(document.document_kind)

    if (requestId) {
      if (!requestDocsById.has(requestId)) requestDocsById.set(requestId, [])
      requestDocsById.get(requestId)!.push(document)
      continue
    }

    if (signatureRequestId) {
      if (!signatureDocsById.has(signatureRequestId)) signatureDocsById.set(signatureRequestId, [])
      signatureDocsById.get(signatureRequestId)!.push(document)
      continue
    }

    if (!documentKind) {
      freeGeneralDocs.push(document)
    }
  }

  const missing: string[] = []
  const included: string[] = []
  const sources: BundleSource[] = []

  const orderedRequests = requestRows.slice().sort((left, right) => {
    const leftOrder = REQUEST_ORDER.get(normalizeTitleKey(left.title)) ?? 999
    const rightOrder = REQUEST_ORDER.get(normalizeTitleKey(right.title)) ?? 999
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return compareByCreatedAtAsc(left, right)
  })

  for (const request of orderedRequests) {
    const requestId = trimOrNull(request.id)
    if (!requestId) continue
    const title = trimOrNull(request.title) ?? "Unterlage"
    const requestDocs = (requestDocsById.get(requestId) ?? []).slice().sort(compareByCreatedAtAsc)
    const required = Boolean(request.required)
    const requestOrder = REQUEST_ORDER.get(normalizeTitleKey(title)) ?? 999

    if (!requestDocs.length) {
      if (required) missing.push(title)
      continue
    }

    included.push(title)
    for (const doc of requestDocs) {
      const downloaded = await downloadStoredDocument(admin, doc, title)
      sources.push({
        order: requestOrder,
        label: title,
        optional: !required,
        binary: {
          label: title,
          fileName: downloaded.fileName,
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
        },
      })
    }
  }

  if (freeGeneralDocs.length) {
    included.push("Freie Zusatzunterlagen")
    for (const doc of freeGeneralDocs.slice().sort(compareByCreatedAtAsc)) {
      const downloaded = await downloadStoredDocument(admin, doc, "Freie Zusatzunterlagen")
      sources.push({
        order: 95,
        label: "Freie Zusatzunterlagen",
        optional: true,
        binary: {
          label: "Freie Zusatzunterlagen",
          fileName: downloaded.fileName,
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
        },
      })
    }
  }

  const requestIds = signatureRows.map((request) => trimOrNull(request.id)).filter((value): value is string => Boolean(value))
  const valuesByRequest = await loadSignatureValuesMap(admin, requestIds)

  const signatureRequestsSorted = signatureRows
    .slice()
    .sort((left, right) => {
      const leftMeta = getSchufaFreeSignatureRequestMeta({
        title: left.title,
        requiresWetSignature: Boolean(left.requires_wet_signature),
        fields: left.fields ?? [],
      })
      const rightMeta = getSchufaFreeSignatureRequestMeta({
        title: right.title,
        requiresWetSignature: Boolean(right.requires_wet_signature),
        fields: right.fields ?? [],
      })
      if (leftMeta.order !== rightMeta.order) return leftMeta.order - rightMeta.order
      return compareByCreatedAtAsc(left, right)
    })

  for (const request of signatureRequestsSorted) {
    const requestId = trimOrNull(request.id)
    if (!requestId) continue

    const meta = getSchufaFreeSignatureRequestMeta({
      title: request.title,
      requiresWetSignature: Boolean(request.requires_wet_signature),
      fields: request.fields ?? [],
    })
    const label = trimOrNull(request.title) ?? "Signaturdokument"
    const requestDocs = signatureDocsById.get(requestId) ?? []
    const isComplete = isSignatureRequestComplete({
      fields: request.fields ?? [],
      requires_wet_signature: Boolean(request.requires_wet_signature),
      advisor_signed_at: request.advisor_signed_at,
      customer_signed_at: request.customer_signed_at,
      status: request.status,
    })

    if (meta.downloadOnly) {
      const originalDoc = pickLatestDocument(requestDocs, "signature_original")
      if (!originalDoc && meta.completionRequired) {
        missing.push(label)
        continue
      }
      if (!originalDoc) continue

      included.push(label)
      const downloaded = await downloadStoredDocument(admin, originalDoc, label)
      sources.push({
        order: 1000 + meta.order,
        label,
        optional: meta.optional,
        binary: {
          label,
          fileName: downloaded.fileName,
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
        },
      })
      continue
    }

    if (request.requires_wet_signature) {
      const signedDoc = pickLatestDocument(requestDocs, "signature_signed")
      if (!signedDoc) {
        if (!meta.optional) missing.push(`${label} (hochgeladenes Original)`)
        continue
      }

      included.push(label)
      const downloaded = await downloadStoredDocument(admin, signedDoc, label)
      sources.push({
        order: 1000 + meta.order,
        label,
        optional: meta.optional,
        binary: {
          label,
          fileName: downloaded.fileName,
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
        },
      })
      continue
    }

    if (!isComplete) {
      if (!meta.optional) missing.push(label)
      continue
    }

    included.push(label)
    const binary = await buildRenderedDigitalSignatureBinary({
      admin,
      caseId: input.caseId,
      request,
      requestDocs,
      valuesByRole: valuesByRequest.get(requestId) ?? {},
    })
    sources.push({
      order: 1000 + meta.order,
      label,
      optional: meta.optional,
      binary,
    })
  }

  if (missing.length) {
    return {
      ok: false,
      included: Array.from(new Set(included)),
      missing: Array.from(new Set(missing)),
    }
  }

  const mergedPdf = await PDFDocument.create()
  const orderedSources = sources.slice().sort((left, right) => left.order - right.order)
  for (const source of orderedSources) {
    await appendBinaryToPdf(mergedPdf, source.binary)
  }

  return {
    ok: true,
    pdfBytes: new Uint8Array(await mergedPdf.save()),
    fileName: buildBundleFileName(input.caseRef),
    included: Array.from(new Set(included)),
    missing: [],
  }
}
