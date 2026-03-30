export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { syncLocalDocumentToEuropaceWithRetry } from "@/lib/europace/documents"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function resolveSiteOrigin(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fall through
    }
  }
  return new URL(req.url).origin
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const caseId = trimOrNull(body.caseId)
    const caseRef = trimOrNull(body.caseRef)
    const accessToken = trimOrNull(body.access)
    const localDocumentId = trimOrNull(body.localDocumentId)
    const requestedCategory = trimOrNull(body.europaceCategory)
    const requestedAssignmentId = trimOrNull(body.europaceAssignmentId)

    if (!caseId || !caseRef || !accessToken || !localDocumentId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "konsum",
    })

    if (!access.ok) {
      return NextResponse.json({ error: "Link ungültig oder abgelaufen." }, { status: access.status })
    }

    const [{ data: europaceMeta, error: europaceError }, { data: documentRow, error: documentError }, { data: mappingRow, error: mappingError }] =
      await Promise.all([
        admin.from("case_europace").select("vorgangsnummer,antragsnummer").eq("case_id", caseId).maybeSingle(),
        admin
          .from("documents")
          .select("id,file_path,file_name")
          .eq("id", localDocumentId)
          .eq("case_id", caseId)
          .maybeSingle(),
        admin
          .from("case_europace_documents")
          .select("category,assignment_id")
          .eq("case_id", caseId)
          .eq("local_document_id", localDocumentId)
          .maybeSingle(),
      ])

    if (europaceError) throw europaceError
    if (documentError) throw documentError
    if (mappingError) throw mappingError

    if (!trimOrNull(europaceMeta?.vorgangsnummer) || !trimOrNull(europaceMeta?.antragsnummer)) {
      return NextResponse.json(
        { error: "Der Antrag ist noch nicht final angelegt. Bitte warte, bis die Bestätigungsseite vollständig geladen ist." },
        { status: 409 }
      )
    }

    if (!documentRow?.file_path || !documentRow?.file_name) {
      return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 })
    }

    const result = await syncLocalDocumentToEuropaceWithRetry(
      admin,
      {
        caseId,
        localDocumentId,
        filePath: documentRow.file_path,
        fileName: documentRow.file_name,
        siteOrigin: resolveSiteOrigin(req),
        category: requestedCategory ?? trimOrNull(mappingRow?.category),
        assignmentId: requestedAssignmentId ?? trimOrNull(mappingRow?.assignment_id),
        antragsnummer: trimOrNull(europaceMeta?.antragsnummer),
      },
      {
        maxAttempts: 3,
        retryDelayMs: 600,
      }
    )

    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason ?? "Europace hat die Datei noch nicht übernommen.", europaceSync: result },
        { status: result.attempted ? 502 : 409 }
      )
    }

    return NextResponse.json({ ok: true, europaceSync: result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Europace-Unterlagensync fehlgeschlagen." },
      { status: 500 }
    )
  }
}
