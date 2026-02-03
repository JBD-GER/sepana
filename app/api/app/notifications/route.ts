export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type NameRow = {
  first_name?: string | null
  last_name?: string | null
}

type NotificationRow = {
  id: string
  case_id: string | null
  type: string | null
  title: string | null
  body: string | null
  meta: unknown
  created_at: string
  read_at: string | null
}

type CaseRefRow = {
  id: string
  case_ref: string | null
  assigned_advisor_id: string | null
}

type AdvisorNameRow = {
  user_id: string
  display_name: string | null
}

type ApplicantRow = {
  case_id: string
  first_name: string | null
  last_name: string | null
}

type CaseOwnerRow = {
  id: string
  customer_id: string | null
}

type CustomerOption = {
  id: string
  label: string
}

function readPositiveInt(raw: string | null, fallback: number) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

function buildName(row: NameRow | null | undefined) {
  const first = String(row?.first_name || "").trim()
  const last = String(row?.last_name || "").trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(100, readPositiveInt(url.searchParams.get("limit"), 20))
  const page = readPositiveInt(url.searchParams.get("page"), 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const caseId = String(url.searchParams.get("caseId") || "").trim()
  const customerId = String(url.searchParams.get("customerId") || "").trim()
  const scope = String(url.searchParams.get("scope") || "all").trim().toLowerCase()
  const typesRaw = String(url.searchParams.get("types") || "").trim()
  const types = typesRaw
    ? typesRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : []
  const excludeTypesRaw = String(url.searchParams.get("excludeTypes") || "").trim()
  const excludeTypes = excludeTypesRaw
    ? excludeTypesRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : []

  const admin = supabaseAdmin()
  let customerOptions: CustomerOption[] = []
  let caseIdsForCustomerFilter: string[] | null = null

  if (role === "advisor") {
    const { data: ownerCases } = await admin
      .from("cases")
      .select("id,customer_id")
      .eq("assigned_advisor_id", user.id)
      .not("customer_id", "is", null)

    const ownerRows = (ownerCases ?? []) as CaseOwnerRow[]
    const ownerCaseIds = ownerRows.map((row) => row.id).filter(Boolean)
    const ownerCustomerIds = Array.from(
      new Set(
        ownerRows
          .map((row) => row.customer_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const { data: ownerApplicants } = await (ownerCaseIds.length
      ? admin
          .from("case_applicants")
          .select("case_id,first_name,last_name")
          .in("case_id", ownerCaseIds)
          .eq("role", "primary")
      : Promise.resolve({ data: [] as ApplicantRow[] }))

    const applicantByCase = new Map<string, string>()
    for (const row of (ownerApplicants ?? []) as ApplicantRow[]) {
      if (!applicantByCase.has(row.case_id)) {
        const full = buildName(row)
        if (full) applicantByCase.set(row.case_id, full)
      }
    }

    const labelByCustomer = new Map<string, string>()
    for (const row of ownerRows) {
      const cid = row.customer_id
      if (!cid || labelByCustomer.has(cid)) continue
      const fallback = `Kunde ${cid.slice(0, 8)}`
      labelByCustomer.set(cid, applicantByCase.get(row.id) ?? fallback)
    }

    customerOptions = ownerCustomerIds
      .map((id) => ({ id, label: labelByCustomer.get(id) ?? `Kunde ${id.slice(0, 8)}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"))

    if (customerId) {
      caseIdsForCustomerFilter = ownerRows
        .filter((row) => row.customer_id === customerId)
        .map((row) => row.id)
        .filter(Boolean)
      if (caseIdsForCustomerFilter.length === 0) {
        return NextResponse.json({
          items: [],
          page,
          pageSize: limit,
          total: 0,
          totalPages: 1,
          customerOptions,
        })
      }
    }
  }

  let query = admin
    .from("notification_log")
    .select("id,case_id,type,title,body,meta,created_at,read_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (scope === "inbox") {
    query = query.eq("recipient_id", user.id)
  } else {
    query = query.or(`recipient_id.eq.${user.id},actor_id.eq.${user.id}`)
  }

  if (caseId) {
    query = query.eq("case_id", caseId)
  }
  if (caseIdsForCustomerFilter?.length) {
    query = query.in("case_id", caseIdsForCustomerFilter)
  }
  if (types.length) {
    query = query.in("type", types)
  }
  if (excludeTypes.length) {
    const encoded = `(${excludeTypes.map((t) => `"${t.replace(/"/g, "")}"`).join(",")})`
    query = query.not("type", "in", encoded)
  }

  const { data, error, count } = await query

  if (error) {
    const missingTable =
      error.message?.toLowerCase().includes("notification_log") &&
      error.message?.toLowerCase().includes("does not exist")
    if (missingTable) {
      return NextResponse.json({ error: "notification_table_missing" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as NotificationRow[]
  const caseIds = Array.from(
    new Set(rows.map((x) => x.case_id).filter((value): value is string => typeof value === "string" && value.length > 0))
  )

  const { data: cases } = await (caseIds.length
    ? admin.from("cases").select("id,case_ref,assigned_advisor_id").in("id", caseIds)
    : Promise.resolve({ data: [] as CaseRefRow[] }))

  const caseRows = (cases ?? []) as CaseRefRow[]
  const advisorIds = Array.from(
    new Set(
      caseRows
        .map((c) => c.assigned_advisor_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  )

  const [{ data: advisors }, { data: applicants }] = await Promise.all([
    advisorIds.length
      ? admin.from("advisor_profiles").select("user_id,display_name").in("user_id", advisorIds)
      : Promise.resolve({ data: [] as AdvisorNameRow[] }),
    caseIds.length
      ? admin
          .from("case_applicants")
          .select("case_id,first_name,last_name")
          .in("case_id", caseIds)
          .eq("role", "primary")
      : Promise.resolve({ data: [] as ApplicantRow[] }),
  ])

  const advisorRows = (advisors ?? []) as AdvisorNameRow[]
  const applicantRows = (applicants ?? []) as ApplicantRow[]

  const caseMap = new Map<string, CaseRefRow>()
  for (const c of caseRows) caseMap.set(c.id, c)

  const advisorNameById = new Map<string, string>()
  for (const a of advisorRows) {
    if (a.user_id && a.display_name) advisorNameById.set(a.user_id, a.display_name)
  }

  const customerNameByCase = new Map<string, string>()
  for (const a of applicantRows) {
    if (!customerNameByCase.has(a.case_id)) {
      const name = buildName(a)
      if (name) customerNameByCase.set(a.case_id, name)
    }
  }

  const items = rows.map((row) => {
    const c = row.case_id ? caseMap.get(row.case_id) : null
    let counterpartName: string | null = null
    if (role === "customer") {
      counterpartName = c?.assigned_advisor_id ? advisorNameById.get(c.assigned_advisor_id) ?? null : null
    } else if (role === "advisor") {
      counterpartName = row.case_id ? customerNameByCase.get(row.case_id) ?? null : null
    }
    if (!counterpartName) {
      if (role === "customer") counterpartName = "Berater"
      if (role === "advisor") counterpartName = "Kunde"
    }

    return {
      ...row,
      case_ref: c?.case_ref ?? null,
      counterpart_name: counterpartName,
    }
  })

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return NextResponse.json({
    items,
    page,
    pageSize: limit,
    total,
    totalPages,
    customerOptions,
  })
}
