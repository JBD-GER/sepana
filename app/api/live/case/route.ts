import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { getIbanDisplayValue, getSandboxIbanDemo, normalizeIbanInput } from "@/lib/banking/iban"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { hasEuropaceConfig } from "@/lib/europace/config"
import { syncEuropaceCase } from "@/lib/europace/service"
import {
  getAdditionalIdDateValidationIssue,
  getLoanAmountMinimumValidationIssue,
  getMonthlyAmountPlausibilityValidationIssue,
  mapOnlinekreditSaveValidationIssue,
  ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
  ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
  ONLINEKREDIT_MIN_LOAN_AMOUNT,
} from "@/lib/onlinekredit/validation"
import { normalizePhoneForProviders } from "@/lib/onlinekredit/phone"
import { verifyPublicCaseAccessToken } from "@/lib/onlinekredit/publicAccess"

export const runtime = "nodejs"

const PRIMARY_FIELDS = [
  "salutation",
  "title",
  "first_name",
  "last_name",
  "email",
  "phone",
  "phone_business",
  "birth_date",
  "birth_name",
  "birth_country",
  "nationality",
  "marital_status",
  "tax_id",
  "address_street",
  "address_house_no",
  "address_zip",
  "address_city",
  "housing_status",
  "employment_type",
  "employment_status",
  "employment_job_title",
  "employment_since",
  "employer_name",
  "employer_industry",
  "employer_address_street",
  "employer_address_house_no",
  "employer_address_zip",
  "employer_address_city",
  "employer_address_country",
  "net_income_monthly",
  "other_income_monthly",
  "expenses_monthly",
  "existing_loans_monthly",
] as const

const CO_FIELDS = [
  "salutation",
  "title",
  "first_name",
  "last_name",
  "email",
  "phone",
  "phone_business",
  "birth_date",
  "birth_name",
  "birth_country",
  "birth_place",
  "nationality",
  "marital_status",
  "tax_id",
  "id_document_number",
  "id_issued_place",
  "id_issued_at",
  "id_expires_at",
  "address_street",
  "address_house_no",
  "address_zip",
  "address_city",
  "housing_status",
  "shared_household_with_primary",
  "residence_since",
  "previous_address_street",
  "previous_address_house_no",
  "previous_address_zip",
  "previous_address_city",
  "previous_address_since",
  "household_persons",
  "vehicle_count",
  "employment_type",
  "employment_status",
  "employment_job_title",
  "employment_since",
  "employer_name",
  "employer_industry",
  "employer_address_street",
  "employer_address_house_no",
  "employer_address_zip",
  "employer_address_city",
  "employer_address_country",
  "net_income_monthly",
  "other_income_monthly",
  "expenses_monthly",
  "existing_loans_monthly",
] as const

const BAUFI_DB_FIELDS = [
  "purpose",
  "property_type",
  "purchase_price",
  "loan_amount_requested",
  "term_months",
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
  "previous_address_street",
  "previous_address_house_no",
  "previous_address_zip",
  "previous_address_city",
  "previous_address_since",
  "probation",
  "probation_months",
  "salary_count",
  "household_size",
  "vehicles_count",
  "vehicles_cost_total",
  "bank_account_holder",
  "bank_iban",
  "bank_bic",
  "returned_debit_window",
  "has_children",
  "maintenance_income_monthly",
  "id_document_number",
  "id_issued_place",
  "id_issued_at",
  "id_expires_at",
] as const

const CHILD_DB_FIELDS = [
  "child_name",
  "birth_date",
  "child_benefit",
  "maintenance_income_present",
  "applicant_scope",
  "support_income_monthly",
] as const

const LIABILITY_DB_FIELDS = [
  "liability_type",
  "applicant_scope",
  "creditor",
  "monthly_rate",
  "final_installment",
  "last_rate_date",
  "current_balance",
  "original_amount",
  "first_payment_date",
  "utilized_amount",
  "credit_limit",
  "interest_rate",
  "refinance",
  "iban",
  "bic",
] as const

const REAL_ESTATE_ASSET_DB_FIELDS = [
  "applicant_scope",
  "property_type",
  "description",
  "value_amount",
  "living_space_sqm",
  "usage_type",
  "rented_living_space_sqm",
  "rent_income_cold_monthly",
  "rent_income_warm_monthly",
  "ancillary_costs_monthly",
] as const

const REAL_ESTATE_LOAN_DB_FIELDS = [
  "remaining_debt",
  "interest_fixed_until",
  "monthly_rate",
] as const

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

