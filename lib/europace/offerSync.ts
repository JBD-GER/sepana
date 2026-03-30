import type { SupabaseClient } from "@supabase/supabase-js"
import { exportEuropaceVorgang } from "@/lib/europace/export"
import { buildOfferAcceptanceFailureMessage } from "@/lib/europace/offerAcceptance"
import {
  EuropaceOfferValidationError,
  getOfferValidationMessage,
  isAccountCheckOfferMessage,
} from "@/lib/europace/offerEligibility"
import { EuropaceGraphQLError } from "@/lib/europace/graphql"
import { acceptEuropaceOffer, getEuropaceAnnahmeJob, getEuropaceOffers } from "@/lib/europace/offers"
import { compareEuropaceOfferRevisionsDesc } from "@/lib/europace/offerToken"
import {
  getMonthlyAmountPlausibilityValidationIssue,
  ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
  ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
} from "@/lib/onlinekredit/validation"
import {
  buildEuropaceApplicationDecisionMessage,
  findExactEuropaceApplication,
  findRelevantEuropaceApplication,
  findRejectedEuropaceApplication,
  isRejectedEuropaceStatus,
  looksLikeTechnicalEuropaceDecisionMessage,
  normalizeEuropaceApplications,
  syncCaseEuropaceSnapshot,
  type EuropaceApplicationStatusView,
} from "@/lib/europace/status"
import type { EuropaceOfferSummary } from "@/lib/europace/types"

type MinimalSupabase = Pick<SupabaseClient, "from" | "storage">

export type EuropaceStoredOfferView = {
  angebotId: string
  machbarkeitStatus: string | null
  vollstaendigkeitStatus: string | null
  providerName: string | null
  productName: string | null
  monthlyRate: number | null
  effectiveRate: number | null
  nominalRate: number | null
  creditAmount: number | null
  payoutAmount: number | null
  termMonths: number | null
  sofortkredit: boolean
  score: number | null
  snapshot: EuropaceOfferSummary
}

