import type { EuropaceExportResult } from "@/lib/europace/types"

export type EuropaceFlowMeta = {
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  last_export_snapshot?: unknown
} | null

export type EuropaceFlowOffer = {
  accepted_at?: string | null
  superseded_at?: string | null
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  angebot_snapshot?: {
    sofortkredit?: boolean | null
    digitalisierungsmerkmale?: {
      accountCheck?: {
        modus?: string | null
      } | null
    } | null
  } | null
}

export type EuropaceFlowApplication = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  antragstellerstatus?: string | null
  produktanbieterstatus?: string | null
  provisionsforderungsstatus?: string | null
  produktanbieterkommentar?: string | null
  produktanbieterhinweise?: string[] | null
}

export type EuropaceFlowDocument = {
  local_document_id?: string | null
  europace_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  release_status?: string | null
  upload_status?: string | null
}

export type EuropaceFlowUploadTarget = {
  key: string
  title: string
  category_id: string
  assignment_id?: string | null
}

export type EuropaceFlowLocalDocument = {
  id?: string | null
  file_name?: string | null
  file_path?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  created_at?: string | null
}

export type EuropaceBankContinuationStep = {
  applicantName: string | null
  referenceNumber: string | null
  videoLegitUrl: string | null
  qesUrl: string | null
}

export type EuropaceBankDocument = {
  name: string | null
  url: string | null
}

export type EuropaceBankMilestoneState = "not_applicable" | "waiting" | "pending" | "completed"

export type EuropaceFlowDocumentProgress = {
  requiredDocumentCount: number
  uploadedDocumentCount: number
  missingDocumentCount: number
  releasedDocumentCount: number
}

export type EuropaceFlowStage =
  | "missing_data"
  | "offer_selection"
  | "application_pending"
  | "bank_links_pending"
  | "bank_completion"
  | "documents"
  | "signature"
  | "advisor"
  | "completed"
  | "rejected"
  | "status"

export type EuropaceFlowSummary = {
  hasAcceptedOffer: boolean
  hasApplication: boolean
  hasRunningApplicationJob: boolean
  hasRejectedApplication: boolean
  acceptedOfferIsOnline: boolean
  accountCheckMode: string | null
  accountCheckRequired: boolean
  directOnlineBankCompletionFlow: boolean
  bankContinuationReady: boolean
  bankContinuationSteps: EuropaceBankContinuationStep[]
  bankLegitimationState: EuropaceBankMilestoneState
  bankLegitimationLabel: string
  bankLegitimationDescription: string
  bankSignatureState: EuropaceBankMilestoneState
  bankSignatureLabel: string
  bankSignatureDescription: string
  bankDocuments: EuropaceBankDocument[]
  bankDocumentCount: number
  importedBankDocumentCount: number
  offerCount: number
  onlineOfferCount: number
  acceptableOfferCount: number
  requiredDocumentCount: number
  uploadedDocumentCount: number
  missingDocumentCount: number
  releasedDocumentCount: number
  customerSignatureOpenCount: number
  advisorPreparationCount: number
  isCompleted: boolean
  shouldHideUploads: boolean
  shouldHideSignatures: boolean
  shouldHideStatusBoxes: boolean
  stage: EuropaceFlowStage
  customerLabel: string
  customerDescription: string
  advisorLabel: string
  advisorDescription: string
  blockerLabel: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function isOfferAccepted(offer: EuropaceFlowOffer) {
  return Boolean(trimOrNull(offer.accepted_at))
}

function isOfferCurrent(offer: EuropaceFlowOffer) {
  return !trimOrNull(offer.superseded_at)
}

function isOfferComplete(offer: EuropaceFlowOffer) {
  return normalizeStatus(offer.vollstaendigkeit_status) === "VOLLSTAENDIG"
}

function isOfferMachbar(offer: EuropaceFlowOffer) {
  const status = normalizeStatus(offer.machbarkeit_status)
  return !status || status === "MACHBAR"
}

function isSelectableOffer(offer: EuropaceFlowOffer) {
  return isOfferCurrent(offer) && isOfferComplete(offer) && isOfferMachbar(offer)
}

function isUploadMappedToTarget(row: EuropaceFlowDocument, target: EuropaceFlowUploadTarget) {
  const rowCategory = trimOrNull(row.category)
  const rowAssignmentId = trimOrNull(row.assignment_id)
  const targetCategory = trimOrNull(target.category_id)
  const targetAssignmentId = trimOrNull(target.assignment_id)

  if (!rowCategory || !targetCategory || rowCategory !== targetCategory) return false
  if (targetAssignmentId) return rowAssignmentId === targetAssignmentId
  return true
}

function isUploadedDocument(row: EuropaceFlowDocument) {
  const uploadStatus = String(row.upload_status ?? "").trim().toLowerCase()
  if (!uploadStatus) return Boolean(trimOrNull(row.europace_document_id) || trimOrNull(row.local_document_id))
  return uploadStatus !== "error" && uploadStatus !== "local_deleted"
}

function isReleasedDocument(row: EuropaceFlowDocument) {
  const status = String(row.release_status ?? "").trim().toLowerCase()
  return status === "released" || status === "freigegeben"
}

function isRejectedEuropaceStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return false
  return (
    normalized === "ABGELEHNT" ||
    normalized === "AUTOMATISCH_ABGELEHNT" ||
    normalized === "REJECTED" ||
    normalized === "DECLINED" ||
    normalized.includes("ABGELEHNT") ||
    normalized.includes("DECLIN") ||
    normalized.includes("REJECT")
  )
}

