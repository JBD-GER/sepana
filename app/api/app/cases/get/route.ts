// app/api/app/cases/get/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { flattenEuropaceAvailableAssignments, listEuropaceAvailableAssignments } from "@/lib/europace/documents"
import { deriveEuropaceFlowSummary } from "@/lib/europace/flow"
import { selectVisibleEuropaceOffers } from "@/lib/europace/offerVisibility"
import { normalizeEuropaceApplications } from "@/lib/europace/status"
import { deriveConcreteUploadProgress, deriveConcreteUploadTargets } from "@/lib/europace/uploadRequirements"
import { normalizeSchufaFreeDocumentRequest } from "@/lib/schufa-frei/documentRecommendations"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { getTippgeberBrandForCase } from "@/lib/tippgeber/service"

type ProviderMini = {
  id: string
  name?: string | null
  logo_horizontal_path?: string | null
  logo_icon_path?: string | null
  preferred_logo_variant?: string | null
  logo_path?: any | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function isGeneralCaseDocument(input: { signature_request_id?: string | null; document_kind?: string | null }) {
  const signatureRequestId = trimOrNull(input.signature_request_id)
  if (signatureRequestId) return false

  const documentKind = String(input.document_kind ?? "").trim().toLowerCase()
  if (documentKind === "bank_submission_bundle") return false

  return true
}

function resolveSelectedEuropaceOfferId(
  offers: Array<{ angebot_id?: string | null; accepted_at?: string | null; superseded_at?: string | null; created_at?: string | null }>,
  syncEvents: Array<{
    created_at?: string | null
    request_payload?: Record<string, unknown> | null
    response_payload?: Record<string, unknown> | null
  }>,
  reference?: { annahme_job_id?: string | null } | null
) {
  const acceptedOffer = offers
    .filter((offer) => trimOrNull(offer.accepted_at) && !trimOrNull(offer.superseded_at))
    .sort((left, right) => {
      const leftTs = new Date(String(left.accepted_at ?? left.created_at ?? "")).getTime()
      const rightTs = new Date(String(right.accepted_at ?? right.created_at ?? "")).getTime()
      return rightTs - leftTs
    })[0]
  if (trimOrNull(acceptedOffer?.angebot_id)) return trimOrNull(acceptedOffer?.angebot_id)

  const currentJobId = trimOrNull(reference?.annahme_job_id)
  if (currentJobId) {
    const byJob = syncEvents.find((event) => trimOrNull(event.response_payload?.jobId) === currentJobId)
    const jobOfferId = trimOrNull(byJob?.request_payload?.resolvedAngebotId) ?? trimOrNull(byJob?.request_payload?.angebotId)
    if (jobOfferId) return jobOfferId
  }

  const latestEvent = syncEvents.find(
    (event) => trimOrNull(event.request_payload?.resolvedAngebotId) || trimOrNull(event.request_payload?.angebotId)
  )
  return trimOrNull(latestEvent?.request_payload?.resolvedAngebotId) ?? trimOrNull(latestEvent?.request_payload?.angebotId)
}

function extractLogoRef(v: any) {
  if (!v) return null
  if (typeof v === "string") return v
  if (typeof v === "object") return v.path || v.file_path || v.storage_path || v.key || v.url || null
  return null
}

function pickProviderLogo(p: ProviderMini) {
  const prefer = p?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const picked = prefer === "icon" ? p?.logo_icon_path : p?.logo_horizontal_path
  return extractLogoRef(picked ?? p?.logo_path ?? null)
}

function isMissingAdvisorPrivateNoteColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("advisor_private_note") && (msg.includes("column") || msg.includes("exist"))
}

function isMissingBankCommissionAmountColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code !== "42703") return false
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("bank_commission_amount")
}

function isMissingEuropaceTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_europace") && (msg.includes("relation") || msg.includes("table"))
}

function isMissingCaseLiabilitiesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_liabilities") && (msg.includes("relation") || msg.includes("table"))
}

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  let { data: c, error: caseErr } = await supabase
    .from("cases")
    .select(
      "id,case_ref,advisor_case_ref,advisor_status,advisor_private_note,status,created_at,updated_at,case_type,customer_id,assigned_advisor_id"
    )
    .eq("id", id)
    .single()

  if (caseErr && isMissingAdvisorPrivateNoteColumnError(caseErr)) {
    const fallback = await supabase
      .from("cases")
      .select("id,case_ref,advisor_case_ref,advisor_status,status,created_at,updated_at,case_type,customer_id,assigned_advisor_id")
      .eq("id", id)
      .single()
    caseErr = fallback.error
    c = fallback.data ? ({ ...fallback.data, advisor_private_note: null } as any) : null
  }

  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 400 })
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role === "customer" && c.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role === "advisor" && c.assigned_advisor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role !== "customer" && role !== "advisor" && role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = supabaseAdmin()
  const readClient = admin
  const offerSelectBase =
    "id,case_id,provider_id,product_type,status,bank_status,bank_feedback_note,loan_amount,rate_monthly,interest_nominal,apr_effective,term_months,zinsbindung_years,special_repayment,created_at"
  const offerSelect = role === "customer" ? offerSelectBase : `${offerSelectBase},bank_commission_amount`

  const [
    { data: details },
    { data: applicants },
    { data: previews },
    offersResult,
    { data: docs },
    { data: docRequests },
    { data: notes },
    { data: additional },
    { data: children },
    { data: liabilities },
    { data: europace },
    { data: europaceOffers },
    { data: europaceDocuments },
    { data: europaceOfferSyncEvents },
    tippgeberReferrer,
  ] =
    await Promise.all([
      readClient.from("case_baufi_details").select("*").eq("case_id", id).maybeSingle(),
      readClient.from("case_applicants").select("*").eq("case_id", id).order("created_at", { ascending: true }),
      readClient
        .from("case_offer_previews")
        .select("id,case_id,provider_id,product_type,payload,created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      (() => {
        let query = readClient
          .from("case_offers")
          .select(offerSelect)
          .eq("case_id", id)
          .order("created_at", { ascending: false })
          .limit(50)
        // Kunden sehen finale Angebote erst, wenn sie freigegeben (sent) wurden.
        if (role === "customer") query = query.in("status", ["sent", "accepted", "rejected"])
        return query
      })(),
      readClient
        .from("documents")
        .select("id,case_id,request_id,signature_request_id,document_kind,file_name,file_path,mime_type,size_bytes,created_at,uploaded_by")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      readClient
        .from("document_requests")
        .select("id,case_id,title,required,created_at,created_by")
        .eq("case_id", id)
        .order("created_at", { ascending: true }),
      readClient
        .from("case_notes")
        .select("id,case_id,author_id,visibility,body,created_at")
        .eq("case_id", id)
        .eq("visibility", "shared")
        .order("created_at", { ascending: true })
        .limit(200),
      readClient.from("case_additional_details").select("*").eq("case_id", id).maybeSingle(),
      readClient.from("case_children").select("*").eq("case_id", id).order("created_at", { ascending: true }),
      (async () => {
        const result = await readClient.from("case_liabilities").select("*").eq("case_id", id).order("created_at", { ascending: true })
        if (result.error && isMissingCaseLiabilitiesTableError(result.error)) {
          return { data: [] }
        }
        return { data: result.data ?? [] }
      })(),
      (async () => {
        const result = await readClient
          .from("case_europace")
          .select(
            "case_id,vorgangsnummer,annahme_job_id,antragsnummer,produktanbieterantragsnummer,sync_status,last_sync_at,letzte_aenderung_am,letztes_ereignis_am,last_error,last_export_snapshot"
          )
          .eq("case_id", id)
          .maybeSingle()
        if (result.error && isMissingEuropaceTableError(result.error)) {
          return { data: null }
        }
        return { data: result.data ?? null }
      })(),
      (async () => {
        const result = await readClient
          .from("case_europace_offers")
          .select(
            "angebot_id,angebot_snapshot,machbarkeit_status,vollstaendigkeit_status,calculated_at,accepted_at,superseded_at,created_at"
          )
          .eq("case_id", id)
          .order("accepted_at", { ascending: false, nullsFirst: false })
          .order("calculated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50)
        if (result.error && isMissingEuropaceTableError(result.error)) {
          return { data: [] }
        }
        return { data: result.data ?? [] }
      })(),
      (async () => {
        const result = await readClient
          .from("case_europace_documents")
          .select(
            "local_document_id,europace_document_id,category,assignment_id,release_status,upload_status,last_sync_at,last_error,created_at"
          )
          .eq("case_id", id)
          .order("created_at", { ascending: false })
          .limit(200)
        if (result.error && isMissingEuropaceTableError(result.error)) {
          return { data: [] }
        }
        return { data: result.data ?? [] }
      })(),
      (async () => {
        const result = await readClient
          .from("case_europace_sync_events")
          .select("created_at,request_payload,response_payload,operation,success")
          .eq("case_id", id)
          .eq("operation", "angebotAnnehmen")
          .eq("success", true)
          .order("created_at", { ascending: false })
          .limit(20)
        if (result.error && isMissingEuropaceTableError(result.error)) {
          return { data: [] }
        }
        return { data: result.data ?? [] }
      })(),
      getTippgeberBrandForCase(id),
    ])

  // Supabase's typed select parser can return ParserError types for dynamic select unions.
  let offers: any[] = (offersResult?.data as any[]) ?? []
  if (offersResult?.error) {
    if (isMissingBankCommissionAmountColumnError(offersResult.error)) {
      let fallbackQuery = readClient
        .from("case_offers")
        .select(offerSelectBase)
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
      if (role === "customer") {
        fallbackQuery = fallbackQuery.in("status", ["sent", "accepted", "rejected"])
      }
      const fallbackOffers = await fallbackQuery
      offers = fallbackOffers.data ?? []
      if (fallbackOffers.error) console.error("case offers fallback query failed", fallbackOffers.error)
    } else {
      console.error("case offers query failed", offersResult.error)
    }
  }

  // OK Provider Infos für Offers nachladen (optional, wenn Tabelle existiert)
  const previewProviderIds = (previews ?? [])
    .map((p: any) => p?.provider_id)
    .filter(Boolean)
  const offerProviderIds = (offers ?? []).map((o: any) => o.provider_id).filter(Boolean)
  const providerIds = Array.from(new Set([...offerProviderIds, ...previewProviderIds])) as string[]

  const providerMap = new Map<string, { id: string; name: string | null; logo_path: any | null }>()
  if (providerIds.length) {
    // Prefer primary providers table (matches IDs used in offer_previews)
    const { data: providers, error: provErr } = await readClient
      .from("providers")
      .select("id,name,logo_horizontal_path,logo_icon_path,preferred_logo_variant")
      .in("id", providerIds)

    if (!provErr) {
      for (const p of (providers ?? []) as ProviderMini[]) {
        providerMap.set(p.id, {
          id: p.id,
          name: p.name ?? null,
          logo_path: pickProviderLogo(p),
        })
      }
    }
  }

  const offersWithProvider = (offers ?? []).map((o: any) => {
    const p = o?.provider_id ? providerMap.get(o.provider_id) : null
    return {
      ...o,
      provider_name: p?.name ?? null,
      provider_logo_path: p?.logo_path ?? null,
    }
  })

  const previewsWithProvider = (previews ?? []).map((p: any) => {
    const payloadProviderId =
      p?.payload?.providerId ??
      p?.payload?.provider_id ??
      p?.payload?.provider?.id ??
      null
    const providerId = p?.provider_id ?? payloadProviderId ?? null
    const prov = providerId ? providerMap.get(providerId) : null
    const payloadLogo = extractLogoRef(
      p?.payload?.provider?.logo_path ?? p?.payload?.provider?.logoPath ?? p?.payload?.provider?.logo ?? null
    )

    return {
      ...p,
      provider_id: providerId ?? p?.provider_id ?? null,
      provider_name: prov?.name ?? p?.payload?.provider?.name ?? null,
      provider_logo_path: prov?.logo_path ?? payloadLogo ?? null,
    }
  })

  const hasPreview = (previewsWithProvider ?? []).length > 0
  const latestOfferStatus = offersWithProvider?.[0]?.status ?? null
  const statusDisplay =
    latestOfferStatus === "accepted"
      ? "offer_accepted"
      : latestOfferStatus === "rejected"
        ? "offer_rejected"
        : latestOfferStatus === "sent"
          ? "offer_sent"
          : latestOfferStatus === "draft"
            ? "offer_created"
            : hasPreview
              ? "comparison_ready"
              : c.status

  const canViewAdvisorPrivateFields = role === "advisor" || role === "admin"
  const europaceApplications = normalizeEuropaceApplications(
    ((europace as { last_export_snapshot?: unknown } | null)?.last_export_snapshot ?? null) as {
      antraege?: Array<{
        antragsnummer?: string | null
        produktanbieterantragsnummer?: string | null
        antragstellerstatus?: string | null
        produktanbieterstatus?: string | null
        provisionsforderungsstatus?: string | null
      }> | null
    } | null
  )
  const leadingEuropaceApplication = europaceApplications[0] ?? null
  const normalizedEuropaceMeta = europace
    ? {
        ...europace,
        antragsnummer: leadingEuropaceApplication?.antragsnummer ?? europace.antragsnummer ?? null,
        produktanbieterantragsnummer:
          leadingEuropaceApplication?.produktanbieterantragsnummer ?? europace.produktanbieterantragsnummer ?? null,
      }
    : null
  const selectedEuropaceOfferId = resolveSelectedEuropaceOfferId(
    ((europaceOffers ?? []) as Array<{
      angebot_id?: string | null
      accepted_at?: string | null
      superseded_at?: string | null
      created_at?: string | null
    }>) ?? [],
    ((europaceOfferSyncEvents ?? []) as Array<{
      created_at?: string | null
      request_payload?: Record<string, unknown> | null
      response_payload?: Record<string, unknown> | null
    }>) ?? [],
    normalizedEuropaceMeta
      ? {
          annahme_job_id: normalizedEuropaceMeta.annahme_job_id ?? null,
        }
      : null
  )
  const casePayload = canViewAdvisorPrivateFields ? c : { ...c, advisor_private_note: null }
  const europacePayload = canViewAdvisorPrivateFields
    ? normalizedEuropaceMeta
      ? {
          ...normalizedEuropaceMeta,
          selected_angebot_id: selectedEuropaceOfferId,
        }
      : null
    : normalizedEuropaceMeta
      ? {
          annahme_job_id: normalizedEuropaceMeta.annahme_job_id ?? null,
          antragsnummer: normalizedEuropaceMeta.antragsnummer ?? null,
          produktanbieterantragsnummer: normalizedEuropaceMeta.produktanbieterantragsnummer ?? null,
          selected_angebot_id: selectedEuropaceOfferId,
          sync_status: normalizedEuropaceMeta.sync_status ?? null,
          last_sync_at: normalizedEuropaceMeta.last_sync_at ?? null,
          letzte_aenderung_am: normalizedEuropaceMeta.letzte_aenderung_am ?? null,
          letztes_ereignis_am: normalizedEuropaceMeta.letztes_ereignis_am ?? null,
          last_error: normalizedEuropaceMeta.last_error ?? null,
        }
      : null
  const europaceAvailableAssignments = (() => {
    if (String(c.case_type ?? "").trim().toLowerCase() !== "konsum") return []
    const vorgangsnummer = String(europace?.vorgangsnummer ?? "").trim()
    if (!vorgangsnummer) return []
    return null
  })()

  let europaceUploadTargets: Array<{
    key: string
    title: string
    category_id: string
    category_name: string | null
    category_description: string | null
    assignment_id: string | null
    assignment_type: string | null
    assignment_name: string | null
    assignment_role_name: string | null
  }> = []

  if (europaceAvailableAssignments === null) {
    try {
      const assignments = await listEuropaceAvailableAssignments(admin, {
        caseId: id,
        vorgangsnummer: String(europace?.vorgangsnummer ?? "").trim(),
        antragsnummer: String(normalizedEuropaceMeta?.antragsnummer ?? "").trim() || null,
      })

      europaceUploadTargets = flattenEuropaceAvailableAssignments(assignments).map((target) => ({
        key: target.key,
        title: target.title,
        category_id: target.categoryId,
        category_name: target.categoryName,
        category_description: target.categoryDescription,
        assignment_id: target.assignmentId,
        assignment_type: target.assignmentType,
        assignment_name: target.assignmentName,
        assignment_role_name: target.assignmentRoleName,
      }))
    } catch (error) {
      console.error("europace assignments query failed", error)
    }
  }

  const europaceRequestRows = ((docRequests ?? []) as Array<{
    id?: string | null
    title?: string | null
    created_at?: string | null
    required?: boolean | null
  }>)
    .map((row) => ({
      id: String(row?.id ?? "").trim(),
      title: String(row?.title ?? "").trim(),
      created_at: row?.created_at ?? null,
      required: row?.required ?? null,
    }))
    .filter((row) => Boolean(row.id) && Boolean(row.title))
  const europaceLocalDocumentRows = ((docs ?? []) as Array<{
    id?: string | null
    request_id?: string | null
  }>)
    .map((row) => ({
      id: String(row?.id ?? "").trim(),
      request_id: row?.request_id ?? null,
    }))
    .filter((row) => Boolean(row.id))
  const europaceDocumentMappingRows = (europaceDocuments ?? []) as Array<{
    local_document_id?: string | null
    category?: string | null
    assignment_id?: string | null
    release_status?: string | null
    upload_status?: string | null
  }>

  const concreteEuropaceUploadTargets = deriveConcreteUploadTargets({
    requests: europaceRequestRows,
    uploadTargets: europaceUploadTargets,
    documents: europaceLocalDocumentRows,
    europaceDocuments: europaceDocumentMappingRows,
  })
  const concreteEuropaceDocumentProgress = deriveConcreteUploadProgress({
    requests: europaceRequestRows,
    uploadTargets: europaceUploadTargets,
    documents: europaceLocalDocumentRows,
    europaceDocuments: europaceDocumentMappingRows,
  })
  const baseEuropaceFlow = deriveEuropaceFlowSummary({
    meta:
      (normalizedEuropaceMeta as {
        annahme_job_id?: string | null
        antragsnummer?: string | null
        last_export_snapshot?: unknown
      } | null) ?? null,
    offers: (europaceOffers ?? []) as Array<{
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
      angebot_id?: string | null
      calculated_at?: string | null
      created_at?: string | null
    }>,
    applications: europaceApplications,
    documents: europaceDocumentMappingRows,
    uploadTargets: concreteEuropaceUploadTargets,
    localDocuments: (docs ?? []) as Array<{
      id?: string | null
      file_name?: string | null
      file_path?: string | null
      mime_type?: string | null
      size_bytes?: number | null
      created_at?: string | null
    }>,
    documentProgress: {
      requiredDocumentCount: concreteEuropaceDocumentProgress.requiredCount,
      uploadedDocumentCount: concreteEuropaceDocumentProgress.uploadedCount,
      releasedDocumentCount: concreteEuropaceDocumentProgress.releasedCount,
      missingDocumentCount: concreteEuropaceDocumentProgress.missingCount,
    },
  })
  const visibleEuropaceOffers = selectVisibleEuropaceOffers(
    (europaceOffers ?? []) as Array<{
      angebot_id?: string | null
      angebot_snapshot?: unknown
      machbarkeit_status?: string | null
      vollstaendigkeit_status?: string | null
      calculated_at?: string | null
      accepted_at?: string | null
      superseded_at?: string | null
      created_at?: string | null
    }>,
    { hasRejectedApplication: baseEuropaceFlow.hasRejectedApplication }
  )

  const europaceFlow = deriveEuropaceFlowSummary({
    meta:
      (normalizedEuropaceMeta as {
        annahme_job_id?: string | null
        antragsnummer?: string | null
        last_export_snapshot?: unknown
      } | null) ?? null,
    offers: visibleEuropaceOffers as Array<{
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
    }>,
    applications: europaceApplications,
    documents: europaceDocumentMappingRows,
    uploadTargets: concreteEuropaceUploadTargets,
    localDocuments: (docs ?? []) as Array<{
      id?: string | null
      file_name?: string | null
      file_path?: string | null
      mime_type?: string | null
      size_bytes?: number | null
      created_at?: string | null
    }>,
    documentProgress: {
      requiredDocumentCount: concreteEuropaceDocumentProgress.requiredCount,
      uploadedDocumentCount: concreteEuropaceDocumentProgress.uploadedCount,
      releasedDocumentCount: concreteEuropaceDocumentProgress.releasedCount,
      missingDocumentCount: concreteEuropaceDocumentProgress.missingCount,
    },
  })

  let advisor: any = null
  if (c.assigned_advisor_id) {
    const [{ data: prof }, { data: authUser }] = await Promise.all([
      readClient
        .from("advisor_profiles")
        .select("display_name,bio,languages,photo_path,phone,is_active")
        .eq("user_id", c.assigned_advisor_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(c.assigned_advisor_id),
    ])

    const meta = (authUser as any)?.user?.user_metadata ?? {}
    const metaName =
      [meta?.first_name, meta?.last_name].filter(Boolean).join(" ").trim() ||
      meta?.full_name ||
      null
    advisor = {
      id: c.assigned_advisor_id,
      email: authUser?.user?.email ?? null,
      display_name: prof?.display_name ?? metaName ?? null,
      bio: prof?.bio ?? meta?.bio ?? null,
      languages: prof?.languages ?? (Array.isArray(meta?.languages) ? meta.languages : []) ?? [],
      photo_path: prof?.photo_path ?? meta?.photo_path ?? null,
      phone: prof?.phone ?? meta?.phone ?? null,
      is_active: prof?.is_active ?? null,
    }
  }

  const normalizedDocumentRequests =
    String(c.case_type ?? "").trim().toLowerCase() === "schufa_frei"
      ? ((docRequests ?? []) as Array<{ id?: string | null; case_id?: string | null; title?: string | null; required?: boolean | null; created_at?: string | null; created_by?: string | null }>).map(
          (request) => normalizeSchufaFreeDocumentRequest(request)
        )
      : docRequests ?? []

  const visibleDocuments = ((docs ?? []) as Array<{
    id?: string | null
    case_id?: string | null
    request_id?: string | null
    signature_request_id?: string | null
    document_kind?: string | null
    file_name?: string | null
    file_path?: string | null
    mime_type?: string | null
    size_bytes?: number | null
    created_at?: string | null
    uploaded_by?: string | null
  }>)
    .filter((document) => isGeneralCaseDocument(document))
    .map((document) => {
      const next = { ...document }
      delete next.signature_request_id
      delete next.document_kind
      return next
    })

  return NextResponse.json({
    case: { ...casePayload, status_display: statusDisplay },
    baufi_details: details ?? null,
    applicants: applicants ?? [],
    additional: additional ?? null,
    children: children ?? [],
    liabilities: liabilities ?? [],
    offer_previews: previewsWithProvider ?? [],
    offers: offersWithProvider,
    documents: visibleDocuments,
    document_requests: normalizedDocumentRequests,
    chat: notes ?? [],
    advisor,
    europace: europacePayload,
    europace_applications: europaceApplications,
    europace_flow: europaceFlow,
    europace_offers: visibleEuropaceOffers,
    europace_documents: europaceDocuments ?? [],
    europace_upload_targets: concreteEuropaceUploadTargets,
    recommended_by: tippgeberReferrer ?? null,
    viewer_role: role ?? null,
  })
}


