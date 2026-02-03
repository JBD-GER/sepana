// app/api/app/cases/get/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type ProviderMini = {
  id: string
  name?: string | null
  logo_horizontal_path?: string | null
  logo_icon_path?: string | null
  preferred_logo_variant?: string | null
  logo_path?: any | null
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

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id,case_ref,status,created_at,updated_at,case_type,customer_id,assigned_advisor_id")
    .eq("id", id)
    .single()

  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 400 })
  if (!c) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role === "customer" && c.customer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role === "advisor" && c.assigned_advisor_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (role !== "customer" && role !== "advisor" && role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = supabaseAdmin()
  const readClient = admin

  const [
    { data: details },
    { data: applicants },
    { data: previews },
    { data: offers },
    { data: docs },
    { data: docRequests },
    { data: notes },
    { data: additional },
    { data: children },
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
      readClient
        .from("case_offers")
        .select("id,case_id,provider_id,product_type,status,bank_status,loan_amount,rate_monthly,interest_nominal,apr_effective,term_months,zinsbindung_years,special_repayment,created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      readClient
        .from("documents")
        .select("id,case_id,request_id,file_name,file_path,mime_type,size_bytes,created_at")
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
    ])

  // ✅ Provider Infos für Offers nachladen (optional, wenn Tabelle existiert)
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

  return NextResponse.json({
    case: { ...c, status_display: statusDisplay },
    baufi_details: details ?? null,
    applicants: applicants ?? [],
    additional: additional ?? null,
    children: children ?? [],
    offer_previews: previewsWithProvider ?? [],
    offers: offersWithProvider,
    documents: docs ?? [],
    document_requests: docRequests ?? [],
    chat: notes ?? [],
    advisor,
    viewer_role: role ?? null,
  })
}
