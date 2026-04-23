import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { updateCaseStatusCompat } from "@/lib/caseStatusCompat"
import { getCaseMeta, logCaseEvent } from "@/lib/notifications/notify"
import { SEPARATE_MANDATE_TITLE } from "@/lib/schufa-frei/contractPackage"
import {
  SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  buildLegacySchufaFreeProvisionCancellationDescription,
  buildSchufaFreeProvisionCancellationDescription,
  buildSchufaFreeProvisionCancellationInvoiceTitle,
  buildSchufaFreeProvisionDescription,
  buildSchufaFreeProvisionInvoiceTitle,
  getSchufaFreeProvisionInvoiceNumber,
  isLegacySchufaFreeProvisionInvoiceType,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"
import { renderSchufaFreeSeparateMandatePdf } from "@/lib/schufa-frei/signatureDocuments"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type SupportedAction = "save" | "recreate" | "mark_paid" | "mark_refunded" | "mark_open" | "cancel"

type CaseInvoiceRow = {
  id: string
  invoice_type?: string | null
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | string | null
  loan_amount?: number | string | null
  recipient_name?: string | null
  recipient_email?: string | null
  created_at?: string | null
}

const MAIN_INVOICE_TYPES = [SCHUFA_FREE_PROVISION_INVOICE_TYPE, SCHUFA_FREE_LEGACY_PROVISION_INVOICE_TYPE]
const CANCELLATION_INVOICE_TYPES = [
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE,
]

function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

function isMissingCaseInvoiceNumberMigrationError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false

  const code = String(anyError.code ?? "").trim()
  const msg = String(anyError.message ?? "").toLowerCase()

  if (code === "23502" && msg.includes("invoice_number")) return true
  if (code === "42704" && msg.includes("case_invoice_number_seq")) return true
  return msg.includes("case_invoice_number_seq") || (msg.includes("invoice_number") && msg.includes("default"))
}

function isSupportedAction(value: string): value is SupportedAction {
  return (
    value === "save" ||
    value === "recreate" ||
    value === "mark_paid" ||
    value === "mark_refunded" ||
    value === "mark_open" ||
    value === "cancel"
  )
}

function parseAmountTotal(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric * 100) / 100
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function pickPreferredInvoice(rows: CaseInvoiceRow[], preferredTypes: string[]) {
  const preferredTypeSet = new Set(preferredTypes)
  const filtered = rows.filter((row) => preferredTypeSet.has(String(row.invoice_type ?? "").trim()))
  if (filtered.length === 0) return null

  return filtered.sort((a, b) => {
    const aType = String(a.invoice_type ?? "").trim()
    const bType = String(b.invoice_type ?? "").trim()
    const aPriority = preferredTypes.indexOf(aType)
    const bPriority = preferredTypes.indexOf(bType)
    if (aPriority !== bPriority) return aPriority - bPriority
    const aCreated = Date.parse(String(a.created_at ?? ""))
    const bCreated = Date.parse(String(b.created_at ?? ""))
    return Number.isFinite(bCreated) ? bCreated - (Number.isFinite(aCreated) ? aCreated : 0) : -1
  })[0]
}

function getCreatedAtMs(value: string | null | undefined) {
  const timestamp = Date.parse(String(value ?? ""))
  return Number.isFinite(timestamp) ? timestamp : 0
}

function pickRelevantCancellationInvoice(rows: CaseInvoiceRow[], invoice: CaseInvoiceRow | null) {
  const preferredTypeSet = new Set(CANCELLATION_INVOICE_TYPES)
  const invoiceCreatedAt = getCreatedAtMs(invoice?.created_at)
  const filtered = rows.filter((row) => {
    const invoiceType = String(row.invoice_type ?? "").trim()
    if (!preferredTypeSet.has(invoiceType)) return false
    if (!invoice) return true
    return getCreatedAtMs(row.created_at) >= invoiceCreatedAt
  })
  if (filtered.length === 0) return null
  return pickPreferredInvoice(filtered, CANCELLATION_INVOICE_TYPES)
}

async function resolveSchufaFreeCustomerCity(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: details } = await admin
    .from("case_schufa_free_details")
    .select("city")
    .eq("case_id", caseId)
    .maybeSingle()

  return trimOrNull(details?.city)
}

