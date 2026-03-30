import type { Metadata } from "next"
import Link from "next/link"
import OnlinekreditAccessCard from "@/components/onlinekredit/OnlinekreditAccessCard"
import OnlinekreditDocumentPinCard from "@/components/onlinekredit/OnlinekreditDocumentPinCard"
import OnlinekreditDocumentUploadPanel from "@/components/onlinekredit/OnlinekreditDocumentUploadPanel"
import { toPublicOfferAcceptanceMessage } from "@/lib/europace/offerAcceptance"
import { flattenEuropaceAvailableAssignments, listEuropaceAvailableAssignments } from "@/lib/europace/documents"
import { getBankApplicationDocuments, getBankContinuationSteps, isImportedBankDocumentPath } from "@/lib/europace/flow"
import {
  buildEuropaceApplicationDecisionMessage,
  findRelevantEuropaceApplication,
  findRejectedEuropaceApplication,
  looksLikeTechnicalEuropaceDecisionMessage,
  normalizeEuropaceApplications,
  refreshEuropaceStatusForCase,
} from "@/lib/europace/status"
import type { EuropaceExportResult } from "@/lib/europace/types"
import { deriveConcreteUploadRequirements } from "@/lib/europace/uploadRequirements"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { getOnlinekreditDocumentPin } from "@/lib/onlinekredit/documentPin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const metadata: Metadata = {
  title: "Onlinekredit Bestätigung | SEPANA",
  robots: { index: false, follow: false },
}

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  existing?: string
  angebotId?: string
}

type EuropaceMeta = {
  vorgangsnummer?: string | null
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  last_error?: string | null
  last_export_snapshot?: unknown
} | null

type OfferRow = {
  angebot_id: string
  accepted_at?: string | null
  angebot_snapshot?: {
    sofortkredit?: boolean | null
    digitalisierungsmerkmale?: {
      accountCheck?: {
        modus?: string | null
      } | null
    } | null
    ratenkredit?: {
      produktanbieter?: {
        name?: string | null
      } | null
      produktbezeichnung?: string | null
    } | null
  } | null
}

type UploadTargetRow = {
  key: string
  title: string
  category_id: string
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
}

type DocumentRow = {
  id: string
  request_id?: string | null
  file_name: string
  file_path: string
  mime_type?: string | null
  size_bytes?: number | null
  created_at: string
}

type EuropaceDocumentRow = {
  local_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  upload_status?: string | null
  last_error?: string | null
}

type DocumentRequestRow = {
  id: string
  title: string
  created_at?: string | null
  required?: boolean | null
}

type SignatureRequestRow = {
  id: string
  requires_wet_signature?: boolean | null
  advisor_signed_at?: string | null
  customer_signed_at?: string | null
  status?: string | null
  fields?: Array<{ owner?: "advisor" | "customer" | string | null }> | null
}

type ConfirmationStepState = "completed" | "current" | "upcoming" | "optional"

type ConfirmationStepCard = {
  key: string
  number: string
  title: string
  description: string
  badge: string
  state: ConfirmationStepState
}

type BankPreviewCard = {
  key: string
  kind: string
  title: string
  description: string
  href: string
  buttonLabel: string
  accent: "emerald" | "slate"
  priority: number
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function accountCheckFollowUp(mode: string | null | undefined) {
  const normalized = String(mode ?? "").trim().toUpperCase()
  if (normalized === "REQUIRED") {
    return "Für dieses Angebot führst du den Kontocheck als separaten Online-Schritt direkt im Browser durch."
  }
  if (normalized === "OPTIONAL") {
    return "Falls der Anbieter einen Kontocheck nutzt, erfolgt er ebenfalls als separater Online-Schritt direkt im Browser."
  }
  return null
}

function hasRequiredAccountCheckMode(mode: string | null | undefined) {
  return String(mode ?? "").trim().toUpperCase() === "REQUIRED"
}

function normalizeBankDocumentKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.(pdf|jpg|jpeg|png|tif|tiff)$/i, "")
    .replace(/\s+/g, " ")
}

function bankDocumentKindLabel(fileName: string | null | undefined) {
  const normalized = normalizeBankDocumentKey(fileName)
  if (!normalized) return "Bankdokument"
  if (normalized.includes("kreditvertrag") || normalized.includes("darlehensvertrag") || normalized.includes("vertrag")) {
    return "Kreditvertrag"
  }
  if (normalized.includes("datenschutz") || normalized.includes("einwilligung")) {
    return "Datenschutz"
  }
  return "Bankdokument"
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase()
}

function isCompletedEuropaceStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return false
  return (
    normalized === "ABGESCHLOSSEN" ||
    normalized === "AUSGEZAHLT" ||
    normalized === "ERLEDIGT" ||
    normalized === "SIGNIERT" ||
    normalized.includes("ABGESCHLOSSEN") ||
    normalized.includes("AUSGEZAHLT") ||
    normalized.includes("SIGNIERT") ||
    normalized.includes("UNTERSCHRIEBEN")
  )
}

function isPaidOutEuropaceStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return false
  return normalized === "AUSGEZAHLT" || normalized.includes("AUSGEZAHLT")
}

function buildBaseQuery(input: {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount: boolean
}) {
  const params = new URLSearchParams({
    caseId: input.caseId,
    caseRef: input.caseRef,
    access: input.accessToken,
  })
  if (input.existingAccount) params.set("existing", "1")
  return params
}

