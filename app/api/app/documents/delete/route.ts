// app/api/app/documents/delete/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

async function canAccessCase(supabase: any, caseId: string, userId: string, role: string | null) {
  const { data: c } = await supabase
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return false
  if (role === "admin") return true
  if (role === "customer") return c.customer_id === userId
  if (role === "advisor") return c.assigned_advisor_id === userId
  return false
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
      .select("id,case_id,file_path,uploaded_by")
      .eq("id", docId)
      .maybeSingle()
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const allowed = await canAccessCase(supabase, doc.case_id, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Allow customers/advisors/admins who can access the case to delete
    const { error: rmErr } = await admin.storage.from("case_documents").remove([doc.file_path])
    if (rmErr) throw rmErr

    const { error: delErr } = await admin.from("documents").delete().eq("id", doc.id)
    if (delErr) throw delErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
