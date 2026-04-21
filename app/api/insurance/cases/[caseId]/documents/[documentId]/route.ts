export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function safeFileName(value: string | null | undefined) {
  const name = String(value ?? "").trim()
  if (!name) return "download"
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160) || "download"
}

export async function GET(req: Request, context: { params: Promise<{ caseId: string; documentId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "insurance" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { caseId, documentId } = await context.params
  const url = new URL(req.url)
  const download = url.searchParams.get("download") === "1"
  const admin = supabaseAdmin()
  const access = await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { data: document, error: documentError } = await admin
    .from("documents")
    .select("id,case_id,file_name,file_path,mime_type")
    .eq("id", documentId)
    .eq("case_id", caseId)
    .maybeSingle()

  if (documentError) {
    return NextResponse.json({ ok: false, error: documentError.message }, { status: 400 })
  }
  if (!document?.file_path) {
    return NextResponse.json({ ok: false, error: "Dokument nicht gefunden" }, { status: 404 })
  }

  const { data: blob, error: downloadError } = await admin.storage.from("case_documents").download(document.file_path)
  if (downloadError || !blob) {
    return NextResponse.json({ ok: false, error: downloadError?.message ?? "Datei nicht gefunden" }, { status: 404 })
  }

  const arrayBuffer = await blob.arrayBuffer()
  const headers: Record<string, string> = {
    "content-type": document.mime_type || blob.type || "application/octet-stream",
    "cache-control": "private, no-store",
  }
  if (download) {
    headers["content-disposition"] = `attachment; filename="${safeFileName(document.file_name)}"`
  }

  return new NextResponse(arrayBuffer, { status: 200, headers })
}
