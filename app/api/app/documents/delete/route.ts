// app/api/app/documents/delete/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { deleteEuropaceDocumentForCase, markLocalEuropaceDocumentDeleted } from "@/lib/europace/documents"
import { isImportedBankDocumentPath } from "@/lib/europace/flow"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

async function getAccessibleCase(supabase: any, caseId: string, userId: string, role: string | null) {
  const { data: c } = await supabase
    .from("cases")
    .select("id,customer_id,assigned_advisor_id,case_type")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return null
  if (role === "admin") return c
  if (role === "customer" && c.customer_id === userId) return c
  if (role === "advisor" && c.assigned_advisor_id === userId) return c
  return null
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const docId = String(body?.id || "")
    if (!docId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const admin = supabaseAdmin()
    const { data: doc } = await admin
      .from("documents")
      .select("id,case_id,file_name,file_path,uploaded_by,document_kind")
      .eq("id", docId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const accessibleCase = await getAccessibleCase(supabase, doc.case_id, user.id, role)
    if (!accessibleCase) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const isSignedSignatureDoc = String(doc.document_kind || "") === "signature_signed"
    if (isSignedSignatureDoc && role !== "advisor" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isImportedBankDocumentPath(doc.file_path)) {
      return NextResponse.json(
        {
          error:
            "Automatisch übernommene Bankunterlagen können nicht gelöscht werden. Bitte nutzen Sie für den Kreditvertrag den Unterschriften-Bereich.",
        },
        { status: 409 }
      )
    }

    // General case documents can be deleted by case participants; signed signature docs are advisor/admin only.
    const { error: rmErr } = await admin.storage.from("case_documents").remove([doc.file_path])
    if (rmErr) throw rmErr

    const isKonsum = String(accessibleCase.case_type ?? "").trim().toLowerCase() === "konsum"
    let remoteDeleteMirrored = false

    if (isKonsum) {
      try {
        const [{ data: europaceCase }, { data: remoteMapping }] = await Promise.all([
          admin.from("case_europace").select("vorgangsnummer").eq("case_id", doc.case_id).maybeSingle(),
          admin
            .from("case_europace_documents")
            .select("europace_document_id")
            .eq("case_id", doc.case_id)
            .eq("local_document_id", doc.id)
            .maybeSingle(),
        ])

        const vorgangsnummer = String(europaceCase?.vorgangsnummer ?? "").trim()
        const europaceDocumentId = String(remoteMapping?.europace_document_id ?? "").trim()
        if (vorgangsnummer && europaceDocumentId) {
          await deleteEuropaceDocumentForCase(admin, {
            caseId: String(doc.case_id),
            vorgangsnummer,
            europaceDocumentId,
          })
          remoteDeleteMirrored = true
        }
      } catch (mappingError) {
        console.error("europace remote delete mirror failed", mappingError)
      }
    }

    if (!remoteDeleteMirrored) {
      try {
        await markLocalEuropaceDocumentDeleted(admin, {
          caseId: String(doc.case_id),
          localDocumentId: String(doc.id),
          fileName: String(doc.file_name ?? ""),
        })
      } catch (mappingError) {
        console.error("europace local delete mirror failed", mappingError)
      }
    }

    const { error: delErr } = await admin.from("documents").delete().eq("id", doc.id)
    if (delErr) throw delErr

    return NextResponse.json({ ok: true, remoteDeleteMirrored })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
