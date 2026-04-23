import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { loadLatestFinancialAnalysisService } from "@/lib/financial-analysis/data"
import {
  buildFinancialAnalysisServicePatch,
  getFinancialAnalysisDocumentKindLabel,
  isMissingFinancialAnalysisTablesError,
  normalizeFinancialAnalysisServiceRow,
  trimOrNull,
  type FinancialAnalysisDocumentKind,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
}

function safeFileName(name: string) {
  return String(name ?? "").replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function fileExt(name: string) {
  const raw = String(name ?? "")
  const index = raw.lastIndexOf(".")
  if (index < 0) return ""
  return raw.slice(index + 1).trim().toLowerCase()
}

function inferMimeType(file: File) {
  const explicit = trimOrNull(file.type)?.toLowerCase()
  if (explicit) return explicit
  return MIME_BY_EXT[fileExt(file.name)] || "application/octet-stream"
}

function isSupportedDocument(file: File, mimeType: string) {
  const normalizedMime = String(mimeType ?? "").trim().toLowerCase()
  if (normalizedMime.startsWith("image/")) return true
  if (Object.values(MIME_BY_EXT).includes(normalizedMime)) return true
  return Object.prototype.hasOwnProperty.call(MIME_BY_EXT, fileExt(file.name))
}

function normalizeDocumentKind(value: unknown): FinancialAnalysisDocumentKind | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "bank_statement" || normalized === "schufa_report" || normalized === "supporting_document") {
    return normalized
  }
  return null
}

async function loadCaseAccess(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const result = await admin
    .from("cases")
    .select("id,case_type,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (result.error) throw result.error
  return (result.data ?? null) as
    | {
        id?: string | null
        case_type?: string | null
        customer_id?: string | null
        assigned_advisor_id?: string | null
      }
    | null
}

function canAccessCase(input: {
  role: string | null
  userId: string
  caseRow: { customer_id?: string | null; assigned_advisor_id?: string | null } | null
}) {
  if (!input.caseRow) return false
  if (input.role === "admin") return true
  if (input.role === "customer") return trimOrNull(input.caseRow.customer_id) === input.userId
  if (input.role === "advisor") return trimOrNull(input.caseRow.assigned_advisor_id) === input.userId
  return false
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const caseId = trimOrNull(form?.get("caseId"))
  const serviceId = trimOrNull(form?.get("serviceId"))
  const documentKind = normalizeDocumentKind(form?.get("documentKind"))
  const file = form?.get("file")

  if (!caseId || !serviceId || !documentKind || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "fehlende_felder" }, { status: 400 })
  }
  if (!file.size) {
    return NextResponse.json({ ok: false, error: "leere_datei" }, { status: 400 })
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "datei_zu_gross" }, { status: 413 })
  }

  const mimeType = inferMimeType(file)
  if (!isSupportedDocument(file, mimeType)) {
    return NextResponse.json({ ok: false, error: "dateityp_nicht_unterstuetzt" }, { status: 415 })
  }

  const admin = supabaseAdmin()

  try {
    const caseRow = await loadCaseAccess(admin, caseId)
    if (!caseRow?.id) {
      return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
    }
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
      return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
    }
    if (!canAccessCase({ role, userId: user.id, caseRow })) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const latestService = await loadLatestFinancialAnalysisService(admin, caseId)
    if (!latestService?.id || latestService.id !== serviceId) {
      return NextResponse.json({ ok: false, error: "financial_analysis_not_found" }, { status: 404 })
    }
    if (String(latestService.service_status ?? "").trim().toLowerCase() !== "active") {
      return NextResponse.json({ ok: false, error: "financial_analysis_not_active" }, { status: 409 })
    }

    const originalName = trimOrNull(file.name) ?? "upload.bin"
    const storagePath = `financial-analysis/${serviceId}/${Date.now()}_${crypto.randomUUID()}_${safeFileName(originalName)}`

    const uploadResult = await admin.storage.from("case_documents").upload(storagePath, file, {
      upsert: false,
      contentType: mimeType,
    })
    if (uploadResult.error) throw uploadResult.error

    const insertedResult = await admin
      .from("case_financial_analysis_documents")
      .insert({
        service_id: serviceId,
        case_id: caseId,
        document_kind: documentKind,
        file_name: originalName,
        file_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        uploaded_by: user.id,
        processing_status: "uploaded",
      })
      .select("*")
      .single()

    if (insertedResult.error) throw insertedResult.error

    let nextService: FinancialAnalysisServiceRow | null = latestService
    if (String(latestService.analysis_status ?? "").trim().toLowerCase() === "not_started") {
      const patch = buildFinancialAnalysisServicePatch({
        row: latestService,
        nowIso: new Date().toISOString(),
        nextAnalysisStatus: "documents_received",
      })

      const serviceUpdateResult = await admin
        .from("case_financial_analysis_services")
        .update(patch)
        .eq("id", latestService.id)
        .select("*")
        .single()

      if (serviceUpdateResult.error) throw serviceUpdateResult.error
      nextService = normalizeFinancialAnalysisServiceRow((serviceUpdateResult.data ?? null) as FinancialAnalysisServiceRow | null)
    }

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "financial_analysis_document_uploaded",
      title: "Finanzanalyse-Dokument hochgeladen",
      body: `Dokument: ${getFinancialAnalysisDocumentKindLabel(documentKind)} - ${originalName}`,
      meta: {
        service_id: serviceId,
        file_name: originalName,
        document_kind: documentKind,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({
      ok: true,
      service: nextService,
      document: insertedResult.data ?? null,
    })
  } catch (error) {
    if (isMissingFinancialAnalysisTablesError(error)) {
      return NextResponse.json({ ok: false, error: "financial_analysis_tables_missing" }, { status: 503 })
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "financial_analysis_upload_failed" },
      { status: 400 }
    )
  }
}