export type EuropaceAnnahmeJobView = {
  jobId: string
  status: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  hasApplication: boolean
  applications: EuropaceApplicationStatusView[]
  hasRejectedApplication: boolean
  terminalMessage: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

type LocalOfferLookupRow = {
  angebot_id: string
  accepted_at?: string | null
  superseded_at?: string | null
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  angebot_snapshot?: EuropaceOfferSummary | null
}

function providerNameFromOfferSnapshot(snapshot: EuropaceOfferSummary | null | undefined) {
  return trimOrNull(snapshot?.ratenkredit?.produktanbieter?.name)
}

function productNameFromOfferSnapshot(snapshot: EuropaceOfferSummary | null | undefined) {
  return trimOrNull(snapshot?.ratenkredit?.produktbezeichnung)
}

function accountCheckModeFromOfferSnapshot(snapshot: EuropaceOfferSummary | null | undefined) {
  return trimOrNull(snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)?.toUpperCase() ?? null
}

function buildOfferIdentityFromSnapshot(snapshot: EuropaceOfferSummary | null | undefined) {
  return JSON.stringify({
    provider: providerNameFromOfferSnapshot(snapshot),
    product: productNameFromOfferSnapshot(snapshot),
    amount: numberOrNull(snapshot?.gesamtkonditionen?.nettokreditbetrag ?? snapshot?.gesamtkonditionen?.gesamtkreditbetrag),
    payout: numberOrNull(snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    term: numberOrNull(snapshot?.gesamtkonditionen?.laufzeitInMonaten),
    effectiveRate: numberOrNull(snapshot?.gesamtkonditionen?.effektivzins),
    nominalRate: numberOrNull(snapshot?.gesamtkonditionen?.sollzins),
    online: Boolean(snapshot?.sofortkredit),
    accountCheckMode: accountCheckModeFromOfferSnapshot(snapshot),
  })
}

function isSelectableStoredOffer(offer: EuropaceStoredOfferView) {
  const vollstaendigkeit = trimOrNull(offer.vollstaendigkeitStatus)?.toUpperCase()
  const machbarkeit = trimOrNull(offer.machbarkeitStatus)?.toUpperCase()
  return vollstaendigkeit === "VOLLSTAENDIG" && (machbarkeit === "MACHBAR" || machbarkeit === "MACHBAR_UNTER_VORBEHALT")
}

function compareResolvedOfferCandidates(left: EuropaceStoredOfferView, right: EuropaceStoredOfferView) {
  const leftSelectable = Number(isSelectableStoredOffer(left))
  const rightSelectable = Number(isSelectableStoredOffer(right))
  if (leftSelectable !== rightSelectable) return rightSelectable - leftSelectable

  const revisionDiff = compareEuropaceOfferRevisionsDesc(left.angebotId, right.angebotId)
  if (revisionDiff !== 0) return revisionDiff

  const effectiveDiff = (left.effectiveRate ?? Number.POSITIVE_INFINITY) - (right.effectiveRate ?? Number.POSITIVE_INFINITY)
  if (effectiveDiff !== 0) return effectiveDiff

  const monthlyRateDiff = (left.monthlyRate ?? Number.POSITIVE_INFINITY) - (right.monthlyRate ?? Number.POSITIVE_INFINITY)
  if (monthlyRateDiff !== 0) return monthlyRateDiff

  return String(left.angebotId ?? "").localeCompare(String(right.angebotId ?? ""), "de", { sensitivity: "base" })
}

function findCurrentOfferVariant(referenceOffer: LocalOfferLookupRow, offers: EuropaceStoredOfferView[]) {
  const referenceSnapshot = (referenceOffer.angebot_snapshot ?? null) as EuropaceOfferSummary | null
  const referenceIdentity = buildOfferIdentityFromSnapshot(referenceSnapshot)
  const referenceProvider = providerNameFromOfferSnapshot(referenceSnapshot)
  const referenceProduct = productNameFromOfferSnapshot(referenceSnapshot)
  const referenceAmount = numberOrNull(
    referenceSnapshot?.gesamtkonditionen?.nettokreditbetrag ?? referenceSnapshot?.gesamtkonditionen?.gesamtkreditbetrag
  )
  const referencePayout = numberOrNull(referenceSnapshot?.gesamtkonditionen?.auszahlungsbetrag)
  const referenceTerm = numberOrNull(referenceSnapshot?.gesamtkonditionen?.laufzeitInMonaten)
  const referenceOnline = Boolean(referenceSnapshot?.sofortkredit)
  const referenceAccountCheckMode = accountCheckModeFromOfferSnapshot(referenceSnapshot)

  const candidates = offers
    .map((offer) => {
      const sameProviderProduct = offer.providerName === referenceProvider && offer.productName === referenceProduct
      const sameFinancialShape =
        offer.creditAmount === referenceAmount && offer.payoutAmount === referencePayout && offer.termMonths === referenceTerm
      const sameDigitalFlow =
        Boolean(offer.sofortkredit) === referenceOnline &&
        accountCheckModeFromOfferSnapshot(offer.snapshot) === referenceAccountCheckMode

      if (offer.angebotId === referenceOffer.angebot_id) return { offer, matchRank: 0 }
      if (buildOfferIdentityFromSnapshot(offer.snapshot) === referenceIdentity) return { offer, matchRank: 1 }
      if (sameProviderProduct && sameFinancialShape && sameDigitalFlow) return { offer, matchRank: 2 }
      if (sameProviderProduct && sameFinancialShape) return { offer, matchRank: 3 }
      if (sameProviderProduct) return { offer, matchRank: 4 }
      return null
    })
    .filter(Boolean) as Array<{ offer: EuropaceStoredOfferView; matchRank: number }>

  if (!candidates.length) return null

  candidates.sort((left, right) => left.matchRank - right.matchRank || compareResolvedOfferCandidates(left.offer, right.offer))
  return candidates[0]?.offer ?? null
}

function isOfferProductReferenceError(error: unknown) {
  if (error instanceof EuropaceGraphQLError) {
    const details = Array.isArray(error.details) ? error.details : []
    if (
      details.some((entry) =>
        String((entry as { message?: unknown })?.message ?? "")
          .toLowerCase()
          .includes("produktreferenz")
      )
    ) {
      return true
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase()
  return message.includes("produktreferenz") || message.includes("product reference")
}

function isOfferTechnicalAcceptanceError(error: unknown) {
  if (error instanceof EuropaceGraphQLError) {
    const details = Array.isArray(error.details) ? error.details : []
    if (
      details.some((entry) =>
        looksLikeTechnicalEuropaceDecisionMessage(String((entry as { message?: unknown })?.message ?? ""))
      )
    ) {
      return true
    }
  }

  return looksLikeTechnicalEuropaceDecisionMessage(error instanceof Error ? error.message : error)
}

function serializeEuropaceError(error: unknown) {
  if (error instanceof EuropaceGraphQLError) {
    return {
      name: error.name,
      message: error.message,
      details: error.details ?? null,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return {
    message: String(error ?? "unknown_error"),
  }
}

function normalizeOffer(offer: EuropaceOfferSummary): EuropaceStoredOfferView | null {
  const angebotId = trimOrNull(offer.id)
  if (!angebotId) return null

  return {
    angebotId,
    machbarkeitStatus: trimOrNull(offer.machbarkeit?.status),
    vollstaendigkeitStatus: trimOrNull(offer.vollstaendigkeit?.status),
    providerName: trimOrNull(offer.ratenkredit?.produktanbieter?.name),
    productName: trimOrNull(offer.ratenkredit?.produktbezeichnung),
    monthlyRate: numberOrNull(offer.gesamtkonditionen?.rateMonatlich),
    effectiveRate: numberOrNull(offer.gesamtkonditionen?.effektivzins),
    nominalRate: numberOrNull(offer.gesamtkonditionen?.sollzins),
    creditAmount: numberOrNull(
      offer.gesamtkonditionen?.nettokreditbetrag ?? offer.gesamtkonditionen?.gesamtkreditbetrag
    ),
    payoutAmount: numberOrNull(offer.gesamtkonditionen?.auszahlungsbetrag),
    termMonths: numberOrNull(offer.gesamtkonditionen?.laufzeitInMonaten),
    sofortkredit: Boolean(offer.sofortkredit),
    score: numberOrNull(offer.vorhersage?.machbarkeit?.score),
    snapshot: offer,
  }
}

function normalizeAnnahmeJob(
  jobId: string,
  job:
    | {
        status?: string | null
        antrag?: {
          antragsnummer?: string | null
          produktanbieterantragsnummer?: string | null
        } | null
      }
    | null
    | undefined
): EuropaceAnnahmeJobView {
  return {
    jobId,
    status: trimOrNull(job?.status),
    antragsnummer: trimOrNull(job?.antrag?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(job?.antrag?.produktanbieterantragsnummer),
    hasApplication: Boolean(trimOrNull(job?.antrag?.antragsnummer)),
    applications: [],
    hasRejectedApplication: false,
    terminalMessage: null,
  }
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function offerRequiresConfirmedAccountCheck(
  offer:
    | {
        angebot_snapshot?: {
          digitalisierungsmerkmale?: {
            accountCheck?: {
              modus?: string | null
            } | null
          } | null
          vollstaendigkeit?: {
            messages?: Array<{
              text?: string | null
              property?: string | null
              category?: string | null
              reason?: string | null
            }> | null
          } | null
        } | null
      }
    | null
    | undefined
) {
  const mode = normalizeStatus(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)
  const messages = Array.isArray(offer?.angebot_snapshot?.vollstaendigkeit?.messages)
    ? offer?.angebot_snapshot?.vollstaendigkeit?.messages ?? []
    : []

  return mode === "REQUIRED" || messages.some((entry) => isAccountCheckOfferMessage(entry))
}

async function assertStoredFinancialPlausibility(admin: MinimalSupabase, caseId: string) {
  const [applicantsResult, additionalResult] = await Promise.all([
    admin.from("case_applicants").select("role,net_income_monthly").eq("case_id", caseId),
    admin.from("case_additional_details").select("warm_rent_monthly,warm_rent_not_applicable").eq("case_id", caseId).maybeSingle(),
  ])

  if (applicantsResult.error) throw applicantsResult.error
  if (additionalResult.error) throw additionalResult.error

  const applicants = Array.isArray(applicantsResult.data) ? applicantsResult.data : []
  const primaryApplicant = applicants.find((row) => trimOrNull((row as { role?: unknown }).role) === "primary")
  const coApplicant = applicants.find((row) => trimOrNull((row as { role?: unknown }).role) === "co")

  const primaryValidationIssue = getMonthlyAmountPlausibilityValidationIssue({
    value: (primaryApplicant as { net_income_monthly?: unknown } | undefined)?.net_income_monthly,
    max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
    step: "employment",
    section: "beruf",
    fields: ["net_income_monthly"],
    label: "Das Nettoeinkommen",
  })
  if (primaryValidationIssue) {
    throw new EuropaceOfferValidationError(
      `${primaryValidationIssue.message} Bitte pruefe die Angaben im Antrag und speichere sie erneut.`,
      409
    )
  }

  const coValidationIssue = getMonthlyAmountPlausibilityValidationIssue({
    value: (coApplicant as { net_income_monthly?: unknown } | undefined)?.net_income_monthly,
    max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
    step: "co",
    section: "zweiter-kreditnehmer",
    fields: ["net_income_monthly"],
    label: "Das Nettoeinkommen von Antragsteller 2",
  })
  if (coValidationIssue) {
    throw new EuropaceOfferValidationError(
      `${coValidationIssue.message} Bitte pruefe die Angaben im Antrag und speichere sie erneut.`,
      409
    )
  }

  const additional = additionalResult.data as
    | {
        warm_rent_monthly?: unknown
        warm_rent_not_applicable?: unknown
      }
    | null
    | undefined
  if (!additional?.warm_rent_not_applicable) {
    const warmRentValidationIssue = getMonthlyAmountPlausibilityValidationIssue({
      value: additional?.warm_rent_monthly,
      max: ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
      step: "residence",
      section: "wohnen",
      fields: ["current_warm_rent"],
      label: "Die Warmmiete",
    })
    if (warmRentValidationIssue) {
      throw new EuropaceOfferValidationError(
        `${warmRentValidationIssue.message} Bitte pruefe die Angaben im Antrag und speichere sie erneut.`,
        409
      )
    }
  }
}

export async function hasFinishedAccountCheckAfterLatestStart(admin: MinimalSupabase, caseId: string) {
  const { data, error } = await admin
    .from("case_europace_sync_events")
    .select("operation,created_at,success")
    .eq("case_id", caseId)
    .eq("success", true)
    .in("operation", ["createAccountCheckSession", "accountCheckCompleted"])
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const latestStart = rows.find((row) => row.operation === "createAccountCheckSession")
  if (!latestStart?.created_at) return false

  const latestFinished = rows.find((row) => row.operation === "accountCheckCompleted")
  if (!latestFinished?.created_at) return false

  return new Date(latestFinished.created_at).getTime() >= new Date(latestStart.created_at).getTime()
}

function isOfferConflictError(error: unknown) {
  if (error instanceof EuropaceGraphQLError) {
    const details = Array.isArray(error.details) ? error.details : []
    if (details.some((entry) => Number((entry as { status?: unknown })?.status ?? 0) === 409)) return true
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase()
  return message.includes("409") || message.includes("conflict")
}

function isOfferIncompleteError(error: unknown) {
  if (error instanceof EuropaceGraphQLError) {
    const details = Array.isArray(error.details) ? error.details : []
    if (
      details.some((entry) =>
        String((entry as { message?: unknown })?.message ?? "")
          .toLowerCase()
          .includes("angebot is incomplete")
      )
    ) {
      return true
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase()
  return message.includes("angebot is incomplete") || message.includes("offer is incomplete")
}

async function logOfferSyncEvent(admin: MinimalSupabase, input: {
  caseId: string
  vorgangsnummer: string
  operation?: string
  success: boolean
  requestPayload?: unknown
  responsePayload?: unknown
  errorMessage?: string | null
}) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: "outbound",
    operation: input.operation ?? "angeboteAbrufen",
    request_payload: input.requestPayload ?? { vorgangsnummer: input.vorgangsnummer },
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

async function findAcceptedOfferIdForJob(admin: MinimalSupabase, caseId: string, jobId: string) {
  const { data, error } = await admin
    .from("case_europace_sync_events")
    .select("request_payload,response_payload,operation,success")
    .eq("case_id", caseId)
    .eq("operation", "angebotAnnehmen")
    .eq("success", true)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw error

  const row = (data ?? []).find((entry) => {
    const responsePayload = (entry as { response_payload?: Record<string, unknown> | null }).response_payload ?? null
    return trimOrNull(responsePayload?.jobId) === jobId
  }) as { request_payload?: Record<string, unknown> | null } | undefined

  return trimOrNull(row?.request_payload?.resolvedAngebotId) ?? trimOrNull(row?.request_payload?.angebotId)
}

async function findStoredOfferLookupRow(admin: MinimalSupabase, caseId: string, angebotId: string) {
  const { data, error } = await admin
    .from("case_europace_offers")
    .select("angebot_id,accepted_at,superseded_at,angebot_snapshot,machbarkeit_status,vollstaendigkeit_status")
    .eq("case_id", caseId)
    .eq("angebot_id", angebotId)
    .maybeSingle()

  if (error) throw error
  if (!data?.angebot_id) return null

  return {
    angebot_id: data.angebot_id,
    accepted_at: data.accepted_at,
    superseded_at: data.superseded_at,
    machbarkeit_status: data.machbarkeit_status,
    vollstaendigkeit_status: data.vollstaendigkeit_status,
    angebot_snapshot: (data.angebot_snapshot ?? null) as EuropaceOfferSummary | null,
  } satisfies LocalOfferLookupRow
}

async function refreshOfferVariantAfterAcceptanceFailure(admin: MinimalSupabase, caseId: string, jobId: string) {
  let referenceOffer: LocalOfferLookupRow | null = null
  let acceptedOfferId: string | null = null

  try {
    acceptedOfferId = await findAcceptedOfferIdForJob(admin, caseId, jobId)
    if (acceptedOfferId) {
      referenceOffer = await findStoredOfferLookupRow(admin, caseId, acceptedOfferId)
    }
  } catch {
    referenceOffer = null
  }

  try {
    const refreshed = await refreshEuropaceOffers(admin, caseId)
    const currentOffer = referenceOffer ? findCurrentOfferVariant(referenceOffer, refreshed.offers) : null
    const currentOfferId = trimOrNull(currentOffer?.angebotId)

    return {
      offerReloaded: true,
      replacementOfferChanged: Boolean(currentOfferId && acceptedOfferId && currentOfferId !== acceptedOfferId),
      currentOfferSelectable: Boolean(currentOffer && isSelectableStoredOffer(currentOffer)),
    }
  } catch {
    return {
      offerReloaded: false,
      replacementOfferChanged: false,
      currentOfferSelectable: false,
    }
  }
}

function withApplications(job: EuropaceAnnahmeJobView, applications: EuropaceApplicationStatusView[], terminalMessage?: string | null) {
  const currentApplication = findRelevantEuropaceApplication(applications, {
    antragsnummer: job.antragsnummer,
    produktanbieterantragsnummer: job.produktanbieterantragsnummer,
  })
  const rejectedApplication = findRejectedEuropaceApplication(applications, {
    antragsnummer: job.antragsnummer,
    produktanbieterantragsnummer: job.produktanbieterantragsnummer,
  })

  return {
    ...job,
    antragsnummer: trimOrNull(currentApplication?.antragsnummer) ?? job.antragsnummer,
    produktanbieterantragsnummer:
      trimOrNull(currentApplication?.produktanbieterantragsnummer) ?? job.produktanbieterantragsnummer,
    hasApplication: job.hasApplication || Boolean(trimOrNull(currentApplication?.antragsnummer)),
    applications,
    hasRejectedApplication: Boolean(rejectedApplication),
    terminalMessage: trimOrNull(terminalMessage) ?? buildEuropaceApplicationDecisionMessage(rejectedApplication),
  }
}

export async function refreshEuropaceOffers(admin: MinimalSupabase, caseId: string) {
  const now = new Date().toISOString()
  const { data: mapping, error: mappingError } = await admin
    .from("case_europace")
    .select("vorgangsnummer")
    .eq("case_id", caseId)
    .maybeSingle()

  if (mappingError) throw mappingError

  const vorgangsnummer = trimOrNull(mapping?.vorgangsnummer)
  if (!vorgangsnummer) {
    throw new Error("Kein Europace-Vorgang vorhanden. Bitte zuerst synchronisieren.")
  }

  try {
    const rawOffers = await getEuropaceOffers(vorgangsnummer)
    const offers = rawOffers.map(normalizeOffer).filter(Boolean) as EuropaceStoredOfferView[]

    const { error: supersedeError } = await admin
      .from("case_europace_offers")
      .update({
        superseded_at: now,
        updated_at: now,
      })
      .eq("case_id", caseId)
      .is("accepted_at", null)
      .is("superseded_at", null)

    if (supersedeError) throw supersedeError

    if (offers.length) {
      const { error: upsertError } = await admin.from("case_europace_offers").upsert(
        offers.map((offer) => ({
          case_id: caseId,
          angebot_id: offer.angebotId,
          angebot_snapshot: offer.snapshot,
          machbarkeit_status: offer.machbarkeitStatus,
          vollstaendigkeit_status: offer.vollstaendigkeitStatus,
          calculated_at: now,
          superseded_at: null,
          updated_at: now,
        })),
        { onConflict: "case_id,angebot_id" }
      )

      if (upsertError) throw upsertError
    }

    await admin
      .from("case_europace")
      .update({
        last_sync_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await logOfferSyncEvent(admin, {
      caseId,
      vorgangsnummer,
      success: true,
      responsePayload: rawOffers,
    })

    return {
      vorgangsnummer,
      offers,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Angebote konnten nicht geladen werden."

    await admin
      .from("case_europace")
      .update({
        last_error: message,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await logOfferSyncEvent(admin, {
      caseId,
      vorgangsnummer,
      success: false,
      errorMessage: message,
    })

    throw error
  }
}

export async function acceptEuropaceOfferForCase(admin: MinimalSupabase, caseId: string, input: { angebotId: string }) {
  const now = new Date().toISOString()
  const angebotId = trimOrNull(input.angebotId)
  if (!angebotId) {
    throw new Error("angebotId fehlt.")
  }

  const { data: mapping, error: mappingError } = await admin
    .from("case_europace")
    .select("vorgangsnummer,annahme_job_id,last_export_snapshot")
    .eq("case_id", caseId)
    .maybeSingle()

  if (mappingError) throw mappingError

  const vorgangsnummer = trimOrNull(mapping?.vorgangsnummer)
  const hasRejectedApplication = Boolean(
    findRejectedEuropaceApplication(
      normalizeEuropaceApplications(
        (mapping?.last_export_snapshot ?? null) as Parameters<typeof normalizeEuropaceApplications>[0]
      )
    )
  )
  if (!vorgangsnummer) {
    throw new Error("Kein Europace-Vorgang vorhanden. Bitte zuerst synchronisieren.")
  }
  if (trimOrNull(mapping?.annahme_job_id)) {
    throw new Error("Es laeuft bereits ein Europace-Annahmejob fuer diesen Fall.")
  }

  const { data: offerRow, error: offerError } = await admin
    .from("case_europace_offers")
    .select("angebot_id,accepted_at,superseded_at,angebot_snapshot,machbarkeit_status,vollstaendigkeit_status")
    .eq("case_id", caseId)
    .eq("angebot_id", angebotId)
    .maybeSingle()

  if (offerError) throw offerError
  if (!offerRow?.angebot_id) {
    throw new Error("Das Angebot ist lokal nicht vorhanden. Bitte zuerst die Europace-Angebote aktualisieren.")
  }
  if (offerRow.accepted_at) {
    throw new Error("Dieses Europace-Angebot wurde bereits angenommen.")
  }
  if (offerRow.superseded_at) {
    throw new Error("Dieses Europace-Angebot ist veraltet. Bitte Angebote neu abrufen.")
  }

  let latestResolvedOffer = findCurrentOfferVariant(
    {
      angebot_id: offerRow.angebot_id,
      accepted_at: offerRow.accepted_at,
      superseded_at: offerRow.superseded_at,
      machbarkeit_status: offerRow.machbarkeit_status,
      vollstaendigkeit_status: offerRow.vollstaendigkeit_status,
      angebot_snapshot: (offerRow.angebot_snapshot ?? null) as EuropaceOfferSummary | null,
    },
    (await refreshEuropaceOffers(admin, caseId)).offers
  )

  if (!latestResolvedOffer) {
    throw new EuropaceOfferValidationError(
      "Dieses Angebot wurde nach der letzten Aktualisierung vom Produktanbieter ersetzt. Bitte pruefe die finalen Konditionen erneut.",
      409
    )
  }

  const resolvedOfferId = trimOrNull(latestResolvedOffer.angebotId)
  const validationMessage = getOfferValidationMessage({
    accepted_at: null,
    superseded_at: null,
    machbarkeit_status: latestResolvedOffer.machbarkeitStatus,
    vollstaendigkeit_status: latestResolvedOffer.vollstaendigkeitStatus,
    angebot_snapshot: latestResolvedOffer.snapshot,
  })
  if (validationMessage) {
    throw new EuropaceOfferValidationError(validationMessage, 409)
  }
  if (offerRequiresConfirmedAccountCheck({
    angebot_snapshot: latestResolvedOffer.snapshot,
  })) {
    const hasFinishedAccountCheck = await hasFinishedAccountCheckAfterLatestStart(admin, caseId)
    if (!hasFinishedAccountCheck) {
      throw new EuropaceOfferValidationError(
        "Fuer dieses Angebot muss der Kontocheck zuerst im Browser vollstaendig abgeschlossen werden. Bitte schliesse ihn ab und pruefe danach die finalen Konditionen erneut.",
        409
      )
    }
  }
  await assertStoredFinancialPlausibility(admin, caseId)

  try {
    let finalAcceptedOfferId = resolvedOfferId ?? angebotId
    let response
    try {
      response = await acceptEuropaceOffer(vorgangsnummer, finalAcceptedOfferId)
    } catch (error) {
      if (!isOfferConflictError(error) && !isOfferProductReferenceError(error) && !isOfferTechnicalAcceptanceError(error)) {
        throw error
      }

      const refreshedOffers = await refreshEuropaceOffers(admin, caseId)
      const retryOffer = findCurrentOfferVariant(
        {
          angebot_id: latestResolvedOffer.angebotId,
          accepted_at: null,
          superseded_at: null,
          machbarkeit_status: latestResolvedOffer.machbarkeitStatus,
          vollstaendigkeit_status: latestResolvedOffer.vollstaendigkeitStatus,
          angebot_snapshot: latestResolvedOffer.snapshot,
        },
        refreshedOffers.offers
      )
      const retryOfferId = trimOrNull(retryOffer?.angebotId)
      if (!retryOffer || !retryOfferId || retryOfferId === finalAcceptedOfferId) {
        throw error
      }

      latestResolvedOffer = retryOffer
      finalAcceptedOfferId = retryOfferId
      response = await acceptEuropaceOffer(vorgangsnummer, finalAcceptedOfferId)
    }

    const jobId = trimOrNull(response?.jobId)
    if (!jobId) {
      throw new Error("Europace hat keine jobId fuer die Angebotsannahme geliefert.")
    }

    await admin
      .from("case_europace")
      .update({
        annahme_job_id: jobId,
        antragsnummer: hasRejectedApplication ? null : undefined,
        produktanbieterantragsnummer: hasRejectedApplication ? null : undefined,
        last_sync_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await logOfferSyncEvent(admin, {
      caseId,
      vorgangsnummer,
      operation: "angebotAnnehmen",
      success: true,
      requestPayload: { vorgangsnummer, angebotId, resolvedAngebotId: finalAcceptedOfferId },
      responsePayload: { jobId },
    })

    return {
      vorgangsnummer,
      angebotId: finalAcceptedOfferId,
      jobId,
    }
  } catch (error) {
    if (isOfferIncompleteError(error)) {
      await refreshEuropaceOffers(admin, caseId).catch(() => null)
    }

    const message = isOfferIncompleteError(error)
      ? "Dieses Angebot ist laut Produktanbieter noch nicht vollstaendig final annehmbar. Bitte rufe die Angebote erneut ab. Wenn ein Kontocheck noetig ist, muss dieser zuerst abgeschlossen sein."
      : isOfferConflictError(error)
        ? "Europace meldet einen Konflikt: Der Vorgang hat sich nach der Angebotsberechnung geaendert. Bitte Angebote neu abrufen."
        : isOfferProductReferenceError(error)
          ? "Der Produktanbieter meldet, dass sich die Angebotsreferenz nach dem Kontocheck geaendert hat. Bitte pruefe die finalen Konditionen erneut."
          : isOfferTechnicalAcceptanceError(error)
            ? "Der Produktanbieter konnte das Angebot technisch nicht final pruefen. Wir haben die Angebotsdaten bereits neu geladen. Bitte versuche es erneut."
        : error instanceof Error
          ? error.message
          : "Europace-Angebot konnte nicht angenommen werden."

    await admin
      .from("case_europace")
      .update({
        last_error: message,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await logOfferSyncEvent(admin, {
      caseId,
      vorgangsnummer,
      operation: "angebotAnnehmen",
      success: false,
      requestPayload: { vorgangsnummer, angebotId, resolvedAngebotId: resolvedOfferId ?? angebotId },
      errorMessage: message,
      responsePayload: serializeEuropaceError(error),
    })

    throw new Error(message)
  }
}

export async function pollEuropaceOfferAcceptanceJob(admin: MinimalSupabase, caseId: string) {
  const now = new Date().toISOString()
  const { data: mapping, error: mappingError } = await admin
    .from("case_europace")
    .select("vorgangsnummer,annahme_job_id")
    .eq("case_id", caseId)
    .maybeSingle()

  if (mappingError) throw mappingError

  const vorgangsnummer = trimOrNull(mapping?.vorgangsnummer)
  if (!vorgangsnummer) {
    throw new Error("Kein Europace-Vorgang vorhanden. Bitte zuerst synchronisieren.")
  }

  const jobId = trimOrNull(mapping?.annahme_job_id)
  if (!jobId) {
    throw new Error("Kein laufender Annahmejob vorhanden.")
  }

  try {
    const rawJob = await getEuropaceAnnahmeJob(jobId)
    const baseJob = normalizeAnnahmeJob(jobId, rawJob)
    let job = baseJob

    if (baseJob.status === "PENDING") {
      await admin
        .from("case_europace")
        .update({
          last_sync_at: now,
          updated_at: now,
        })
        .eq("case_id", caseId)
    } else if (baseJob.status === "SUCCESS" && baseJob.hasApplication) {
      const exportSnapshot = await exportEuropaceVorgang(vorgangsnummer)
      await syncCaseEuropaceSnapshot(admin, caseId, exportSnapshot)
      const applications = normalizeEuropaceApplications(exportSnapshot)
      const exactApplication = findExactEuropaceApplication(applications, {
        antragsnummer: baseJob.antragsnummer,
        produktanbieterantragsnummer: baseJob.produktanbieterantragsnummer,
      })
      const rejectedApplication =
        exactApplication &&
        (isRejectedEuropaceStatus(exactApplication.antragstellerstatus) ||
          isRejectedEuropaceStatus(exactApplication.produktanbieterstatus))
          ? exactApplication
          : null
      const rejectionMessage = buildEuropaceApplicationDecisionMessage(rejectedApplication)
      job = {
        ...baseJob,
        antragsnummer: trimOrNull(exactApplication?.antragsnummer) ?? baseJob.antragsnummer,
        produktanbieterantragsnummer:
          trimOrNull(exactApplication?.produktanbieterantragsnummer) ?? baseJob.produktanbieterantragsnummer,
        hasApplication: true,
        applications,
        hasRejectedApplication: Boolean(rejectedApplication),
        terminalMessage: rejectionMessage,
      }

      const angebotId = await findAcceptedOfferIdForJob(admin, caseId, jobId)
      if (angebotId) {
        await admin
          .from("case_europace_offers")
          .update({
            accepted_at: now,
            superseded_at: null,
            updated_at: now,
          })
          .eq("case_id", caseId)
          .eq("angebot_id", angebotId)
      }

      await admin
        .from("case_europace")
        .update({
          annahme_job_id: null,
          last_error: rejectionMessage,
          last_sync_at: now,
          updated_at: now,
        })
        .eq("case_id", caseId)
    } else {
      let applications: EuropaceApplicationStatusView[] = []
      let terminalMessage = buildOfferAcceptanceFailureMessage({ status: baseJob.status })
      let hasRejectedApplicationFromExport = false

      try {
        const exportSnapshot = await exportEuropaceVorgang(vorgangsnummer)
        await syncCaseEuropaceSnapshot(admin, caseId, exportSnapshot)
        applications = normalizeEuropaceApplications(exportSnapshot)
        const rejectedApplication = findRejectedEuropaceApplication(applications, {
          antragsnummer: baseJob.antragsnummer,
          produktanbieterantragsnummer: baseJob.produktanbieterantragsnummer,
        })
        if (rejectedApplication) {
          hasRejectedApplicationFromExport = true
          terminalMessage = buildEuropaceApplicationDecisionMessage(rejectedApplication) ?? terminalMessage
        }
      } catch {
        applications = []
      }

      if (!hasRejectedApplicationFromExport) {
        const refreshContext = await refreshOfferVariantAfterAcceptanceFailure(admin, caseId, jobId)
        terminalMessage = buildOfferAcceptanceFailureMessage({
          status: baseJob.status,
          offerReloaded: refreshContext.offerReloaded,
          replacementOfferChanged: refreshContext.replacementOfferChanged,
          currentOfferSelectable: refreshContext.currentOfferSelectable,
        })
      }

      job = withApplications(baseJob, applications, terminalMessage)
      if (job.hasApplication && !job.hasRejectedApplication) {
        job = {
          ...job,
          status: "SUCCESS",
          terminalMessage: null,
        }
      } else if (!job.hasRejectedApplication) {
        job = {
          ...job,
          status: "FAILURE",
        }
      }

      await admin
        .from("case_europace")
        .update({
          annahme_job_id: null,
          last_error: job.terminalMessage,
          last_sync_at: now,
          updated_at: now,
        })
        .eq("case_id", caseId)
    }

    await admin.from("case_europace_sync_events").insert({
      case_id: caseId,
      direction: "inbound",
      operation: "annahmeJob",
      request_payload: { jobId, vorgangsnummer },
      response_payload: {
        rawJob,
        status: job.status,
        antragsnummer: job.antragsnummer,
        produktanbieterantragsnummer: job.produktanbieterantragsnummer,
        hasApplication: job.hasApplication,
        hasRejectedApplication: job.hasRejectedApplication,
        terminalMessage: job.terminalMessage,
      },
      success: true,
      error_message: null,
    })

    return job
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Annahmejob konnte nicht geladen werden."

    await admin
      .from("case_europace")
      .update({
        last_error: message,
        updated_at: now,
      })
      .eq("case_id", caseId)

    await admin.from("case_europace_sync_events").insert({
      case_id: caseId,
      direction: "inbound",
      operation: "annahmeJob",
      request_payload: { jobId, vorgangsnummer },
      response_payload: null,
      success: false,
      error_message: message,
    })

    throw error
  }
}
