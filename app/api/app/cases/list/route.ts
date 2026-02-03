// app/api/app/cases/list/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

function readPositiveInt(raw: string | null, fallback: number) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
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

type OfferRow = {
  id: string
  case_id: string
  provider_id: string | null
  status: string | null
  bank_status: string | null
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

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(200, readPositiveInt(url.searchParams.get("limit"), 200))
  const page = readPositiveInt(url.searchParams.get("page"), 1)
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from("cases")
    .select("id,case_ref,status,created_at,assigned_advisor_id,case_type", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (role === "customer") {
    query = query.eq("customer_id", user.id).eq("case_type", "baufi")
  } else if (role === "advisor") {
    query = query.eq("assigned_advisor_id", user.id)
  } else if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: cases, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const caseIds = (cases ?? []).map((c) => c.id)

  const [{ data: docs }, { data: offers }, { data: previews }, providersRes] = await Promise.all([
    caseIds.length
      ? supabase.from("documents").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as DocRow[] }),
    caseIds.length
      ? supabase
          .from("case_offers")
          .select("id,case_id,provider_id,status,bank_status,loan_amount,rate_monthly,apr_effective,interest_nominal,zinsbindung_years,special_repayment,created_at")
          .in("case_id", caseIds)
      : Promise.resolve({ data: [] as OfferRow[] }),
    caseIds.length
      ? supabase.from("case_offer_previews").select("id,case_id,provider_id,payload,created_at").in("case_id", caseIds)
      : Promise.resolve({ data: [] as PreviewRow[] }),
    // optional provider table (wenn nicht vorhanden => error != null, wir ignorieren)
    supabase
      .from("providers")
      .select("id,name,logo_horizontal_path,logo_icon_path,preferred_logo_variant,logo_path"),
  ])

  // counts
  const docRows = (docs ?? []) as DocRow[]
  const offerRows = (offers ?? []) as OfferRow[]
  const previewRows = (previews ?? []) as PreviewRow[]

  const docsCountByCase = new Map<string, number>()
  for (const d of docRows) docsCountByCase.set(d.case_id, (docsCountByCase.get(d.case_id) ?? 0) + 1)

  // group offers
  const offersByCase = new Map<string, OfferRow[]>()
  for (const o of offerRows) {
    const arr = offersByCase.get(o.case_id) ?? []
    arr.push(o)
    offersByCase.set(o.case_id, arr)
  }

  // group previews
  const previewsByCase = new Map<string, PreviewRow[]>()
  for (const p of previewRows) {
    const arr = previewsByCase.get(p.case_id) ?? []
    arr.push(p)
    previewsByCase.set(p.case_id, arr)
  }

  // provider map (optional)
  const providerMap = new Map<string, { id: string; name: string | null; logo_path: string | null }>()
  const providerRows = ((providersRes as { data?: ProviderMini[] } | null)?.data ?? []) as ProviderMini[]
  for (const p of providerRows) {
    providerMap.set(p.id, {
      id: p.id,
      name: p.name ?? null,
      logo_path: pickProviderLogo(p),
    })
  }

  function bestOfferSummary(list: OfferRow[]): PreviewSummary | null {
    if (!list?.length) return null

    // Fuer die Uebersicht immer den zeitlich neuesten Offer-Stand zeigen.
    const picked = list
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]

    const prov = picked?.provider_id ? providerMap.get(picked.provider_id) : null

    return {
      provider_id: picked?.provider_id ?? null,
      provider_name: prov?.name ?? null,
      provider_logo_path: prov?.logo_path ?? null,

      loan_amount: picked?.loan_amount ?? null,
      rate_monthly: picked?.rate_monthly ?? null,
      apr_effective: picked?.apr_effective ?? null,
      interest_nominal: picked?.interest_nominal ?? null,
      zinsbindung_years: picked?.zinsbindung_years ?? null,
      special_repayment: picked?.special_repayment ?? null,
    }
  }

  function latestPreviewSummary(list: PreviewRow[]): PreviewSummary | null {
    if (!list?.length) return null
    const picked = list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]
    const s = pickPreviewSummary(picked?.payload)
    const base: PreviewSummary = s ?? {
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

    // Wenn Provider Masterdata existiert, überschreibt es Payload
    const provId = picked?.provider_id ?? base.provider_id
    const prov = provId ? providerMap.get(provId) : null

    return {
      ...base,
      provider_id: provId ?? null,
      provider_name: prov?.name ?? base.provider_name ?? null,
      provider_logo_path: prov?.logo_path ?? base.provider_logo_path ?? null,
    }
  }

  const items = (cases ?? []).map((c) => {
      const previewSum = latestPreviewSummary(previewsByCase.get(c.id) ?? [])
      const allOffers = offersByCase.get(c.id) ?? []
      const offerSum = bestOfferSummary(allOffers)
      const latestOffer = allOffers
        .slice()
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null
      const latestOfferStatus = latestOffer?.status ?? null
      const statusDisplay =
        latestOfferStatus === "accepted"
          ? "offer_accepted"
          : latestOfferStatus === "rejected"
            ? "offer_rejected"
            : latestOfferStatus === "sent"
              ? "offer_sent"
              : latestOfferStatus === "draft"
                ? "offer_created"
                : previewSum
                  ? "comparison_ready"
                  : c.status

    return {
      ...c,
      status_display: statusDisplay,
      docsCount: docsCountByCase.get(c.id) ?? 0,
      offersCount: allOffers.length,
      previewsCount: (previewsByCase.get(c.id) ?? []).length,

      comparison: previewSum, // Startschuss
      bestOffer: offerSum,    // optional
    }
  })

  const total = count ?? items.length
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return NextResponse.json({
    cases: items,
    page,
    pageSize: limit,
    total,
    totalPages,
  })
}
