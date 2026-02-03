export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { renderSignedPdf } from "@/lib/signatures/renderSignedPdf"
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

    const body = await req.json().catch(() => null)
    const requestId = String(body?.requestId ?? "").trim()
    const values = body?.values ?? null
    if (!requestId || !values || typeof values !== "object") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: reqRow } = await admin
      .from("case_signature_requests")
      .select("id,case_id,requires_wet_signature,advisor_signed_at,fields")
      .eq("id", requestId)
      .maybeSingle()
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const advisorRequired = hasAdvisorFields(reqRow.fields)

    if (reqRow.requires_wet_signature) {
      return NextResponse.json({ error: "wet_signature_required" }, { status: 409 })
    }

    if (role === "customer" && advisorRequired && !reqRow.advisor_signed_at) {
      return NextResponse.json({ error: "advisor_not_signed" }, { status: 409 })
    }

    const allowed = await canAccessCase(admin, reqRow.case_id, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { error } = await admin
      .from("case_signature_field_values")
      .upsert(
        {
          request_id: requestId,
          actor_id: user.id,
          values,
        },
        { onConflict: "request_id,actor_id" }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await updateSignedState(admin, requestId, role, advisorRequired)

    await logCaseEvent({
      caseId: reqRow.case_id,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "signature_signed",
      title: "Dokument unterschrieben",
      body: "Eine digitale Unterschrift wurde abgegeben.",
      meta: { request_id: requestId },
    })

    try {
      await admin.from("case_signature_events").insert({
        request_id: requestId,
        actor_id: user.id,
        actor_role: role ?? "customer",
        event: "signed",
        ip: clientIp(req),
        user_agent: req.headers.get("user-agent") || null,
      })
    } catch {
      // ignore if events table not present yet
    }

    if (role === "customer") {
      const { data: reqFull } = await admin
        .from("case_signature_requests")
        .select("id,case_id,title,fields,advisor_signed_at,customer_signed_at,requires_wet_signature")
        .eq("id", requestId)
        .maybeSingle()

      const advisorRequiredFinal = hasAdvisorFields(reqFull?.fields)
      if (
        reqFull?.customer_signed_at &&
        (!advisorRequiredFinal || reqFull?.advisor_signed_at) &&
        !reqFull?.requires_wet_signature
      ) {
        const { data: originalDocs } = await admin
          .from("documents")
          .select("file_path,file_name,mime_type")
          .eq("signature_request_id", requestId)
          .eq("document_kind", "signature_original")
          .order("created_at", { ascending: false })
          .limit(1)
        const originalDoc = originalDocs?.[0]
        if (originalDoc?.file_path) {
          const { data: download } = await admin.storage
            .from("case_documents")
            .download(originalDoc.file_path)
          if (download) {
            const bytes = new Uint8Array(await download.arrayBuffer())
            const { data: allVals } = await admin
              .from("case_signature_field_values")
              .select("actor_id,values")
              .eq("request_id", requestId)
            const actorIds = Array.from(
              new Set((allVals ?? []).map((v: any) => v.actor_id).filter(Boolean))
            )
            const { data: profiles } = actorIds.length
              ? await admin.from("profiles").select("user_id,role").in("user_id", actorIds)
              : { data: [] as any[] }
            const roleMap = new Map<string, string>()
            for (const p of profiles ?? []) roleMap.set(p.user_id, p.role)

            const valuesByRole: { advisor?: any; customer?: any } = {}
            for (const v of allVals ?? []) {
              const r = roleMap.get(v.actor_id)
              if (r === "advisor" || r === "admin") valuesByRole.advisor = v.values ?? {}
              if (r === "customer") valuesByRole.customer = v.values ?? {}
            }

            const { data: events } = await admin
              .from("case_signature_events")
              .select("created_at,event,actor_role,ip,user_agent")
              .eq("request_id", requestId)
              .order("created_at", { ascending: true })

            let finalBytes: Uint8Array | null = null
            try {
              finalBytes = await renderSignedPdf({
                originalBytes: bytes,
                originalMime: originalDoc.mime_type || null,
                fields: Array.isArray(reqFull.fields) ? reqFull.fields : [],
                values: valuesByRole,
                events: (events ?? []) as any,
                auditTitle: `${reqFull.title} · ${reqFull.case_id}`,
              })
            } catch {
              finalBytes = null
            }

            if (finalBytes) {
              const finalName = `signed_final_${Date.now()}.pdf`
              const path = `${reqFull.case_id}/signature/${requestId}/${finalName}`
              await admin.storage
                .from("case_documents")
                .upload(path, finalBytes, { upsert: true, contentType: "application/pdf" })
              await admin.from("documents").insert({
                case_id: reqFull.case_id,
                signature_request_id: requestId,
                document_kind: "signature_signed",
                uploaded_by: user.id,
                file_path: path,
                file_name: finalName,
                mime_type: "application/pdf",
                size_bytes: finalBytes.length,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
