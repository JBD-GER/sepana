export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

const LIVE_CASE_TABS = ["contact", "household", "finance", "details"] as const
type LiveCaseTabId = (typeof LIVE_CASE_TABS)[number]

type MissingCheck = {
  tab: LiveCaseTabId
  missing: boolean
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

function toUiAddressKind(v: unknown): string | null {
  const value = String(v ?? "").trim().toLowerCase()
  if (!value) return null
  if (value === "grundstueck") return "plot"
  if (value === "immobilie") return "property"
  if (value === "plot" || value === "property") return value
  return null
}

function findFirstMissingTab(missing: MissingCheck[]) {
  if (!missing.length) return null
  const missingTabs = new Set(missing.filter((check) => check.missing).map((check) => check.tab))
  return LIVE_CASE_TABS.find((tab) => missingTabs.has(tab)) ?? null
}

function normalizeCaseType(raw: string | null): "baufi" | "konsum" | null {
  const value = String(raw ?? "").trim().toLowerCase()
  if (value === "baufi") return "baufi"
  if (value === "konsum" || value === "privatkredit") return "konsum"
  return null
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "customer") return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })

  const url = new URL(req.url)
  const caseTypeFilter = normalizeCaseType(url.searchParams.get("caseType"))
  const admin = supabaseAdmin()
  let openQuery = admin
    .from("cases")
    .select("id,case_ref,status,case_type,created_at")
    .eq("customer_id", user.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
  if (caseTypeFilter) openQuery = openQuery.eq("case_type", caseTypeFilter)
  const { data: openCase, error: openError } = await openQuery.maybeSingle()
  if (openError) {
    return NextResponse.json({ ok: false, error: "case_lookup_failed" }, { status: 500 })
  }

  let targetCase = openCase
  if (!targetCase) {
    let latestQuery = admin
      .from("cases")
      .select("id,case_ref,status,case_type,created_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
    if (caseTypeFilter) latestQuery = latestQuery.eq("case_type", caseTypeFilter)
    const { data: latestCase, error: latestError } = await latestQuery.maybeSingle()
    if (latestError) {
      return NextResponse.json({ ok: false, error: "case_lookup_failed" }, { status: 500 })
    }
    targetCase = latestCase ?? null
  }

  if (!targetCase) {
    return NextResponse.json({ ok: true, caseId: null, caseRef: null, missingCount: 0, firstTab: null })
  }

  const caseId = targetCase.id

  const [{ data: primary }, { data: baufi }, { data: additional }, { data: children }] = await Promise.all([
    admin
      .from("case_applicants")
      .select(
        "first_name,last_name,email,phone,birth_date,nationality,marital_status,address_street,address_zip,address_city,housing_status,employment_type,employment_status,net_income_monthly,expenses_monthly,existing_loans_monthly"
      )
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle(),
    admin
      .from("case_baufi_details")
      .select("purpose,property_type,purchase_price,loan_amount_requested,property_address_kind,property_street,property_house_no,property_zip,property_city,property_plot_size")
      .eq("case_id", caseId)
      .maybeSingle(),
    admin.from("case_additional_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin.from("case_children").select("child_name,birth_date").eq("case_id", caseId).order("created_at", { ascending: true }),
  ])

  const primaryRow = (primary ?? {}) as Record<string, any>
  const baufiRow = (baufi ?? {}) as {
    purpose?: string | null
    property_type?: string | null
    purchase_price?: number | null
    loan_amount_requested?: number | null
    property_address_kind?: string | null
    property_street?: string | null
    property_house_no?: string | null
    property_zip?: string | null
    property_city?: string | null
  }
  const additionalRow = (additional ?? {}) as Record<string, any>
  const childrenRows = Array.isArray(children) ? children : []

  const childrenUi = childrenRows.map((c: any) => ({
    name: c?.child_name ?? c?.name ?? null,
    birth_date: c?.birth_date ?? null,
  }))

  const additionalUi = {
    equity_total: additionalRow?.equity_total ?? null,
    equity_used: additionalRow?.equity_used ?? null,
    property_address_type: toUiAddressKind(baufiRow?.property_address_kind),
    property_street: baufiRow?.property_street ?? null,
    property_no: baufiRow?.property_house_no ?? null,
    property_zip: baufiRow?.property_zip ?? null,
    property_city: baufiRow?.property_city ?? null,
    current_warm_rent: additionalRow?.warm_rent_monthly ?? additionalRow?.current_warm_rent ?? null,
    current_warm_rent_none: additionalRow?.warm_rent_not_applicable ?? additionalRow?.current_warm_rent_none ?? false,
    birth_place: additionalRow?.birth_place ?? null,
    id_document_number: additionalRow?.id_document_number ?? null,
    id_issued_place: additionalRow?.id_issued_place ?? null,
    id_issued_at: additionalRow?.id_issued_at ?? null,
    id_expires_at: additionalRow?.id_expires_at ?? null,
    address_since: additionalRow?.residence_since ?? additionalRow?.address_since ?? null,
    probation: additionalRow?.probation ?? false,
    probation_months: additionalRow?.probation_months ?? null,
    salary_payments_per_year: additionalRow?.salary_count ?? additionalRow?.salary_payments_per_year ?? null,
    household_persons: additionalRow?.household_size ?? additionalRow?.household_persons ?? null,
    bank_account_holder: additionalRow?.bank_account_holder ?? null,
    bank_iban: additionalRow?.bank_iban ?? null,
    bank_bic: additionalRow?.bank_bic ?? null,
    has_children:
      additionalRow?.has_children !== undefined && additionalRow?.has_children !== null
        ? !!additionalRow?.has_children
        : childrenUi.length > 0,
  }

  const checks: MissingCheck[] = [
    // Kontakt
    { tab: "contact", missing: !hasValue(primaryRow.first_name) },
    { tab: "contact", missing: !hasValue(primaryRow.last_name) },
    { tab: "contact", missing: !hasValue(primaryRow.email) },
    { tab: "contact", missing: !hasValue(primaryRow.phone) },
    { tab: "contact", missing: !hasValue(primaryRow.birth_date) },
    { tab: "contact", missing: !hasValue(primaryRow.nationality) },
    { tab: "contact", missing: !hasValue(primaryRow.marital_status) },
    { tab: "contact", missing: !hasValue(primaryRow.address_street) },
    { tab: "contact", missing: !hasValue(primaryRow.address_zip) },
    { tab: "contact", missing: !hasValue(primaryRow.address_city) },
    { tab: "contact", missing: !hasValue(primaryRow.housing_status) },
    { tab: "contact", missing: !hasValue(primaryRow.employment_type) },
    { tab: "contact", missing: !hasValue(primaryRow.employment_status) },

    // Haushalt
    { tab: "household", missing: !hasValue(primaryRow.net_income_monthly) },
    { tab: "household", missing: !hasValue(primaryRow.expenses_monthly) },
    { tab: "household", missing: !hasValue(primaryRow.existing_loans_monthly) },

    // Details
    { tab: "details", missing: !hasValue(additionalUi.birth_place) },
    { tab: "details", missing: !hasValue(additionalUi.id_document_number) },
    { tab: "details", missing: !hasValue(additionalUi.id_issued_place) },
    { tab: "details", missing: !hasValue(additionalUi.id_issued_at) },
    { tab: "details", missing: !hasValue(additionalUi.id_expires_at) },
    { tab: "details", missing: !hasValue(additionalUi.address_since) },
    { tab: "details", missing: !hasValue(additionalUi.salary_payments_per_year) },
    { tab: "details", missing: !hasValue(additionalUi.household_persons) },
    { tab: "details", missing: !hasValue(additionalUi.bank_account_holder) },
    { tab: "details", missing: !hasValue(additionalUi.bank_iban) },
    { tab: "details", missing: !hasValue(additionalUi.bank_bic) },
  ]

  const currentCaseType = normalizeCaseType(targetCase.case_type ?? null) ?? "baufi"
  if (currentCaseType === "konsum") {
    checks.push(
      { tab: "finance", missing: !hasValue(baufiRow.purpose) },
      { tab: "finance", missing: !hasValue(baufiRow.loan_amount_requested) }
    )
  } else {
    checks.push(
      { tab: "finance", missing: !hasValue(baufiRow.purpose) },
      { tab: "finance", missing: !hasValue(baufiRow.property_type) },
      { tab: "finance", missing: !hasValue(baufiRow.purchase_price) },
      { tab: "finance", missing: !hasValue(additionalUi.equity_total) },
      { tab: "finance", missing: !hasValue(additionalUi.equity_used) },
      { tab: "finance", missing: !hasValue(additionalUi.property_address_type) },
      { tab: "finance", missing: !hasValue(additionalUi.property_street) },
      { tab: "finance", missing: !hasValue(additionalUi.property_no) },
      { tab: "finance", missing: !hasValue(additionalUi.property_zip) },
      { tab: "finance", missing: !hasValue(additionalUi.property_city) }
    )
  }

  if (!additionalUi.current_warm_rent_none) {
    checks.push({ tab: "details", missing: !hasValue(additionalUi.current_warm_rent) })
  }

  if (additionalUi.probation) {
    checks.push({ tab: "details", missing: !hasValue(additionalUi.probation_months) })
  }

  if (additionalUi.has_children) {
    checks.push({ tab: "details", missing: childrenUi.length === 0 })
    childrenUi.forEach((child) => {
      checks.push({ tab: "details", missing: !hasValue(child.name) })
      checks.push({ tab: "details", missing: !hasValue(child.birth_date) })
    })
  }

  const missing = checks.filter((check) => check.missing)
  const firstTab = findFirstMissingTab(missing)

  return NextResponse.json({
    ok: true,
    caseId,
    caseRef: targetCase.case_ref ?? null,
    caseType: currentCaseType,
    missingCount: missing.length,
    firstTab,
  })
}
