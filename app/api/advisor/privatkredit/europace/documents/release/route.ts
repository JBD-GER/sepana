import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import {
  createEuropaceReleaseForCase,
  flattenEuropaceAvailableAssignments,
  listEuropaceAvailableAssignments,
  syncEuropaceDocumentStateForCase,
} from "@/lib/europace/documents"
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
      return NextResponse.json({ ok: false, error: "Europace-Unterlagen sind nur fuer Privatkredit vorgesehen." }, { status: 409 })
    }

    const { data: mapping, error: mappingError } = await admin
      .from("case_europace")
      .select("vorgangsnummer,antragsnummer")
      .eq("case_id", caseId)
      .maybeSingle()

    if (mappingError) throw mappingError

    const vorgangsnummer = String(mapping?.vorgangsnummer ?? "").trim()
    const antragsnummer = String(mapping?.antragsnummer ?? "").trim()
    if (!vorgangsnummer) {
      return NextResponse.json(
        { ok: false, error: "Kein Europace-Vorgang vorhanden. Bitte zuerst synchronisieren." },
        { status: 409 }
      )
    }
    if (!antragsnummer) {
      return NextResponse.json(
        { ok: false, error: "Noch kein Antrag vorhanden. Dokumentfreigabe ist erst nach Angebotsannahme moeglich." },
        { status: 409 }
      )
    }

    const release = await createEuropaceReleaseForCase(admin, {
      caseId,
      vorgangsnummer,
      antragsnummer,
      includeApplicationDocument: false,
    })
    const synced = await syncEuropaceDocumentStateForCase(admin, {
      caseId,
      vorgangsnummer,
      antragsnummer,
    })
    let uploadTargets = [] as Array<{
      key: string
      title: string
      category_id: string
      category_name: string | null
      category_description: string | null
      assignment_id: string | null
      assignment_type: string | null
      assignment_name: string | null
      assignment_role_name: string | null
    }>

    try {
      const assignments = await listEuropaceAvailableAssignments(admin, {
        caseId,
        vorgangsnummer,
        antragsnummer,
      })
      uploadTargets = flattenEuropaceAvailableAssignments(assignments).map((target) => ({
        key: target.key,
        title: target.title,
        category_id: target.categoryId,
        category_name: target.categoryName,
        category_description: target.categoryDescription,
        assignment_id: target.assignmentId,
        assignment_type: target.assignmentType,
        assignment_name: target.assignmentName,
        assignment_role_name: target.assignmentRoleName,
      }))
    } catch (error) {
      console.error("europace upload targets query failed", error)
    }

    return NextResponse.json({
      ok: true,
      vorgangsnummer,
      antragsnummer,
      pagesShared: release.pagesShared,
      shares: release.shares,
      documents: synced.documents,
      pages: synced.pages,
      uploadTargets,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Europace-Freigabe konnte nicht erstellt werden."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