async function refreshSeparateMandateRequest(input: {
  admin: ReturnType<typeof supabaseAdmin>
  caseId: string
  actorId: string
  amountTotal: number
  caseRef: string
  createdAt?: string | null
  customerName: string | null
  customerCity: string | null
  advisorName: string | null
  forceRefresh: boolean
}) {
  const { admin, caseId, actorId, amountTotal, caseRef, createdAt, customerName, customerCity, advisorName, forceRefresh } = input
  const { data: existingRequest } = await admin
    .from("case_signature_requests")
    .select("id")
    .eq("case_id", caseId)
    .eq("title", SEPARATE_MANDATE_TITLE)
    .limit(1)
    .maybeSingle()

  if (existingRequest?.id && !forceRefresh) {
    const { data: existingOriginalDoc } = await admin
      .from("documents")
      .select("id")
      .eq("signature_request_id", existingRequest.id)
      .eq("document_kind", "signature_original")
      .limit(1)
      .maybeSingle()

    if (existingOriginalDoc?.id) {
      return { requestId: existingRequest.id, refreshed: false }
    }
  }

  const rendered = await renderSchufaFreeSeparateMandatePdf({
    caseRef,
    amountTotal,
    createdAt,
    customerName,
    customerCity,
    advisorName,
  })

  let requestId = trimOrNull(existingRequest?.id)
  if (!requestId) {
    const { data: createdRequest, error: createRequestError } = await admin
      .from("case_signature_requests")
      .insert({
        case_id: caseId,
        title: SEPARATE_MANDATE_TITLE,
        provider_id: null,
        requires_wet_signature: false,
        fields: rendered.fields,
        created_by: actorId,
        status: "pending",
      })
      .select("id")
      .single()

    if (createRequestError || !createdRequest?.id) {
      throw new Error(createRequestError?.message ?? "Vermittlungsauftrag konnte nicht angelegt werden.")
    }
    requestId = createdRequest.id
  }

  const { data: oldDocs } = await admin
    .from("documents")
    .select("id,file_path")
    .eq("signature_request_id", requestId)

  const fileName = `${safeFileName(SEPARATE_MANDATE_TITLE)}.pdf`
  const storagePath = `${caseId}/signature/${requestId}/${Date.now()}_${fileName}`
  const uploadResult = await admin.storage
    .from("case_documents")
    .upload(storagePath, rendered.bytes, { upsert: true, contentType: "application/pdf" })
  if (uploadResult.error) throw uploadResult.error

  const { data: insertedDoc, error: insertDocError } = await admin
    .from("documents")
    .insert({
      case_id: caseId,
      signature_request_id: requestId,
      document_kind: "signature_original",
      uploaded_by: actorId,
      file_path: storagePath,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: rendered.bytes.length,
    })
    .select("id")
    .single()

  if (insertDocError || !insertedDoc?.id) {
    try {
      await admin.storage.from("case_documents").remove([storagePath])
    } catch {}
    throw new Error(insertDocError?.message ?? "Vermittlungsauftrag konnte nicht gespeichert werden.")
  }

  const oldDocumentIds = (oldDocs ?? [])
    .map((row) => trimOrNull(row.id))
    .filter((value): value is string => Boolean(value) && value !== insertedDoc.id)
  const oldFilePaths = (oldDocs ?? [])
    .map((row) => trimOrNull(row.file_path))
    .filter((value): value is string => Boolean(value) && value !== storagePath)

  if (oldFilePaths.length) {
    try {
      await admin.storage.from("case_documents").remove(oldFilePaths)
    } catch {}
  }
  if (oldDocumentIds.length) {
    try {
      await admin.from("case_skag_documents").delete().in("local_document_id", oldDocumentIds)
    } catch {}
    try {
      await admin.from("documents").delete().in("id", oldDocumentIds)
    } catch {}
  }
  try {
    await admin.from("case_signature_field_values").delete().eq("request_id", requestId)
  } catch {}
  try {
    await admin.from("case_signature_events").delete().eq("request_id", requestId)
  } catch {}

  const { error: updateRequestError } = await admin
    .from("case_signature_requests")
    .update({
      fields: rendered.fields,
      provider_id: null,
      requires_wet_signature: false,
      status: "pending",
      advisor_signed_at: null,
      customer_signed_at: null,
      customer_notified_at: null,
    })
    .eq("id", requestId)

  if (updateRequestError) {
    throw new Error(updateRequestError.message)
  }

  return { requestId, refreshed: true }
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const actionRaw = String(body?.action ?? "").trim().toLowerCase()

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }
  if (!isSupportedAction(actionRaw)) {
    return NextResponse.json({ ok: false, error: "Ungueltige Aktion" }, { status: 400 })
  }
  if (actionRaw === "cancel" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Nur Admin darf stornieren" }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id,status")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) {
    return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  }
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { data: invoiceRowsRaw, error: invoiceLoadError } = await admin
    .from("case_invoices")
    .select("*")
    .eq("case_id", caseId)
    .in("invoice_type", [...MAIN_INVOICE_TYPES, ...CANCELLATION_INVOICE_TYPES])
    .order("created_at", { ascending: false })

  if (invoiceLoadError) {
    if (isMissingCaseInvoicesTableError(invoiceLoadError)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: invoiceLoadError.message }, { status: 400 })
  }

  const invoiceRows = (invoiceRowsRaw ?? []) as CaseInvoiceRow[]
  const existingInvoice = pickPreferredInvoice(invoiceRows, MAIN_INVOICE_TYPES)
  const cancellationInvoice = pickRelevantCancellationInvoice(invoiceRows, existingInvoice)
  const existingStatus = String(existingInvoice?.status ?? "").trim().toLowerCase()
  const invoiceCancelled = existingStatus === "cancelled" || Boolean(cancellationInvoice?.id)
  const now = new Date().toISOString()

  if (actionRaw === "save") {
    const amountTotal = parseAmountTotal(body?.amountTotal)
    if (!amountTotal) {
      return NextResponse.json({ ok: false, error: "amount_total_invalid" }, { status: 400 })
    }
    if (invoiceCancelled) {
      return NextResponse.json({ ok: false, error: "Rechnung wurde bereits storniert" }, { status: 409 })
    }
    if (existingInvoice && existingStatus && existingStatus !== "sent") {
      return NextResponse.json({ ok: false, error: "Rechnung kann nicht mehr geaendert werden" }, { status: 409 })
    }

    const caseMeta = await getCaseMeta(caseId)
    const payload = {
      case_type: "schufa_frei",
      invoice_type: SCHUFA_FREE_PROVISION_INVOICE_TYPE,
      title: buildSchufaFreeProvisionInvoiceTitle(),
      description: buildSchufaFreeProvisionDescription(amountTotal),
      status: "sent",
      loan_amount: null,
      percentage_rate: null,
      amount_total: amountTotal,
      currency: "EUR",
      recipient_name: caseMeta?.customer_name ?? trimOrNull(existingInvoice?.recipient_name),
      recipient_email: caseMeta?.customer_email ?? trimOrNull(existingInvoice?.recipient_email),
      sent_at: null,
      paid_at: null,
      refunded_at: null,
      updated_at: now,
    }

    const query = existingInvoice
      ? admin.from("case_invoices").update(payload).eq("id", existingInvoice.id).select("*").single()
      : admin
          .from("case_invoices")
          .insert({
            case_id: caseId,
            created_by: user.id,
            ...payload,
          })
          .select("*")
          .single()

    const { data: savedInvoice, error: saveError } = await query

    if (saveError) {
      if (isMissingCaseInvoicesTableError(saveError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      if (isMissingCaseInvoiceNumberMigrationError(saveError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: fortlaufende Rechnungsnummer in case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      return NextResponse.json({ ok: false, error: saveError.message }, { status: 400 })
    }

    const customerCity = await resolveSchufaFreeCustomerCity(admin, caseId)
    const mandateResult = await refreshSeparateMandateRequest({
      admin,
      caseId,
      actorId: user.id,
      amountTotal,
      caseRef: caseRow.case_ref ?? caseId,
      createdAt: savedInvoice.created_at ?? now,
      customerName: caseMeta?.customer_name ?? null,
      customerCity,
      advisorName: caseMeta?.advisor_name ?? null,
      forceRefresh:
        !existingInvoice ||
        Math.abs(Number(existingInvoice.amount_total ?? 0) - amountTotal) > 0.009,
    })

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: existingInvoice ? "schufa_free_service_fee_invoice_updated" : "schufa_free_service_fee_invoice_created",
      title: existingInvoice ? "Servicepauschale aktualisiert" : "Servicepauschale angelegt",
      body: "Die Servicepauschale wurde intern im Fall angelegt. Der gesonderte Vermittlungsauftrag wurde dabei synchronisiert. Es wurde keine Kundenbenachrichtigung versendet.",
      meta: {
        invoice_id: savedInvoice.id,
        amount_total: amountTotal,
        separate_mandate_request_id: mandateResult.requestId,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, invoice: savedInvoice, emailSent: false })
  }

  if (actionRaw === "recreate") {
    const amountTotal = parseAmountTotal(body?.amountTotal)
    if (!amountTotal) {
      return NextResponse.json({ ok: false, error: "amount_total_invalid" }, { status: 400 })
    }
    if (!existingInvoice || !invoiceCancelled) {
      return NextResponse.json({ ok: false, error: "Rechnung ist nicht storniert" }, { status: 409 })
    }

    const caseMeta = await getCaseMeta(caseId)
    const insertPayload = {
      case_id: caseId,
      case_type: "schufa_frei",
      invoice_type: SCHUFA_FREE_PROVISION_INVOICE_TYPE,
      title: buildSchufaFreeProvisionInvoiceTitle(),
      description: buildSchufaFreeProvisionDescription(amountTotal),
      status: "sent",
      loan_amount: null,
      percentage_rate: null,
      amount_total: amountTotal,
      currency: "EUR",
      recipient_name: caseMeta?.customer_name ?? trimOrNull(existingInvoice.recipient_name),
      recipient_email: caseMeta?.customer_email ?? trimOrNull(existingInvoice.recipient_email),
      sent_at: null,
      paid_at: null,
      refunded_at: null,
      created_by: user.id,
      updated_at: now,
    }

    const { data: recreatedInvoice, error: recreateError } = await admin
      .from("case_invoices")
      .insert(insertPayload)
      .select("*")
      .single()

    if (recreateError) {
      if (isMissingCaseInvoicesTableError(recreateError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      if (isMissingCaseInvoiceNumberMigrationError(recreateError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: fortlaufende Rechnungsnummer in case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            recreateError.code === "23505"
              ? "DB-Migration fehlt: Mehrere Rechnungen pro Falltyp sind noch nicht freigeschaltet."
              : recreateError.message,
        },
        { status: recreateError.code === "23505" ? 503 : 400 }
      )
    }

    const customerCity = await resolveSchufaFreeCustomerCity(admin, caseId)
    const mandateResult = await refreshSeparateMandateRequest({
      admin,
      caseId,
      actorId: user.id,
      amountTotal,
      caseRef: caseRow.case_ref ?? caseId,
      createdAt: recreatedInvoice.created_at ?? now,
      customerName: caseMeta?.customer_name ?? null,
      customerCity,
      advisorName: caseMeta?.advisor_name ?? null,
      forceRefresh: true,
    })

    await updateCaseStatusCompat(admin, {
      caseId,
      status: "skag_submitted",
      updatedAt: now,
    })

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: "schufa_free_service_fee_invoice_recreated",
      title: "Neue Rechnung angelegt",
      body: "Nach einer Stornierung wurde eine neue interne Servicepauschalenrechnung angelegt. Der Vertragsbereich ist wieder freigeschaltet.",
      meta: {
        invoice_id: recreatedInvoice.id,
        amount_total: amountTotal,
        separate_mandate_request_id: mandateResult.requestId,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, invoice: recreatedInvoice, emailSent: false })
  }

  if (!existingInvoice) {
    return NextResponse.json({ ok: false, error: "Rechnung noch nicht angelegt" }, { status: 404 })
  }

  if (invoiceCancelled && actionRaw !== "cancel" && actionRaw !== "recreate") {
    return NextResponse.json({ ok: false, error: "Rechnung wurde bereits storniert" }, { status: 409 })
  }

  if (actionRaw === "cancel") {
    if (cancellationInvoice) {
      return NextResponse.json({ ok: false, error: "Rechnung wurde bereits storniert" }, { status: 409 })
    }

    const absoluteTotalAmount = Math.abs(Number(existingInvoice.amount_total ?? 0))
    const isLegacyInvoice = isLegacySchufaFreeProvisionInvoiceType(existingInvoice.invoice_type)
    const originalInvoiceNumber = getSchufaFreeProvisionInvoiceNumber(existingInvoice.invoice_number)
    const cancellationPayload = {
      case_id: caseId,
      case_type: "schufa_frei",
      invoice_type: isLegacyInvoice
        ? SCHUFA_FREE_LEGACY_PROVISION_CANCELLATION_INVOICE_TYPE
        : SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
      title: buildSchufaFreeProvisionCancellationInvoiceTitle(),
      description: isLegacyInvoice
        ? buildLegacySchufaFreeProvisionCancellationDescription({
            loanAmount: Number(existingInvoice.loan_amount ?? 0),
            originalInvoiceNumber,
          })
        : buildSchufaFreeProvisionCancellationDescription({
            amountTotal: absoluteTotalAmount,
            originalInvoiceNumber,
          }),
      status: "cancelled",
      loan_amount: isLegacyInvoice ? Number(existingInvoice.loan_amount ?? 0) || null : null,
      percentage_rate: isLegacyInvoice ? 0.05 : null,
      amount_total: -absoluteTotalAmount,
      currency: "EUR",
      recipient_name: trimOrNull(existingInvoice.recipient_name),
      recipient_email: trimOrNull(existingInvoice.recipient_email),
      sent_at: null,
      paid_at: null,
      refunded_at: null,
      created_by: user.id,
      updated_at: now,
    }

    const { data: createdCancellationInvoice, error: cancellationError } = await admin
      .from("case_invoices")
      .insert(cancellationPayload)
      .select("*")
      .single()

    if (cancellationError) {
      if (isMissingCaseInvoicesTableError(cancellationError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      if (isMissingCaseInvoiceNumberMigrationError(cancellationError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: fortlaufende Rechnungsnummer in case_invoices ist noch nicht vorhanden." },
          { status: 503 }
        )
      }
      return NextResponse.json({ ok: false, error: cancellationError.message }, { status: 400 })
    }

    const { data: updatedInvoice, error: updateError } = await admin
      .from("case_invoices")
      .update({
        status: "cancelled",
        paid_at: null,
        refunded_at: null,
        updated_at: now,
      })
      .eq("id", existingInvoice.id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 })
    }

    try {
      await updateCaseStatusCompat(admin, {
        caseId,
        status: "cancelled",
        updatedAt: now,
      })
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "case_status_update_failed" },
        { status: 400 }
      )
    }

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: "schufa_free_service_fee_cancelled",
      title: "Rechnung storniert",
      body: "Die Rechnung wurde im Admin storniert. Es wurde keine Kundenbenachrichtigung versendet.",
      meta: {
        invoice_id: updatedInvoice.id,
        cancellation_invoice_id: createdCancellationInvoice.id,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({
      ok: true,
      invoice: updatedInvoice,
      cancellationInvoice: createdCancellationInvoice,
      emailSent: false,
    })
  }

  const nextStatus =
    actionRaw === "mark_paid" ? "paid" : actionRaw === "mark_refunded" ? "refunded" : "sent"
  const patch =
    nextStatus === "paid"
      ? { status: "paid", paid_at: now, refunded_at: null, updated_at: now }
      : nextStatus === "refunded"
        ? { status: "refunded", refunded_at: now, updated_at: now }
        : { status: "sent", paid_at: null, refunded_at: null, updated_at: now }

  const { data: updatedInvoice, error: updateError } = await admin
    .from("case_invoices")
    .update(patch)
    .eq("id", existingInvoice.id)
    .select("*")
    .single()

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 })
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type:
      nextStatus === "paid"
        ? "schufa_free_service_fee_paid"
        : nextStatus === "refunded"
          ? "schufa_free_service_fee_refunded"
          : "schufa_free_service_fee_reset",
    title:
      nextStatus === "paid"
        ? "Servicepauschale bezahlt"
        : nextStatus === "refunded"
          ? "Servicepauschale erstattet"
          : "Servicepauschale wieder offen",
    body:
      nextStatus === "paid"
        ? "Die Servicepauschale wurde als bezahlt markiert."
        : nextStatus === "refunded"
          ? "Die Servicepauschale wurde als erstattet markiert."
          : "Die Servicepauschale wurde wieder auf offen gesetzt.",
    notifyCustomer: false,
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true, invoice: updatedInvoice })
}
