import {
  isMissingFinancialAnalysisTablesError,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisDocumentRow,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
import { verifyFinancialAnalysisPublicToken } from "@/lib/financial-analysis/publicAccess"

type MinimalSupabase = {
  from: (table: string) => any
}

export async function loadLatestFinancialAnalysisService(admin: MinimalSupabase, caseId: string) {
  const normalizedCaseId = trimOrNull(caseId)
  if (!normalizedCaseId) return null

  const result = await admin
    .from("case_financial_analysis_services")
    .select("*")
    .eq("case_id", normalizedCaseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) {
    if (isMissingFinancialAnalysisTablesError(result.error)) return null
    throw result.error
  }

  return normalizeFinancialAnalysisServiceRow((result.data ?? null) as FinancialAnalysisServiceRow | null)
}

export async function loadFinancialAnalysisDocuments(admin: MinimalSupabase, serviceId: string) {
  const normalizedServiceId = trimOrNull(serviceId)
  if (!normalizedServiceId) return []

  const result = await admin
    .from("case_financial_analysis_documents")
    .select("*")
    .eq("service_id", normalizedServiceId)
    .order("created_at", { ascending: false })
    .limit(200)

  const awaited = (result as unknown as Promise<{ data: unknown; error?: unknown }>)
  const { data, error } = await awaited

  if (error) {
    if (isMissingFinancialAnalysisTablesError(error)) return []
    throw error
  }

  return ((data ?? []) as FinancialAnalysisDocumentRow[]).map((row) => ({ ...row }))
}

export async function loadFinancialAnalysisPublicContext(admin: MinimalSupabase, token: string) {
  const verified = verifyFinancialAnalysisPublicToken(token)
  if (!verified) {
    return { ok: false as const, status: 403, error: "invalid_public_financial_analysis_access" }
  }

  const [serviceResult, caseResult, applicantResult] = await Promise.all([
    admin
      .from("case_financial_analysis_services")
      .select("*")
      .eq("id", verified.serviceId)
      .maybeSingle(),
    admin
      .from("cases")
      .select("id,case_ref,case_type,customer_id,assigned_advisor_id")
      .eq("id", verified.caseId)
      .maybeSingle(),
    admin
      .from("case_applicants")
      .select("first_name,last_name")
      .eq("case_id", verified.caseId)
      .eq("role", "primary")
      .maybeSingle(),
  ])

  if (serviceResult.error) {
    if (isMissingFinancialAnalysisTablesError(serviceResult.error)) {
      return { ok: false as const, status: 503, error: "missing_financial_analysis_tables" }
    }
    throw serviceResult.error
  }
  if (caseResult.error) throw caseResult.error
  if (applicantResult.error) throw applicantResult.error

  const service = normalizeFinancialAnalysisServiceRow((serviceResult.data ?? null) as FinancialAnalysisServiceRow | null)
  const caseRow = (caseResult.data ?? null) as
    | {
        id?: string | null
        case_ref?: string | null
        case_type?: string | null
        customer_id?: string | null
        assigned_advisor_id?: string | null
      }
    | null
  const applicantRow = (applicantResult.data ?? null) as
    | {
        first_name?: string | null
        last_name?: string | null
      }
    | null

  if (!service || !caseRow?.id || trimOrNull(caseRow.id) !== verified.caseId) {
    return { ok: false as const, status: 404, error: "financial_analysis_not_found" }
  }

  const applicantName = [applicantRow?.first_name, applicantRow?.last_name]
    .map((value) => trimOrNull(value))
    .filter(Boolean)
    .join(" ")

  return {
    ok: true as const,
    tokenPayload: verified,
    service,
    caseRow: {
      id: trimOrNull(caseRow.id) ?? verified.caseId,
      case_ref: trimOrNull(caseRow.case_ref),
      case_type: trimOrNull(caseRow.case_type),
      customer_id: trimOrNull(caseRow.customer_id),
      assigned_advisor_id: trimOrNull(caseRow.assigned_advisor_id),
    },
    applicantName: applicantName || null,
  }
}
