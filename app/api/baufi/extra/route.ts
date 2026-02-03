import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

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
const PRIMARY_FIELDS = ["nationality"] as const

const CHILD_FIELDS = ["name", "birth_date", "maintenance_income_monthly"] as const

function pick(obj: any, fields: readonly string[]) {
  const out: Record<string, any> = {}
  fields.forEach((k) => {
    if (obj && obj[k] !== undefined) out[k] = obj[k]
  })
  return out
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
  } else {
    normalized = normalized.replace(/\./g, "")
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
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
  const [{ data: primary }, { data: additional }, { data: children }] = await Promise.all([
    admin
      .from("case_applicants")
      .select(PRIMARY_FIELDS.join(","))
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle(),
    admin.from("case_additional_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("case_children").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
  ])

  return NextResponse.json({
    ok: true,
    primary: primary ?? {},
    additional: additional ?? {},
    children: children ?? [],
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
    const { data: existingPrimary } = await admin
      .from("case_applicants")
      .select("id")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()

    if (existingPrimary?.id) {
      await admin.from("case_applicants").update(primaryPatch).eq("id", existingPrimary.id)
    } else {
      await admin.from("case_applicants").insert({ case_id: caseId, role: "primary", ...primaryPatch })
    }
  }

  const additionalPatch = pick(body?.additional ?? {}, ADDITIONAL_FIELDS)
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

    await admin
      .from("case_additional_details")
      .upsert({ case_id: caseId, ...additionalPatch }, { onConflict: "case_id" })
  }

  if (Array.isArray(body?.children)) {
    const hasChildren = additionalPatch.has_children !== undefined ? !!additionalPatch.has_children : true
    const rows = hasChildren
      ? (body.children as any[])
          .map((c) => pick(c ?? {}, CHILD_FIELDS))
          .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
          .map((c) => ({
            case_id: caseId,
            ...c,
            maintenance_income_monthly: numOrNull(c.maintenance_income_monthly),
          }))
      : []

    await admin.from("case_children").delete().eq("case_id", caseId)
    if (rows.length) {
      await admin.from("case_children").insert(rows)
    }
  }

  return NextResponse.json({ ok: true })
}
