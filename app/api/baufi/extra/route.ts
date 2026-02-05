import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const PRIMARY_FIELDS = ["nationality"] as const
const BAUFI_DB_FIELDS = [
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
  "id_document_number",
  "id_issued_place",
  "id_issued_at",
  "id_expires_at",
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
] as const
const CHILD_DB_FIELDS = ["child_name", "birth_date", "support_income_monthly"] as const

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

async function resolveCase(caseId: string, caseRef?: string | null) {
  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) return { ok: false, status: 404, error: "case_not_found" }
  if (caseRef && caseRow.case_ref && caseRow.case_ref !== caseRef) {
    return { ok: false, status: 403, error: "case_ref_mismatch" }
  }
  return { ok: true, admin, caseRow }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const caseId = String(searchParams.get("caseId") ?? "").trim()
  const caseRef = String(searchParams.get("caseRef") ?? "").trim() || null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const resolved = await resolveCase(caseId, caseRef)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status })
  }

  const { admin } = resolved as any
  const [{ data: primary }, { data: baufi }, { data: additional }, { data: children }] = await Promise.all([
    admin
      .from("case_applicants")
      .select(PRIMARY_FIELDS.join(","))
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle(),
    admin.from("case_baufi_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("case_additional_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("case_children").select("id,*").eq("case_id", caseId).order("created_at", { ascending: true }),
  ])

  const childrenUi = (children ?? []).map((c: any) => ({
    id: c.id,
    name: c.child_name ?? c.name ?? null,
    birth_date: c.birth_date ?? null,
    maintenance_income_monthly: c.support_income_monthly ?? c.maintenance_income_monthly ?? null,
  }))

  const additionalUi = {
    equity_total: additional?.equity_total ?? null,
    equity_used: additional?.equity_used ?? null,
    property_address_type: toUiAddressKind(baufi?.property_address_kind),
    property_street: baufi?.property_street ?? null,
    property_no: baufi?.property_house_no ?? null,
    property_zip: baufi?.property_zip ?? null,
    property_city: baufi?.property_city ?? null,
    property_plot_size: baufi?.property_plot_size ?? null,
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
    primary: primary ?? {},
    additional: additionalUi,
    children: childrenUi,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const caseRef = body?.caseRef ? String(body.caseRef).trim() : null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const resolved = await resolveCase(caseId, caseRef)
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status })
  }
  const { admin } = resolved as any

  const primaryPatch = pick(body?.primary ?? {}, PRIMARY_FIELDS)
  if (Object.keys(primaryPatch).length) {
    const { data: existingPrimary, error: existingPrimaryError } = await admin
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

    if (existingPrimary?.id) {
      const { error: primaryUpdateError } = await admin.from("case_applicants").update(primaryPatch).eq("id", existingPrimary.id)
      if (primaryUpdateError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "primary_update", message: primaryUpdateError.message },
          { status: 400 }
        )
      }
    } else {
      const { error: primaryInsertError } = await admin
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

  const incomingAdditional = body?.additional ?? {}
  const baufiPatch = pick(
    defined({
      property_address_kind: toDbAddressKind(incomingAdditional.property_address_type),
      property_street: incomingAdditional.property_street,
      property_house_no: incomingAdditional.property_no,
      property_zip: incomingAdditional.property_zip,
      property_city: incomingAdditional.property_city,
      property_plot_size: incomingAdditional.property_plot_size,
    }),
    BAUFI_DB_FIELDS
  )
  if (Object.keys(baufiPatch).length) {
    if (baufiPatch.property_plot_size !== undefined) baufiPatch.property_plot_size = numOrNull(baufiPatch.property_plot_size)
    const { error: baufiUpsertError } = await admin
      .from("case_baufi_details")
      .upsert({ case_id: caseId, ...baufiPatch }, { onConflict: "case_id" })
    if (baufiUpsertError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "baufi_upsert", message: baufiUpsertError.message },
        { status: 400 }
      )
    }
  }

  const additionalPatch = pick(
    defined({
      equity_total: incomingAdditional.equity_total,
      equity_used: incomingAdditional.equity_used,
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

    const { error: additionalUpsertError } = await admin
      .from("case_additional_details")
      .upsert({ case_id: caseId, ...additionalPatch }, { onConflict: "case_id" })
    if (additionalUpsertError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "additional_upsert", message: additionalUpsertError.message },
        { status: 400 }
      )
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

    const { error: childrenDeleteError } = await admin.from("case_children").delete().eq("case_id", caseId)
    if (childrenDeleteError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "children_delete", message: childrenDeleteError.message },
        { status: 400 }
      )
    }
    if (rows.length) {
      const { error: childrenInsertError } = await admin.from("case_children").insert(rows)
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
