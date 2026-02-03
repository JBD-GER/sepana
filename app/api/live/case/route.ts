import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const PRIMARY_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "birth_date",
  "nationality",
  "marital_status",
  "address_street",
  "address_zip",
  "address_city",
  "housing_status",
  "employment_type",
  "employment_status",
  "employer_name",
  "net_income_monthly",
  "other_income_monthly",
  "expenses_monthly",
  "existing_loans_monthly",
] as const

const CO_FIELDS = [
  "first_name",
  "last_name",
  "birth_date",
  "employment_status",
  "net_income_monthly",
] as const

const BAUFI_FIELDS = ["purpose", "property_type", "purchase_price"] as const
const ADDITIONAL_FIELDS = [
  "equity_total",
  "equity_used",
  "property_address_type",
  "property_street",
  "property_no",
  "property_zip",
  "property_city",
  "property_plot_size",
  "current_warm_rent",
  "current_warm_rent_none",
  "birth_place",
  "id_document_number",
  "id_issued_place",
  "id_issued_at",
  "id_expires_at",
  "address_since",
  "probation",
  "probation_months",
  "salary_payments_per_year",
  "household_persons",
  "vehicle_count",
  "vehicle_cost_total",
  "bank_account_holder",
  "bank_iban",
  "bank_bic",
  "has_children",
  "maintenance_income_monthly",
] as const

const CHILD_FIELDS = ["name", "birth_date", "maintenance_income_monthly"] as const

