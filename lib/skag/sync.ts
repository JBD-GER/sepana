import { getCaseMeta } from "@/lib/notifications/notify"
import { updateCaseStatusCompat } from "@/lib/caseStatusCompat"
import { uploadSkagDocument } from "@/lib/skag/client"
import type { SkagApiVariant } from "@/lib/skag/config"
import { notifySkagStatusChange } from "@/lib/skag/notifications"
import { getSkagStatusMeta } from "@/lib/skag/status"
import type { SupabaseClient } from "@supabase/supabase-js"

type AdminClient = SupabaseClient

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

type PushPayloadInput = Record<string, unknown>

function parseDocumentsList(payload: PushPayloadInput) {
  const raw = payload.documents_list
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry ?? "").trim()).filter(Boolean)
  }
  if (raw && typeof raw === "object") {
    return Object.values(raw).map((entry) => String(entry ?? "").trim()).filter(Boolean)
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      }
      if (parsed && typeof parsed === "object") {
        return Object.values(parsed).map((entry) => String(entry ?? "").trim()).filter(Boolean)
      }
    } catch {
      return trimmed
        .split(/[;\n,]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
  }
  return []
}

function inferSkagDocumentTypeFromName(fileName: string) {
  const normalized = String(fileName ?? "").trim().toLowerCase()
  if (!normalized) return "unterlagen" as const
  if (normalized.includes("vertrag") || normalized.includes("contract")) return "bankeinreichung" as const
  return "unterlagen" as const
}

async function resolveSkagDocumentType(
  admin: AdminClient,
  localDocumentId: string,
  fileName: string
): Promise<"unterlagen" | "bankeinreichung"> {
  const { data: documentRow } = await admin
    .from("documents")
    .select("document_kind")
    .eq("id", localDocumentId)
    .maybeSingle()

  const documentKind = String((documentRow as { document_kind?: string | null } | null)?.document_kind ?? "")
    .trim()
    .toLowerCase()

  if (documentKind === "signature_original" || documentKind === "signature_signed") {
    return "bankeinreichung"
  }

  return inferSkagDocumentTypeFromName(fileName)
}

async function ensureDocumentRequestsForPush(admin: AdminClient, caseId: string, payload: PushPayloadInput) {
  const titles = parseDocumentsList(payload)
  if (!titles.length) return

  const { data: existingRows } = await admin.from("document_requests").select("title").eq("case_id", caseId)
  const existing = new Set(
    ((existingRows as Array<{ title?: string | null }> | null) ?? [])
      .map((row) => String(row.title ?? "").trim().toLowerCase())
      .filter(Boolean)
  )

  const inserts = titles
    .filter((title) => !existing.has(title.toLowerCase()))
    .map((title) => ({
      case_id: caseId,
      title,
      required: true,
      created_by: null,
    }))

  if (!inserts.length) return
  await admin.from("document_requests").insert(inserts)
}

