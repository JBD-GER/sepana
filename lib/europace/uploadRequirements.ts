export type EuropaceUploadTargetSummary = {
  key: string
  title: string
  category_id: string
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
}

export type EuropaceDocumentRequestSummary = {
  id: string
  title: string
  created_at?: string | null
  required?: boolean | null
}

export type EuropaceLocalDocumentSummary = {
  id: string
  request_id?: string | null
}

export type EuropaceDocumentMappingSummary = {
  local_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  release_status?: string | null
  upload_status?: string | null
}

export type ConcreteUploadRequirement = {
  key: string
  title: string
  request_id?: string | null
  category_id?: string | null
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
  source: "request" | "uploaded"
  required: boolean
}

export type ConcreteUploadProgress = {
  requirements: ConcreteUploadRequirement[]
  requiredCount: number
  uploadedCount: number
  releasedCount: number
  missingCount: number
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeTitle(value: string) {
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

function getApplicantRoleSortOrder(value: string | null | undefined) {
  const normalized = normalizeTitle(String(value ?? ""))
  if (!normalized) return 99
  const match = normalized.match(/kreditnehmer\s+([0-9]+)/)
  if (!match) return 99
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99
}

function buildTargetKey(category: string | null | undefined, assignmentId: string | null | undefined) {
  return `${trimOrNull(category) ?? "none"}::${trimOrNull(assignmentId) ?? "none"}`
}

function isRequirementMappedToDocument(
  requirement: Pick<ConcreteUploadRequirement, "category_id" | "assignment_id">,
  mapping: EuropaceDocumentMappingSummary
) {
  const requirementCategory = trimOrNull(requirement.category_id)
  const mappingCategory = trimOrNull(mapping.category)
  if (!requirementCategory || !mappingCategory || requirementCategory !== mappingCategory) return false

  const requirementAssignmentId = trimOrNull(requirement.assignment_id)
  if (requirementAssignmentId) {
    return trimOrNull(mapping.assignment_id) === requirementAssignmentId
  }

  return true
}

function isUploadedEuropaceDocument(mapping: EuropaceDocumentMappingSummary) {
  const uploadStatus = String(mapping.upload_status ?? "").trim().toLowerCase()
  if (!uploadStatus) return Boolean(trimOrNull(mapping.local_document_id))
  return uploadStatus !== "error" && uploadStatus !== "local_deleted"
}

function isReleasedEuropaceDocument(mapping: EuropaceDocumentMappingSummary) {
  const releaseStatus = String(mapping.release_status ?? "").trim().toLowerCase()
  return releaseStatus === "released" || releaseStatus === "freigegeben"
}

function isAlwaysOptionalDocumentTitle(title: string) {
  const normalized = normalizeTitle(title)
  return normalized.includes("meldebescheinigung")
}

function normalizeRequiredFlag(title: string, required: boolean | null | undefined) {
  if (isAlwaysOptionalDocumentTitle(title)) return false
  return required !== false
}

function matchTargetByTitle(
  title: string,
  uploadTargets: EuropaceUploadTargetSummary[]
) {
  const normalizedTitle = normalizeTitle(title)
  if (!normalizedTitle) return null

  const exact = uploadTargets.find((target) => normalizeTitle(target.title) === normalizedTitle)
  if (exact) return exact

  const fuzzyMatches = uploadTargets.filter((target) => {
    const normalizedTarget = normalizeTitle(target.title)
    return normalizedTarget.includes(normalizedTitle) || normalizedTitle.includes(normalizedTarget)
  })

  return fuzzyMatches.sort((left, right) => left.title.length - right.title.length)[0] ?? null
}

export function deriveConcreteUploadRequirements(input: {
  requests?: EuropaceDocumentRequestSummary[] | null
  uploadTargets?: EuropaceUploadTargetSummary[] | null
  documents?: EuropaceLocalDocumentSummary[] | null
  europaceDocuments?: EuropaceDocumentMappingSummary[] | null
}) {
  const requests = Array.isArray(input.requests) ? input.requests : []
  const uploadTargets = Array.isArray(input.uploadTargets) ? input.uploadTargets : []
  const documents = Array.isArray(input.documents) ? input.documents : []
  const europaceDocuments = Array.isArray(input.europaceDocuments) ? input.europaceDocuments : []

  const requirements: ConcreteUploadRequirement[] = []
  const coveredRequestIds = new Set<string>()
  const coveredTargetKeys = new Set<string>()

  for (const request of requests) {
    const requestId = trimOrNull(request.id)
    const title = trimOrNull(request.title)
    if (!requestId || !title) continue

    const matchedTarget = matchTargetByTitle(title, uploadTargets)
    const targetKey = matchedTarget ? buildTargetKey(matchedTarget.category_id, matchedTarget.assignment_id) : null
    if (targetKey) coveredTargetKeys.add(targetKey)
    coveredRequestIds.add(requestId)

    requirements.push({
      key: `request:${requestId}`,
      title,
      request_id: requestId,
      category_id: matchedTarget?.category_id ?? null,
      category_name: matchedTarget?.category_name ?? null,
      category_description: matchedTarget?.category_description ?? null,
      assignment_id: matchedTarget?.assignment_id ?? null,
      assignment_name: matchedTarget?.assignment_name ?? null,
      assignment_role_name: matchedTarget?.assignment_role_name ?? null,
      source: "request",
      required: normalizeRequiredFlag(title, request.required),
    })
  }

  const documentsById = new Map<string, EuropaceLocalDocumentSummary>()
  for (const document of documents) {
    const documentId = trimOrNull(document.id)
    if (!documentId || documentsById.has(documentId)) continue
    documentsById.set(documentId, document)
  }

  for (const mapping of europaceDocuments) {
    const localDocumentId = trimOrNull(mapping.local_document_id)
    if (!localDocumentId) continue

    const document = documentsById.get(localDocumentId)
    const requestId = trimOrNull(document?.request_id)
    if (requestId && coveredRequestIds.has(requestId)) continue

    const targetKey = buildTargetKey(mapping.category, mapping.assignment_id)
    if (coveredTargetKeys.has(targetKey)) continue

    const matchedTarget = uploadTargets.find(
      (target) => buildTargetKey(target.category_id, target.assignment_id) === targetKey
    )
    if (!matchedTarget) continue

    coveredTargetKeys.add(targetKey)
    requirements.push({
      key: `uploaded:${matchedTarget.key}`,
      title: matchedTarget.title,
      request_id: requestId,
      category_id: matchedTarget.category_id,
      category_name: matchedTarget.category_name ?? null,
      category_description: matchedTarget.category_description ?? null,
      assignment_id: matchedTarget.assignment_id ?? null,
      assignment_name: matchedTarget.assignment_name ?? null,
      assignment_role_name: matchedTarget.assignment_role_name ?? null,
      source: "uploaded",
      required: true,
    })
  }

  return requirements.sort((left, right) => {
    const requiredDiff = Number(right.required) - Number(left.required)
    if (requiredDiff !== 0) return requiredDiff
    const applicantDiff =
      getApplicantRoleSortOrder(left.assignment_role_name) - getApplicantRoleSortOrder(right.assignment_role_name)
    if (applicantDiff !== 0) return applicantDiff
    const assignmentNameDiff = String(left.assignment_name ?? "").localeCompare(String(right.assignment_name ?? ""), "de", {
      sensitivity: "base",
    })
    if (assignmentNameDiff !== 0) return assignmentNameDiff
    return left.title.localeCompare(right.title, "de", { sensitivity: "base" })
  })
}

export function deriveConcreteUploadTargets(input: {
  requests?: EuropaceDocumentRequestSummary[] | null
  uploadTargets?: EuropaceUploadTargetSummary[] | null
  documents?: EuropaceLocalDocumentSummary[] | null
  europaceDocuments?: EuropaceDocumentMappingSummary[] | null
}) {
  return deriveConcreteUploadRequirements(input)
    .filter((row) => Boolean(trimOrNull(row.category_id)))
    .map((row) => ({
      key: row.key,
      title: row.title,
      category_id: trimOrNull(row.category_id) as string,
      category_name: row.category_name ?? null,
      category_description: row.category_description ?? null,
      assignment_id: row.assignment_id ?? null,
      assignment_name: row.assignment_name ?? null,
      assignment_role_name: row.assignment_role_name ?? null,
    }))
}

export function deriveConcreteUploadProgress(input: {
  requests?: EuropaceDocumentRequestSummary[] | null
  uploadTargets?: EuropaceUploadTargetSummary[] | null
  documents?: EuropaceLocalDocumentSummary[] | null
  europaceDocuments?: EuropaceDocumentMappingSummary[] | null
}): ConcreteUploadProgress {
  const requirements = deriveConcreteUploadRequirements(input)
  const requiredRequirements = requirements.filter((requirement) => requirement.required)
  const localRequestIdsWithUpload = new Set(
    (Array.isArray(input.documents) ? input.documents : [])
      .map((document) => trimOrNull(document.request_id))
      .filter(Boolean) as string[]
  )
  const europaceDocuments = Array.isArray(input.europaceDocuments) ? input.europaceDocuments : []

  const uploadedCount = requiredRequirements.filter((requirement) => {
    const hasLocalUpload = Boolean(requirement.request_id && localRequestIdsWithUpload.has(requirement.request_id))
    const hasMappedUpload = europaceDocuments.some(
      (mapping) => isRequirementMappedToDocument(requirement, mapping) && isUploadedEuropaceDocument(mapping)
    )
    return hasLocalUpload || hasMappedUpload
  }).length

  const releasedCount = requiredRequirements.filter((requirement) =>
    europaceDocuments.some(
      (mapping) => isRequirementMappedToDocument(requirement, mapping) && isReleasedEuropaceDocument(mapping)
    )
  ).length

  const requiredCount = requiredRequirements.length
  return {
    requirements,
    requiredCount,
    uploadedCount,
    releasedCount,
    missingCount: Math.max(0, requiredCount - uploadedCount),
  }
}
