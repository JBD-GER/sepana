export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { SCHUFA_FREE_PROVISION_INVOICE_TYPE } from "@/lib/schufa-frei/provisionInvoice"

function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const caseId = String(url.searchParams.get("caseId") ?? "").trim()
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,customer_id,assigned_advisor_id,case_type")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 400 })
  if (!caseRow) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "customer" && caseRow.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role !== "customer" && role !== "advisor" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [detailsResult, applicantResult, syncResult, pushResult, skagDocumentsResult, invoiceResult] = await Promise.all([
    supabase.from("case_schufa_free_details").select("*").eq("case_id", caseId).maybeSingle(),
    supabase.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    supabase.from("case_skag_sync").select("*").eq("case_id", caseId).maybeSingle(),
    supabase
      .from("case_skag_push_events")
      .select("status_alias,status_description,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("case_skag_documents")
      .select("local_document_id,upload_status,last_error")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("case_invoices")
      .select("*")
      .eq("case_id", caseId)
      .eq("invoice_type", SCHUFA_FREE_PROVISION_INVOICE_TYPE)
      .maybeSingle(),
  ])

  if (invoiceResult.error && !isMissingCaseInvoicesTableError(invoiceResult.error)) {
    return NextResponse.json({ error: invoiceResult.error.message }, { status: 400 })
  }

  return NextResponse.json({
    details: detailsResult.data ?? null,
    applicant: applicantResult.data ?? null,
    sync: syncResult.data ?? null,
    pushEvents: pushResult.data ?? [],
    skagDocuments: skagDocumentsResult.data ?? [],
    invoice: invoiceResult.error ? null : invoiceResult.data ?? null,
  })
}
