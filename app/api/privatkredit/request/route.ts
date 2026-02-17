import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const SOURCE = "website_privatkredit"
const MAX_MESSAGE_LENGTH = 2000
const MAX_CALLBACK_LENGTH = 120

function trimOrNull(value: unknown) {
  const s = String(value ?? "").trim()
  return s ? s : null
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function parseAmount(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function purposeLabel(value: string | null) {
  const v = String(value ?? "").toLowerCase().trim()
  if (v === "freie_verwendung") return "Freie Verwendung"
  if (v === "umschuldung") return "Umschuldung"
  if (v === "auto") return "Auto"
  if (v === "modernisierung") return "Modernisierung"
  if (v === "sonstiges") return "Sonstiges"
  return "Privatkredit"
}

function nextExternalLeadId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

async function insertLeadWithRetry(admin: ReturnType<typeof supabaseAdmin>, rowBase: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const externalLeadId = nextExternalLeadId()
    const { data, error } = await admin
      .from("webhook_leads")
      .insert({ ...rowBase, external_lead_id: externalLeadId })
      .select("id,external_lead_id")
      .single()

    if (!error) {
      return { data, error: null as null }
    }

    if (String((error as any)?.code ?? "") !== "23505") {
      return { data: null, error }
    }
  }

  return { data: null, error: new Error("duplicate_external_lead_id") }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const firstName = trimOrNull(body?.firstName)
    const lastName = trimOrNull(body?.lastName)
    const email = trimOrNull(body?.email)?.toLowerCase() ?? null
    const phone = trimOrNull(body?.phone)
    const loanAmountRaw = trimOrNull(body?.loanAmount)
    const purposeRaw = trimOrNull(body?.purpose)
    const callbackTime = trimOrNull(body?.callbackTime)
    const message = trimOrNull(body?.message)

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Bitte Pflichtfelder ausfuellen." }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-Mail ist ungueltig." }, { status: 400 })
    }
    if (!isPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Telefonnummer ist ungueltig." }, { status: 400 })
    }

    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ ok: false, error: "Nachricht ist zu lang." }, { status: 400 })
    }
    if (callbackTime && callbackTime.length > MAX_CALLBACK_LENGTH) {
      return NextResponse.json({ ok: false, error: "Angabe zur Erreichbarkeit ist zu lang." }, { status: 400 })
    }

    const loanAmount = loanAmountRaw ? parseAmount(loanAmountRaw) : null
    if (loanAmountRaw && loanAmount === null) {
      return NextResponse.json({ ok: false, error: "Kreditsumme konnte nicht erkannt werden." }, { status: 400 })
    }

    const now = new Date().toISOString()
    const notes = [callbackTime ? `Beste Erreichbarkeit: ${callbackTime}` : null, message].filter(Boolean).join("\n\n") || null

    const admin = supabaseAdmin()
    const rowBase = {
      source: SOURCE,
      event_type: "lead.new",
      status: "new",
      source_created_at: now,
      last_event_at: now,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      phone_mobile: phone,
      product_name: "Privatkredit",
      product_price: loanAmount,
      loan_purpose: purposeLabel(purposeRaw),
      loan_amount_total: loanAmount,
      notes,
      additional: {
        origin: "website",
        page: "/privatkredit",
        callback_time: callbackTime,
        request_type: "privatkredit_contact",
      },
    }

    const { data, error } = await insertLeadWithRetry(admin, rowBase)
    if (error) {
      const message = error instanceof Error ? error.message : (error as any)?.message ?? "Lead konnte nicht gespeichert werden."
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      leadId: data?.id ?? null,
      externalLeadId: data?.external_lead_id ?? null,
      message: "Anfrage gespeichert",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
