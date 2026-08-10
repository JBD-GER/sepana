export const runtime = "nodejs"

import { NextResponse } from "next/server"
import sharp from "sharp"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import {
  getSchufaFreeSignatureRequestMeta,
  isSchufaSignatureRequestLockedUntilInvoice,
} from "@/lib/schufa-frei/contractPackage"
import {
  getSchufaFreeSignatureInvoiceGateMessage,
  loadSchufaFreeSignatureInvoiceGate,
} from "@/lib/schufa-frei/signatureInvoiceGate"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { renderSignedPdf } from "@/lib/signatures/renderSignedPdf"
import { logCaseEvent } from "@/lib/notifications/notify"
import { maybeNotifyAdvisorAboutCompletedSchufaFreeContractPackage } from "@/lib/schufa-frei/contractPackageNotifications"

type SubmittedSignatureField = {
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

async function hasVisibleSignatureInk(value: unknown) {
  if (typeof value !== "string") return false
  const match = value.match(/^data:image\/png;base64,([a-z0-9+/=]+)$/i)
  if (!match) return false

  const bytes = Buffer.from(match[1], "base64")
  if (!bytes.length || bytes.length > 2_000_000) return false

  try {
    const image = sharp(bytes, { limitInputPixels: 2_000_000, failOn: "error" })
    const metadata = await image.metadata()
    if (metadata.format !== "png" || !metadata.width || !metadata.height) return false

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let inkPixels = 0
    let minX = info.width
    let minY = info.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const offset = (y * info.width + x) * info.channels
        const red = data[offset]
        const green = data[offset + 1]
        const blue = data[offset + 2]
        const alpha = data[offset + 3]
        if (alpha <= 32 || (red >= 245 && green >= 245 && blue >= 245)) continue
        inkPixels += 1
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    return inkPixels >= 40 && maxX - minX + 1 >= 12 && maxY - minY + 1 >= 4
  } catch {
    return false
  }
}

async function isSubmittedFieldValueFilled(field: SubmittedSignatureField, value: unknown) {
  const type = String(field?.type ?? "").trim().toLowerCase()
  if (type === "checkbox") return value === true
  if (type === "signature") return hasVisibleSignatureInk(value)
  return typeof value === "string" && value.trim().length > 0
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

async function updateSignedState(
  admin: any,
  requestId: string,
  actorRole: string | null,
  advisorRequired: boolean,
  customerRequired: boolean
) {
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

  const isComplete =
    (!advisorRequired || !!reqRow?.advisor_signed_at) && (!customerRequired || !!reqRow?.customer_signed_at)
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
      .select("id,case_id,title,requires_wet_signature,advisor_signed_at,fields")
      .eq("id", requestId)
      .maybeSingle()
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (reqRow.requires_wet_signature) {
      return NextResponse.json({ error: "wet_signature_required" }, { status: 409 })
    }

    const allowed = await canAccessCase(admin, reqRow.case_id, user.id, role)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: caseMeta, error: caseMetaError } = await admin
      .from("cases")
      .select("case_type")
      .eq("id", reqRow.case_id)
      .maybeSingle()
    if (caseMetaError) return NextResponse.json({ error: caseMetaError.message }, { status: 500 })
    const isSchufaFreeCase = String(caseMeta?.case_type ?? "").trim().toLowerCase() === "schufa_frei"
    const storedFields = normalizeFields(reqRow.fields) as SubmittedSignatureField[]
    const requestMeta = getSchufaFreeSignatureRequestMeta({
      title: reqRow.title,
      requiresWetSignature: Boolean(reqRow.requires_wet_signature),
      fields: storedFields,
    })
    if (isSchufaFreeCase && requestMeta.packageRelated && requestMeta.downloadOnly) {
      return NextResponse.json({ error: "Dieses Dokument dient nur zur Durchsicht." }, { status: 409 })
    }
    const effectiveFields = storedFields
    const advisorRequired = hasAdvisorFields(effectiveFields)
    const customerRequired = hasCustomerFields(effectiveFields)
    const advisorOnly = advisorRequired && !customerRequired

    if (role === "customer" && customerRequired && advisorRequired && !reqRow.advisor_signed_at) {
      return NextResponse.json({ error: "advisor_not_signed" }, { status: 409 })
    }

    if (isSchufaFreeCase && isSchufaSignatureRequestLockedUntilInvoice(reqRow.title, storedFields)) {
      try {
        const invoiceGate = await loadSchufaFreeSignatureInvoiceGate(admin, reqRow.case_id)
        if (!invoiceGate.ready) {
          return NextResponse.json(
            { error: getSchufaFreeSignatureInvoiceGateMessage(invoiceGate.reason) },
            { status: 409 }
          )
        }
      } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "invoice_gate_failed" }, { status: 400 })
      }
    }

    const actorOwner = role === "customer" ? "customer" : role === "advisor" || role === "admin" ? "advisor" : null
    const actorFields = effectiveFields.filter((field) => {
      const owner = String(field.owner ?? "").trim().toLowerCase() === "customer" ? "customer" : "advisor"
      return owner === actorOwner
    })
    const submittedValues = values as Record<string, unknown>
    const fieldChecks = await Promise.all(
      actorFields.map(async (field) => ({
        field,
        filled: await isSubmittedFieldValueFilled(field, submittedValues[String(field.id ?? "")]),
      }))
    )
    const missingFieldLabels = fieldChecks
      .filter((check) => !check.filled)
      .map((check) => String(check.field.label ?? "Pflichtfeld").trim() || "Pflichtfeld")
    if (!actorOwner || !actorFields.length || missingFieldLabels.length) {
      return NextResponse.json(
        {
          error: missingFieldLabels.length
            ? `Bitte alle Pflichtfelder ausfüllen: ${missingFieldLabels.join(", ")}.`
            : "Keine ausfüllbaren Felder für diese Rolle vorhanden.",
        },
        { status: 400 }
      )
    }

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

    await updateSignedState(admin, requestId, role, advisorRequired, customerRequired)

    await logCaseEvent({
      caseId: reqRow.case_id,
      actorId: user.id,
      actorRole: role ?? "customer",
      type: "signature_signed",
      title: "Dokument unterschrieben",
      body: "Eine digitale Unterschrift wurde abgegeben.",
      meta: { request_id: requestId },
      notifyCustomer: advisorOnly ? false : undefined,
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

    const { data: reqFull } = await admin
      .from("case_signature_requests")
      .select("id,case_id,title,fields,advisor_signed_at,customer_signed_at,requires_wet_signature")
      .eq("id", requestId)
      .maybeSingle()

    const storedFieldsFinal = normalizeFields(reqFull?.fields) as SubmittedSignatureField[]
    const effectiveFieldsFinal = storedFieldsFinal
    const advisorRequiredFinal = hasAdvisorFields(effectiveFieldsFinal)
    const customerRequiredFinal = hasCustomerFields(effectiveFieldsFinal)
    const isComplete =
      (!advisorRequiredFinal || !!reqFull?.advisor_signed_at) &&
      (!customerRequiredFinal || !!reqFull?.customer_signed_at)

    if (reqFull && isComplete && !reqFull.requires_wet_signature) {
      const { data: signedDocs } = await admin
        .from("documents")
        .select("id")
        .eq("signature_request_id", requestId)
        .eq("document_kind", "signature_signed")
        .limit(1)

      if (!signedDocs?.length) {
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
                fields: effectiveFieldsFinal,
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
              const insertedDoc = await admin
                .from("documents")
                .insert({
                  case_id: reqFull.case_id,
                  signature_request_id: requestId,
                  document_kind: "signature_signed",
                  uploaded_by: user.id,
                  file_path: path,
                  file_name: finalName,
                  mime_type: "application/pdf",
                  size_bytes: finalBytes.length,
                })
                .select("id")
                .single()
              if (insertedDoc.error) throw insertedDoc.error
            }
          }
        }
      }
    }

    await maybeNotifyAdvisorAboutCompletedSchufaFreeContractPackage({
      admin,
      caseId: reqRow.case_id,
      completedRequestId: requestId,
    }).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
