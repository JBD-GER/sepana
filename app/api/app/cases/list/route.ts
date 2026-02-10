// app/api/app/cases/list/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

function readPositiveInt(raw: string | null, fallback: number) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

type BaseCaseRow = {
  id: string
  case_ref: string | null
  advisor_case_ref: string | null
  advisor_status: string | null
  status: string
  created_at: string
  assigned_advisor_id: string | null
  case_type: string
}

type ProviderMini = {
  id: string
  name?: string | null
  logo_horizontal_path?: string | null
  logo_icon_path?: string | null
  preferred_logo_variant?: string | null
  logo_path?: unknown | null
}

type DocRow = {
  id: string
  case_id: string
}

type ApplicantRow = {
  case_id: string
  first_name: string | null
  last_name: string | null
}

type OfferRow = {
  id: string
  case_id: string
  provider_id: string | null
  status: string | null
  bank_status: string | null
  bank_feedback_note: string | null
  bank_confirmed_at: string | null
  loan_amount: number | null
  rate_monthly: number | null
  apr_effective: number | null
  interest_nominal: number | null
  zinsbindung_years: number | null
  special_repayment: string | null
  created_at: string
}

type PreviewRow = {
  id: string
  case_id: string
  provider_id: string | null
  payload: unknown
  created_at: string
}

type PreviewSummary = {
  provider_id: string | null
  provider_name: string | null
  provider_logo_path: string | null
  loan_amount: number | null
  rate_monthly: number | null
  apr_effective: number | null
  interest_nominal: number | null
  zinsbindung_years: number | null
  special_repayment: string | null
}

function extractLogoRef(v: unknown) {
  if (!v) return null
  if (typeof v === "string") return v
  if (typeof v === "object") {
    const row = v as Record<string, unknown>
    const direct = row.path ?? row.file_path ?? row.storage_path ?? row.key ?? row.url ?? null
    return typeof direct === "string" && direct ? direct : null
  }
  return null
}

function pickProviderLogo(p: ProviderMini) {
  const prefer = p?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const picked = prefer === "icon" ? p?.logo_icon_path : p?.logo_horizontal_path
  return extractLogoRef(picked ?? p?.logo_path ?? null)
}

