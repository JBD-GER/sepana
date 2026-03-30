import { deriveEuropaceFlowSummary, type EuropaceFlowSummary, type EuropaceFlowStage } from "@/lib/europace/flow"

export type PrivatkreditJourneyTab = "contact" | "household" | "finance" | "details"

export type PrivatkreditJourneyMeta = {
  vorgangsnummer?: string | null
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  sync_status?: string | null
  last_error?: string | null
} | null

export type PrivatkreditJourneyOffer = {
  angebot_id: string
  accepted_at?: string | null
  superseded_at?: string | null
  vollstaendigkeit_status?: string | null
  angebot_snapshot?: {
    sofortkredit?: boolean | null
    vollstaendigkeit?: {
      messages?: Array<{ text?: string | null; property?: string | null }> | null
    } | null
  } | null
}

type PrivatkreditJourneyOfferMessage = {
  text?: string | null
  property?: string | null
}

export type PrivatkreditJourneyDocument = {
  local_document_id?: string | null
  europace_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  release_status?: string | null
  upload_status?: string | null
}

export type PrivatkreditJourneyUploadTarget = {
  key: string
  title: string
  category_id: string
  assignment_id?: string | null
}

export type PrivatkreditJourneySignatureField = {
  owner?: "advisor" | "customer" | string | null
}

export type PrivatkreditJourneySignatureDocument = {
  document_kind?: "signature_original" | "signature_signed" | string | null
}

export type PrivatkreditJourneySignatureRequest = {
  id: string
  title?: string | null
  requires_wet_signature?: boolean | null
  advisor_signed_at?: string | null
  customer_signed_at?: string | null
  status?: string | null
  fields?: PrivatkreditJourneySignatureField[] | null
  documents?: PrivatkreditJourneySignatureDocument[] | null
}

export type PrivatkreditJourneyStepState = "done" | "current" | "upcoming"

export type PrivatkreditJourneyStep = {
  id: "data" | "offers" | "documents" | "signature" | "status"
  title: string
  description: string
  state: PrivatkreditJourneyStepState
}

