export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent } from "@/lib/notifications/notify"
import { buildSchufaFreeBankSubmission, isBankSubmissionTooLargeError } from "@/lib/schufa-frei/bankSubmission"
import { syncLocalDocumentToSkag } from "@/lib/skag/sync"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function safeFileName(value: string) {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function isBankSubmissionBundleDocument(input: { document_kind?: string | null; file_path?: string | null }) {
  const documentKind = String(input.document_kind ?? "").trim().toLowerCase()
  if (documentKind === "bank_submission_bundle") return true

  const filePath = String(input.file_path ?? "").trim().toLowerCase()
  return filePath.includes("/bank-submission/")
}

function isDocumentKindConstraintError(error: unknown) {
  const anyError = error as { code?: string | null; message?: string | null } | null
  if (!anyError) return false
  if (String(anyError.code ?? "").trim() === "23514") return true

  const message = String(anyError.message ?? "").toLowerCase()
  return message.includes("documents_document_kind_check") || message.includes("document_kind")
}

async function canAccessSchufaFreeCase(
  admin: ReturnType<typeof supabaseAdmin>,
  caseId: string,
  userId: string,
  role: string | null
) {
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (!caseRow) return { allowed: false as const, caseRow: null }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return { allowed: false as const, caseRow }
  }
  if (role === "admin") return { allowed: true as const, caseRow }
  if (role === "advisor" && caseRow.assigned_advisor_id === userId) return { allowed: true as const, caseRow }
  return { allowed: false as const, caseRow }
}

async function removeExistingBankSubmissionBundles(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: docs } = await admin
    .from("documents")
    .select("id,file_path,document_kind")
    .eq("case_id", caseId)

  const bundleDocs = ((docs ?? []) as Array<{ id?: string | null; file_path?: string | null; document_kind?: string | null }>)
    .filter((doc) => isBankSubmissionBundleDocument(doc))

  const documentIds = bundleDocs.map((doc) => trimOrNull(doc.id)).filter((value): value is string => Boolean(value))
  const filePaths = Array.from(
    new Set(
      bundleDocs
        .map((doc) => trimOrNull(doc.file_path))
        .filter((value): value is string => Boolean(value))
    )
  )

  if (filePaths.length) {
    try {
      await admin.storage.from("case_documents").remove(filePaths)
    } catch {
      // keep replacing resilient
    }
  }

  if (documentIds.length) {
    try {
      await admin.from("case_skag_documents").delete().in("local_document_id", documentIds)
    } catch {
      // covered by FK cascade when available
    }
    try {
      await admin.from("documents").delete().in("id", documentIds)
    } catch {
      // ignore cleanup failure, next insert can still proceed
    }
  }
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  if (!caseId) return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })

  const admin = supabaseAdmin()
  const access = await canAccessSchufaFreeCase(admin, caseId, user.id, role)
  if (!access.caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  if (!access.allowed) {
    const wrongCaseType = String(access.caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei"
    return NextResponse.json(
      { ok: false, error: wrongCaseType ? "case_type_not_supported" : "Forbidden" },
      { status: wrongCaseType ? 409 : 403 }
    )
  }

  const { data: syncRow } = await admin
    .from("case_skag_sync")
    .select("skag_credit_id")
    .eq("case_id", caseId)
    .maybeSingle()

  if (!trimOrNull(syncRow?.skag_credit_id)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Die Bankeinreichung kann erst erzeugt werden, wenn der Fall bereits bei SKAG angelegt wurde.",
      },
      { status: 409 }
    )
  }

  let bundle
  try {
    bundle = await buildSchufaFreeBankSubmission(admin, {
      caseId,
      caseRef: trimOrNull(access.caseRow.case_ref) ?? caseId,
    })
  } catch (error) {
    if (isBankSubmissionTooLargeError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 413 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bankeinreichung konnte nicht erstellt werden.",
      },
      { status: 500 }
    )
  }

  if (!bundle.ok) {
    const errorMessage =
      bundle.missing.length > 0
        ? `Bankeinreichung kann nicht generiert werden. Es fehlen noch: ${bundle.missing.join(", ")}.`
        : "Bankeinreichung kann nicht generiert werden."
    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        missing: bundle.missing,
      },
      { status: 409 }
    )
  }

  await removeExistingBankSubmissionBundles(admin, caseId)

  const storagePath = `${caseId}/bank-submission/${Date.now()}_${safeFileName(bundle.fileName)}`
  const upload = await admin.storage.from("case_documents").upload(storagePath, bundle.pdfBytes, {
    upsert: true,
    contentType: "application/pdf",
  })
  if (upload.error) {
    return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 })
  }

  let insertedDocument = await admin
    .from("documents")
    .insert({
      case_id: caseId,
      document_kind: "bank_submission_bundle",
      uploaded_by: user.id,
      file_path: storagePath,
      file_name: bundle.fileName,
      mime_type: "application/pdf",
      size_bytes: bundle.pdfBytes.length,
    })
    .select("id")
    .single()

  if (insertedDocument.error && isDocumentKindConstraintError(insertedDocument.error)) {
    insertedDocument = await admin
      .from("documents")
      .insert({
        case_id: caseId,
        document_kind: null,
        uploaded_by: user.id,
        file_path: storagePath,
        file_name: bundle.fileName,
        mime_type: "application/pdf",
        size_bytes: bundle.pdfBytes.length,
      })
      .select("id")
      .single()
  }

  if (insertedDocument.error || !insertedDocument.data?.id) {
    try {
      await admin.storage.from("case_documents").remove([storagePath])
    } catch {}
    return NextResponse.json(
      {
        ok: false,
        error: insertedDocument.error?.message ?? "Bankeinreichung konnte nicht gespeichert werden.",
      },
      { status: 500 }
    )
  }

  const syncResult = await syncLocalDocumentToSkag(admin, {
    caseId,
    localDocumentId: insertedDocument.data.id,
    filePath: storagePath,
    fileName: bundle.fileName,
  })

  if (!syncResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: syncResult.reason || "SKAG-Upload der Bankeinreichung fehlgeschlagen.",
      },
      { status: 502 }
    )
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "document_uploaded",
    title: "Bankeinreichung generiert",
    body: "Die vollständige Schufa-frei-Bankeinreichung wurde als Sammel-PDF erzeugt und an SKAG übermittelt.",
    meta: {
      document_kind: "bank_submission_bundle",
      file_name: bundle.fileName,
      included_items: bundle.included,
    },
    notifyAdvisor: false,
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    message: "Die Bankeinreichung wurde erzeugt und an SKAG übermittelt.",
  })
}