function normalizeSandboxAdditionalBankFields(input: {
  bankIban?: unknown
  bankBic?: unknown
}) {
  const bankIban = getIbanDisplayValue(input.bankIban) || null
  const sandboxDemo = getSandboxIbanDemo(bankIban)

  return {
    bankIban,
    bankBic: sandboxDemo?.bic ?? input.bankBic,
  }
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

function missingSchemaColumn(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message ?? "")
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] ? String(match[1]).trim() : null
}

function isMissingRelationError(error: unknown) {
  const relationError = error as { code?: string; message?: string } | null
  if (!relationError) return false
  if (relationError.code === "42P01") return true
  const message = String(relationError.message ?? "").toLowerCase()
  return message.includes("relation") && message.includes("does not exist")
}

function isMissingSpecificRelationError(error: unknown, relation: string) {
  const relationError = error as { code?: string; message?: string } | null
  if (!relationError) return false
  if (relationError.code === "42P01") {
    const message = String(relationError.message ?? "").toLowerCase()
    return !relation || message.includes(relation.toLowerCase())
  }
  const message = String(relationError.message ?? "").toLowerCase()
  return message.includes(relation.toLowerCase()) && message.includes("relation") && message.includes("does not exist")
}

async function persistApplicantRow(
  readClient: ReturnType<typeof supabaseAdmin>,
  input: {
    id?: string | null
    caseId: string
    role: "primary" | "co"
    patch: Record<string, unknown>
    warnings: string[]
  }
) {
  const payload: Record<string, unknown> = input.id
    ? { ...input.patch }
    : { case_id: input.caseId, role: input.role, ...input.patch }

  if (input.id && Object.keys(payload).length === 0) return null

  while (true) {
    const result = input.id
      ? await readClient.from("case_applicants").update(payload).eq("id", input.id)
      : await readClient.from("case_applicants").insert(payload)

    if (!result.error) return null

    const missingColumn = missingSchemaColumn(result.error)
    if (!missingColumn || !(missingColumn in payload)) {
      return result.error
    }

    delete payload[missingColumn]
    if (!input.warnings.includes("case_applicants_columns_missing_in_db")) {
      input.warnings.push("case_applicants_columns_missing_in_db")
    }

    if (input.id && Object.keys(payload).length === 0) return null
  }
}

async function insertChildrenRows(
  readClient: ReturnType<typeof supabaseAdmin>,
  rows: Record<string, unknown>[],
  warnings: string[]
) {
  let payload = rows
  while (payload.length) {
    const result = await readClient.from("case_children").insert(payload)
    if (!result.error) return null

    const missingColumn = missingSchemaColumn(result.error)
    if (!missingColumn) return result.error

    payload = payload.map((row) => {
      const next = { ...row }
      delete next[missingColumn]
      return next
    })
    if (!warnings.includes("case_children_columns_missing_in_db")) {
      warnings.push("case_children_columns_missing_in_db")
    }
  }

  return null
}

async function insertLiabilityRows(
  readClient: ReturnType<typeof supabaseAdmin>,
  rows: Record<string, unknown>[],
  warnings: string[]
) {
  let payload = rows
  while (payload.length) {
    const result = await readClient.from("case_liabilities").insert(payload)
    if (!result.error) return null

    if (isMissingRelationError(result.error)) {
      if (!warnings.includes("case_liabilities_table_missing_in_db")) {
        warnings.push("case_liabilities_table_missing_in_db")
      }
      return null
    }

    const missingColumn = missingSchemaColumn(result.error)
    if (!missingColumn) return result.error

    payload = payload.map((row) => {
      const next = { ...row }
      delete next[missingColumn]
      return next
    })
    if (!warnings.includes("case_liabilities_columns_missing_in_db")) {
      warnings.push("case_liabilities_columns_missing_in_db")
    }
  }

  return null
}

function customerCanEdit(offerStatus: string | null) {
  if (!offerStatus) return true
  const s = String(offerStatus).toLowerCase()
  return s === "sent" || s === "rejected"
}

async function hasEuropaceAutoSyncPrerequisites(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: primary, error } = await admin
    .from("case_applicants")
    .select("first_name,last_name")
    .eq("case_id", caseId)
    .eq("role", "primary")
    .maybeSingle()

  if (error) throw error

  const firstName = String(primary?.first_name ?? "").trim()
  const lastName = String(primary?.last_name ?? "").trim()
  return Boolean(firstName && lastName)
}

