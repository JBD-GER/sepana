import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import {
  buildInsuranceInvoicePaymentReference,
  extractInsurancePartnerCode,
  getInsuranceInvoiceTitle,
  isInsuranceInvoiceType,
} from "@/lib/insurance/invoice"
import { renderInsuranceInvoicePdf } from "@/lib/insurance/renderInsuranceInvoicePdf"
import { renderSchufaFreeProvisionInvoicePdf } from "@/lib/schufa-frei/renderProvisionInvoicePdf"
import {
  buildSchufaFreeProvisionPaymentReference,
  getSchufaFreeProvisionInvoiceNumber,
  isInternalSchufaFreeProvisionInvoiceType,
  isSchufaFreeProvisionCancellationInvoiceType,
  isSchufaFreeProvisionInvoiceType,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

export async function GET(_req: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { invoiceId } = await context.params
  const normalizedInvoiceId = trimOrNull(invoiceId)
  if (!normalizedInvoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: invoiceRow, error: invoiceError } = await admin
    .from("case_invoices")
    .select("*")
    .eq("id", normalizedInvoiceId)
    .maybeSingle()

  if (invoiceError) {
    if (isMissingCaseInvoicesTableError(invoiceError)) {
      return NextResponse.json({ error: "DB-Migration fehlt: case_invoices" }, { status: 503 })
    }
    return NextResponse.json({ error: invoiceError.message }, { status: 400 })
  }
  if (!invoiceRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const invoiceType = String(invoiceRow.invoice_type ?? "").trim().toLowerCase()
  const isSchufaInvoice = isSchufaFreeProvisionInvoiceType(invoiceType) || isSchufaFreeProvisionCancellationInvoiceType(invoiceType)
  const isInsurancePartnerInvoice = isInsuranceInvoiceType(invoiceType)
  if (!isSchufaInvoice && !isInsurancePartnerInvoice) {
    return NextResponse.json({ error: "invoice_type_not_supported" }, { status: 409 })
  }

  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,customer_id,assigned_advisor_id")
    .eq("id", invoiceRow.case_id)
    .maybeSingle()

  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 400 })
  }
  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 })
  }
  if (role === "customer" && caseRow.customer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role === "customer" && isInternalSchufaFreeProvisionInvoiceType(invoiceType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role === "customer" && isInsurancePartnerInvoice) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (role === "insurance") {
    const { data: insuranceRoute } = await admin
      .from("case_insurance_routes")
      .select("case_id")
      .eq("case_id", invoiceRow.case_id)
      .maybeSingle()

    if (!insuranceRoute || !isInsurancePartnerInvoice) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }
  if (role !== "customer" && role !== "advisor" && role !== "admin" && role !== "insurance") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (isInsurancePartnerInvoice) {
    const [{ data: profileRow, error: profileError }] = await Promise.all([
      invoiceRow.created_by
        ? admin
            .from("insurance_partner_profiles")
            .select("partner_code,company_name,display_name,email,street,zipcode,city")
            .eq("user_id", invoiceRow.created_by)
            .maybeSingle()
        : Promise.resolve({ data: null as any, error: null as any }),
    ])

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    const invoiceNumber = String(invoiceRow.invoice_number ?? normalizedInvoiceId).trim()
    const caseRef = trimOrNull(caseRow.case_ref) ?? caseRow.id.slice(0, 8)
    const partnerCode = trimOrNull(profileRow?.partner_code) ?? extractInsurancePartnerCode(invoiceRow.description)
    const paymentReference = buildInsuranceInvoicePaymentReference(partnerCode, trimOrNull(caseRow.case_ref))

    const pdfBytes = await renderInsuranceInvoicePdf({
      invoiceNumber,
      createdAt: invoiceRow.created_at,
      caseRef,
      paymentReference,
      recipientName: trimOrNull(invoiceRow.recipient_name) ?? trimOrNull(profileRow?.company_name) ?? trimOrNull(profileRow?.display_name),
      recipientEmail: trimOrNull(invoiceRow.recipient_email) ?? trimOrNull(profileRow?.email),
      recipientStreet: trimOrNull(invoiceRow.recipient_street) ?? trimOrNull(profileRow?.street),
      recipientZipcode: trimOrNull(invoiceRow.recipient_zipcode) ?? trimOrNull(profileRow?.zipcode),
      recipientCity: trimOrNull(invoiceRow.recipient_city) ?? trimOrNull(profileRow?.city),
      partnerCode,
      amountTotal: Number(invoiceRow.amount_total ?? 0),
      status: trimOrNull(invoiceRow.status),
      description: trimOrNull(invoiceRow.description),
    })

    return new NextResponse(pdfBytes, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${getInsuranceInvoiceTitle()}-${invoiceNumber}.pdf"`,
        "cache-control": "private, no-store",
      },
    })
  }

  const { data: detailsRow, error: detailsError } = await admin
    .from("case_schufa_free_details")
    .select("street,house_number,zipcode,city")
    .eq("case_id", invoiceRow.case_id)
    .maybeSingle()

  if (detailsError) {
    return NextResponse.json({ error: detailsError.message }, { status: 400 })
  }

  const invoiceNumber = getSchufaFreeProvisionInvoiceNumber(invoiceRow.invoice_number) ?? normalizedInvoiceId
  const caseRef = trimOrNull(caseRow.case_ref) ?? caseRow.id.slice(0, 8)
  const paymentReference = buildSchufaFreeProvisionPaymentReference(invoiceNumber, trimOrNull(caseRow.case_ref)) ?? invoiceNumber

  const pdfBytes = await renderSchufaFreeProvisionInvoicePdf({
    invoiceNumber,
    createdAt: invoiceRow.created_at,
    caseRef,
    paymentReference,
    recipientName: trimOrNull(invoiceRow.recipient_name),
    recipientEmail: trimOrNull(invoiceRow.recipient_email),
    recipientStreet: trimOrNull(detailsRow?.street),
    recipientHouseNumber: trimOrNull(detailsRow?.house_number),
    recipientZipcode: trimOrNull(detailsRow?.zipcode),
    recipientCity: trimOrNull(detailsRow?.city),
    loanAmount: Number(invoiceRow.loan_amount ?? 0),
    amountTotal: Number(invoiceRow.amount_total ?? 0),
    status: trimOrNull(invoiceRow.status),
    invoiceType,
    description: trimOrNull(invoiceRow.description),
  })

  const fileName = isSchufaFreeProvisionCancellationInvoiceType(invoiceType)
    ? `Stornorechnung-${invoiceNumber}.pdf`
    : `Rechnung-${invoiceNumber}.pdf`

  return new NextResponse(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  })
}