export type PrivatkreditJourneySummary = {
  missingCount: number
  firstMissingTab: PrivatkreditJourneyTab | null
  hasVorgang: boolean
  hasAcceptedOffer: boolean
  hasApplication: boolean
  hasRunningApplicationJob: boolean
  offerCount: number
  onlineOfferCount: number
  acceptableOfferCount: number
  requiredDocumentCount: number
  uploadedDocumentCount: number
  missingDocumentCount: number
  releasedDocumentCount: number
  signatureRequestCount: number
  completedSignatureCount: number
  customerSignatureOpenCount: number
  advisorPreparationCount: number
  nextHref: string
  nextLabel: string
  nextDescription: string
  nextSectionId: string
  stage: EuropaceFlowStage
  stageLabel: string
  stageDescription: string
  accountCheckRequired: boolean
  directOnlineBankCompletionFlow: boolean
  bankContinuationReady: boolean
  hasBankDocuments: boolean
  importedBankDocumentCount: number
  shouldHideUploads: boolean
  shouldHideSignatures: boolean
  isCompleted: boolean
  steps: PrivatkreditJourneyStep[]
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function isOfferAccepted(offer: PrivatkreditJourneyOffer) {
  return Boolean(trimOrNull(offer.accepted_at))
}

function isOfferCurrent(offer: PrivatkreditJourneyOffer) {
  return !trimOrNull(offer.superseded_at)
}

function isAccountCheckMessage(entry: PrivatkreditJourneyOfferMessage | null | undefined) {
  const haystack = [String(entry?.property ?? ""), String(entry?.text ?? "")]
    .join(" ")
    .toLowerCase()
  return haystack.includes("kontocheck") || haystack.includes("accountcheck") || haystack.includes("account check")
}

function isOfferComplete(offer: PrivatkreditJourneyOffer) {
  const status = String(offer.vollstaendigkeit_status ?? "").trim().toUpperCase()
  return status === "VOLLSTAENDIG"
}

function hasOwnerField(fields: PrivatkreditJourneySignatureField[] | null | undefined, owner: "advisor" | "customer") {
  return Array.isArray(fields)
    ? fields.some((field) => String(field?.owner ?? "").trim().toLowerCase() === owner)
    : false
}

function hasSignedOutput(documents: PrivatkreditJourneySignatureDocument[] | null | undefined) {
  return Array.isArray(documents)
    ? documents.some((document) => String(document?.document_kind ?? "").trim().toLowerCase() === "signature_signed")
    : false
}

export function derivePrivatkreditJourney(input: {
  caseId: string
  meta: PrivatkreditJourneyMeta
  missingCount?: number | null
  firstMissingTab?: PrivatkreditJourneyTab | null
  offers?: PrivatkreditJourneyOffer[] | null
  documents?: PrivatkreditJourneyDocument[] | null
  uploadTargets?: PrivatkreditJourneyUploadTarget[] | null
  signatureRequests?: PrivatkreditJourneySignatureRequest[] | null
  flowSummary?: EuropaceFlowSummary | null
}): PrivatkreditJourneySummary {
  const offers = Array.isArray(input.offers) ? input.offers : []
  const documents = Array.isArray(input.documents) ? input.documents : []
  const uploadTargets = Array.isArray(input.uploadTargets) ? input.uploadTargets : []
  const signatureRequests = Array.isArray(input.signatureRequests) ? input.signatureRequests : []

  const missingCount = Math.max(0, Number(input.missingCount ?? 0) || 0)
  const firstMissingTab = input.firstMissingTab ?? null
  const hasVorgang = Boolean(trimOrNull(input.meta?.vorgangsnummer))
  const hasAcceptedOffer = offers.some((offer) => isOfferAccepted(offer))
  const hasApplication = Boolean(trimOrNull(input.meta?.antragsnummer))
  const hasRunningApplicationJob = Boolean(trimOrNull(input.meta?.annahme_job_id)) && !hasApplication
  const currentOffers = offers.filter((offer) => isOfferCurrent(offer))
  const acceptableOffers = currentOffers.filter((offer) => isOfferComplete(offer) && !isOfferAccepted(offer))
  const onlineOfferCount = acceptableOffers.filter((offer) => Boolean(offer.angebot_snapshot?.sofortkredit)).length

  const completedSignatureCount = signatureRequests.filter((request) => {
    const status = String(request.status ?? "").trim().toLowerCase()
    return status === "completed" || hasSignedOutput(request.documents)
  }).length

  const customerSignatureOpenCount = signatureRequests.filter((request) => {
    const requiresWet = Boolean(request.requires_wet_signature)
    const customerRequired = requiresWet || hasOwnerField(request.fields, "customer")
    if (!customerRequired) return false
    return !trimOrNull(request.customer_signed_at)
  }).length

  const advisorPreparationCount = signatureRequests.filter((request) => {
    const advisorRequired = hasOwnerField(request.fields, "advisor")
    const customerRequired = Boolean(request.requires_wet_signature) || hasOwnerField(request.fields, "customer")
    if (!advisorRequired || !customerRequired) return false
    return !trimOrNull(request.advisor_signed_at)
  }).length

  const flowSummary =
    input.flowSummary ??
    deriveEuropaceFlowSummary({
      meta: input.meta,
      missingCount,
      offers,
      documents,
      uploadTargets,
      customerSignatureOpenCount,
      advisorPreparationCount,
    })
  const uploadedDocumentCount = flowSummary.uploadedDocumentCount
  const releasedDocumentCount = flowSummary.releasedDocumentCount
  const requiredDocumentCount = flowSummary.requiredDocumentCount
  const missingDocumentCount = flowSummary.missingDocumentCount

  let nextSectionId = "privatkredit-angaben"
  let nextLabel = "Angaben vervollständigen"
  let nextDescription = "Bitte vervollständige zuerst alle Pflichtangaben für die Angebotsberechnung."
  let nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}?open=1&tab=${encodeURIComponent(firstMissingTab ?? "contact")}#live-case-panel-${encodeURIComponent(input.caseId)}`

  if (missingCount === 0 && !hasVorgang) {
    nextSectionId = "privatkredit-angaben"
    nextLabel = "Privatkredit starten"
    nextDescription = "Sobald alle Angaben vorliegen, wird dein Europace-Vorgang angelegt und Angebote koennen berechnet werden."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-angaben`
  } else if (missingCount === 0 && currentOffers.length === 0 && !hasAcceptedOffer && !hasApplication) {
    nextSectionId = "privatkredit-angebote"
    nextLabel = "Live-Angebote berechnen"
    nextDescription = "Hole jetzt die aktuellen Europace-Konditionen für deinen Privatkredit ab."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-angebote`
  } else if (missingCount === 0 && !hasAcceptedOffer && !hasApplication) {
    nextSectionId = "privatkredit-angebote"
    nextLabel = onlineOfferCount > 0 ? "Online-Angebot auswählen" : "Angebot auswählen"
    nextDescription =
      onlineOfferCount > 0
        ? "Wähle jetzt dein live berechnetes Angebot. Online abschließbare Angebote sind direkt markiert."
        : "Wähle jetzt eines deiner live berechneten Angebote aus."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-angebote`
  } else if (hasRunningApplicationJob) {
    nextSectionId = "privatkredit-status"
    nextLabel = "Antrag wird erstellt"
    nextDescription = "Europace erstellt gerade deinen Antrag. Du kannst den Status direkt hier verfolgen."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-status`
  } else if (flowSummary.directOnlineBankCompletionFlow && hasApplication) {
    nextSectionId = "privatkredit-status"
    nextLabel = flowSummary.isCompleted
      ? "Abschluss ansehen"
      : flowSummary.bankContinuationReady
        ? "Bankabschluss jetzt fortsetzen"
        : "Bank-Fortsetzung prüfen"
    nextDescription = flowSummary.customerDescription
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-status`
  } else if (hasApplication && missingDocumentCount > 0) {
    nextSectionId = "privatkredit-unterlagen"
    nextLabel = "Unterlagen hochladen"
    nextDescription =
      missingDocumentCount === 1
        ? "Es fehlt noch 1 Unterlage für deinen Antrag."
        : `Es fehlen noch ${missingDocumentCount} Unterlagen für deinen Antrag.`
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-unterlagen`
  } else if (hasApplication && customerSignatureOpenCount > 0) {
    nextSectionId = "privatkredit-unterschrift"
    nextLabel = "Vertrag unterschreiben"
    nextDescription = "Dein Vertrag ist bereit. Bitte schließe jetzt die Unterschrift im Vorgang ab."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-unterschrift`
  } else if (hasApplication && advisorPreparationCount > 0) {
    nextSectionId = "privatkredit-unterschrift"
    nextLabel = "Auf Vertragsdokument warten"
    nextDescription = "Dein Berater bereitet gerade das Vertragsdokument für die Unterschrift vor."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-unterschrift`
  } else if (hasApplication) {
    nextSectionId = "privatkredit-status"
    nextLabel = "Antragsstatus verfolgen"
    nextDescription = "Dein Antrag läuft bereits. Hier siehst du Status, Dokumente und nächste Schritte."
    nextHref = `/app/faelle/${encodeURIComponent(input.caseId)}#privatkredit-status`
  }

  const currentPhase =
    missingCount > 0
      ? "data"
      : !hasAcceptedOffer && !hasApplication
        ? "offers"
        : hasApplication && missingDocumentCount > 0
          ? "documents"
          : hasApplication && (customerSignatureOpenCount > 0 || advisorPreparationCount > 0)
            ? "signature"
            : "status"

  const effectiveCurrentPhase =
    flowSummary.stage === "completed" || flowSummary.stage === "rejected" || flowSummary.directOnlineBankCompletionFlow
      ? "status"
      : currentPhase

  const steps: PrivatkreditJourneyStep[] = [
    {
      id: "data",
      title: "Angaben",
      description:
        missingCount > 0
          ? `${missingCount} Pflichtfelder noch offen`
          : "Alle Pflichtangaben für die Angebotsberechnung sind vorhanden",
      state: missingCount === 0 ? "done" : "current",
    },
    {
      id: "offers",
      title: "Angebot",
      description: hasAcceptedOffer || hasApplication
        ? "Ein Europace-Angebot wurde bereits ausgewählt"
        : currentOffers.length > 0
          ? `${acceptableOffers.length} wählbare Live-Angebote vorhanden`
          : "Noch keine Live-Angebote berechnet",
      state:
        hasAcceptedOffer || hasApplication
          ? "done"
          : currentPhase === "offers"
            ? "current"
            : missingCount === 0
              ? "upcoming"
              : "upcoming",
    },
    {
      id: "documents",
      title: "Unterlagen",
      description:
        flowSummary.directOnlineBankCompletionFlow
          ? flowSummary.isCompleted
            ? "Kein Upload mehr nötig, der digitale Bankabschluss ist erledigt"
            : "Für diesen Kontocheck-Direktabschluss ist kein Upload über SEPANA nötig"
          : requiredDocumentCount > 0
          ? `${uploadedDocumentCount}/${requiredDocumentCount} benötigte Unterlagen hochgeladen`
          : "Noch keine Europace-Unterlagen angefordert",
      state:
        flowSummary.directOnlineBankCompletionFlow
          ? "done"
          : hasApplication && requiredDocumentCount > 0 && missingDocumentCount === 0
          ? "done"
          : effectiveCurrentPhase === "documents"
            ? "current"
            : hasAcceptedOffer || hasApplication
              ? "upcoming"
              : "upcoming",
    },
    {
      id: "signature",
      title: "Unterschrift",
      description:
        flowSummary.directOnlineBankCompletionFlow
          ? flowSummary.isCompleted
            ? "Legitimation und Signatur bei der Bank abgeschlossen"
            : flowSummary.bankContinuationReady
              ? "Die Bank hat die direkte Online-Legitimation und digitale Signatur bereitgestellt"
              : "Die Bank-Fortsetzung wird vorbereitet"
          : signatureRequests.length === 0
          ? "Noch kein Vertragsdokument vorhanden"
          : customerSignatureOpenCount > 0
            ? `${customerSignatureOpenCount} Dokumente warten auf deine Unterschrift`
            : completedSignatureCount > 0
              ? `${completedSignatureCount} Dokumente abgeschlossen`
              : "Vertragsdokument wird vorbereitet",
      state:
        flowSummary.directOnlineBankCompletionFlow
          ? flowSummary.isCompleted
            ? "done"
            : effectiveCurrentPhase === "status"
              ? "current"
              : "upcoming"
          : signatureRequests.length > 0 &&
            customerSignatureOpenCount === 0 &&
            advisorPreparationCount === 0 &&
            completedSignatureCount === signatureRequests.length
          ? "done"
          : effectiveCurrentPhase === "signature"
            ? "current"
            : hasApplication
              ? "upcoming"
              : "upcoming",
    },
    {
      id: "status",
      title: "Status",
      description: flowSummary.customerDescription,
      state:
        effectiveCurrentPhase === "status"
          ? "current"
          : hasApplication && missingDocumentCount === 0 && customerSignatureOpenCount === 0
            ? "done"
            : "upcoming",
    },
  ]

  return {
    missingCount,
    firstMissingTab,
    hasVorgang,
    hasAcceptedOffer,
    hasApplication,
    hasRunningApplicationJob,
    offerCount: currentOffers.length,
    onlineOfferCount,
    acceptableOfferCount: acceptableOffers.length,
    requiredDocumentCount,
    uploadedDocumentCount,
    missingDocumentCount,
    releasedDocumentCount,
    signatureRequestCount: signatureRequests.length,
    completedSignatureCount,
    customerSignatureOpenCount,
    advisorPreparationCount,
    nextHref,
    nextLabel,
    nextDescription,
    nextSectionId,
    stage: flowSummary.stage,
    stageLabel: flowSummary.customerLabel,
    stageDescription: flowSummary.customerDescription,
    accountCheckRequired: flowSummary.accountCheckRequired,
    directOnlineBankCompletionFlow: flowSummary.directOnlineBankCompletionFlow,
    bankContinuationReady: flowSummary.bankContinuationReady,
    hasBankDocuments: flowSummary.bankDocumentCount > 0,
    importedBankDocumentCount: flowSummary.importedBankDocumentCount,
    shouldHideUploads: flowSummary.shouldHideUploads,
    shouldHideSignatures: flowSummary.shouldHideSignatures,
    isCompleted: flowSummary.isCompleted,
    steps,
  }
}