async function resolveAccess(
  caseId: string,
  ticketId: string,
  guestToken: string | null,
  caseRef: string | null,
  publicAccessToken: string | null
) {
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

  if (publicAccessToken && caseRef) {
    const verified = verifyPublicCaseAccessToken({
      token: publicAccessToken,
      caseId,
      caseRef,
    })
    if (!verified) {
      return { ok: false, status: 403, error: "not_allowed" }
    }

    return { ok: true, readClient: admin, caseRow, viewerRole: "public" }
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
  const caseRef = String(searchParams.get("caseRef") ?? "").trim() || null
  const publicAccessToken = String(searchParams.get("access") ?? "").trim() || null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const access = await resolveAccess(caseId, ticketId, guestToken, caseRef, publicAccessToken)
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
    .select("*")
    .eq("case_id", caseId)
    .eq("role", "primary")
    .maybeSingle()

  const { data: coApplicants } = await readClient
    .from("case_applicants")
    .select("*")
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

  const liabilitiesResult = await readClient
    .from("case_liabilities")
    .select("id,*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })

  const realEstateAssetsResult = await readClient
    .from("case_real_estate_assets")
    .select("id,*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })

  const realEstateAssets = isMissingSpecificRelationError(realEstateAssetsResult.error, "case_real_estate_assets")
    ? []
    : realEstateAssetsResult.data
  if (realEstateAssetsResult.error && !isMissingSpecificRelationError(realEstateAssetsResult.error, "case_real_estate_assets")) {
    return NextResponse.json(
      { ok: false, error: "load_failed", stage: "real_estate_assets_select", message: realEstateAssetsResult.error.message },
      { status: 500 }
    )
  }

  const assetIds = (realEstateAssets ?? []).map((row: any) => String(row.id ?? "").trim()).filter(Boolean)
  const realEstateLoansResult = assetIds.length
    ? await readClient
        .from("case_real_estate_loans")
        .select("id,*")
        .in("asset_id", assetIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null as { message?: string } | null }

  const realEstateLoans = isMissingSpecificRelationError(realEstateLoansResult.error, "case_real_estate_loans")
    ? []
    : realEstateLoansResult.data
  if (realEstateLoansResult.error && !isMissingSpecificRelationError(realEstateLoansResult.error, "case_real_estate_loans")) {
    return NextResponse.json(
      { ok: false, error: "load_failed", stage: "real_estate_loans_select", message: realEstateLoansResult.error.message },
      { status: 500 }
    )
  }

  const liabilities = isMissingRelationError(liabilitiesResult.error) ? [] : liabilitiesResult.data
  if (liabilitiesResult.error && !isMissingRelationError(liabilitiesResult.error)) {
    return NextResponse.json(
      { ok: false, error: "load_failed", stage: "liabilities_select", message: liabilitiesResult.error.message },
      { status: 500 }
    )
  }

  const childrenUi = (children ?? []).map((c: any) => ({
    id: c.id,
    name: c.child_name ?? c.name ?? null,
    birth_date: c.birth_date ?? null,
    child_benefit: c.child_benefit ?? null,
    maintenance_income_present: c.maintenance_income_present ?? null,
    applicant_scope: c.applicant_scope ?? null,
    maintenance_income_monthly: c.support_income_monthly ?? c.maintenance_income_monthly ?? null,
  }))

  const liabilitiesUi = (liabilities ?? []).map((row: any) => ({
    id: row.id,
    liability_type: row.liability_type ?? null,
    applicant_scope: row.applicant_scope ?? null,
    creditor: row.creditor ?? null,
    monthly_rate: row.monthly_rate ?? null,
    final_installment: row.final_installment ?? null,
    last_rate_date: row.last_rate_date ?? null,
    current_balance: row.current_balance ?? null,
    original_amount: row.original_amount ?? null,
    first_payment_date: row.first_payment_date ?? null,
    utilized_amount: row.utilized_amount ?? null,
    credit_limit: row.credit_limit ?? null,
    interest_rate: row.interest_rate ?? null,
    refinance: row.refinance ?? null,
    iban: row.iban ?? null,
    bic: row.bic ?? null,
  }))

  const realEstateLoansByAssetId = new Map<string, any[]>()
  for (const row of realEstateLoans ?? []) {
    const assetId = String((row as any)?.asset_id ?? "").trim()
    if (!assetId) continue
    const bucket = realEstateLoansByAssetId.get(assetId) ?? []
    bucket.push(row)
    realEstateLoansByAssetId.set(assetId, bucket)
  }

  const realEstateAssetsUi = (realEstateAssets ?? []).map((row: any) => ({
    id: row.id,
    applicant_scope: row.applicant_scope ?? null,
    property_type: row.property_type ?? null,
    description: row.description ?? null,
    value_amount: row.value_amount ?? null,
    living_space_sqm: row.living_space_sqm ?? null,
    usage_type: row.usage_type ?? null,
    rented_living_space_sqm: row.rented_living_space_sqm ?? null,
    rent_income_cold_monthly: row.rent_income_cold_monthly ?? null,
    rent_income_warm_monthly: row.rent_income_warm_monthly ?? null,
    ancillary_costs_monthly: row.ancillary_costs_monthly ?? null,
    loans: (realEstateLoansByAssetId.get(String(row.id)) ?? []).map((loan) => ({
      id: loan.id,
      remaining_debt: loan.remaining_debt ?? null,
      interest_fixed_until: loan.interest_fixed_until ?? null,
      monthly_rate: loan.monthly_rate ?? null,
    })),
  }))

  const baufiUi = {
    purpose: baufi?.purpose ?? null,
    property_type: isKonsum ? null : (baufi?.property_type ?? null),
    purchase_price: isKonsum ? null : (baufi?.purchase_price ?? null),
    loan_amount_requested: baufi?.loan_amount_requested ?? null,
    term_months: baufi?.term_months ?? null,
  }

  const normalizedAdditionalBankFields = normalizeSandboxAdditionalBankFields({
    bankIban: additional?.bank_iban,
    bankBic: additional?.bank_bic,
  })

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
    previous_address_street: additional?.previous_address_street ?? null,
    previous_address_house_no: additional?.previous_address_house_no ?? null,
    previous_address_zip: additional?.previous_address_zip ?? null,
    previous_address_city: additional?.previous_address_city ?? null,
    previous_address_since: additional?.previous_address_since ?? null,
    probation: additional?.probation ?? false,
    probation_months: additional?.probation_months ?? null,
    salary_payments_per_year: additional?.salary_count ?? additional?.salary_payments_per_year ?? null,
    household_persons: additional?.household_size ?? additional?.household_persons ?? null,
    vehicle_count: additional?.vehicles_count ?? additional?.vehicle_count ?? null,
    vehicle_cost_total: additional?.vehicles_cost_total ?? additional?.vehicle_cost_total ?? null,
    bank_account_holder: additional?.bank_account_holder ?? null,
    bank_iban: normalizedAdditionalBankFields.bankIban ?? null,
    bank_bic: normalizedAdditionalBankFields.bankBic ?? null,
    returned_debit_window: additional?.returned_debit_window ?? null,
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
    liabilities: liabilitiesUi,
    real_estate_assets: realEstateAssetsUi,
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
  const caseRef = body?.caseRef ? String(body.caseRef).trim() : null
  const publicAccessToken = body?.access ? String(body.access).trim() : null
  const triggerEuropaceSync = body?.triggerEuropaceSync === undefined ? true : Boolean(body?.triggerEuropaceSync)
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const access = await resolveAccess(caseId, ticketId, guestToken, caseRef, publicAccessToken)
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
  const warnings: string[] = []
  const primaryPatch = pick(body?.primary ?? {}, PRIMARY_FIELDS)
  const baufiPatch = isKonsum
    ? pick(
        defined({
          purpose: incomingBaufi.purpose,
          loan_amount_requested: incomingBaufi.loan_amount_requested,
          term_months: incomingBaufi.term_months,
        }),
        BAUFI_DB_FIELDS
      )
    : pick(
        defined({
          purpose: incomingBaufi.purpose,
          property_type: incomingBaufi.property_type,
          purchase_price: incomingBaufi.purchase_price,
          loan_amount_requested: incomingBaufi.loan_amount_requested,
          term_months: incomingBaufi.term_months,
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
      previous_address_street: incomingAdditional.previous_address_street,
      previous_address_house_no: incomingAdditional.previous_address_house_no,
      previous_address_zip: incomingAdditional.previous_address_zip,
      previous_address_city: incomingAdditional.previous_address_city,
      previous_address_since: incomingAdditional.previous_address_since,
      probation: incomingAdditional.probation,
      probation_months: incomingAdditional.probation_months,
      salary_count: incomingAdditional.salary_payments_per_year,
      household_size: incomingAdditional.household_persons,
      vehicles_count: incomingAdditional.vehicle_count,
      vehicles_cost_total: incomingAdditional.vehicle_cost_total,
      bank_account_holder: incomingAdditional.bank_account_holder,
      bank_iban: incomingAdditional.bank_iban,
      bank_bic: incomingAdditional.bank_bic,
      returned_debit_window: incomingAdditional.returned_debit_window,
      has_children: incomingAdditional.has_children,
      maintenance_income_monthly: incomingAdditional.maintenance_income_monthly,
    }),
    ADDITIONAL_DB_FIELDS
  )

  const normalizedAdditionalPatchBankFields = normalizeSandboxAdditionalBankFields({
    bankIban: normalizeIbanInput(additionalPatch.bank_iban),
    bankBic: additionalPatch.bank_bic,
  })
  if (additionalPatch.bank_iban !== undefined) {
    additionalPatch.bank_iban = normalizedAdditionalPatchBankFields.bankIban
  }
  if (additionalPatch.bank_iban !== undefined && normalizedAdditionalPatchBankFields.bankBic) {
    additionalPatch.bank_bic = normalizedAdditionalPatchBankFields.bankBic
  }

  if (Object.keys(primaryPatch).length) {
    if (primaryPatch.phone !== undefined) primaryPatch.phone = normalizePhoneForProviders(primaryPatch.phone)
    if (primaryPatch.phone_business !== undefined) {
      primaryPatch.phone_business = normalizePhoneForProviders(primaryPatch.phone_business)
    }
    ;(["net_income_monthly", "other_income_monthly", "expenses_monthly", "existing_loans_monthly"] as const).forEach(
      (k) => {
        if (primaryPatch[k] !== undefined) primaryPatch[k] = numOrNull(primaryPatch[k])
      }
    )
    if (primaryPatch.birth_date !== undefined) primaryPatch.birth_date = dateOrNull(primaryPatch.birth_date)
    if (primaryPatch.employment_since !== undefined) primaryPatch.employment_since = dateOrNull(primaryPatch.employment_since)

    const primaryValidationIssue = getMonthlyAmountPlausibilityValidationIssue({
      value: primaryPatch.net_income_monthly,
      max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
      step: "employment",
      section: "beruf",
      fields: ["net_income_monthly"],
      label: "Das Nettoeinkommen",
    })
    if (primaryValidationIssue) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          stage: "primary_validation",
          message: primaryValidationIssue.message,
          validation: primaryValidationIssue,
        },
        { status: 400 }
      )
    }

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
      const primaryUpdateError = await persistApplicantRow(readClient, {
        id: existing.id,
        caseId,
        role: "primary",
        patch: primaryPatch,
        warnings,
      })
      if (primaryUpdateError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "primary_update", message: primaryUpdateError.message },
          { status: 400 }
        )
      }
    } else {
      const primaryInsertError = await persistApplicantRow(readClient, {
        caseId,
        role: "primary",
        patch: primaryPatch,
        warnings,
      })
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
    if (baufiPatch.term_months !== undefined) baufiPatch.term_months = numOrNull(baufiPatch.term_months)
    if (baufiPatch.property_plot_size !== undefined) baufiPatch.property_plot_size = numOrNull(baufiPatch.property_plot_size)

    const loanAmountValidationIssue = isKonsum
      ? getLoanAmountMinimumValidationIssue({
          loan_amount_requested: baufiPatch.loan_amount_requested,
          minimum: ONLINEKREDIT_MIN_LOAN_AMOUNT,
        })
      : null
    if (loanAmountValidationIssue) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          stage: "baufi_validation",
          message: loanAmountValidationIssue.message,
          validation: loanAmountValidationIssue,
        },
        { status: 400 }
      )
    }

    let { error: baufiUpsertError } = await readClient
      .from("case_baufi_details")
      .upsert({ case_id: caseId, ...baufiPatch }, { onConflict: "case_id" })
    if (
      baufiUpsertError &&
      "term_months" in baufiPatch &&
      String((baufiUpsertError as { message?: unknown }).message ?? "").toLowerCase().includes("term_months")
    ) {
      const fallbackPatch = { ...baufiPatch }
      delete fallbackPatch.term_months
      const fallback = await readClient.from("case_baufi_details").upsert({ case_id: caseId, ...fallbackPatch }, { onConflict: "case_id" })
      baufiUpsertError = fallback.error ?? null
      if (!baufiUpsertError) {
        warnings.push("term_months_missing_in_db")
      }
    }
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
      "maintenance_income_monthly",
    ] as const).forEach((k) => {
      if (additionalPatch[k] !== undefined) additionalPatch[k] = numOrNull(additionalPatch[k])
    })
    ;(["id_issued_at", "id_expires_at", "residence_since", "previous_address_since"] as const).forEach((k) => {
      if (additionalPatch[k] !== undefined) additionalPatch[k] = dateOrNull(additionalPatch[k])
    })

    const additionalValidationIssue = getAdditionalIdDateValidationIssue({
      id_issued_at: additionalPatch.id_issued_at,
      id_expires_at: additionalPatch.id_expires_at,
    })
    if (additionalValidationIssue) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          stage: "additional_validation",
          message: additionalValidationIssue.message,
          validation: additionalValidationIssue,
        },
        { status: 400 }
      )
    }

    if (additionalPatch.warm_rent_not_applicable !== undefined) {
      additionalPatch.warm_rent_not_applicable = !!additionalPatch.warm_rent_not_applicable
      if (additionalPatch.warm_rent_not_applicable) additionalPatch.warm_rent_monthly = null
    }
    if (additionalPatch.probation !== undefined) {
      additionalPatch.probation = !!additionalPatch.probation
      if (!additionalPatch.probation) additionalPatch.probation_months = null
    }
    if (additionalPatch.has_children !== undefined) {
      additionalPatch.has_children = !!additionalPatch.has_children
    }

    const warmRentValidationIssue =
      additionalPatch.warm_rent_not_applicable || additionalPatch.warm_rent_monthly === undefined
        ? null
        : getMonthlyAmountPlausibilityValidationIssue({
            value: additionalPatch.warm_rent_monthly,
            max: ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
            step: "residence",
            section: "wohnen",
            fields: ["current_warm_rent"],
            label: "Die Warmmiete",
          })
    if (warmRentValidationIssue) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          stage: "additional_validation",
          message: warmRentValidationIssue.message,
          validation: warmRentValidationIssue,
        },
        { status: 400 }
      )
    }

    let additionalPayload: Record<string, unknown> = { case_id: caseId, ...additionalPatch }
    let { error: additionalUpsertError } = await readClient
      .from("case_additional_details")
      .upsert(additionalPayload, { onConflict: "case_id" })
    while (additionalUpsertError) {
      const missingColumn = missingSchemaColumn(additionalUpsertError)
      if (!missingColumn || !(missingColumn in additionalPayload)) break
      const fallbackPayload: Record<string, unknown> = { ...additionalPayload }
      delete fallbackPayload[missingColumn]
      additionalPayload = fallbackPayload
      if (!warnings.includes("case_additional_details_columns_missing_in_db")) {
        warnings.push("case_additional_details_columns_missing_in_db")
      }
      const fallback = await readClient.from("case_additional_details").upsert(additionalPayload, { onConflict: "case_id" })
      additionalUpsertError = fallback.error ?? null
    }
    if (additionalUpsertError) {
      const validationIssue = mapOnlinekreditSaveValidationIssue({
        stage: "additional_upsert",
        message: additionalUpsertError.message,
      })
      return NextResponse.json(
        validationIssue
          ? {
              ok: false,
              error: "validation_failed",
              stage: "additional_upsert",
              message: validationIssue.message,
              validation: validationIssue,
            }
          : { ok: false, error: "save_failed", stage: "additional_upsert", message: additionalUpsertError.message },
        { status: 400 }
      )
    }
  }

  if (Array.isArray(body?.co)) {
    const coRows = (body.co as any[])
      .map((c) => pick(c ?? {}, CO_FIELDS))
      .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
      .map((c) => ({
        ...c,
        phone: c.phone === undefined ? undefined : normalizePhoneForProviders(c.phone),
        phone_business: c.phone_business === undefined ? undefined : normalizePhoneForProviders(c.phone_business),
        birth_date: dateOrNull(c.birth_date),
        id_issued_at: dateOrNull(c.id_issued_at),
        id_expires_at: dateOrNull(c.id_expires_at),
        residence_since: dateOrNull(c.residence_since),
        previous_address_since: dateOrNull(c.previous_address_since),
        employment_since: dateOrNull(c.employment_since),
        household_persons: numOrNull(c.household_persons),
        vehicle_count: numOrNull(c.vehicle_count),
        net_income_monthly: numOrNull(c.net_income_monthly),
        other_income_monthly: numOrNull(c.other_income_monthly),
        expenses_monthly: numOrNull(c.expenses_monthly),
        existing_loans_monthly: numOrNull(c.existing_loans_monthly),
      }))

    let coValidationIssue = null
    for (const row of coRows) {
      coValidationIssue = getMonthlyAmountPlausibilityValidationIssue({
        value: row.net_income_monthly,
        max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
        step: "co",
        section: "zweiter-kreditnehmer",
        fields: ["net_income_monthly"],
        label: "Das Nettoeinkommen von Antragsteller 2",
      })
      if (coValidationIssue) break
      const coAdditionalDateValidationIssue = getAdditionalIdDateValidationIssue({
        id_issued_at: row.id_issued_at,
        id_expires_at: row.id_expires_at,
      })
      if (coAdditionalDateValidationIssue) {
        coValidationIssue = {
          ...coAdditionalDateValidationIssue,
          step: "co",
          section: "legitimation",
          fields: ["id_issued_at", "id_expires_at"],
        }
        break
      }
    }
    if (coValidationIssue) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          stage: "co_validation",
          message: coValidationIssue.message,
          validation: coValidationIssue,
        },
        { status: 400 }
      )
    }

    const { error: coDeleteError } = await readClient.from("case_applicants").delete().eq("case_id", caseId).eq("role", "co")
    if (coDeleteError) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "co_delete", message: coDeleteError.message },
        { status: 400 }
      )
    }
    if (coRows.length) {
      for (const row of coRows) {
        const coInsertError = await persistApplicantRow(readClient, {
          caseId,
          role: "co",
          patch: row,
          warnings,
        })
        if (coInsertError) {
          return NextResponse.json(
            { ok: false, error: "save_failed", stage: "co_insert", message: coInsertError.message },
            { status: 400 }
          )
        }
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
              child_benefit: c?.child_benefit,
              maintenance_income_present: c?.maintenance_income_present,
              applicant_scope: c?.applicant_scope,
              support_income_monthly: c?.maintenance_income_monthly,
            })
          )
          .filter((c) => Object.values(c).some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
          .map((c) => ({
            case_id: caseId,
            ...(pick(c, CHILD_DB_FIELDS) as Record<string, any>),
            birth_date: dateOrNull(c.birth_date),
            child_benefit:
              c.child_benefit === undefined || c.child_benefit === null ? null : !!c.child_benefit,
            maintenance_income_present:
              c.maintenance_income_present === undefined || c.maintenance_income_present === null
                ? null
                : !!c.maintenance_income_present,
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
      const childrenInsertError = await insertChildrenRows(readClient, rows, warnings)
      if (childrenInsertError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "children_insert", message: childrenInsertError.message },
          { status: 400 }
        )
      }
    }
  }

  if (Array.isArray(body?.liabilities)) {
    const rows = (body.liabilities as any[])
      .map((row) =>
        defined({
          liability_type: row?.liability_type,
          applicant_scope: row?.applicant_scope,
          creditor: row?.creditor,
          monthly_rate: row?.monthly_rate,
          final_installment: row?.final_installment,
          last_rate_date: row?.last_rate_date,
          current_balance: row?.current_balance,
          original_amount: row?.original_amount,
          first_payment_date: row?.first_payment_date,
          utilized_amount: row?.utilized_amount,
          credit_limit: row?.credit_limit,
          interest_rate: row?.interest_rate,
          refinance: row?.refinance,
          iban: row?.iban,
          bic: row?.bic,
        })
      )
      .filter((row) => {
        const textFields = [
          row.creditor,
          row.monthly_rate,
          row.final_installment,
          row.last_rate_date,
          row.current_balance,
          row.original_amount,
          row.first_payment_date,
          row.utilized_amount,
          row.credit_limit,
          row.interest_rate,
          row.iban,
          row.bic,
        ]
        const hasData = textFields.some((value) => value !== null && value !== undefined && String(value).trim() !== "")
        return Boolean(row.liability_type) && (hasData || row.refinance === true)
      })
      .map((row) => ({
        case_id: caseId,
        ...(pick(row, LIABILITY_DB_FIELDS) as Record<string, any>),
        monthly_rate: numOrNull(row.monthly_rate),
        final_installment: numOrNull(row.final_installment),
        last_rate_date: dateOrNull(row.last_rate_date),
        current_balance: numOrNull(row.current_balance),
        original_amount: numOrNull(row.original_amount),
        first_payment_date: dateOrNull(row.first_payment_date),
        utilized_amount: numOrNull(row.utilized_amount),
        credit_limit: numOrNull(row.credit_limit),
        interest_rate: numOrNull(row.interest_rate),
        refinance: row.refinance === undefined || row.refinance === null ? null : !!row.refinance,
      }))

    const { error: liabilitiesDeleteError } = await readClient.from("case_liabilities").delete().eq("case_id", caseId)
    if (liabilitiesDeleteError && !isMissingRelationError(liabilitiesDeleteError)) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "liabilities_delete", message: liabilitiesDeleteError.message },
        { status: 400 }
      )
    }
    if (liabilitiesDeleteError && isMissingRelationError(liabilitiesDeleteError)) {
      warnings.push("case_liabilities_table_missing_in_db")
    } else if (rows.length) {
      const liabilitiesInsertError = await insertLiabilityRows(readClient, rows, warnings)
      if (liabilitiesInsertError) {
        return NextResponse.json(
          { ok: false, error: "save_failed", stage: "liabilities_insert", message: liabilitiesInsertError.message },
          { status: 400 }
        )
      }
    }
  }

  if (Array.isArray(body?.realEstateAssets)) {
    const assetRows = (body.realEstateAssets as any[])
      .map((row) => ({
        raw: row,
        asset: defined({
          applicant_scope: row?.applicant_scope,
          property_type: row?.property_type,
          description: row?.description,
          value_amount: row?.value_amount,
          living_space_sqm: row?.living_space_sqm,
          usage_type: row?.usage_type,
          rented_living_space_sqm: row?.rented_living_space_sqm,
          rent_income_cold_monthly: row?.rent_income_cold_monthly,
          rent_income_warm_monthly: row?.rent_income_warm_monthly,
          ancillary_costs_monthly: row?.ancillary_costs_monthly,
        }),
      }))
      .filter(({ asset }) =>
        Object.values(asset).some((value) => value !== null && value !== undefined && String(value).trim() !== "")
      )

    const deleteAssetsResult = await readClient.from("case_real_estate_assets").delete().eq("case_id", caseId)
    if (deleteAssetsResult.error && !isMissingSpecificRelationError(deleteAssetsResult.error, "case_real_estate_assets")) {
      return NextResponse.json(
        { ok: false, error: "save_failed", stage: "real_estate_assets_delete", message: deleteAssetsResult.error.message },
        { status: 400 }
      )
    }

    if (deleteAssetsResult.error && isMissingSpecificRelationError(deleteAssetsResult.error, "case_real_estate_assets")) {
      warnings.push("case_real_estate_assets_table_missing_in_db")
    } else {
      for (const { raw, asset } of assetRows) {
        const assetPayload = {
          case_id: caseId,
          ...(pick(asset, REAL_ESTATE_ASSET_DB_FIELDS) as Record<string, any>),
          value_amount: numOrNull(asset.value_amount),
          living_space_sqm: numOrNull(asset.living_space_sqm),
          rented_living_space_sqm: numOrNull(asset.rented_living_space_sqm),
          rent_income_cold_monthly: numOrNull(asset.rent_income_cold_monthly),
          rent_income_warm_monthly: numOrNull(asset.rent_income_warm_monthly),
          ancillary_costs_monthly: numOrNull(asset.ancillary_costs_monthly),
        }

        const { data: insertedAsset, error: assetInsertError } = await readClient
          .from("case_real_estate_assets")
          .insert(assetPayload)
          .select("id")
          .single()

        if (assetInsertError && isMissingSpecificRelationError(assetInsertError, "case_real_estate_assets")) {
          warnings.push("case_real_estate_assets_table_missing_in_db")
          break
        }

        if (assetInsertError) {
          return NextResponse.json(
            { ok: false, error: "save_failed", stage: "real_estate_asset_insert", message: assetInsertError.message },
            { status: 400 }
          )
        }

        const loans = Array.isArray(raw?.loans) ? raw.loans : []
        const loanRows = loans
          .map((loan: any) =>
            defined({
              remaining_debt: loan?.remaining_debt,
              interest_fixed_until: loan?.interest_fixed_until,
              monthly_rate: loan?.monthly_rate,
            })
          )
          .filter((loan: Record<string, unknown>) =>
            Object.values(loan).some((value) => value !== null && value !== undefined && String(value).trim() !== "")
          )
          .map((loan: Record<string, unknown>) => ({
            asset_id: insertedAsset.id,
            ...(pick(loan, REAL_ESTATE_LOAN_DB_FIELDS) as Record<string, any>),
            remaining_debt: numOrNull(loan.remaining_debt),
            interest_fixed_until: dateOrNull(loan.interest_fixed_until),
            monthly_rate: numOrNull(loan.monthly_rate),
          }))

        if (loanRows.length) {
          const { error: loansInsertError } = await readClient.from("case_real_estate_loans").insert(loanRows)
          if (loansInsertError && isMissingSpecificRelationError(loansInsertError, "case_real_estate_loans")) {
            warnings.push("case_real_estate_loans_table_missing_in_db")
            continue
          }
          if (loansInsertError) {
            return NextResponse.json(
              { ok: false, error: "save_failed", stage: "real_estate_loans_insert", message: loansInsertError.message },
              { status: 400 }
            )
          }
        }
      }
    }
  }

  let europaceSync:
    | {
        attempted: boolean
        ok: boolean
        error?: string | null
      }
    | undefined

  if (triggerEuropaceSync && isKonsum && hasEuropaceConfig()) {
    const canAutoSync = await hasEuropaceAutoSyncPrerequisites(readClient, caseId)
    if (canAutoSync) {
      europaceSync = { attempted: true, ok: false, error: null }
      try {
        await syncEuropaceCase(readClient, caseId)
        europaceSync = { attempted: true, ok: true }
      } catch (error) {
        europaceSync = {
          attempted: true,
          ok: false,
          error: error instanceof Error ? error.message : "Europace-Sync fehlgeschlagen.",
        }
      }
    } else {
      europaceSync = { attempted: false, ok: false, error: null }
    }
  } else {
    europaceSync = { attempted: false, ok: false, error: null }
  }

  return NextResponse.json({
    ok: true,
    warnings,
    europaceSync: europaceSync ?? { attempted: false, ok: false, error: null },
  })
}
