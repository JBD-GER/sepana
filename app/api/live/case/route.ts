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

const BAUFI_DB_FIELDS = [
  "purpose",
  "property_type",
  "purchase_price",
  "loan_amount_requested",
  "property_address_kind",
  "property_street",
  "property_house_no",
  "property_zip",
  "property_city",
  "property_plot_size",
] as const

const ADDITIONAL_DB_FIELDS = [
  "equity_total",
  "equity_used",
  "warm_rent_monthly",
  "warm_rent_not_applicable",
  "birth_place",
  "residence_since",
  "probation",
  "probation_months",
  "salary_count",
  "household_size",
  "vehicles_count",
  "vehicles_cost_total",
  "bank_account_holder",
  "bank_iban",
  "bank_bic",
  "id_document_number",
  "id_issued_place",
  "id_issued_at",
  "id_expires_at",
] as const

const CHILD_DB_FIELDS = ["child_name", "birth_date", "support_income_monthly"] as const

function numOrNull(v: unknown) {
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  let normalized = cleaned
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".")
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, "")
  } else if (normalized.includes(".")) {
    // Keep decimal values like 12.5, but treat 1.050/300.000 as thousands format.
    const [, decimalPart = ""] = normalized.split(".")
    if (decimalPart.length > 2) normalized = normalized.replace(/\./g, "")
  } else {
    normalized = normalized.replace(/\./g, "")
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function dateOrNull(v: unknown) {
  if (v === undefined) return undefined
  if (v === null) return null
  const raw = String(v).trim()
  return raw ? raw : null
}

function pick(obj: any, fields: readonly string[]) {
  const out: Record<string, any> = {}
  fields.forEach((k) => {
    if (obj && obj[k] !== undefined) out[k] = obj[k]
  })
  return out
}

function defined(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function toUiAddressKind(v: unknown): string | null {
  const value = String(v ?? "").trim().toLowerCase()
  if (!value) return null
  if (value === "grundstueck") return "plot"
  if (value === "immobilie") return "property"
  if (value === "plot" || value === "property") return value
  return null
}

function toDbAddressKind(v: unknown): string | undefined {
  const value = String(v ?? "").trim().toLowerCase()
  if (!value) return undefined
  if (value === "plot" || value === "grundstueck") return "grundstueck"
  if (value === "property" || value === "immobilie") return "immobilie"
  return undefined
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
  const caseType = String(caseRow.case_type ?? "").trim().toLowerCase()
  const isKonsum = caseType === "konsum"
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
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle()

  const { data: additional } = await readClient
    .from("case_additional_details")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle()

  const { data: children } = await readClient
    .from("case_children")
    .select("id,*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })

  const childrenUi = (children ?? []).map((c: any) => ({
    id: c.id,
    name: c.child_name ?? c.name ?? null,
    birth_date: c.birth_date ?? null,
    maintenance_income_monthly: c.support_income_monthly ?? c.maintenance_income_monthly ?? null,
  }))

  const baufiUi = {
    purpose: baufi?.purpose ?? null,
    property_type: isKonsum ? null : (baufi?.property_type ?? null),
    purchase_price: isKonsum ? null : (baufi?.purchase_price ?? null),
    loan_amount_requested: baufi?.loan_amount_requested ?? null,
  }

  const additionalUi = {
    equity_total: isKonsum ? null : (additional?.equity_total ?? null),
    equity_used: isKonsum ? null : (additional?.equity_used ?? null),
    property_address_type: isKonsum ? null : toUiAddressKind(baufi?.property_address_kind),
    property_street: isKonsum ? null : (baufi?.property_street ?? null),
    property_no: isKonsum ? null : (baufi?.property_house_no ?? null),
    property_zip: isKonsum ? null : (baufi?.property_zip ?? null),
    property_city: isKonsum ? null : (baufi?.property_city ?? null),
    property_plot_size: isKonsum ? null : (baufi?.property_plot_size ?? null),
    current_warm_rent: additional?.warm_rent_monthly ?? additional?.current_warm_rent ?? null,
    current_warm_rent_none: additional?.warm_rent_not_applicable ?? additional?.current_warm_rent_none ?? false,
    birth_place: additional?.birth_place ?? null,
    id_document_number: additional?.id_document_number ?? null,
    id_issued_place: additional?.id_issued_place ?? null,
    id_issued_at: additional?.id_issued_at ?? null,
    id_expires_at: additional?.id_expires_at ?? null,
    address_since: additional?.residence_since ?? additional?.address_since ?? null,
    probation: additional?.probation ?? false,
    probation_months: additional?.probation_months ?? null,
    salary_payments_per_year: additional?.salary_count ?? additional?.salary_payments_per_year ?? null,
    household_persons: additional?.household_size ?? additional?.household_persons ?? null,
    vehicle_count: additional?.vehicles_count ?? additional?.vehicle_count ?? null,
    vehicle_cost_total: additional?.vehicles_cost_total ?? additional?.vehicle_cost_total ?? null,
    bank_account_holder: additional?.bank_account_holder ?? null,
    bank_iban: additional?.bank_iban ?? null,
    bank_bic: additional?.bank_bic ?? null,
    has_children:
      additional?.has_children !== undefined && additional?.has_children !== null
        ? !!additional.has_children
        : childrenUi.length > 0,
    maintenance_income_monthly: additional?.maintenance_income_monthly ?? null,
  }

  return NextResponse.json({
    ok: true,
    case: {
      id: caseRow.id,
      case_ref: caseRow.case_ref ?? null,
      case_type: caseRow.case_type ?? null,
    },
    primary: primary ?? {},
    co: coApplicants ?? [],
    baufi: baufiUi,
    additional: additionalUi,
    children: childrenUi,
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

  const { readClient, caseRow } = access as any
  const caseType = String(caseRow?.case_type ?? "").trim().toLowerCase()
  const isKonsum = caseType === "konsum"
  const effectiveRole = user ? role : "customer"
  const { data: latestOffer, error: latestOfferError } = await readClient
    .from("case_offers")
    .select("status,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestOfferError) {
    return NextResponse.json(
      { ok: false, error: "save_failed", stage: "latest_offer", message: latestOfferError.message },
      { status: 500 }
    )
  }

  if (effectiveRole === "customer" && !customerCanEdit(latestOffer?.status ?? null)) {
    return NextResponse.json({ ok: false, error: "customer_edit_locked" }, { status: 409 })
  }
  const incomingBaufi = body?.baufi ?? {}
  const incomingAdditional = body?.additional ?? {}
  const primaryPatch = pick(body?.primary ?? {}, PRIMARY_FIELDS)
  const baufiPatch = isKonsum
    ? pick(
        defined({
          purpose: incomingBaufi.purpose,
          loan_amount_requested: incomingBaufi.loan_amount_requested,
        }),
        BAUFI_DB_FIELDS
      )
    : pick(
        defined({
          purpose: incomingBaufi.purpose,
          property_type: incomingBaufi.property_type,
          purchase_price: incomingBaufi.purchase_price,
          loan_amount_requested: incomingBaufi.loan_amount_requested,
          property_address_kind: toDbAddressKind(incomingAdditional.property_address_type ?? incomingBaufi.property_address_type),
          property_street: incomingAdditional.property_street ?? incomingBaufi.property_street,
          property_house_no: incomingAdditional.property_no ?? incomingBaufi.property_no ?? incomingBaufi.property_house_no,
          property_zip: incomingAdditional.property_zip ?? incomingBaufi.property_zip,
          property_city: incomingAdditional.property_city ?? incomingBaufi.property_city,
          property_plot_size: incomingAdditional.property_plot_size ?? incomingBaufi.property_plot_size,
        }),
        BAUFI_DB_FIELDS
      )
  const additionalPatch = pick(
    defined({
      equity_total: isKonsum ? undefined : incomingAdditional.equity_total,
      equity_used: isKonsum ? undefined : incomingAdditional.equity_used,
      warm_rent_monthly: incomingAdditional.current_warm_rent,
      warm_rent_not_applicable: incomingAdditional.current_warm_rent_none,
      birth_place: incomingAdditional.birth_place,
      id_document_number: incomingAdditional.id_document_number,
      id_issued_place: incomingAdditional.id_issued_place,
      id_issued_at: incomingAdditional.id_issued_at,
      id_expires_at: incomingAdditional.id_expires_at,
      residence_since: incomingAdditional.address_since,
      probation: incomingAdditional.probation,
      probation_months: incomingAdditional.probation_months,
      salary_count: incomingAdditional.salary_payments_per_year,
      household_size: incomingAdditional.household_persons,
      vehicles_count: incomingAdditional.vehicle_count,
      vehicles_cost_total: incomingAdditional.vehicle_cost_total,
      bank_account_holder: incomingAdditional.bank_account_holder,
      bank_iban: incomingAdditional.bank_iban,
      bank_bic: incomingAdditional.bank_bic,
    }),
    ADDITIONAL_DB_FIELDS
  )

  if (Object.keys(primaryPatch).length) {
    ;(["net_income_monthly", "other_income_monthly", "expenses_monthly", "existing_loans_monthly"] as const).forEach(
      (k) => {
        if (primaryPatch[k] !== undefined) primaryPatch[k] = numOrNull(primaryPatch[k])
      }
    )
    if (primaryPatch.birth_date !== undefined) primaryPatch.birth_date = dateOrNull(primaryPatch.birth_date)
    const { data: existing, error: existingPrimaryError } = await readClient
      .from("case_applicants")
      .select("id")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()
    if (existingPrimaryError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "primary_lookup", message: existingPrimaryError.message },
        { status: 500 }
      )
    }
    if (existing?.id) {
      const { error: primaryUpdateError } = await readClient.from("case_applicants").update(primaryPatch).eq("id", existing.id)
      if (primaryUpdateError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "primary_update", message: primaryUpdateError.message },
          { status: 400 }
        )
      }
    } else {
      const { error: primaryInsertError } = await readClient
        .from("case_applicants")
        .insert({ case_id: caseId, role: "primary", ...primaryPatch })
      if (primaryInsertError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "primary_insert", message: primaryInsertError.message },
          { status: 400 }
        )
      }
    }
  }

  if (Object.keys(baufiPatch).length) {
    if (baufiPatch.purchase_price !== undefined) baufiPatch.purchase_price = numOrNull(baufiPatch.purchase_price)
    if (baufiPatch.loan_amount_requested !== undefined) {
      baufiPatch.loan_amount_requested = numOrNull(baufiPatch.loan_amount_requested)
    }
    if (baufiPatch.property_plot_size !== undefined) baufiPatch.property_plot_size = numOrNull(baufiPatch.property_plot_size)
    const { error: baufiUpsertError } = await readClient
      .from("case_baufi_details")
      .upsert({ case_id: caseId, ...baufiPatch }, { onConflict: "case_id" })
    if (baufiUpsertError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "baufi_upsert", message: baufiUpsertError.message },
        { status: 400 }
      )
    }
  }

  if (Object.keys(additionalPatch).length) {
    ;([
      "equity_total",
      "equity_used",
      "warm_rent_monthly",
      "probation_months",
      "salary_count",
      "household_size",
      "vehicles_count",
      "vehicles_cost_total",
    ] as const).forEach((k) => {
      if (additionalPatch[k] !== undefined) additionalPatch[k] = numOrNull(additionalPatch[k])
    })
    ;(["id_issued_at", "id_expires_at", "residence_since"] as const).forEach((k) => {
      if (additionalPatch[k] !== undefined) additionalPatch[k] = dateOrNull(additionalPatch[k])
    })

    if (additionalPatch.warm_rent_not_applicable !== undefined) {
      additionalPatch.warm_rent_not_applicable = !!additionalPatch.warm_rent_not_applicable
      if (additionalPatch.warm_rent_not_applicable) additionalPatch.warm_rent_monthly = null
    }
    if (additionalPatch.probation !== undefined) {
      additionalPatch.probation = !!additionalPatch.probation
      if (!additionalPatch.probation) additionalPatch.probation_months = null
    }

    const { error: additionalUpsertError } = await readClient
      .from("case_additional_details")
      .upsert({ case_id: caseId, ...additionalPatch }, { onConflict: "case_id" })
    if (additionalUpsertError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "additional_upsert", message: additionalUpsertError.message },
        { status: 400 }
      )
    }
  }

  if (Array.isArray(body?.co)) {
    const coRows = (body.co as any[])
      .map((c) => pick(c ?? {}, CO_FIELDS))
      .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
      .map((c) => ({
        case_id: caseId,
        role: "co",
        ...c,
        birth_date: dateOrNull(c.birth_date),
        net_income_monthly: numOrNull(c.net_income_monthly),
      }))

    const { error: coDeleteError } = await readClient.from("case_applicants").delete().eq("case_id", caseId).eq("role", "co")
    if (coDeleteError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "co_delete", message: coDeleteError.message },
        { status: 400 }
      )
    }
    if (coRows.length) {
      const { error: coInsertError } = await readClient.from("case_applicants").insert(coRows)
      if (coInsertError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "co_insert", message: coInsertError.message },
          { status: 400 }
        )
      }
    }
  }

  if (Array.isArray(body?.children)) {
    const hasChildren =
      incomingAdditional?.has_children !== undefined ? !!incomingAdditional.has_children : true
    const rows = hasChildren
      ? (body.children as any[])
          .map((c) =>
            defined({
              child_name: c?.name,
              birth_date: c?.birth_date,
              support_income_monthly: c?.maintenance_income_monthly,
            })
          )
          .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
          .map((c) => ({
            case_id: caseId,
            ...(pick(c, CHILD_DB_FIELDS) as Record<string, any>),
            birth_date: dateOrNull(c.birth_date),
            support_income_monthly: numOrNull(c.support_income_monthly),
          }))
      : []

    const { error: childrenDeleteError } = await readClient.from("case_children").delete().eq("case_id", caseId)
    if (childrenDeleteError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "children_delete", message: childrenDeleteError.message },
        { status: 400 }
      )
    }
    if (rows.length) {
      const { error: childrenInsertError } = await readClient.from("case_children").insert(rows)
      if (childrenInsertError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "children_insert", message: childrenInsertError.message },
          { status: 400 }
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
