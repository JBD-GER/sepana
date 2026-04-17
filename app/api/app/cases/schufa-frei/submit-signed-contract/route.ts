import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent } from "@/lib/notifications/notify"
import { syncLocalDocumentToSkag } from "@/lib/skag/sync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const requestId = trimOrNull(body?.requestId)
  const documentId = trimOrNull(body?.documentId)

  if (!caseId || !documentId) {
    return NextResponse.json({ ok: false, error: "caseId oder documentId fehlt" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_type,assigned_advisor_id")
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

  const { data: documentRow, error: documentError } = await admin
    .from("documents")
    .select("id,case_id,file_path,file_name,document_kind")
    .eq("id", documentId)
    .maybeSingle()

  if (documentError) {
    return NextResponse.json({ ok: false, error: documentError.message }, { status: 400 })
  }
  if (!documentRow || documentRow.case_id !== caseId) {
    return NextResponse.json({ ok: false, error: "Dokument nicht gefunden" }, { status: 404 })
  }
  if (String(documentRow.document_kind ?? "").trim().toLowerCase() !== "signature_signed") {
    return NextResponse.json({ ok: false, error: "Nur fertig unterschriebene Dokumente können übermittelt werden." }, { status: 409 })
  }

  const { data: skagDocumentRow } = await admin
    .from("case_skag_documents")
    .select("upload_status,last_error")
    .eq("local_document_id", documentId)
    .maybeSingle()

  if (String(skagDocumentRow?.upload_status ?? "").trim().toLowerCase() === "uploaded") {
    return NextResponse.json({
      ok: true,
      alreadyUploaded: true,
      message: "Das finale Dokument wurde bereits an SKAG übermittelt.",
    })
  }

  const result = await syncLocalDocumentToSkag(admin, {
    caseId,
    localDocumentId: documentId,
    filePath: String(documentRow.file_path),
    fileName: String(documentRow.file_name),
  })

  if (!result.ok) {
    const reason =
      result.reason === "missing_credit_id"
        ? "Der Fall muss zuerst an SEPANA übermittelt sein, bevor das finale Dokument an SKAG gesendet werden kann."
        : result.reason || "SKAG-Übermittlung fehlgeschlagen."

    return NextResponse.json({ ok: false, error: reason }, { status: 400 })
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "schufa_free_signed_contract_submitted_to_skag",
    title: "Finalen Vertrag an SKAG übermittelt",
    body: "Der vollständig unterschriebene Vertrag wurde an SKAG übermittelt.",
    meta: {
      request_id: requestId,
      document_id: documentId,
      file_name: documentRow.file_name,
    },
    notifyCustomer: false,
  })

  return NextResponse.json({
    ok: true,
    alreadyUploaded: false,
    message: "Das finale Dokument wurde erfolgreich an SKAG übermittelt.",
  })
}
