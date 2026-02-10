export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || ""
  const first = forwarded.split(",")[0]?.trim()
  return first || req.headers.get("x-real-ip") || null
}

function normalizeFields(raw: any) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function hasAdvisorFields(raw: any) {
  const fields = normalizeFields(raw)
  if (!fields.length) return false
  return fields.some((f: any) => {
    const owner = String(f?.owner || "").toLowerCase()
    return owner !== "customer"
  })
}

function hasCustomerFields(raw: any) {
  const fields = normalizeFields(raw)
  if (!fields.length) return false
  return fields.some((f: any) => {
    const owner = String(f?.owner || "").toLowerCase()
    return owner === "customer"
  })
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

async function canAccessCase(admin: any, caseId: string, userId: string, role: string | null) {
  const { data: c } = await admin
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

async function updateSignedState(admin: any, requestId: string, actorRole: string | null, advisorRequired: boolean) {
  const patch: any = {}
  if (actorRole === "customer") patch.customer_signed_at = new Date().toISOString()
  if (actorRole === "advisor" || actorRole === "admin") patch.advisor_signed_at = new Date().toISOString()

  if (Object.keys(patch).length) {
    await admin.from("case_signature_requests").update(patch).eq("id", requestId)
  }

  const { data: reqRow } = await admin
    .from("case_signature_requests")
    .select("advisor_signed_at,customer_signed_at")
    .eq("id", requestId)
    .maybeSingle()

  const isComplete = !!reqRow?.customer_signed_at && (!!reqRow?.advisor_signed_at || !advisorRequired)
  if (isComplete) {
    await admin.from("case_signature_requests").update({ status: "completed" }).eq("id", requestId)
  }
}

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const form = await req.formData()
    const caseId = String(form.get("caseId") || "").trim()
    const requestId = String(form.get("requestId") || "").trim()
    if (!caseId || !requestId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const files = form.getAll("file").filter((f) => f instanceof File) as File[]
    if (!files.length) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    const admin = supabaseAdmin()
    const allowed = await canAccessCase(admin, caseId, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: reqRow } = await admin
      .from("case_signature_requests")
      .select("id,case_id,requires_wet_signature,fields")
      .eq("id", requestId)
      .maybeSingle()
    if (!reqRow || reqRow.case_id !== caseId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const advisorRequired = hasAdvisorFields(reqRow.fields)
    const advisorOnly = advisorRequired && !hasCustomerFields(reqRow.fields)

    for (const file of files) {
      const safeName = safeFileName(file.name || "signed.pdf")
      const path = `${caseId}/signature/${requestId}/signed_${Date.now()}_${safeName}`
      const { error: upErr } = await admin.storage
        .from("case_documents")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" })
      if (upErr) throw upErr

      const { error: docErr } = await admin.from("documents").insert({
        case_id: caseId,
        signature_request_id: requestId,
        document_kind: "signature_signed",
        uploaded_by: user.id,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || null,
      })
      if (docErr) throw docErr
    }

    await updateSignedState(admin, requestId, role, advisorRequired)

    await logCaseEvent({
      caseId: caseId,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "signature_uploaded",
      title: "Unterschrift hochgeladen",
      body: "Es wurden unterschriebene Dokumente hochgeladen.",
      meta: { request_id: requestId, files: files.map((f) => f.name) },
      notifyCustomer: advisorOnly ? false : undefined,
    })

    try {
      await admin.from("case_signature_events").insert({
        request_id: requestId,
        actor_id: user.id,
        actor_role: role ?? "customer",
        event: "uploaded_scan",
        ip: clientIp(req),
        user_agent: req.headers.get("user-agent") || null,
        meta: { files: files.map((f) => ({ name: f.name, size: f.size })) },
      })
    } catch {
      // ignore if events table not present yet
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
