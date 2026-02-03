// app/api/app/documents/upload/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function resolveSiteOrigin(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fallback below
    }
  }
  return new URL(req.url).origin
}

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

export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const form = await req.formData()
    const caseId = String(form.get("caseId") || "")
    const requestId = String(form.get("requestId") || "") || null
    const file = form.get("file")
    if (!caseId || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const allowed = await canAccessCase(supabase, caseId, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
    const safeName = safeFileName(file.name || `file.${ext}`)
    const path = `${caseId}/${Date.now()}_${safeName}`

    const admin = supabaseAdmin()
    const { error: upErr } = await admin.storage
      .from("case_documents")
      .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" })
    if (upErr) throw upErr

    const { error: docErr } = await admin.from("documents").insert({
      case_id: caseId,
      request_id: requestId,
      uploaded_by: user.id,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size || null,
    })
    if (docErr) throw docErr

    const eventMeta = await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "document_uploaded",
      title: "Dokument hochgeladen",
      body: `Datei: ${file.name}`,
      meta: { file_name: file.name, request_id: requestId },
    })

    if (role === "customer") {
      const caseMeta = eventMeta ?? (await getCaseMeta(caseId))
      if (caseMeta?.advisor_email) {
        const caseLabel = caseMeta.case_ref ? ` (${caseMeta.case_ref})` : ""
        const origin = resolveSiteOrigin(req)
        const html = buildEmailHtml({
          title: "Neues Dokument vom Kunden",
          intro: `Im Fall${caseLabel} wurde ein neues Dokument hochgeladen.`,
          steps: [`Datei: ${file.name}`, "Bitte pruefen Sie das Dokument im Advisor-Dashboard."],
          ctaLabel: "Zum Advisor-Dashboard",
          ctaUrl: `${origin}/advisor`,
          eyebrow: "SEPANA - Dokumenten-Update",
          preheader: "Ein Kunde hat ein neues Dokument hochgeladen.",
        })
        await sendEmail({
          to: caseMeta.advisor_email,
          subject: "Neues Dokument im Kundenfall",
          html,
        })
      }
    }

    return NextResponse.json({ ok: true, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
