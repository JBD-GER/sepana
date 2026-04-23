import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { loadLatestFinancialAnalysisService } from "@/lib/financial-analysis/data"
import { renderFinancialAnalysisActionPlanPdf } from "@/lib/financial-analysis/renderFinancialAnalysisActionPlanPdf"
import { isMissingFinancialAnalysisTablesError, trimOrNull } from "@/lib/financial-analysis/service"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function safePdfName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80)
}

export async function GET(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const caseId = trimOrNull(url.searchParams.get("caseId"))
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })

  const admin = supabaseAdmin()

  try {
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("id,case_ref,case_type,customer_id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle()

    if (caseError) throw caseError
    if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
      return NextResponse.json({ error: "case_type_not_supported" }, { status: 409 })
    }
    if (role === "customer" && trimOrNull(caseRow.customer_id) !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (role === "advisor" && trimOrNull(caseRow.assigned_advisor_id) !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (role !== "customer" && role !== "advisor" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = await loadLatestFinancialAnalysisService(admin, caseId)
    if (!service?.id) {
      return NextResponse.json({ error: "financial_analysis_missing" }, { status: 404 })
    }

    const actionPlan = trimOrNull(service.published_action_plan)
    if (!actionPlan) {
      return NextResponse.json({ error: "financial_analysis_action_plan_missing" }, { status: 404 })
    }

    const isCustomer = role === "customer"
    const isPublished = Boolean(trimOrNull(service.published_at))
    const isActive = String(service.service_status ?? "").trim().toLowerCase() === "active"
    if (isCustomer && (!isActive || !isPublished)) {
      return NextResponse.json({ error: "financial_analysis_not_published" }, { status: 403 })
    }

    const { data: applicantRow, error: applicantError } = await admin
      .from("case_applicants")
      .select("first_name,last_name")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()

    if (applicantError) throw applicantError

    const customerName = [applicantRow?.first_name, applicantRow?.last_name]
      .map((value) => trimOrNull(value))
      .filter(Boolean)
      .join(" ")

    const caseRef = trimOrNull(caseRow.case_ref) ?? caseRow.id.slice(0, 8)
    const pdfBytes = await renderFinancialAnalysisActionPlanPdf({
      caseRef,
      customerName: customerName || null,
      actionPlan,
      householdOverview: service.published_household_overview,
      recommendations: service.published_recommendations,
      createdAt: service.created_at,
      publishedAt: service.published_at,
    })

    return new NextResponse(pdfBytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="90-Tage-Massnahmenplan-${safePdfName(caseRef)}.pdf"`,
        "cache-control": "private, no-store",
      },
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "financial_analysis_action_plan_failed" },
      { status: 400 }
    )
  }
}