export async function syncLocalDocumentToSkag(
  admin: AdminClient,
  input: {
    caseId: string
    localDocumentId: string
    filePath: string
    fileName: string
  }
) {
  const { data: syncRow } = await admin
    .from("case_skag_sync")
    .select("skag_credit_id,api_variant")
    .eq("case_id", input.caseId)
    .maybeSingle()

  const creditId = trimOrNull((syncRow as { skag_credit_id?: string | null } | null)?.skag_credit_id)
  const apiVariant = trimOrNull((syncRow as { api_variant?: string | null } | null)?.api_variant) as SkagApiVariant | null
  const basePayload = {
    case_id: input.caseId,
    local_document_id: input.localDocumentId,
    skag_credit_id: creditId,
    file_name: input.fileName,
  }

  if (!creditId) {
    await admin.from("case_skag_documents").upsert(
      {
        ...basePayload,
        upload_status: "pending_credit_id",
        last_attempt_at: new Date().toISOString(),
        last_error: "SEPANA Credit ID fehlt.",
      },
      { onConflict: "local_document_id" }
    )
    return {
      attempted: false,
      ok: false,
      reason: "missing_credit_id",
    }
  }

  const download = await admin.storage.from("case_documents").download(input.filePath)
  if (download.error || !download.data) {
    const reason = download.error?.message || "Datei konnte nicht aus dem Speicher geladen werden."
    await admin.from("case_skag_documents").upsert(
      {
        ...basePayload,
        upload_status: "error",
        last_attempt_at: new Date().toISOString(),
        last_error: reason,
      },
      { onConflict: "local_document_id" }
    )
    return {
      attempted: true,
      ok: false,
      reason,
    }
  }

  const arrayBuffer = await download.data.arrayBuffer()
  const contentType = download.data.type || "application/octet-stream"
  const documentType = await resolveSkagDocumentType(admin, input.localDocumentId, input.fileName)

  try {
    const result = await uploadSkagDocument({
      creditId,
      fileName: input.fileName,
      contentType,
      data: arrayBuffer,
      variant: apiVariant ?? "standard",
      documentType,
    })

    await admin.from("case_skag_documents").upsert(
      {
        ...basePayload,
        upload_status: "uploaded",
        uploaded_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        last_error: null,
        raw_response: {
          document_type: documentType,
          response: result.raw ?? result.rawText ?? { status: "success" },
        },
      },
      { onConflict: "local_document_id" }
    )

    await admin
      .from("case_skag_sync")
      .upsert(
        {
          case_id: input.caseId,
          skag_credit_id: creditId,
          last_document_upload_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "case_id" }
      )

    return {
      attempted: true,
      ok: true,
      reason: null,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "SEPANA-Dokumentenupload fehlgeschlagen."
    await admin.from("case_skag_documents").upsert(
      {
        ...basePayload,
        upload_status: "error",
        last_attempt_at: new Date().toISOString(),
        last_error: reason,
        raw_response: {
          document_type: documentType,
        },
      },
      { onConflict: "local_document_id" }
    )

    await admin
      .from("case_skag_sync")
      .upsert(
        {
          case_id: input.caseId,
          skag_credit_id: creditId,
          last_error: reason,
        },
        { onConflict: "case_id" }
      )

    return {
      attempted: true,
      ok: false,
      reason,
    }
  }
}

export async function syncPendingCaseDocumentsToSkag(admin: AdminClient, caseId: string) {
  const { data: documents } = await admin
    .from("documents")
    .select("id,file_path,file_name")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })

  const rows = (documents as Array<{ id?: string | null; file_path?: string | null; file_name?: string | null }> | null) ?? []
  const results = []
  for (const row of rows) {
    const localDocumentId = trimOrNull(row.id)
    const filePath = trimOrNull(row.file_path)
    const fileName = trimOrNull(row.file_name)
    if (!localDocumentId || !filePath || !fileName) continue
    results.push(
      await syncLocalDocumentToSkag(admin, {
        caseId,
        localDocumentId,
        filePath,
        fileName,
      })
    )
  }
  return results
}

export async function applySkagPushUpdate(admin: AdminClient, payload: PushPayloadInput) {
  const creditId = trimOrNull(payload.credit_id) ?? trimOrNull(payload.order_id)
  const clientId = trimOrNull(payload.client_id)
  const alias = trimOrNull(payload.status_id)
  const description = trimOrNull(payload.status_description)

  const { data: syncRow } = creditId
    ? await admin
        .from("case_skag_sync")
        .select("case_id")
        .eq("skag_credit_id", creditId)
        .maybeSingle()
    : { data: null as { case_id?: string | null } | null }

  const caseId = trimOrNull((syncRow as { case_id?: string | null } | null)?.case_id)

  await admin.from("case_skag_push_events").insert({
    case_id: caseId,
    skag_credit_id: creditId,
    status_alias: alias,
    status_description: description,
    payload,
  })

  if (!caseId) {
    return { caseId: null, matched: false }
  }

  const statusMeta = getSkagStatusMeta(alias, description)

  await admin
    .from("case_skag_sync")
    .upsert(
      {
        case_id: caseId,
        skag_client_id: clientId,
        skag_credit_id: creditId,
        last_push_at: new Date().toISOString(),
        last_status_alias: statusMeta.alias,
        last_status_description: description,
        raw_last_response: payload,
        last_error: null,
      },
      { onConflict: "case_id" }
    )

  await updateCaseStatusCompat(admin, {
    caseId,
    status: statusMeta.caseStatus,
    updatedAt: new Date().toISOString(),
  })

  await ensureDocumentRequestsForPush(admin, caseId, payload)

  const caseMeta = await getCaseMeta(caseId)
  await notifySkagStatusChange({
    caseId,
    alias,
    description,
    customerEmail: caseMeta?.customer_email ?? null,
    advisorEmail: caseMeta?.advisor_email ?? null,
    caseRef: caseMeta?.case_ref ?? null,
  })

  return { caseId, matched: true }
}
