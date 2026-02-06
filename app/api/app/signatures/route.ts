export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent, buildEmailHtml, sendEmail, getCaseMeta } from "@/lib/notifications/notify"

type SignatureField = {
  id: string
  owner: "advisor" | "customer"
  type: "signature" | "checkbox" | "text"
  label: string
  page: number
  width: number
  height: number
  x: number
  y: number
}

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 160)
}

function resolveSiteUrl() {
  const fallback = "https://www.sepana.de"
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  if (!raw) return fallback
  try {
    return new URL(raw).origin
  } catch {
    return fallback
  }
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

function normalizeFields(raw: any): SignatureField[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as SignatureField[]
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

export async function GET(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const caseId = String(url.searchParams.get("caseId") || "").trim()
    if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 })

    const admin = supabaseAdmin()
    const allowed = await canAccessCase(admin, caseId, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: requests, error } = await admin
      .from("case_signature_requests")
      .select("id,case_id,title,provider_id,requires_wet_signature,fields,advisor_signed_at,customer_signed_at,status,created_at,created_by")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const providerIds = Array.from(
      new Set((requests ?? []).map((r: any) => r?.provider_id).filter(Boolean))
    ) as string[]

    const providerMap = new Map<string, string>()
    if (providerIds.length) {
      const { data: providers } = await admin
        .from("providers")
        .select("id,name")
        .in("id", providerIds)
      for (const p of providers ?? []) providerMap.set(p.id, p.name ?? "")
    }

    const requestIds = (requests ?? []).map((r: any) => r.id).filter(Boolean)
    const { data: docs } = requestIds.length
      ? await admin
          .from("documents")
          .select("id,signature_request_id,file_name,file_path,mime_type,size_bytes,created_at,document_kind")
          .in("signature_request_id", requestIds)
          .order("created_at", { ascending: true })
      : { data: [] as any[] }

    const docsByRequest = new Map<string, any[]>()
    for (const d of docs ?? []) {
      const key = d.signature_request_id
      if (!key) continue
      if (!docsByRequest.has(key)) docsByRequest.set(key, [])
      docsByRequest.get(key)!.push(d)
    }

    const myValueMap = new Map<string, any>()
    const valuesByRoleMap = new Map<string, { advisor?: any; customer?: any }>()
    if (requestIds.length) {
      const { data: allValues } = await admin
        .from("case_signature_field_values")
        .select("request_id,actor_id,values")
        .in("request_id", requestIds)

      const actorIds = Array.from(new Set((allValues ?? []).map((v: any) => v.actor_id).filter(Boolean)))
      const { data: actorProfiles } = actorIds.length
        ? await admin.from("profiles").select("user_id,role").in("user_id", actorIds)
        : { data: [] as any[] }
      const roleMap = new Map<string, string>()
      for (const p of actorProfiles ?? []) roleMap.set(p.user_id, p.role)

      for (const v of allValues ?? []) {
        if (v.actor_id === user.id) myValueMap.set(v.request_id, v.values ?? {})
        const role = roleMap.get(v.actor_id)
        if (!role) continue
        if (!valuesByRoleMap.has(v.request_id)) valuesByRoleMap.set(v.request_id, {})
        const entry = valuesByRoleMap.get(v.request_id)!
        if (role === "advisor" || role === "admin") entry.advisor = v.values ?? {}
        if (role === "customer") entry.customer = v.values ?? {}
      }
    }

    const items = (requests ?? []).map((r: any) => ({
      ...r,
      provider_name: r.provider_id ? providerMap.get(r.provider_id) ?? null : null,
      fields: normalizeFields(r.fields),
      documents: docsByRequest.get(r.id) ?? [],
      my_values: myValueMap.get(r.id) ?? null,
      values_by_role: valuesByRoleMap.get(r.id) ?? null,
    }))

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (role !== "advisor" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const form = await req.formData()
    const caseId = String(form.get("caseId") || "").trim()
    const title = String(form.get("title") || "").trim()
    const providerId = String(form.get("providerId") || "").trim() || null
    const requiresWet = String(form.get("requiresWet") || "") === "1"
    const file = form.get("file")

    if (!caseId || !title || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const allowed = await canAccessCase(admin, caseId, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let requiresWetFinal = requiresWet
    if (providerId) {
      const { data: provider } = await admin
        .from("providers")
        .select("name")
        .eq("id", providerId)
        .maybeSingle()
      if ((provider?.name ?? "").toLowerCase().includes("commerz")) {
        requiresWetFinal = true
      }
    }

    const { data: created, error } = await admin
      .from("case_signature_requests")
      .insert({
        case_id: caseId,
        title,
        provider_id: providerId,
        requires_wet_signature: requiresWetFinal,
        fields: [],
        created_by: user.id,
        status: "pending",
      })
      .select("id")
      .single()

    if (error || !created?.id) {
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 })
    }

    const safeName = safeFileName(file.name || "document.pdf")
    const path = `${caseId}/signature/${created.id}/${Date.now()}_${safeName}`
    const { error: upErr } = await admin.storage
      .from("case_documents")
      .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" })
    if (upErr) throw upErr

    const { error: docErr } = await admin.from("documents").insert({
      case_id: caseId,
      signature_request_id: created.id,
      document_kind: "signature_original",
      uploaded_by: user.id,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size || null,
    })
    if (docErr) throw docErr

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "signature_requested",
      title: "Unterschrift angefordert",
      body: `Dokument: ${file.name}`,
      meta: { document: file.name, request_id: created.id },
    })

    const caseMeta = await getCaseMeta(caseId)
    if (caseMeta?.customer_email) {
      const siteUrl = resolveSiteUrl()
      const ctaUrl = `${siteUrl}/signatur?caseId=${encodeURIComponent(caseId)}`
      const html = buildEmailHtml({
        title: "Unterschrift angefordert",
        intro: "Ein Dokument wartet auf Ihre digitale Unterschrift.",
        steps: [
          "Loggen Sie sich ins Portal ein und oeffnen Sie den Fall.",
          "Unterzeichnen Sie das Dokument direkt online.",
          "Wir informieren Sie nach Abschluss ueber die naechsten Schritte.",
        ],
        ctaLabel: "Dokument unterzeichnen",
        ctaUrl,
        preheader: "Ein Dokument wartet auf Ihre Unterschrift. Jetzt direkt online unterschreiben.",
      })
      await sendEmail({ to: caseMeta.customer_email, subject: "Dokument zur Unterschrift", html })
    }

    return NextResponse.json({ ok: true, id: created.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (role !== "advisor" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const id = String(body?.id ?? "").trim()
    const fields = Array.isArray(body?.fields) ? body.fields : null
    if (!id || !fields) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const admin = supabaseAdmin()
    const { data: reqRow } = await admin
      .from("case_signature_requests")
      .select("id,case_id")
      .eq("id", id)
      .maybeSingle()
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const allowed = await canAccessCase(admin, reqRow.case_id, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { error } = await admin
      .from("case_signature_requests")
      .update({ fields })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