function buildName(row?: ApplicantRow | null) {
  const first = String(row?.first_name ?? "").trim()
  const last = String(row?.last_name ?? "").trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

function pickPreviewSummary(payload: unknown): PreviewSummary | null {
  if (!payload) return null

  const root = typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const computed = typeof root.computed === "object" && root.computed ? (root.computed as Record<string, unknown>) : {}
  const inputs = typeof root.inputs === "object" && root.inputs ? (root.inputs as Record<string, unknown>) : {}
  const provider = typeof root.provider === "object" && root.provider ? (root.provider as Record<string, unknown>) : {}

  const logoRef = extractLogoRef(provider.logo_path ?? provider.logoPath ?? provider.logo)
  const zinsbindungRaw = computed.zinsbindung
  const zinsbindungYears =
    typeof zinsbindungRaw === "string"
      ? parseInt(String(zinsbindungRaw).replace(/\D+/g, ""), 10) || null
      : (computed.zinsbindung_years as number | null | undefined) ?? null

  return {
    provider_id:
      (root.providerId as string | null | undefined) ??
      (root.provider_id as string | null | undefined) ??
      (provider.id as string | null | undefined) ??
      null,
    provider_name: (provider.name as string | null | undefined) ?? null,
    provider_logo_path: logoRef,
    loan_amount: (inputs.loanAmount as number | null | undefined) ?? null,
    rate_monthly: (computed.rateMonthly as number | null | undefined) ?? null,
    apr_effective: (computed.aprEffective as number | null | undefined) ?? null,
    interest_nominal: (computed.interestNominal as number | null | undefined) ?? null,
    zinsbindung_years: zinsbindungYears,
    special_repayment: (computed.specialRepayment as string | null | undefined) ?? null,
  }
}

function sortByCreatedDesc<T extends { created_at: string }>(rows: T[]) {
  return rows.slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
}

function firstByLatestCreated<T extends { created_at: string }>(rows: T[]) {
  return sortByCreatedDesc(rows)[0] ?? null
}

function firstApprovedOffer(rows: OfferRow[]) {
  const approved = rows.filter((row) => String(row.bank_status ?? "").toLowerCase() === "approved")
  if (!approved.length) return null
  return approved
    .slice()
    .sort((a, b) => +new Date(b.bank_confirmed_at ?? b.created_at) - +new Date(a.bank_confirmed_at ?? a.created_at))[0]
}

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(200, readPositiveInt(url.searchParams.get("limit"), 200))
  const page = readPositiveInt(url.searchParams.get("page"), 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const advisorBucketRaw = String(url.searchParams.get("advisorBucket") || "all").trim().toLowerCase()
  const advisorBucket = advisorBucketRaw === "active" || advisorBucketRaw === "confirmed" ? advisorBucketRaw : "all"

  let baseCases: BaseCaseRow[] = []
  let baseTotal = 0

  if (role === "advisor") {
    const { data: advisorCases, error: advisorErr } = await supabase
      .from("cases")
      .select("id,case_ref,advisor_case_ref,advisor_status,status,created_at,assigned_advisor_id,case_type")
      .eq("assigned_advisor_id", user.id)
      .order("created_at", { ascending: false })
    if (advisorErr) return NextResponse.json({ error: advisorErr.message }, { status: 400 })
    baseCases = (advisorCases ?? []) as BaseCaseRow[]
    baseTotal = baseCases.length
  } else {
    let query = supabase
      .from("cases")
      .select("id,case_ref,advisor_case_ref,advisor_status,status,created_at,assigned_advisor_id,case_type", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (role === "customer") {
      query = query.eq("customer_id", user.id).eq("case_type", "baufi")
    } else if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: nonAdvisorCases, error: nonAdvisorErr, count } = await query
    if (nonAdvisorErr) return NextResponse.json({ error: nonAdvisorErr.message }, { status: 400 })
    baseCases = (nonAdvisorCases ?? []) as BaseCaseRow[]
    baseTotal = count ?? baseCases.length
  }

  const caseIds = baseCases.map((row) => row.id)
  const [{ data: docs }, { data: offers }, { data: previews }, { data: applicants }, providersRes] = await Promise.all([
    caseIds.length
      ? supabase.from("documents").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as DocRow[] }),
    caseIds.length
      ? supabase
          .from("case_offers")
          .select("id,case_id,provider_id,status,bank_status,bank_feedback_note,bank_confirmed_at,loan_amount,rate_monthly,apr_effective,interest_nominal,zinsbindung_years,special_repayment,created_at")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as OfferRow[] }),
    caseIds.length
      ? supabase.from("case_offer_previews").select("id,case_id,provider_id,payload,created_at").in("case_id", caseIds)
      : Promise.resolve({ data: [] as PreviewRow[] }),
    caseIds.length
      ? supabase
          .from("case_applicants")
          .select("case_id,first_name,last_name")
          .in("case_id", caseIds)
          .eq("role", "primary")
      : Promise.resolve({ data: [] as ApplicantRow[] }),
    supabase.from("providers").select("id,name,logo_horizontal_path,logo_icon_path,preferred_logo_variant,logo_path"),
  ])

  const docRows = (docs ?? []) as DocRow[]
  const offerRows = (offers ?? []) as OfferRow[]
  const applicantRows = (applicants ?? []) as ApplicantRow[]
  const visibleOfferRows =
    role === "customer"
      ? offerRows.filter((row) => {
          const status = String(row.status ?? "").toLowerCase()
          return status === "sent" || status === "accepted" || status === "rejected"
        })
      : offerRows
  const previewRows = (previews ?? []) as PreviewRow[]

  const docsCountByCase = new Map<string, number>()
  for (const row of docRows) docsCountByCase.set(row.case_id, (docsCountByCase.get(row.case_id) ?? 0) + 1)

  const offersByCase = new Map<string, OfferRow[]>()
  for (const row of visibleOfferRows) {
    const list = offersByCase.get(row.case_id) ?? []
    list.push(row)
    offersByCase.set(row.case_id, list)
  }

  const previewsByCase = new Map<string, PreviewRow[]>()
  for (const row of previewRows) {
    const list = previewsByCase.get(row.case_id) ?? []
    list.push(row)
    previewsByCase.set(row.case_id, list)
  }

  const applicantByCase = new Map<string, ApplicantRow>()
  for (const row of applicantRows) {
    if (!applicantByCase.has(row.case_id)) {
      applicantByCase.set(row.case_id, row)
    }
  }

  const providerMap = new Map<string, { id: string; name: string | null; logo_path: string | null }>()
  const providerRows = ((providersRes as { data?: ProviderMini[] } | null)?.data ?? []) as ProviderMini[]
  for (const provider of providerRows) {
    providerMap.set(provider.id, {
      id: provider.id,
      name: provider.name ?? null,
      logo_path: pickProviderLogo(provider),
    })
  }

  function bestOfferSummary(list: OfferRow[]): PreviewSummary | null {
    if (!list.length) return null
    const picked = firstByLatestCreated(list)
    if (!picked) return null
    const provider = picked.provider_id ? providerMap.get(picked.provider_id) : null
    return {
      provider_id: picked.provider_id ?? null,
      provider_name: provider?.name ?? null,
      provider_logo_path: provider?.logo_path ?? null,
      loan_amount: picked.loan_amount ?? null,
      rate_monthly: picked.rate_monthly ?? null,
      apr_effective: picked.apr_effective ?? null,
      interest_nominal: picked.interest_nominal ?? null,
      zinsbindung_years: picked.zinsbindung_years ?? null,
      special_repayment: picked.special_repayment ?? null,
    }
  }

  function latestPreviewSummary(list: PreviewRow[]): PreviewSummary | null {
    if (!list.length) return null
    const picked = firstByLatestCreated(list)
    if (!picked) return null
    const summary = pickPreviewSummary(picked.payload)
    const base: PreviewSummary = summary ?? {
      provider_id: null,
      provider_name: null,
      provider_logo_path: null,
      loan_amount: null,
      rate_monthly: null,
      apr_effective: null,
      interest_nominal: null,
      zinsbindung_years: null,
      special_repayment: null,
    }
    const providerId = picked.provider_id ?? base.provider_id
    const provider = providerId ? providerMap.get(providerId) : null
    return {
      ...base,
      provider_id: providerId ?? null,
      provider_name: provider?.name ?? base.provider_name ?? null,
      provider_logo_path: provider?.logo_path ?? base.provider_logo_path ?? null,
    }
  }

  const mapped = baseCases.map((baseCase) => {
    const caseOffers = offersByCase.get(baseCase.id) ?? []
    const latestOffer = firstByLatestCreated(caseOffers)
    const approvedOffer = firstApprovedOffer(caseOffers)
    const preview = latestPreviewSummary(previewsByCase.get(baseCase.id) ?? [])
    const bestOffer = bestOfferSummary(caseOffers)
    const applicant = applicantByCase.get(baseCase.id) ?? null

    const latestOfferStatus = latestOffer?.status ?? null
    const statusDisplay = approvedOffer
      ? "approved"
      : latestOfferStatus === "accepted"
        ? "offer_accepted"
        : latestOfferStatus === "rejected"
          ? "offer_rejected"
          : latestOfferStatus === "sent"
            ? "offer_sent"
            : latestOfferStatus === "draft"
              ? "offer_created"
              : preview
                ? "comparison_ready"
                : baseCase.status

    return {
      ...baseCase,
      status_display: statusDisplay,
      docsCount: docsCountByCase.get(baseCase.id) ?? 0,
      offersCount: caseOffers.length,
      previewsCount: (previewsByCase.get(baseCase.id) ?? []).length,
      comparison: preview,
      bestOffer,
      customer_name: buildName(applicant),
      is_bank_confirmed: !!approvedOffer,
      confirmed_at: approvedOffer ? approvedOffer.bank_confirmed_at ?? approvedOffer.created_at : null,
      confirmed_loan_amount: approvedOffer?.loan_amount ?? null,
    }
  })

  const scoped =
    role === "advisor" && advisorBucket === "active"
      ? mapped.filter((row) => {
          const status = String(row.status ?? "").toLowerCase()
          const closed = status === "closed" || status === "completed"
          return !row.is_bank_confirmed && !closed
        })
      : role === "advisor" && advisorBucket === "confirmed"
        ? mapped.filter((row) => row.is_bank_confirmed)
        : mapped

  if (role === "advisor") {
    const total = scoped.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const pageItems = scoped.slice(from, to + 1)
    return NextResponse.json({
      cases: pageItems,
      page,
      pageSize: limit,
      total,
      totalPages,
      advisorBucket,
    })
  }

  const total = baseTotal
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return NextResponse.json({
    cases: scoped,
    page,
    pageSize: limit,
    total,
    totalPages,
  })
}
