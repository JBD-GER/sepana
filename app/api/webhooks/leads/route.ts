import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const SOURCE = "mustermann"

type LeadNewPayload = {
  type: "lead.new"
  data?: {
    id?: number | string
    created_at?: string
    customer?: {
      title?: string
      first_name?: string
      last_name?: string
      zip_code?: string
      city?: string
      street?: string
      birthdate?: string
      phone?: string
      phone_mobile?: string
      phone_work?: string
      email?: string
      marital_status?: string
      occupational_status?: string
    }
    product?: {
      name?: string
      price?: number | string
    }
    notes?: string
    additional?: unknown
  }
}

type LeadComplaintPayload = {
  type: "lead.complaint"
  data?: {
    id?: number | string
    result?: string
    reason?: string
  }
}

function parseAuthToken(rawHeader: string | null) {
  const raw = String(rawHeader ?? "").trim()
  if (!raw) return null

  const tokenPattern = /^token\s+token=(.+)$/i
  const tokenMatch = raw.match(tokenPattern)
  if (tokenMatch?.[1]) return tokenMatch[1].trim()

  const bearerPattern = /^bearer\s+(.+)$/i
  const bearerMatch = raw.match(bearerPattern)
  if (bearerMatch?.[1]) return bearerMatch[1].trim()

  return raw
}

function parseExternalLeadId(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.trunc(n)
}

function parseNumericOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/\./g, "")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function parseDateOrNull(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function parseTimestampOrNull(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T")
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`
  const date = new Date(withTimezone)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function normalizeAdditional(value: unknown) {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") return value
  return {}
}

async function upsertLeadNew(payload: LeadNewPayload, receivedAtIso: string) {
  const externalLeadId = parseExternalLeadId(payload?.data?.id)
  if (!externalLeadId) {
    return NextResponse.json({ ok: false, error: "Invalid lead id for lead.new" }, { status: 400 })
  }

  const customer = payload.data?.customer ?? {}
  const product = payload.data?.product ?? {}
  const admin = supabaseAdmin()

  const { data: existing } = await admin
    .from("webhook_leads")
    .select("status")
    .eq("source", SOURCE)
    .eq("external_lead_id", externalLeadId)
    .maybeSingle()

  const previousStatus = String((existing as { status?: string } | null)?.status ?? "")
  const nextStatus = previousStatus.startsWith("complaint_") ? previousStatus : "new"

  const row = {
    source: SOURCE,
    external_lead_id: externalLeadId,
    event_type: "lead.new",
    status: nextStatus,
    source_created_at: parseTimestampOrNull(payload?.data?.created_at),
    first_name: customer.first_name?.trim() || null,
    last_name: customer.last_name?.trim() || null,
    email: customer.email?.trim().toLowerCase() || null,
    phone: customer.phone?.trim() || null,
    phone_mobile: customer.phone_mobile?.trim() || null,
    phone_work: customer.phone_work?.trim() || null,
    birth_date: parseDateOrNull(customer.birthdate),
    title: customer.title?.trim() || null,
    marital_status: customer.marital_status?.trim() || null,
    employment_status: customer.occupational_status?.trim() || null,
    address_street: customer.street?.trim() || null,
    address_zip: customer.zip_code?.trim() || null,
    address_city: customer.city?.trim() || null,
    product_name: product.name?.trim() || null,
    product_price: parseNumericOrNull(product.price),
    notes: payload.data?.notes?.trim() || null,
    additional: normalizeAdditional(payload.data?.additional),
    payload,
    last_event_at: receivedAtIso,
  }

  const { error } = await admin.from("webhook_leads").upsert(row, { onConflict: "source,external_lead_id" })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, type: "lead.new", externalLeadId }, { status: 200 })
}

async function upsertLeadComplaint(payload: LeadComplaintPayload, receivedAtIso: string) {
  const externalLeadId = parseExternalLeadId(payload?.data?.id)
  if (!externalLeadId) {
    return NextResponse.json({ ok: false, error: "Invalid lead id for lead.complaint" }, { status: 400 })
  }

  const result = String(payload?.data?.result ?? "").trim().toLowerCase()
  if (result !== "accepted" && result !== "declined") {
    return NextResponse.json({ ok: false, error: "Invalid complaint result" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const row = {
    source: SOURCE,
    external_lead_id: externalLeadId,
    event_type: "lead.complaint",
    status: result === "accepted" ? "complaint_accepted" : "complaint_declined",
    complaint_reason: payload?.data?.reason?.trim() || null,
    payload,
    last_event_at: receivedAtIso,
  }

  const { error } = await admin.from("webhook_leads").upsert(row, { onConflict: "source,external_lead_id" })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, type: "lead.complaint", externalLeadId }, { status: 200 })
}

export async function POST(req: Request) {
  const expectedToken = String(process.env.LEAD_WEBHOOK_TOKEN ?? "").trim()
  if (!expectedToken) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: LEAD_WEBHOOK_TOKEN missing" }, { status: 500 })
  }

  const token = parseAuthToken(req.headers.get("authorization"))
  if (!token || token !== expectedToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as LeadNewPayload | LeadComplaintPayload
  const type = String((payload as any)?.type ?? "").trim()
  const receivedAtIso = new Date().toISOString()

  if (type === "lead.new") return upsertLeadNew(payload as LeadNewPayload, receivedAtIso)
  if (type === "lead.complaint") return upsertLeadComplaint(payload as LeadComplaintPayload, receivedAtIso)

  return NextResponse.json({ ok: false, error: `Unsupported type: ${type || "(empty)"}` }, { status: 400 })
}
