export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { isMissingInsuranceTablesError } from "@/lib/insurance/routing"
import { loadSchufaFreeSignatureInvoiceGate } from "@/lib/schufa-frei/signatureInvoiceGate"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

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

  const shouldExposeInternalInvoice = role === "advisor" || role === "admin"
  const admin = supabaseAdmin()

  const [
    detailsResult,
    applicantResult,
    syncResult,
    pushResult,
    skagDocumentsResult,
    invoiceGateResult,
    insuranceRouteResult,
  ] = await Promise.all([
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
      loadSchufaFreeSignatureInvoiceGate(admin, caseId).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
      shouldExposeInternalInvoice
        ? admin
            .from("case_insurance_routes")
            .select("*")
            .eq("case_id", caseId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

  if (invoiceGateResult?.error) {
    return NextResponse.json(
      { error: invoiceGateResult.error instanceof Error ? invoiceGateResult.error.message : "invoice_gate_failed" },
      { status: 400 }
    )
  }
  if (insuranceRouteResult?.error && !isMissingInsuranceTablesError(insuranceRouteResult.error)) {
    return NextResponse.json({ error: insuranceRouteResult.error.message }, { status: 400 })
  }

  const invoiceGate = invoiceGateResult?.data

  return NextResponse.json({
    details: detailsResult.data ?? null,
    applicant: applicantResult.data ?? null,
    sync: syncResult.data ?? null,
    pushEvents: pushResult.data ?? [],
    skagDocuments: skagDocumentsResult.data ?? [],
    serviceFeeInvoiceCreated: invoiceGate?.created ?? false,
    contractSigningUnlocked: invoiceGate?.ready ?? false,
    invoice: shouldExposeInternalInvoice ? invoiceGate?.invoice ?? null : null,
    cancellationInvoice: shouldExposeInternalInvoice ? invoiceGate?.cancellationInvoice ?? null : null,
    insuranceRoute: insuranceRouteResult?.data ?? null,
  })
}