function numOrNull(v: unknown) {
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  let normalized = cleaned
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".")
  } else {
    normalized = normalized.replace(/\./g, "")
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function pick(obj: any, fields: readonly string[]) {
  const out: Record<string, any> = {}
  fields.forEach((k) => {
    if (obj && obj[k] !== undefined) out[k] = obj[k]
  })
  return out
}

function customerCanEdit(offerStatus: string | null) {
  if (!offerStatus) return true
  const s = String(offerStatus).toLowerCase()
  return s === "sent" || s === "rejected"
}

async function resolveAccess(caseId: string, ticketId: string, guestToken: string | null) {
  const { user, role } = await getUserAndRole()
  const admin = supabaseAdmin()
  const viewerRole = user ? role ?? "customer" : "guest"

  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref,case_type,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (!caseRow) {
    return { ok: false, status: 404, error: "case_not_found" }
  }

  if (user) {
    const allowed =
      role === "admin" ||
      caseRow.customer_id === user.id ||
      (caseRow.assigned_advisor_id && caseRow.assigned_advisor_id === user.id)
    if (!allowed) return { ok: false, status: 403, error: "not_allowed" }
    return { ok: true, readClient: admin, caseRow, viewerRole }
  }

  if (!guestToken && !ticketId) {
    return { ok: false, status: 401, error: "not_authenticated" }
  }

  const baseQuery = admin
    .from("live_queue_tickets")
    .select("id,case_id,guest_token")
    .in("status", ["waiting", "active", "ended"])

  const { data: ticket } = await (ticketId
    ? baseQuery.eq("id", ticketId).maybeSingle()
    : baseQuery.eq("case_id", caseId).eq("guest_token", guestToken).maybeSingle())

  if (!ticket || ticket.case_id !== caseId) {
    return { ok: false, status: 403, error: "not_allowed" }
  }

  if (ticketId && guestToken) {
    if (!ticket.guest_token) {
      await admin.from("live_queue_tickets").update({ guest_token: guestToken }).eq("id", ticket.id)
    } else if (ticket.guest_token !== guestToken) {
      return { ok: false, status: 403, error: "not_allowed" }
    }
  }

  return { ok: true, readClient: admin, caseRow, viewerRole }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const caseId = String(searchParams.get("caseId") ?? "").trim()
  const ticketId = String(searchParams.get("ticketId") ?? "").trim()
  const guestToken = String(searchParams.get("guestToken") ?? "").trim() || null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const access = await resolveAccess(caseId, ticketId, guestToken)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const { readClient, caseRow, viewerRole } = access as any
  const { data: latestOffer } = await readClient
    .from("case_offers")
    .select("status,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: primary } = await readClient
    .from("case_applicants")
    .select(PRIMARY_FIELDS.join(","))
    .eq("case_id", caseId)
    .eq("role", "primary")
    .maybeSingle()

  const { data: coApplicants } = await readClient
    .from("case_applicants")
    .select(`id,${CO_FIELDS.join(",")}`)
    .eq("case_id", caseId)
    .eq("role", "co")
    .order("created_at", { ascending: true })

  const { data: baufi } = await readClient
    .from("case_baufi_details")
    .select(BAUFI_FIELDS.join(","))
    .eq("case_id", caseId)
    .maybeSingle()

  const { data: additional } = await readClient
    .from("case_additional_details")
    .select(ADDITIONAL_FIELDS.join(","))
    .eq("case_id", caseId)
    .maybeSingle()

  const { data: children } = await readClient
    .from("case_children")
    .select(`id,${CHILD_FIELDS.join(",")}`)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })

  return NextResponse.json({
    ok: true,
    case: {
      id: caseRow.id,
      case_ref: caseRow.case_ref ?? null,
      case_type: caseRow.case_type ?? null,
    },
    primary: primary ?? {},
    co: coApplicants ?? [],
    baufi: baufi ?? {},
    additional: additional ?? {},
    children: children ?? [],
    latest_offer_status: latestOffer?.status ?? null,
    customer_can_edit: customerCanEdit(latestOffer?.status ?? null),
    viewer_role: viewerRole ?? null,
  })
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const ticketId = String(body?.ticketId ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const access = await resolveAccess(caseId, ticketId, guestToken)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const { readClient } = access as any
  const effectiveRole = user ? role : "customer"
  const { data: latestOffer } = await readClient
    .from("case_offers")
    .select("status,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (effectiveRole === "customer" && !customerCanEdit(latestOffer?.status ?? null)) {
    return NextResponse.json({ ok: false, error: "customer_edit_locked" }, { status: 409 })
  }
  const primaryPatch = pick(body?.primary ?? {}, PRIMARY_FIELDS)
  const baufiPatch = pick(body?.baufi ?? {}, BAUFI_FIELDS)
  const additionalPatch = pick(body?.additional ?? {}, ADDITIONAL_FIELDS)

  if (Object.keys(primaryPatch).length) {
    ;(["net_income_monthly", "other_income_monthly", "expenses_monthly", "existing_loans_monthly"] as const).forEach(
      (k) => {
        if (primaryPatch[k] !== undefined) primaryPatch[k] = numOrNull(primaryPatch[k])
      }
    )
    const { data: existing } = await readClient
      .from("case_applicants")
      .select("id")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()
    if (existing?.id) {
      await readClient.from("case_applicants").update(primaryPatch).eq("id", existing.id)
    } else {
      await readClient
        .from("case_applicants")
        .insert({ case_id: caseId, role: "primary", ...primaryPatch })
    }
  }

  if (Object.keys(baufiPatch).length) {
    if (baufiPatch.purchase_price !== undefined) baufiPatch.purchase_price = numOrNull(baufiPatch.purchase_price)
    await readClient.from("case_baufi_details").upsert({ case_id: caseId, ...baufiPatch }, { onConflict: "case_id" })
  }

  if (Object.keys(additionalPatch).length) {
    ;([
      "equity_total",
      "equity_used",
      "property_plot_size",
      "current_warm_rent",
      "probation_months",
      "salary_payments_per_year",
      "household_persons",
      "vehicle_count",
      "vehicle_cost_total",
      "maintenance_income_monthly",
    ] as const).forEach((k) => {
      if (additionalPatch[k] !== undefined) additionalPatch[k] = numOrNull(additionalPatch[k])
    })

    if (additionalPatch.current_warm_rent_none !== undefined) {
      additionalPatch.current_warm_rent_none = !!additionalPatch.current_warm_rent_none
      if (additionalPatch.current_warm_rent_none) additionalPatch.current_warm_rent = null
    }
    if (additionalPatch.probation !== undefined) {
      additionalPatch.probation = !!additionalPatch.probation
      if (!additionalPatch.probation) additionalPatch.probation_months = null
    }
    if (additionalPatch.has_children !== undefined) {
      additionalPatch.has_children = !!additionalPatch.has_children
    }

    await readClient
      .from("case_additional_details")
      .upsert({ case_id: caseId, ...additionalPatch }, { onConflict: "case_id" })
  }

  if (Array.isArray(body?.co)) {
    const coRows = (body.co as any[])
      .map((c) => pick(c ?? {}, CO_FIELDS))
      .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
      .map((c) => ({
        case_id: caseId,
        role: "co",
        ...c,
        net_income_monthly: numOrNull(c.net_income_monthly),
      }))

    await readClient.from("case_applicants").delete().eq("case_id", caseId).eq("role", "co")
    if (coRows.length) {
      await readClient.from("case_applicants").insert(coRows)
    }
  }

  if (Array.isArray(body?.children)) {
    const rows = (body.children as any[])
      .map((c) => pick(c ?? {}, CHILD_FIELDS))
      .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
      .map((c) => ({
        case_id: caseId,
        ...c,
        maintenance_income_monthly: numOrNull(c.maintenance_income_monthly),
      }))

    await readClient.from("case_children").delete().eq("case_id", caseId)
    if (rows.length) {
      await readClient.from("case_children").insert(rows)
    }
  }

  return NextResponse.json({ ok: true })
}