function caseDocumentDownloadHref(path: string, fileName?: string | null) {
  const fileNameParam = fileName ? `&filename=${encodeURIComponent(fileName)}` : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}&raw=1&download=1${fileNameParam}`
}

function buildRequirementTargetKey(category: string | null | undefined, assignmentId: string | null | undefined) {
  return `${trimOrNull(category) ?? "none"}::${trimOrNull(assignmentId) ?? "none"}`
}

function hasMatchingRequirementDocument(
  requirement: { request_id?: string | null; category_id?: string | null; assignment_id?: string | null },
  documents: DocumentRow[],
  europaceDocumentsByLocalId: Map<string, EuropaceDocumentRow>
) {
  return documents.some((document) => {
    if (trimOrNull(requirement.request_id) && trimOrNull(document.request_id) === trimOrNull(requirement.request_id)) {
      return true
    }

    const requirementKey = buildRequirementTargetKey(requirement.category_id, requirement.assignment_id)
    if (requirementKey === "none::none") return false

    const europaceRow = europaceDocumentsByLocalId.get(document.id) ?? null
    const documentKey = buildRequirementTargetKey(europaceRow?.category, europaceRow?.assignment_id)
    return requirementKey === documentKey
  })
}

function hasSignatureFieldOwner(
  fields: Array<{ owner?: "advisor" | "customer" | string | null }> | null | undefined,
  owner: "advisor" | "customer"
) {
  return Array.isArray(fields)
    ? fields.some((field) => String(field?.owner ?? "").trim().toLowerCase() === owner)
    : false
}

function getConfirmationStepClasses(state: ConfirmationStepState) {
  if (state === "current") {
    return {
      card:
        "border-emerald-300 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,1),rgba(236,253,245,0.92))] shadow-[0_18px_40px_rgba(16,185,129,0.14)]",
      number: "bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      title: "text-slate-950",
      text: "text-slate-700",
    }
  }

  if (state === "completed") {
    return {
      card: "border-emerald-200/80 bg-white/90",
      number: "bg-emerald-100 text-emerald-800",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      title: "text-slate-900",
      text: "text-slate-600",
    }
  }

  if (state === "optional") {
    return {
      card: "border-cyan-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.95))]",
      number: "bg-cyan-100 text-cyan-900",
      badge: "border-cyan-200 bg-cyan-50 text-cyan-900",
      title: "text-slate-900",
      text: "text-slate-600",
    }
  }

  return {
    card: "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]",
    number: "bg-slate-100 text-slate-700",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    title: "text-slate-900",
    text: "text-slate-600",
  }
}

export default async function OnlinekreditConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const existingAccount = parseBoolParam(sp.existing)
  const selectedOfferId = trimOrNull(sp.angebotId)

  if (!caseId || !caseRef || !accessToken) {
    return (
      <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig</h1>
        <p className="mt-2 text-sm text-slate-600">
          Für die Bestätigungsseite fehlt der öffentliche Fallzugriff. Starte den Onlinekredit bitte erneut.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Neu starten
          </Link>
        </div>
      </div>
    )
  }

  const admin = supabaseAdmin()
  const access = await resolvePublicOnlinekreditCaseAccess(admin, {
    caseId,
    caseRef,
    accessToken,
    expectedCaseType: "konsum",
  })

  if (!access.ok) {
    return (
      <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig oder abgelaufen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dieser Onlinekredit-Link kann nicht mehr verwendet werden. Starte den Vorgang bitte erneut.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Neu starten
          </Link>
        </div>
      </div>
    )
  }

  const query = buildBaseQuery({ caseId, caseRef, accessToken, existingAccount })
  const formHref = `/onlinekredit?${query.toString()}`
  const offersHref = `/onlinekredit/angebote?${query.toString()}`
  const loginHref = `/login?next=${encodeURIComponent(`/app/faelle/${caseId}#privatkredit-journey`)}`

  const [
    primaryResult,
    europaceResult,
    acceptedOfferResult,
    documentsResult,
    europaceDocumentsResult,
    documentRequestsResult,
    signatureRequestsResult,
  ] = await Promise.all([
    admin
      .from("case_applicants")
      .select("email")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle(),
    admin
      .from("case_europace")
      .select("vorgangsnummer,annahme_job_id,antragsnummer,produktanbieterantragsnummer,last_error,last_export_snapshot")
      .eq("case_id", caseId)
      .maybeSingle(),
    selectedOfferId
      ? admin
          .from("case_europace_offers")
          .select("angebot_id,accepted_at,angebot_snapshot")
          .eq("case_id", caseId)
          .eq("angebot_id", selectedOfferId)
          .maybeSingle()
      : admin
          .from("case_europace_offers")
          .select("angebot_id,accepted_at,angebot_snapshot")
          .eq("case_id", caseId)
          .order("accepted_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
    admin
      .from("documents")
      .select("id,request_id,file_name,file_path,mime_type,size_bytes,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("case_europace_documents")
      .select("local_document_id,category,assignment_id,upload_status,last_error")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("document_requests")
      .select("id,title,created_at,required")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("case_signature_requests")
      .select("id,requires_wet_signature,advisor_signed_at,customer_signed_at,status,fields")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const primaryEmail = trimOrNull((primaryResult.data as { email?: string | null } | null)?.email)
  const europaceMeta = (europaceResult.data ?? null) as EuropaceMeta
  let acceptedOffer = (acceptedOfferResult.data ?? null) as OfferRow | null
  let documents = ((documentsResult.data ?? []) as DocumentRow[]) ?? []
  const europaceDocuments = ((europaceDocumentsResult.data ?? []) as EuropaceDocumentRow[]) ?? []
  const documentRequests = ((documentRequestsResult.data ?? []) as DocumentRequestRow[]) ?? []
  const signatureRequests = ((signatureRequestsResult.data ?? []) as SignatureRequestRow[]) ?? []
  let exportSnapshot = (europaceMeta?.last_export_snapshot ?? null) as EuropaceExportResult | null
  let applications = normalizeEuropaceApplications(
    exportSnapshot as {
      antraege?: Array<{
        antragsnummer?: string | null
        produktanbieterantragsnummer?: string | null
        antragstellerstatus?: string | { status?: string | null } | null
        produktanbieterstatus?:
          | string
          | { status?: string | null; kommentar?: string | null; hinweise?: string[] | null }
          | null
        provisionsforderungsstatus?: string | { status?: string | null } | null
      }> | null
    } | null
  )
  let rejectedApplication = findRejectedEuropaceApplication(applications, {
    antragsnummer: europaceMeta?.antragsnummer,
    produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
  })
  let rejectionMessage = buildEuropaceApplicationDecisionMessage(rejectedApplication)
  let hasRejectedApplication = Boolean(rejectedApplication)
  let relevantApplication = findRelevantEuropaceApplication(applications, {
    antragsnummer: europaceMeta?.antragsnummer,
    produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
  })
  const hasApplication = Boolean(trimOrNull(europaceMeta?.antragsnummer))
  const hasRunningApplicationJob = Boolean(trimOrNull(europaceMeta?.annahme_job_id)) && !hasApplication

  if (!acceptedOffer && selectedOfferId) {
    const fallbackAcceptedOfferResult = await admin
      .from("case_europace_offers")
      .select("angebot_id,accepted_at,angebot_snapshot")
      .eq("case_id", caseId)
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    acceptedOffer = (fallbackAcceptedOfferResult.data ?? null) as OfferRow | null
  }

  const providerName = acceptedOffer?.angebot_snapshot?.ratenkredit?.produktanbieter?.name ?? null
  const productName = acceptedOffer?.angebot_snapshot?.ratenkredit?.produktbezeichnung ?? null
  const acceptedOfferIsOnline = Boolean(acceptedOffer?.angebot_snapshot?.sofortkredit)
  const accountCheckMode = acceptedOffer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus
  const shouldRefreshConfirmationStatus = hasApplication && !hasRejectedApplication
  let bankContinuationSteps = getBankContinuationSteps(exportSnapshot)

  if (shouldRefreshConfirmationStatus) {
    try {
      const refreshed = await refreshEuropaceStatusForCase(admin, caseId)
      exportSnapshot = refreshed.exportSnapshot
      applications = refreshed.applications
      rejectedApplication = findRejectedEuropaceApplication(applications, {
        antragsnummer: europaceMeta?.antragsnummer,
        produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
      })
      rejectionMessage = buildEuropaceApplicationDecisionMessage(rejectedApplication)
      hasRejectedApplication = Boolean(rejectedApplication)
      relevantApplication = findRelevantEuropaceApplication(applications, {
        antragsnummer: europaceMeta?.antragsnummer,
        produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
      })
      bankContinuationSteps = getBankContinuationSteps(exportSnapshot)
      const refreshedDocumentsResult = await admin
        .from("documents")
        .select("id,request_id,file_name,file_path,mime_type,size_bytes,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(200)
      documents = ((refreshedDocumentsResult.data ?? []) as DocumentRow[]) ?? documents
    } catch {
      // Keep the last persisted snapshot if Europace does not provide a fresher status yet.
    }
  }

  let uploadTargets: UploadTargetRow[] = []
  if (hasApplication && trimOrNull(europaceMeta?.vorgangsnummer)) {
    try {
      const assignments = await listEuropaceAvailableAssignments(admin, {
        caseId,
        vorgangsnummer: String(europaceMeta?.vorgangsnummer ?? "").trim(),
        antragsnummer:
          trimOrNull(relevantApplication?.antragsnummer) ??
          (trimOrNull(europaceMeta?.antragsnummer) ?? null),
      })

      uploadTargets = flattenEuropaceAvailableAssignments(assignments).map((target) => ({
        key: target.key,
        title: target.title,
        category_id: target.categoryId,
        category_name: target.categoryName,
        category_description: target.categoryDescription,
        assignment_id: target.assignmentId,
        assignment_name: target.assignmentName,
        assignment_role_name: target.assignmentRoleName,
      }))
    } catch {
      uploadTargets = []
    }
  }

  const concreteUploadRequirements = deriveConcreteUploadRequirements({
    requests: documentRequests,
    uploadTargets,
    documents,
    europaceDocuments,
  })

  const managedDocuments = documents.filter((document) => !isImportedBankDocumentPath(document.file_path))
  const europaceDocumentsByLocalId = new Map<string, EuropaceDocumentRow>()
  for (const row of europaceDocuments) {
    const localDocumentId = trimOrNull(row.local_document_id)
    if (!localDocumentId || europaceDocumentsByLocalId.has(localDocumentId)) continue
    europaceDocumentsByLocalId.set(localDocumentId, row)
  }

  const requiredUploadRequirements = concreteUploadRequirements.filter((requirement) => requirement.required)
  const requiredUploadCount = requiredUploadRequirements.length
  const openRequiredUploadCount = requiredUploadRequirements.filter(
    (requirement) => !hasMatchingRequirementDocument(requirement, managedDocuments, europaceDocumentsByLocalId)
  ).length

  const bankContinuationReady = bankContinuationSteps.length > 0
  const bankApplicationDocuments = getBankApplicationDocuments(exportSnapshot)
  const bankCaseDocuments = documents.filter((document) => isImportedBankDocumentPath(document.file_path))
  const customerSignatureOpenCount = signatureRequests.filter((request) => {
    const customerRequired = Boolean(request.requires_wet_signature) || hasSignatureFieldOwner(request.fields, "customer")
    if (!customerRequired) return false
    return !trimOrNull(request.customer_signed_at)
  }).length
  const advisorPreparationCount = signatureRequests.filter((request) => {
    const advisorRequired = hasSignatureFieldOwner(request.fields, "advisor")
    const customerRequired = Boolean(request.requires_wet_signature) || hasSignatureFieldOwner(request.fields, "customer")
    if (!advisorRequired || !customerRequired) return false
    return !trimOrNull(request.advisor_signed_at)
  }).length
  const hasVisibleSignatureStage = signatureRequests.length > 0
  const displayAntragsnummer = trimOrNull(relevantApplication?.antragsnummer) ?? trimOrNull(europaceMeta?.antragsnummer)
  const displayProviderReference =
    trimOrNull(relevantApplication?.produktanbieterantragsnummer) ??
    trimOrNull(europaceMeta?.produktanbieterantragsnummer)
  const documentPin = getOnlinekreditDocumentPin(europaceMeta?.vorgangsnummer)
  const bankCaseDocumentKeys = new Set(
    bankCaseDocuments
      .map((document) => normalizeBankDocumentKey(document.file_name))
      .filter(Boolean)
  )
  const visibleBankApplicationDocuments = bankApplicationDocuments.filter((document) => {
    const documentKey = normalizeBankDocumentKey(document.name ?? document.url)
    if (!documentKey) return true
    return !bankCaseDocumentKeys.has(documentKey)
  })
  const previewableBankApplicationDocuments = visibleBankApplicationDocuments.filter((document) => trimOrNull(document.url))
  const bankPreviewCards: BankPreviewCard[] = [
    ...bankCaseDocuments.map<BankPreviewCard>((document) => ({
      key: document.id,
      kind: bankDocumentKindLabel(document.file_name),
      title: document.file_name,
      description: "Dieses Dokument liegt bereits in deinem Vorgang und kann hier direkt zur Einsicht geöffnet werden.",
      href: caseDocumentDownloadHref(document.file_path, document.file_name),
      buttonLabel: bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "Kreditvertrag öffnen" : "Dokument öffnen",
      accent: "emerald",
      priority: bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? 0 : 1,
    })),
    ...previewableBankApplicationDocuments.map<BankPreviewCard>((document, index) => ({
      key: [document.name, document.url, index].filter(Boolean).join("|"),
      kind: bankDocumentKindLabel(document.name),
      title: document.name ?? `Bankdokument ${index + 1}`,
      description: "Dieses Dokument wurde bereits von der Bank bereitgestellt und ist hier zunächst als Vorschau sichtbar.",
      href: String(document.url),
      buttonLabel: bankDocumentKindLabel(document.name) === "Kreditvertrag" ? "Kreditvertrag öffnen" : "Vorschau öffnen",
      accent: "slate",
      priority: bankDocumentKindLabel(document.name) === "Kreditvertrag" ? 0 : 1,
    })),
  ].sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title, "de"))
  const accountCheckBankCompletionFlow =
    hasApplication && !hasRejectedApplication && acceptedOfferIsOnline && hasRequiredAccountCheckMode(accountCheckMode)
  const hasCompletedApplicationStatus = Boolean(
    relevantApplication &&
      (isCompletedEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isCompletedEuropaceStatus(relevantApplication.produktanbieterstatus) ||
        isCompletedEuropaceStatus(relevantApplication.provisionsforderungsstatus))
  )
  const hasPaidOutApplicationStatus = Boolean(
    relevantApplication &&
      (isPaidOutEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isPaidOutEuropaceStatus(relevantApplication.produktanbieterstatus) ||
        isPaidOutEuropaceStatus(relevantApplication.provisionsforderungsstatus))
  )
  const accountCheckFlowCompleted =
    accountCheckBankCompletionFlow && hasCompletedApplicationStatus
  const publicEuropaceErrorMessage = trimOrNull(europaceMeta?.last_error)
    ? toPublicOfferAcceptanceMessage(europaceMeta?.last_error, { hasRejectedApplication })
    : null
  const showPublicEuropaceError =
    publicEuropaceErrorMessage && !hasRejectedApplication && !(accountCheckBankCompletionFlow && bankContinuationReady)
  const hasTechnicalDecisionIssue =
    hasRejectedApplication && looksLikeTechnicalEuropaceDecisionMessage(rejectionMessage)
  const accountCheckNote = hasRejectedApplication
    ? null
    : accountCheckBankCompletionFlow
      ? bankContinuationReady
        ? "Dein digitaler Abschluss ist vorbereitet. Du kannst jetzt direkt die Legitimation und danach die digitale Unterschrift starten."
        : "Dein digitaler Abschluss wird gerade vorbereitet. Sobald die Links bereitstehen, kannst du hier direkt weitermachen."
      : accountCheckFollowUp(accountCheckMode)
  const showDirectOnlineCompletionSection =
    hasApplication && !hasRejectedApplication && accountCheckBankCompletionFlow
  const showBankPreviewSection =
    hasApplication &&
    !hasRejectedApplication &&
    !accountCheckBankCompletionFlow &&
    bankPreviewCards.length > 0
  const hasClassicSignatureStepReady =
    !accountCheckBankCompletionFlow && (bankPreviewCards.length > 0 || hasVisibleSignatureStage)
  const classicCurrentStepNumber = hasCompletedApplicationStatus
    ? 4
    : openRequiredUploadCount > 0
      ? 1
      : hasClassicSignatureStepReady
        ? 3
        : 2
  const confirmationSteps = [
    {
      key: "documents",
      number: "01",
      title: "Dokumente hochladen",
      description:
        requiredUploadCount === 0
          ? accountCheckBankCompletionFlow
            ? "Für dieses volldigitale Angebot sind aktuell keine Pflichtunterlagen offen. Falls später doch noch etwas benötigt wird, kannst du es hier oder später im Login-Bereich hochladen."
            : "Aktuell sind keine Pflichtunterlagen offen. Falls später doch noch etwas benötigt wird, kannst du es hier oder später im Login-Bereich hochladen."
          : "Lade die angeforderten Unterlagen jetzt direkt hier hoch oder später im Login-Bereich. Alles bleibt in deinem Vorgang an einer Stelle gebündelt.",
      badge:
        requiredUploadCount === 0
          ? accountCheckBankCompletionFlow
            ? "Nur falls nötig"
            : "Aktuell nichts offen"
          : openRequiredUploadCount > 0
            ? "Jetzt"
            : "Erledigt",
      state:
        requiredUploadCount === 0
          ? accountCheckBankCompletionFlow
            ? "optional"
            : "completed"
          : openRequiredUploadCount > 0
            ? "current"
            : "completed",
    } satisfies ConfirmationStepCard,
    {
      key: "review",
      number: "02",
      title: accountCheckBankCompletionFlow ? "Digital legitimieren und unterschreiben" : "Antrag wird geprüft",
      description: accountCheckBankCompletionFlow
        ? bankContinuationReady
          ? "Bei volldigitalen Angeboten wie DKB oder SKG legitimierst du dich jetzt über den Link der Bank und unterschreibst den Kreditvertrag direkt digital."
          : "Dein digitaler Bankabschluss wird gerade vorbereitet. Sobald der Link bereitsteht, legitimierst du dich dort und unterschreibst den Kreditvertrag direkt online."
        : "Dein Antrag wird auf Vollständigkeit und Korrektheit geprüft. Plane dafür in der Regel 2 bis 3 Bankarbeitstage ein.",
      badge: accountCheckBankCompletionFlow
        ? accountCheckFlowCompleted
          ? "Erledigt"
          : bankContinuationReady
            ? "Jetzt"
            : "Wird vorbereitet"
        : hasCompletedApplicationStatus || classicCurrentStepNumber > 2
          ? "Erledigt"
          : classicCurrentStepNumber === 2
            ? "In Prüfung"
            : "Danach",
      state: accountCheckBankCompletionFlow
        ? accountCheckFlowCompleted
          ? "completed"
          : "current"
        : hasCompletedApplicationStatus || classicCurrentStepNumber > 2
          ? "completed"
          : classicCurrentStepNumber === 2
            ? "current"
            : "upcoming",
    } satisfies ConfirmationStepCard,
    {
      key: "contract",
      number: "03",
      title: "Kreditvertrag abschließen",
      description:
        customerSignatureOpenCount > 0
          ? "Dein finaler Kreditvertrag ist bereit. Bitte prüfe ihn und unterschreibe ihn im nächsten Schritt."
          : advisorPreparationCount > 0
            ? "Dein Berater ergänzt gerade die Signaturfelder im Kreditvertrag und stellt dir gleich die finale Version bereit."
            : bankPreviewCards.length > 0
              ? "Du kannst Kreditvertrag und Datenschutzhinweise schon vorab einsehen. Die finale Version mit Signaturfeldern sendet dir dein Berater anschließend separat."
              : "Sobald dein Antrag geprüft ist, erhältst du den finalen Kreditvertrag zur Unterschrift.",
      badge: hasCompletedApplicationStatus
        ? "Erledigt"
        : customerSignatureOpenCount > 0
          ? "Jetzt unterschreiben"
          : advisorPreparationCount > 0
            ? "Wird vorbereitet"
            : bankPreviewCards.length > 0
              ? "Als Nächstes"
              : "Später",
      state: hasCompletedApplicationStatus
        ? "completed"
        : classicCurrentStepNumber === 3
          ? "current"
          : "upcoming",
    } satisfies ConfirmationStepCard,
    {
      key: "payout",
      number: "04",
      title: "Auszahlung auf dein Konto",
      description: accountCheckBankCompletionFlow
        ? "Bei volldigitalen Angeboten wie DKB oder SKG erfolgt die Auszahlung nach der digitalen Unterzeichnung oft schon innerhalb weniger Stunden auf dein Konto."
        : "Nach dem finalen Vertragsabschluss erfolgt die Auszahlung in der Regel innerhalb von 2 bis 3 Bankarbeitstagen auf dein Konto.",
      badge: hasPaidOutApplicationStatus ? "Ausgezahlt" : hasCompletedApplicationStatus ? "In Auszahlung" : "Zum Schluss",
      state: hasCompletedApplicationStatus ? "current" : "upcoming",
    } satisfies ConfirmationStepCard,
  ].filter((step) => (accountCheckBankCompletionFlow ? step.key !== "contract" : true))
  const showDirectOnlineActionCards =
    (!accountCheckFlowCompleted && bankContinuationReady) ||
    bankCaseDocuments.length > 0 ||
    (!accountCheckFlowCompleted && previewableBankApplicationDocuments.length > 0)
  const showDocumentPinCard =
    Boolean(documentPin) &&
    (bankPreviewCards.length > 0 || bankCaseDocuments.length > 0 || previewableBankApplicationDocuments.length > 0)

  const directOnlineCompletionSection = showDirectOnlineCompletionSection ? (
    <section className="rounded-[32px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,1))] p-6 shadow-sm sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Digital bei der Bank abschließen</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {accountCheckFlowCompleted ? "Abgeschlossen und im Fall gespeichert" : "Jetzt nur noch legitimieren und digital signieren"}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        Für dieses volldigitale Angebot musst du hier aktuell keine Unterlagen hochladen.{" "}
        {bankContinuationReady
          ? "Die Bank hat deine nächsten Schritte bereits bereitgestellt. Starte jetzt direkt die Legitimation und danach die digitale Unterschrift."
          : "Die nächsten Schritte werden gerade vorbereitet. Sobald die Links da sind, kannst du hier direkt weitermachen."}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">01. Antrag übermittelt</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">Dein Antrag wurde bereits an die Bank weitergegeben.</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">02. Identität bestätigen</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">Schließe die Video- oder Online-Legitimation vollständig ab.</div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">03. Digital unterschreiben</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">Unterschreibe den Vertrag direkt digital im Bankprozess.</div>
        </div>
      </div>

      {accountCheckFlowCompleted ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <div className="font-semibold">Abgeschlossen</div>
          <div className="mt-1">
            Der digitale Bankabschluss ist erledigt. Deine Bankdokumente liegen jetzt direkt im Vorgang bereit.
          </div>
        </div>
      ) : null}

      {!accountCheckFlowCompleted && !bankContinuationReady ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Die Bank stellt die direkten Links gerade noch bereit. Lade diese Seite in ein paar Sekunden erneut, dann
          erscheinen die nächsten Schritte hier automatisch.
        </div>
      ) : null}

      {showDocumentPinCard && documentPin ? (
        <div className="mt-5">
          <OnlinekreditDocumentPinCard
            caseId={caseId}
            caseRef={caseRef}
            accessToken={accessToken}
            existingAccount={existingAccount}
            pin={documentPin}
            revealPin={false}
            showCopyButton={false}
            autoSendOnMount
          />
        </div>
      ) : null}

      {showDirectOnlineActionCards ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {!accountCheckFlowCompleted && bankContinuationReady
            ? bankContinuationSteps.map((step, index) => (
                <div
                  key={[step.applicantName, step.referenceNumber, step.videoLegitUrl, step.qesUrl, index].filter(Boolean).join("|")}
                  className="rounded-[28px] border border-emerald-200/80 bg-white/90 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {step.applicantName ? `Dein digitaler Abschluss für ${step.applicantName}` : `Digitaler Abschluss ${index + 1}`}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Jetzt direkt bei der Bank weitermachen</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Deine Bank hat die nächsten Schritte bereits bereitgestellt. Starte jetzt direkt die Legitimation
                    und danach die digitale Unterschrift.
                  </p>
                  {step.referenceNumber ? (
                    <div className="mt-3 text-xs text-slate-500">Referenz: {step.referenceNumber}</div>
                  ) : null}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {step.videoLegitUrl ? (
                      <a
                        href={step.videoLegitUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
                      >
                        Online-Legitimation starten
                      </a>
                    ) : null}
                    {step.qesUrl ? (
                      <a
                        href={step.qesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 shadow-sm"
                      >
                        Digital signieren
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            : null}

          {bankCaseDocuments.map((document) => (
            <a
              key={document.id}
              href={caseDocumentDownloadHref(document.file_path, document.file_name)}
              className={`rounded-[28px] border bg-white/90 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition ${
                bankDocumentKindLabel(document.file_name) === "Kreditvertrag"
                  ? "border-slate-900/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))] hover:border-slate-900/30"
                  : "border-emerald-200/80 hover:border-emerald-300"
              }`}
            >
              <div
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "text-slate-700" : "text-emerald-700"
                }`}
              >
                {bankDocumentKindLabel(document.file_name)} zur Einsicht
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{document.file_name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Dieses Bankdokument wurde automatisch in deinen Vorgang übernommen und steht jetzt direkt zur Einsicht bereit.
              </p>
              <div
                className={`mt-4 inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white shadow-sm ${
                  bankDocumentKindLabel(document.file_name) === "Kreditvertrag"
                    ? "bg-[linear-gradient(135deg,#0f172a,#0f766e)] shadow-[0_14px_30px_rgba(15,23,42,0.20)]"
                    : "bg-slate-900"
                }`}
              >
                {bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "Kreditvertrag öffnen" : "Dokument öffnen"}
              </div>
            </a>
          ))}

          {!accountCheckFlowCompleted
            ? previewableBankApplicationDocuments.map((document, index) => (
                <a
                  key={[document.name, document.url, index].filter(Boolean).join("|")}
                  href={String(document.url)}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-[28px] border bg-white/90 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition ${
                    bankDocumentKindLabel(document.name) === "Kreditvertrag"
                      ? "border-slate-900/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))] hover:border-slate-900/30"
                      : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bankdokument</div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{document.name ?? `Bankdokument ${index + 1}`}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Dieses Dokument wurde bereits von der Bank bereitgestellt und ist hier zunächst nur zur Einsicht
                    sichtbar. Die Legitimation und digitale Unterschrift laufen separat über die Links oberhalb.
                  </p>
                  <div
                    className={`mt-4 inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm ${
                      bankDocumentKindLabel(document.name) === "Kreditvertrag"
                        ? "bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white shadow-[0_14px_30px_rgba(15,23,42,0.20)]"
                        : "border border-slate-200 bg-slate-50 text-slate-900"
                    }`}
                  >
                    {bankDocumentKindLabel(document.name) === "Kreditvertrag" ? "Kreditvertrag öffnen" : "Dokument öffnen"}
                  </div>
                </a>
              ))
            : null}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
        Falls später doch noch zusätzliche Unterlagen benötigt werden, erscheinen sie hier automatisch.
      </div>
    </section>
  ) : null

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_38%)] blur-3xl" />
      <section className="relative overflow-hidden rounded-[40px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Onlinekredit · Stufe 4 von 4</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {hasRejectedApplication
                ? hasTechnicalDecisionIssue
                  ? "Anfrage konnte technisch nicht bestätigt werden"
                  : "Anfrage leider abgelehnt"
                : accountCheckFlowCompleted
                  ? "Geschafft. Dein Antrag ist digital abgeschlossen"
                : accountCheckBankCompletionFlow && bankContinuationReady
                  ? "Jetzt nur noch legitimieren und digital signieren"
                : accountCheckBankCompletionFlow
                  ? "Digitaler Abschluss wird vorbereitet"
                : hasApplication
                  ? "Antrag bestätigt"
                  : "Antrag wird verarbeitet"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              {hasRejectedApplication
                ? hasTechnicalDecisionIssue
                  ? "Die Bank konnte deinen Antrag technisch nicht final prüfen. Du kannst die Angebote erneut laden oder direkt eine andere Variante prüfen."
                  : "Die Bank hat deinen Antrag nach der finalen Prüfung nicht angenommen. Du kannst jetzt direkt ein anderes Angebot prüfen oder deine Angaben anpassen."
                : accountCheckFlowCompleted
                  ? "Dein digitaler Abschluss wurde erfolgreich durchlaufen. Der fertige Antrag und die Bankdokumente liegen jetzt direkt in deinem Vorgang bereit."
                : accountCheckBankCompletionFlow && bankContinuationReady
                  ? "Dein Antrag ist bei der Bank angelegt. Als Nächstes legitimierst du dich online und unterschreibst danach digital."
                : accountCheckBankCompletionFlow
                  ? "Dein Antrag ist bei der Bank angelegt. Die digitalen Bank-Links werden jetzt vorbereitet und erscheinen hier automatisch."
                : hasApplication
                  ? "Dein Antrag wurde erfolgreich angelegt. Hier siehst du direkt die nächsten Schritte in deinem Vorgang."
                  : "Deine finale Anfrage läuft noch. Sobald der Antrag angelegt ist, erscheinen hier automatisch die nächsten Schritte."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Link
              href={hasRejectedApplication ? offersHref : hasApplication ? loginHref : offersHref}
              prefetch={false}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)]"
            >
              {hasRejectedApplication ? "Andere Angebote prüfen" : hasApplication ? "Zum SEPANA-Portal" : "Zur Angebotsübersicht"}
            </Link>
            <Link
              href={formHref}
              prefetch={false}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Angaben öffnen
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Antragsnummer</div>
            <div className="mt-1 break-all text-sm font-semibold text-slate-900">
              {displayAntragsnummer || "wird erstellt"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Bank-Referenz</div>
            <div className="mt-1 break-all text-sm font-semibold text-slate-900">
              {displayProviderReference || "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Angebot</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{providerName || "-"}</div>
            {productName ? <div className="mt-1 text-xs text-slate-600">{productName}</div> : null}
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Status</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {hasRejectedApplication
                ? hasTechnicalDecisionIssue
                  ? "Technischer Hinweis"
                  : "Abgelehnt"
                : hasApplication
                  ? "Bereit"
                  : hasRunningApplicationJob
                    ? "Wird vorbereitet"
                    : "Offen"}
            </div>
          </div>
        </div>

        {showPublicEuropaceError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Letzter Hinweis: {publicEuropaceErrorMessage}
          </div>
        ) : null}
        {hasRejectedApplication ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
            <div className="font-semibold">{hasTechnicalDecisionIssue ? "Technischer Hinweis" : "Ablehnungsgrund"}</div>
            <div className="mt-1">
              {rejectionMessage ??
                (hasTechnicalDecisionIssue
                  ? "Die Bank konnte das Angebot technisch nicht final prüfen."
                  : "Die Bank hat den Antrag im Rahmen ihrer internen Vergaberichtlinien abgelehnt.")}
            </div>
            {rejectedApplication?.produktanbieterkommentar ? (
              <div className="mt-2">Kommentar: {rejectedApplication.produktanbieterkommentar}</div>
            ) : null}
            {rejectedApplication?.produktanbieterhinweise?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {rejectedApplication.produktanbieterhinweise.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href={offersHref}
                prefetch={false}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
              >
                Andere Angebote prüfen
              </Link>
              <Link
                href={formHref}
                prefetch={false}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm"
              >
                Angaben anpassen
              </Link>
            </div>
          </div>
        ) : null}
      {accountCheckNote ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          {accountCheckNote}
        </div>
      ) : null}
      </section>

      {directOnlineCompletionSection}

      {hasRejectedApplication ? (
        <section className="rounded-[32px] border border-rose-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Nächste Schritte</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">So geht es jetzt weiter</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-rose-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">01. Neue Auswahl</div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Bitte wähle ein anderes Angebot</h3>
              <p className="mt-2 text-sm leading-relaxed text-rose-900">
                {hasTechnicalDecisionIssue
                  ? "Diese Anfrage konnte technisch nicht final bestätigt werden. Bitte rufe die Angebote erneut ab oder wähle direkt eine andere Variante."
                  : "Diese Bank konnte deinen Antrag nicht annehmen. Bitte gehe zurück zur Angebotsübersicht und wähle eine andere verfügbare Variante."}
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200/80 bg-slate-50 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">02. Angaben übernehmen</div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">Deine Daten bleiben erhalten</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Wenn du möchtest, kannst du deine Angaben vorher anpassen. Dein Vorgang bleibt bestehen und du kannst
                direkt mit einer anderen Bankvariante weitermachen.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dein Ablauf</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">So geht es jetzt weiter</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Hier siehst du die nächsten Schritte bis zur Auszahlung. Die hervorgehobene Karte zeigt dir, wo dein
              Antrag gerade steht.
            </p>
          </div>

          <div className={`mt-6 grid gap-4 ${confirmationSteps.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"}`}>
            {confirmationSteps.map((step) => {
              const tone = getConfirmationStepClasses(step.state)

              return (
                <article
                  key={step.key}
                  className={`rounded-[30px] border p-5 transition ${tone.card}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold ${tone.number}`}>
                      {step.number}.
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}>
                      {step.badge}
                    </span>
                  </div>
                  <h3 className={`mt-5 text-lg font-semibold ${tone.title}`}>{step.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${tone.text}`}>{step.description}</p>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {showBankPreviewSection ? (
        <section className="rounded-[32px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,1))] p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Unterlagen zur Einsicht</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Kreditvertrag und Datenschutz schon vorab ansehen
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Direkt nach der Annahme kannst du hier bereits die Unterlagen der Bank einsehen. So weißt du schon vorab,
              was später final unterschrieben wird.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">Wichtig</div>
              <p className="mt-2 leading-relaxed">
                Das ist zunächst nur die Vorschau der Bank. Diese Dokumente dienen jetzt zur Einsicht und noch nicht zur
                Unterschrift.
              </p>
            </div>
            <div className="rounded-[24px] border border-emerald-200 bg-white/90 px-4 py-4 text-sm text-slate-700 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Nächster Schritt</div>
              <p className="mt-2 leading-relaxed">
                Dein Berater ergänzt den Kreditvertrag anschließend um die Signaturfelder und sendet dir die finale
                Version separat zur Unterschrift.
              </p>
            </div>
          </div>

          {showDocumentPinCard && documentPin ? (
            <div className="mt-5">
              <OnlinekreditDocumentPinCard
                caseId={caseId}
                caseRef={caseRef}
                accessToken={accessToken}
                existingAccount={existingAccount}
                pin={documentPin}
                revealPin={false}
                showCopyButton={false}
                autoSendOnMount
              />
            </div>
          ) : null}

          <div className={`mt-6 grid gap-4 ${bankPreviewCards.length > 1 ? "md:grid-cols-2" : ""}`}>
            {bankPreviewCards.map((card) => (
              <a
                key={card.key}
                href={card.href}
                target="_blank"
                rel="noreferrer"
                className={`rounded-[30px] border bg-white/92 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)] transition ${
                  card.kind === "Kreditvertrag"
                    ? "border-slate-900/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))] shadow-[0_18px_40px_rgba(15,23,42,0.10)] hover:border-slate-900/30"
                    : card.accent === "emerald"
                      ? "border-emerald-200/80 hover:border-emerald-300"
                      : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div
                  className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    card.kind === "Kreditvertrag"
                      ? "text-slate-700"
                      : card.accent === "emerald"
                        ? "text-emerald-700"
                        : "text-slate-500"
                  }`}
                >
                  {card.kind}
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {card.description}
                </p>
                <div
                  className={`mt-4 inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm ${
                    card.kind === "Kreditvertrag"
                      ? "bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white shadow-[0_14px_30px_rgba(15,23,42,0.20)]"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {card.buttonLabel}
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {hasApplication && !hasRejectedApplication ? (
        accountCheckBankCompletionFlow ? null : (
          <OnlinekreditDocumentUploadPanel
            caseId={caseId}
            caseRef={caseRef}
            accessToken={accessToken}
            requirements={concreteUploadRequirements}
            documents={documents}
            europaceDocuments={europaceDocuments}
          />
        )
      ) : hasRejectedApplication ? (
        <section className="rounded-3xl border border-rose-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Unterlagen</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Kein Upload für diese Absage nötig</h2>
          <p className="mt-2 text-sm text-slate-600">
            Für ein abgelehntes Angebot zeigen wir bewusst keine Upload-Ziele. Wechsle bitte zu einem anderen Angebot oder
            passe deine Angaben an und berechne neu.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unterlagen</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Upload wird vorbereitet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Die konkreten Upload-Ziele erscheinen automatisch, sobald die finale Anfrage vollständig verarbeitet wurde.
          </p>
        </section>
      )}

      <OnlinekreditAccessCard
        caseId={caseId}
        loginHref={loginHref}
        primaryEmail={primaryEmail}
        existingAccount={existingAccount}
        hasAcceptedOffer={hasApplication || hasRunningApplicationJob}
        hasApplication={hasApplication}
        hasRunningApplicationJob={hasRunningApplicationJob}
        acceptedOfferIsOnline={acceptedOfferIsOnline}
        directOnlineBankCompletionFlow={accountCheckBankCompletionFlow}
      />
    </div>
  )
}