function findRelevantEuropaceApplication(
  applications: EuropaceFlowApplication[],
  meta: EuropaceFlowMeta | null | undefined
) {
  const firstNonRejected =
    applications.find(
      (application) =>
        !isRejectedEuropaceStatus(application.antragstellerstatus) &&
        !isRejectedEuropaceStatus(application.produktanbieterstatus)
    ) ?? null
  const hasReference =
    Boolean(trimOrNull(meta?.antragsnummer)) ||
    Boolean(
      trimOrNull((meta as { produktanbieterantragsnummer?: string | null } | null | undefined)?.produktanbieterantragsnummer)
    )

  const antragsnummer = trimOrNull(meta?.antragsnummer)
  if (antragsnummer) {
    const byAntragsnummer =
      applications.find((application) => trimOrNull(application.antragsnummer) === antragsnummer) ?? null
    if (byAntragsnummer) {
      if (
        !isRejectedEuropaceStatus(byAntragsnummer.antragstellerstatus) &&
        !isRejectedEuropaceStatus(byAntragsnummer.produktanbieterstatus)
      ) {
        return byAntragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byAntragsnummer
    }
  }

  const produktanbieterantragsnummer = trimOrNull((meta as { produktanbieterantragsnummer?: string | null } | null | undefined)?.produktanbieterantragsnummer)
  if (produktanbieterantragsnummer) {
    const byProduktanbieterantragsnummer =
      applications.find(
        (application) => trimOrNull(application.produktanbieterantragsnummer) === produktanbieterantragsnummer
      ) ?? null
    if (byProduktanbieterantragsnummer) {
      if (
        !isRejectedEuropaceStatus(byProduktanbieterantragsnummer.antragstellerstatus) &&
        !isRejectedEuropaceStatus(byProduktanbieterantragsnummer.produktanbieterstatus)
      ) {
        return byProduktanbieterantragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byProduktanbieterantragsnummer
    }
  }

  if (hasReference) {
    return firstNonRejected ?? null
  }

  return firstNonRejected ?? applications[0] ?? null
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

function isSignedEuropaceStatus(value: string | null | undefined) {
  return isCompletedEuropaceStatus(value)
}

function isLegitimationCompletedEuropaceStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value)
  if (!normalized) return false
  return normalized.includes("LEGITIM") || normalized.includes("IDENTIF")
}

function firstAcceptedOffer(offers: EuropaceFlowOffer[]) {
  return (
    [...offers]
      .filter((offer) => isOfferAccepted(offer))
      .sort((left, right) => {
        const leftTs = trimOrNull(left.accepted_at) ? new Date(String(left.accepted_at)).getTime() : 0
        const rightTs = trimOrNull(right.accepted_at) ? new Date(String(right.accepted_at)).getTime() : 0
        return rightTs - leftTs
      })[0] ?? null
  )
}

function getExportSnapshot(meta: EuropaceFlowMeta) {
  return ((meta?.last_export_snapshot ?? null) as EuropaceExportResult | null) ?? null
}

function getBankCompletionEntries(snapshot: EuropaceExportResult | null | undefined) {
  const application = Array.isArray(snapshot?.antraege) ? snapshot.antraege[0] ?? null : null
  if (!application) return [] as EuropaceBankContinuationStep[]

  const candidates = [application.identifikationAntragsteller1, application.identifikationAntragsteller2]
  const seen = new Set<string>()

  return candidates
    .map((item) => {
      const applicantName = trimOrNull(item?.antragstellername)
      const referenceNumber = trimOrNull(item?.referenznummer)
      const videoLegitUrl = trimOrNull(item?.videolegitimationUrl)
      const qesUrl = trimOrNull(item?.qesUrl)
      if (!applicantName && !referenceNumber && !videoLegitUrl && !qesUrl) return null
      const dedupeKey = [applicantName, referenceNumber, videoLegitUrl, qesUrl].filter(Boolean).join("|")
      if (dedupeKey && seen.has(dedupeKey)) return null
      if (dedupeKey) seen.add(dedupeKey)
      return {
        applicantName,
        referenceNumber,
        videoLegitUrl,
        qesUrl,
      } satisfies EuropaceBankContinuationStep
    })
    .filter((row): row is EuropaceBankContinuationStep => Boolean(row))
}

export function getBankContinuationSteps(snapshot: EuropaceExportResult | null | undefined) {
  return getBankCompletionEntries(snapshot).filter((row) => Boolean(row.videoLegitUrl || row.qesUrl))
}

export function getBankApplicationDocuments(snapshot: EuropaceExportResult | null | undefined) {
  const application = Array.isArray(snapshot?.antraege) ? snapshot.antraege[0] ?? null : null
  if (!application?.dokumente?.length) return [] as EuropaceBankDocument[]

  const seen = new Set<string>()
  return application.dokumente
    .map((row) => {
      const name = trimOrNull(row?.name)
      const url = trimOrNull(row?.url)
      if (!name && !url) return null
      const dedupeKey = [name, url].filter(Boolean).join("|")
      if (dedupeKey && seen.has(dedupeKey)) return null
      if (dedupeKey) seen.add(dedupeKey)
      return { name, url } satisfies EuropaceBankDocument
    })
    .filter((row): row is EuropaceBankDocument => Boolean(row))
}

export function isImportedBankDocumentPath(path: string | null | undefined) {
  const normalized = String(path ?? "").trim().replace(/\\/g, "/").toLowerCase()
  return normalized.includes("/europace-bank/") || normalized.includes("/bankabschluss/")
}

function countImportedBankDocuments(localDocuments: EuropaceFlowLocalDocument[]) {
  return localDocuments.filter((row) => isImportedBankDocumentPath(trimOrNull(row.file_path))).length
}

export function deriveEuropaceFlowSummary(input: {
  meta?: EuropaceFlowMeta
  missingCount?: number | null
  offers?: EuropaceFlowOffer[] | null
  applications?: EuropaceFlowApplication[] | null
  documents?: EuropaceFlowDocument[] | null
  uploadTargets?: EuropaceFlowUploadTarget[] | null
  localDocuments?: EuropaceFlowLocalDocument[] | null
  customerSignatureOpenCount?: number | null
  advisorPreparationCount?: number | null
  documentProgress?: EuropaceFlowDocumentProgress | null
}) {
  const offers = Array.isArray(input.offers) ? input.offers : []
  const applications = Array.isArray(input.applications) ? input.applications : []
  const documents = Array.isArray(input.documents) ? input.documents : []
  const uploadTargets = Array.isArray(input.uploadTargets) ? input.uploadTargets : []
  const localDocuments = Array.isArray(input.localDocuments) ? input.localDocuments : []
  const missingCount = Math.max(0, Number(input.missingCount ?? 0) || 0)
  const customerSignatureOpenCount = Math.max(0, Number(input.customerSignatureOpenCount ?? 0) || 0)
  const advisorPreparationCount = Math.max(0, Number(input.advisorPreparationCount ?? 0) || 0)

  const hasApplication = Boolean(trimOrNull(input.meta?.antragsnummer))
  const hasRunningApplicationJob = Boolean(trimOrNull(input.meta?.annahme_job_id)) && !hasApplication
  const currentOffers = offers.filter((offer) => isOfferCurrent(offer))
  const acceptableOffers = currentOffers.filter((offer) => isSelectableOffer(offer) && !isOfferAccepted(offer))
  const onlineOfferCount = acceptableOffers.filter((offer) => Boolean(offer.angebot_snapshot?.sofortkredit)).length
  const acceptedOffer = firstAcceptedOffer(offers)
  const hasAcceptedOffer = Boolean(acceptedOffer)
  const acceptedOfferIsOnline = Boolean(acceptedOffer?.angebot_snapshot?.sofortkredit)
  const accountCheckMode = trimOrNull(acceptedOffer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)
  const accountCheckRequired = normalizeStatus(accountCheckMode) === "REQUIRED"
  const relevantApplication = findRelevantEuropaceApplication(applications, input.meta)
  const hasRejectedApplication = Boolean(
    relevantApplication &&
      (isRejectedEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isRejectedEuropaceStatus(relevantApplication.produktanbieterstatus))
  )

  const legacyRequiredDocumentCount = uploadTargets.length
  const legacyUploadedDocumentCount = uploadTargets.filter((target) =>
    documents.some((row) => isUploadMappedToTarget(row, target) && isUploadedDocument(row))
  ).length
  const legacyReleasedDocumentCount = uploadTargets.filter((target) =>
    documents.some((row) => isUploadMappedToTarget(row, target) && isReleasedDocument(row))
  ).length
  const legacyMissingDocumentCount = Math.max(0, legacyRequiredDocumentCount - legacyUploadedDocumentCount)
  const requiredDocumentCount = Math.max(
    0,
    Number(input.documentProgress?.requiredDocumentCount ?? legacyRequiredDocumentCount) || 0
  )
  const uploadedDocumentCount = Math.max(
    0,
    Number(input.documentProgress?.uploadedDocumentCount ?? legacyUploadedDocumentCount) || 0
  )
  const releasedDocumentCount = Math.max(
    0,
    Number(input.documentProgress?.releasedDocumentCount ?? legacyReleasedDocumentCount) || 0
  )
  const missingDocumentCount = Math.max(
    0,
    Number(input.documentProgress?.missingDocumentCount ?? legacyMissingDocumentCount) || 0
  )

  const exportSnapshot = getExportSnapshot(input.meta ?? null)
  const bankCompletionEntries = getBankCompletionEntries(exportSnapshot)
  const bankContinuationSteps = getBankContinuationSteps(exportSnapshot)
  const bankDocuments = getBankApplicationDocuments(exportSnapshot)
  const importedBankDocumentCount = countImportedBankDocuments(localDocuments)
  const hasCompletedApplicationStatus = Boolean(
    relevantApplication &&
      (isCompletedEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isCompletedEuropaceStatus(relevantApplication.produktanbieterstatus) ||
        isCompletedEuropaceStatus(relevantApplication.provisionsforderungsstatus))
  )
  const hasSignedApplicationStatus = Boolean(
    relevantApplication &&
      (isSignedEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isSignedEuropaceStatus(relevantApplication.produktanbieterstatus) ||
        isSignedEuropaceStatus(relevantApplication.provisionsforderungsstatus))
  )
  const hasLegitimationCompletionStatus = Boolean(
    relevantApplication &&
      (isLegitimationCompletedEuropaceStatus(relevantApplication.antragstellerstatus) ||
        isLegitimationCompletedEuropaceStatus(relevantApplication.produktanbieterstatus) ||
        isLegitimationCompletedEuropaceStatus(relevantApplication.provisionsforderungsstatus))
  )

  const directOnlineBankCompletionFlow =
    hasApplication && !hasRejectedApplication && acceptedOfferIsOnline && accountCheckRequired
  const bankContinuationReady = bankContinuationSteps.length > 0
  const hasBankDocuments = bankDocuments.length > 0 || importedBankDocumentCount > 0
  const hasPendingLegitimationLink = bankCompletionEntries.some((entry) => Boolean(entry.videoLegitUrl))
  const hasPendingSignatureLink = bankCompletionEntries.some((entry) => Boolean(entry.qesUrl))
  const hasSignatureLinkWithoutLegitimationLink = bankCompletionEntries.some(
    (entry) => Boolean(entry.qesUrl) && !entry.videoLegitUrl
  )
  const hasCompletedBankContract = hasSignedApplicationStatus || importedBankDocumentCount > 0
  const hasCompletedBankLegitimation =
    hasCompletedBankContract || hasLegitimationCompletionStatus || hasSignatureLinkWithoutLegitimationLink
  const isCompleted =
    hasApplication &&
    !hasRejectedApplication &&
    (hasCompletedApplicationStatus || (directOnlineBankCompletionFlow && hasBankDocuments))

  let bankLegitimationState: EuropaceBankMilestoneState = "not_applicable"
  let bankLegitimationLabel = "-"
  let bankLegitimationDescription = "Für diesen Fall ist keine direkte Bank-Legitimation aktiv."
  let bankSignatureState: EuropaceBankMilestoneState = "not_applicable"
  let bankSignatureLabel = "-"
  let bankSignatureDescription = "Für diesen Fall ist keine digitale Bank-Signatur aktiv."

  if (directOnlineBankCompletionFlow) {
    if (hasCompletedBankLegitimation) {
      bankLegitimationState = "completed"
      bankLegitimationLabel = "Erfolgreich"
      bankLegitimationDescription = hasCompletedBankContract
        ? "Die Legitimation ist abgeschlossen. Europace meldet den Bankabschluss bereits als signiert oder abgeschlossen."
        : hasSignatureLinkWithoutLegitimationLink
          ? "Die Legitimation ist abgeschlossen. Die digitale Signatur ist jetzt der nächste Schritt."
          : "Die Legitimation wurde von Europace als abgeschlossen zurückgemeldet."
    } else if (hasPendingLegitimationLink) {
      bankLegitimationState = "pending"
      bankLegitimationLabel = "Offen"
      bankLegitimationDescription =
        "Die Bank hat eine Online- oder Video-Legitimation bereitgestellt, sie ist aber noch nicht abgeschlossen."
    } else {
      bankLegitimationState = "waiting"
      bankLegitimationLabel = "Wartet auf Rückmeldung"
      bankLegitimationDescription =
        "Europace hat noch keinen abgeschlossenen Legitimationsstatus oder keinen aktiven Legitimationslink zurückgemeldet."
    }

    if (hasCompletedBankContract) {
      bankSignatureState = "completed"
      bankSignatureLabel = "Digital unterzeichnet"
      bankSignatureDescription = "Die Bank meldet den Vertrag bereits als signiert oder vollständig abgeschlossen."
    } else if (hasPendingSignatureLink) {
      bankSignatureState = "pending"
      bankSignatureLabel = "Offen"
      bankSignatureDescription = hasCompletedBankLegitimation
        ? "Die digitale Signatur ist bei der Bank verfügbar, wurde aber noch nicht abgeschlossen."
        : "Die Signatur ist vorbereitet, wartet aber noch auf den vollständigen Bankabschluss."
    } else if (hasCompletedBankLegitimation) {
      bankSignatureState = "waiting"
      bankSignatureLabel = "Wartet auf Signatur-Link"
      bankSignatureDescription =
        "Die Legitimation ist abgeschlossen. Europace hat die digitale Signatur noch nicht als nächsten Schritt gemeldet."
    } else {
      bankSignatureState = "waiting"
      bankSignatureLabel = "Wartet auf Legitimation"
      bankSignatureDescription =
        "Die digitale Signatur kann erst nach erfolgreicher Legitimation abgeschlossen werden."
    }
  }

  let stage: EuropaceFlowStage = "status"
  let customerLabel = "Status verfolgen"
  let customerDescription = "Dein Antrag läuft bereits. Hier siehst du den aktuellen Stand."
  let advisorLabel = "In Bearbeitung"
  let advisorDescription = "Der Antrag läuft bereits und wird aktuell weiter verarbeitet."
  let blockerLabel: string | null = null

  if (hasRejectedApplication) {
    stage = "rejected"
    customerLabel = "Abgelehnt"
    customerDescription = "Dieses Angebot wurde nach der finalen Prüfung abgelehnt. Bitte wechsle zu einem anderen Angebot."
    advisorLabel = "Abgelehnt"
    advisorDescription = "Der Produktanbieter hat den Antrag abgelehnt."
    blockerLabel = "Anbieterabsage"
  } else if (isCompleted) {
    stage = "completed"
    customerLabel = "Abgeschlossen"
    customerDescription = directOnlineBankCompletionFlow
      ? "Der digitale Bankabschluss ist erledigt. Der fertige Antrag liegt jetzt im Fall."
      : "Der Antrag ist abgeschlossen."
    advisorLabel = "Abgeschlossen"
    advisorDescription = directOnlineBankCompletionFlow
      ? "Der digitale Bankabschluss wurde abgeschlossen und die Bankdokumente liegen vor."
      : "Der Antrag ist abgeschlossen."
    blockerLabel = null
  } else if (missingCount > 0) {
    stage = "missing_data"
    customerLabel = "Angaben vervollständigen"
    customerDescription =
      missingCount === 1
        ? "Es fehlt noch 1 Pflichtangabe für die Angebotsberechnung."
        : `Es fehlen noch ${missingCount} Pflichtangaben für die Angebotsberechnung.`
    advisorLabel = "Wartet auf Pflichtangaben"
    advisorDescription = customerDescription
    blockerLabel = "Pflichtangaben"
  } else if (!hasAcceptedOffer && !hasApplication) {
    stage = "offer_selection"
    customerLabel = currentOffers.length > 0 ? "Angebot auswählen" : "Live-Angebote abrufen"
    customerDescription = currentOffers.length > 0
      ? "Wähle jetzt eines deiner berechneten Angebote aus."
      : "Sobald alle Angaben vollständig sind, kannst du die Live-Angebote abrufen."
    advisorLabel = currentOffers.length > 0 ? "Wartet auf Angebotsauswahl" : "Wartet auf Angebotsabruf"
    advisorDescription = customerDescription
    blockerLabel = currentOffers.length > 0 ? "Angebotsauswahl" : "Live-Angebote"
  } else if (hasRunningApplicationJob) {
    stage = "application_pending"
    customerLabel = "Antrag wird angelegt"
    customerDescription = "Die Bankanfrage wird gerade erzeugt. Danach erscheinen automatisch die nächsten Schritte."
    advisorLabel = "Antrag wird angelegt"
    advisorDescription = "Europace erstellt gerade den Antrag für dieses ausgewählte Angebot."
    blockerLabel = "Antragserstellung"
  } else if (directOnlineBankCompletionFlow && !bankContinuationReady) {
    stage = "bank_links_pending"
    customerLabel = "Bank-Fortsetzung wird vorbereitet"
    customerDescription = "Der Kontocheck ist übernommen. Wir warten jetzt auf die nächsten Bank-Links."
    advisorLabel = "Bank-Fortsetzung ausstehend"
    advisorDescription = "Kontocheck ist aktiv. Die digitale Fortsetzung bei der Bank ist noch nicht zurückgemeldet."
    blockerLabel = "Bank-Fortsetzung"
  } else if (directOnlineBankCompletionFlow && bankContinuationReady) {
    stage = "bank_completion"
    customerLabel = "Online-Legitimation und Signatur"
    customerDescription =
      "Der Kontocheck ist erledigt. Jetzt muss der Kunde nur noch die Online-Legitimation und digitale Signatur bei der Bank abschließen."
    advisorLabel = "Wartet auf Kundenabschluss bei der Bank"
    advisorDescription =
      "Die Banklinks für Legitimation und digitale Signatur liegen vor. Der Kunde muss den Bankprozess noch abschließen."
    blockerLabel = "Bank-Legitimation"
  } else if (hasApplication && missingDocumentCount > 0) {
    stage = "documents"
    customerLabel = "Unterlagen hochladen"
    customerDescription =
      missingDocumentCount === 1
        ? "Es fehlt noch 1 konkrete Unterlage für den Antrag."
        : `Es fehlen noch ${missingDocumentCount} konkrete Unterlagen für den Antrag.`
    advisorLabel = "Wartet auf Unterlagen"
    advisorDescription = customerDescription
    blockerLabel = "Unterlagen"
  } else if (hasApplication && customerSignatureOpenCount > 0) {
    stage = "signature"
    customerLabel = "Digital unterschreiben"
    customerDescription =
      customerSignatureOpenCount === 1
        ? "Es wartet noch 1 Unterschrift auf den Kunden."
        : `Es warten noch ${customerSignatureOpenCount} Unterschriften auf den Kunden.`
    advisorLabel = "Wartet auf Kundensignatur"
    advisorDescription = customerDescription
    blockerLabel = "Kundensignatur"
  } else if (hasApplication && advisorPreparationCount > 0) {
    stage = "advisor"
    customerLabel = "Kreditberater bereitet vor"
    customerDescription = "SEPANA und dein Kreditberater bereiten gerade die nächsten Schritte vor."
    advisorLabel = "Beim Kreditberater"
    advisorDescription = "Der Antrag liegt beim Kreditberater oder in der weiteren Begleitung."
    blockerLabel = "Berater"
  } else if (hasApplication) {
    stage = "advisor"
    customerLabel = acceptedOfferIsOnline ? "Bei SEPANA und Bank in Bearbeitung" : "Beim Kreditberater"
    customerDescription = acceptedOfferIsOnline
      ? "Der Antrag ist angelegt und wird jetzt weiter verarbeitet."
      : "Der Antrag ist angelegt. Jetzt läuft die weitere Bearbeitung mit SEPANA-Begleitung."
    advisorLabel = acceptedOfferIsOnline ? "Bei Anbieter / Bank" : "Beim Kreditberater"
    advisorDescription = acceptedOfferIsOnline
      ? "Der Antrag ist angelegt und läuft jetzt in der weiteren Bankbearbeitung."
      : "Der Antrag ist angelegt und befindet sich jetzt in der begleiteten Strecke."
    blockerLabel = acceptedOfferIsOnline ? "Anbieterbearbeitung" : "Berater"
  }

  return {
    hasAcceptedOffer,
    hasApplication,
    hasRunningApplicationJob,
    hasRejectedApplication,
    acceptedOfferIsOnline,
    accountCheckMode,
    accountCheckRequired,
    directOnlineBankCompletionFlow,
    bankContinuationReady,
    bankContinuationSteps,
    bankLegitimationState,
    bankLegitimationLabel,
    bankLegitimationDescription,
    bankSignatureState,
    bankSignatureLabel,
    bankSignatureDescription,
    bankDocuments,
    bankDocumentCount: bankDocuments.length,
    importedBankDocumentCount,
    offerCount: currentOffers.length,
    onlineOfferCount,
    acceptableOfferCount: acceptableOffers.length,
    requiredDocumentCount,
    uploadedDocumentCount,
    missingDocumentCount,
    releasedDocumentCount,
    customerSignatureOpenCount,
    advisorPreparationCount,
    isCompleted,
    shouldHideUploads: directOnlineBankCompletionFlow,
    shouldHideSignatures: directOnlineBankCompletionFlow,
    shouldHideStatusBoxes: directOnlineBankCompletionFlow,
    stage,
    customerLabel,
    customerDescription,
    advisorLabel,
    advisorDescription,
    blockerLabel,
  } satisfies EuropaceFlowSummary
}
