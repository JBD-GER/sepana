import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { flattenEuropaceAvailableAssignments, listEuropaceAvailableAssignments } from "@/lib/europace/documents"
import { deriveEuropaceFlowSummary } from "@/lib/europace/flow"
import { selectVisibleEuropaceOffers } from "@/lib/europace/offerVisibility"
import { refreshEuropaceStatusForCase } from "@/lib/europace/status"
import { deriveConcreteUploadProgress, deriveConcreteUploadTargets } from "@/lib/europace/uploadRequirements"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    if (role !== "advisor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    const includeDocuments = Boolean(body?.includeDocuments)
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: caseRow, error: caseError } = await admin
      .from("cases")
      .select("id,assigned_advisor_id,case_type")
      .eq("id", caseId)
      .maybeSingle()

    if (caseError) throw caseError
    if (!caseRow) {
      return NextResponse.json({ ok: false, error: "Fall nicht gefunden." }, { status: 404 })
    }
    if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Nicht zugewiesen." }, { status: 403 })
    }
    if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "konsum") {
      return NextResponse.json({ ok: false, error: "Europace-Status ist nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }

    const result = await refreshEuropaceStatusForCase(admin, caseId, { includeDocuments })
    const [offersResult, europaceDocumentsResult, documentsResult, documentRequestsResult] = await Promise.all([
      admin
        .from("case_europace_offers")
        .select("accepted_at,superseded_at,machbarkeit_status,vollstaendigkeit_status,angebot_snapshot")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("case_europace_documents")
        .select("local_document_id,europace_document_id,category,assignment_id,release_status,upload_status")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("documents")
        .select("id,request_id,file_name,file_path,mime_type,size_bytes,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("document_requests")
        .select("id,title,created_at,required")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true }),
    ])

    let uploadTargets: Array<{ key: string; title: string; category_id: string; assignment_id?: string | null }> = []
    if (result.europace.vorgangsnummer && result.europace.antragsnummer) {
      try {
        const assignments = await listEuropaceAvailableAssignments(admin, {
          caseId,
          vorgangsnummer: result.europace.vorgangsnummer,
          antragsnummer: result.europace.antragsnummer,
        })
        uploadTargets = flattenEuropaceAvailableAssignments(assignments).map((target) => ({
          key: target.key,
          title: target.title,
          category_id: target.categoryId,
          assignment_id: target.assignmentId,
        }))
      } catch {
        uploadTargets = []
      }
    }

    const requestRows = ((documentRequestsResult.data ?? []) as Array<{
      id?: string | null
      title?: string | null
      created_at?: string | null
      required?: boolean | null
    }>)
      .map((row) => ({
        id: String(row?.id ?? "").trim(),
        title: String(row?.title ?? "").trim(),
        created_at: row?.created_at ?? null,
        required: row?.required ?? null,
      }))
      .filter((row) => Boolean(row.id) && Boolean(row.title))
    const localDocumentRows = ((documentsResult.data ?? []) as Array<{
      id?: string | null
      request_id?: string | null
    }>)
      .map((row) => ({
        id: String(row?.id ?? "").trim(),
        request_id: row?.request_id ?? null,
      }))
      .filter((row) => Boolean(row.id))
    const europaceDocumentRows = (europaceDocumentsResult.data ?? []) as Array<{
      local_document_id?: string | null
      europace_document_id?: string | null
      category?: string | null
      assignment_id?: string | null
      release_status?: string | null
      upload_status?: string | null
    }>

    const concreteUploadTargets = deriveConcreteUploadTargets({
      requests: requestRows,
      uploadTargets,
      documents: localDocumentRows,
      europaceDocuments: europaceDocumentRows,
    })
    const concreteDocumentProgress = deriveConcreteUploadProgress({
      requests: requestRows,
      uploadTargets,
      documents: localDocumentRows,
      europaceDocuments: europaceDocumentRows,
    })
    const baseFlow = deriveEuropaceFlowSummary({
      meta: {
        annahme_job_id: null,
        antragsnummer: result.europace.antragsnummer,
        last_export_snapshot: result.exportSnapshot,
      },
      offers: (offersResult.data ?? []) as Array<{
        accepted_at?: string | null
        superseded_at?: string | null
        machbarkeit_status?: string | null
        vollstaendigkeit_status?: string | null
        angebot_snapshot?: {
          sofortkredit?: boolean | null
          digitalisierungsmerkmale?: {
            accountCheck?: {
              modus?: string | null
            } | null
          } | null
        } | null
        angebot_id?: string | null
        calculated_at?: string | null
        created_at?: string | null
      }>,
      applications: result.applications,
      documents: europaceDocumentRows,
      uploadTargets: concreteUploadTargets,
      localDocuments: (documentsResult.data ?? []) as Array<{
        id?: string | null
        request_id?: string | null
        file_name?: string | null
        file_path?: string | null
        mime_type?: string | null
        size_bytes?: number | null
        created_at?: string | null
      }>,
      documentProgress: {
        requiredDocumentCount: concreteDocumentProgress.requiredCount,
        uploadedDocumentCount: concreteDocumentProgress.uploadedCount,
        releasedDocumentCount: concreteDocumentProgress.releasedCount,
        missingDocumentCount: concreteDocumentProgress.missingCount,
      },
    })
    const visibleOffers = selectVisibleEuropaceOffers(
      (offersResult.data ?? []) as Array<{
        angebot_id?: string | null
        accepted_at?: string | null
        superseded_at?: string | null
        machbarkeit_status?: string | null
        vollstaendigkeit_status?: string | null
        angebot_snapshot?: {
          sofortkredit?: boolean | null
          digitalisierungsmerkmale?: {
            accountCheck?: {
              modus?: string | null
            } | null
          } | null
        } | null
        calculated_at?: string | null
        created_at?: string | null
      }>,
      { hasRejectedApplication: baseFlow.hasRejectedApplication }
    )

    const flow = deriveEuropaceFlowSummary({
      meta: {
        annahme_job_id: null,
        antragsnummer: result.europace.antragsnummer,
        last_export_snapshot: result.exportSnapshot,
      },
      offers: visibleOffers,
      applications: result.applications,
      documents: europaceDocumentRows,
      uploadTargets: concreteUploadTargets,
      localDocuments: (documentsResult.data ?? []) as Array<{
        id?: string | null
        request_id?: string | null
        file_name?: string | null
        file_path?: string | null
        mime_type?: string | null
        size_bytes?: number | null
        created_at?: string | null
      }>,
      documentProgress: {
        requiredDocumentCount: concreteDocumentProgress.requiredCount,
        uploadedDocumentCount: concreteDocumentProgress.uploadedCount,
        releasedDocumentCount: concreteDocumentProgress.releasedCount,
        missingDocumentCount: concreteDocumentProgress.missingCount,
      },
    })

    return NextResponse.json({
      ok: true,
      europace: result.europace,
      applications: result.applications,
      flow,
      documentSummary: result.documentSummary,
      documentsSynchronized: result.documentsSynchronized,
      documentsError: result.documentsError,
      exportDocumentsFound: result.exportDocumentsFound,
      exportDocumentsImported: result.exportDocumentsImported,
      exportDocumentsError: result.exportDocumentsError,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Status konnte nicht aktualisiert werden."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
