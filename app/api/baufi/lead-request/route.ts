import { NextResponse } from "next/server"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const SOURCE = "website_baufi_lead_funnel"
const DEFAULT_ADMIN_RECIPIENT = "info@sepana.de"
const MAX_NAME_LENGTH = 80
const MAX_TRACKING_VALUE_LENGTH = 300

const PURPOSE_LABELS = {
  kauf: "Kauf einer Immobilie",
  neubau: "Neubau",
  umschuldung: "Anschlussfinanzierung/Umschuldung",
  modernisierung: "Modernisierung",
} as const

const PROPERTY_TYPE_LABELS = {
  wohnung: "Eigentumswohnung",
  haus: "Einfamilienhaus",
  mehrfamilienhaus: "Mehrfamilienhaus",
  grundstueck: "Grundstück",
} as const

type AllowedPurpose = keyof typeof PURPOSE_LABELS
type AllowedPropertyType = keyof typeof PROPERTY_TYPE_LABELS

type RequestBody = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  financingNeed?: number | string
  purpose?: string
  propertyType?: string
  consentAccepted?: boolean
  website?: string
  tracking?: Record<string, unknown>
}

function trimOrNull(value: unknown) {
  const result = String(value ?? "").trim()
  return result ? result : null
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  const raw = String(value ?? "").trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function toPurpose(value: string | null): AllowedPurpose | null {
  if (!value) return null
  if (value in PURPOSE_LABELS) return value as AllowedPurpose
  return null
}

function toPropertyType(value: string | null): AllowedPropertyType | null {
  if (!value) return null
  if (value in PROPERTY_TYPE_LABELS) return value as AllowedPropertyType
  return null
}

function normalizeSiteUrl(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = String(raw ?? "").trim()
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function parseAdminRecipients() {
  const configured = String(
    process.env.BAUFI_LEAD_NOTIFY_TO ?? process.env.PRIVATKREDIT_NOTIFY_TO ?? process.env.INVITE_ACCEPTED_NOTIFY_TO ?? ""
  ).trim()

  const raw = configured || DEFAULT_ADMIN_RECIPIENT
  const unique = new Set(
    raw
      .split(/[;,\s]+/g)
      .map((item) => item.trim().replace(/^["'<]+|[>"']+$/g, ""))
      .filter((item) => item.includes("@"))
  )

  return Array.from(unique)
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

    if (!error) return { data, error: null as null }

    const code = String((error as { code?: string } | null)?.code ?? "")
    if (code !== "23505") return { data: null, error }
  }

  return { data: null, error: new Error("duplicate_external_lead_id") }
}

function esc(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatAmount(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function cleanTracking(input: Record<string, unknown> | undefined) {
  if (!input || typeof input !== "object") return {}

  const allowedKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gad_source",
    "gad_campaignid",
    "gbraid",
    "wbraid",
  ]

  const cleaned: Record<string, string> = {}

  for (const key of allowedKeys) {
    const value = trimOrNull(input[key])
    if (!value) continue
    cleaned[key] = value.slice(0, MAX_TRACKING_VALUE_LENGTH)
  }

  return cleaned
}

function requestSummaryHtml(opts: {
  firstName: string
  lastName: string
  email: string
  phone: string
  financingNeed: number
  purpose: AllowedPurpose
  propertyType: AllowedPropertyType
  leadId: string | number | null
  externalLeadId: string | number | null
}) {
  const rows = [
    ["Name", `${opts.firstName} ${opts.lastName}`.trim()],
    ["E-Mail", opts.email],
    ["Telefon", opts.phone],
    ["Finanzierungsbedarf", formatAmount(opts.financingNeed)],
    ["Vorhaben", PURPOSE_LABELS[opts.purpose]],
    ["Immobilienart", PROPERTY_TYPE_LABELS[opts.propertyType]],
    ["Lead-ID", opts.leadId || "-"],
    ["Externe Lead-ID", opts.externalLeadId || "-"],
  ]

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <div style="font-size:13px; line-height:22px; color:#334155;">
            ${rows
              .map(([label, value]) => `<div><strong style="color:#0f172a;">${esc(label)}:</strong> ${esc(value)}</div>`)
              .join("")}
          </div>
        </td>
      </tr>
    </table>
  `
}

async function sendAdminNotification(opts: {
  firstName: string
  lastName: string
  email: string
  phone: string
  financingNeed: number
  purpose: AllowedPurpose
  propertyType: AllowedPropertyType
  leadId: string | number | null
  externalLeadId: string | number | null
}) {
  const recipients = parseAdminRecipients()
  if (!recipients.length) {
    return { attempted: 0, successCount: 0, error: "missing_recipients" as string | null }
  }

  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const adminUrl = `${siteUrl}/admin/leads`
  const subject = "Neue Baufinanzierungs-Anfrage (Lead-Funnel)"
  const bodyHtml = requestSummaryHtml(opts)

  const html = buildEmailHtml({
    title: subject,
    intro: "Es wurde eine neue Anfrage über den Baufinanzierungs-Lead-Funnel eingereicht.",
    bodyHtml,
    ctaLabel: "Zu den Leads",
    ctaUrl: adminUrl,
    preheader: subject,
    eyebrow: "SEPANA - Lead Eingang",
  })

  const results = await Promise.all(recipients.map((to) => sendEmail({ to, subject, html })))
  const successCount = results.filter((result) => result?.ok).length
  const failed = results.find((result) => !result?.ok)

  return {
    attempted: recipients.length,
    successCount,
    error: failed ? String((failed as { error?: unknown })?.error ?? "mail_send_failed") : null,
  }
}

async function sendCustomerConfirmation(opts: {
  firstName: string
  email: string
  financingNeed: number
  purpose: AllowedPurpose
}) {
  const subject = "Ihre Baufinanzierungs-Anfrage ist eingegangen"
  const html = buildEmailHtml({
    title: subject,
    intro: `Hallo ${opts.firstName}, vielen Dank für Ihre Anfrage bei SEPANA.`,
    steps: [
      `Wir prüfen Ihren Finanzierungsbedarf von ${formatAmount(opts.financingNeed)} (${PURPOSE_LABELS[opts.purpose]}).`,
      "Ein Berater meldet sich zeitnah mit einer ersten Einschätzung bei Ihnen.",
      "Wenn Sie Rückfragen haben, erreichen Sie uns unter 05035 3169996.",
    ],
    preheader: subject,
    eyebrow: "SEPANA - Bestätigung",
  })

  const result = await sendEmail({
    to: opts.email,
    subject,
    html,
  })

  return {
    sent: !!result?.ok,
    error: result?.ok ? null : String((result as { error?: unknown })?.error ?? "mail_send_failed"),
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 })
    }

    if (trimOrNull(body.website)) {
      return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 })
    }

    const firstName = trimOrNull(body.firstName)
    const lastName = trimOrNull(body.lastName)
    const email = trimOrNull(body.email)?.toLowerCase() ?? null
    const phone = trimOrNull(body.phone)
    const financingNeed = parseAmount(body.financingNeed)
    const purpose = toPurpose(trimOrNull(body.purpose))
    const propertyType = toPropertyType(trimOrNull(body.propertyType))
    const consentAccepted = body.consentAccepted === true

    if (!consentAccepted) {
      return NextResponse.json({ ok: false, error: "Bitte Datenschutz akzeptieren." }, { status: 400 })
    }

    if (!firstName || !lastName || !email || !phone || financingNeed === null || !purpose || !propertyType) {
      return NextResponse.json({ ok: false, error: "Bitte alle Pflichtfelder ausfüllen." }, { status: 400 })
    }

    if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ ok: false, error: "Name ist zu lang." }, { status: 400 })
    }

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Bitte eine gültige E-Mail eingeben." }, { status: 400 })
    }

    if (!isPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Bitte eine gültige Telefonnummer eingeben." }, { status: 400 })
    }

    if (financingNeed < 10000 || financingNeed > 10000000) {
      return NextResponse.json({ ok: false, error: "Bitte einen realistischen Finanzierungsbedarf angeben." }, { status: 400 })
    }

    const tracking = cleanTracking(body.tracking)
    const now = new Date().toISOString()
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
      product_name: "Baufinanzierung",
      product_price: financingNeed,
      loan_purpose: PURPOSE_LABELS[purpose],
      loan_amount_total: financingNeed,
      property_type: PROPERTY_TYPE_LABELS[propertyType],
      notes: "Anfrage über Baufinanzierungs-Lead-Funnel",
      additional: {
        origin: "website",
        page: "/baufinanzierung/anfrage",
        purpose_key: purpose,
        property_type_key: propertyType,
        consent_accepted: consentAccepted,
        tracking,
      },
    }

    const { data, error } = await insertLeadWithRetry(admin, rowBase)
    if (error) {
      const message =
        error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? "Lead konnte nicht gespeichert werden.")
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    const leadId = data?.id ?? null
    const externalLeadId = data?.external_lead_id ?? null

    const [adminMail, customerMail] = await Promise.all([
      sendAdminNotification({
        firstName,
        lastName,
        email,
        phone,
        financingNeed,
        purpose,
        propertyType,
        leadId,
        externalLeadId,
      }),
      sendCustomerConfirmation({
        firstName,
        email,
        financingNeed,
        purpose,
      }),
    ])

    if (adminMail.successCount === 0 && adminMail.error) {
      console.error("[baufi-lead-request] admin mail failed", adminMail.error)
    }
    if (!customerMail.sent && customerMail.error) {
      console.error("[baufi-lead-request] customer mail failed", customerMail.error)
    }

    return NextResponse.json({
      ok: true,
      leadId,
      externalLeadId,
      message: "Anfrage gespeichert",
      mail: {
        adminAttempted: adminMail.attempted,
        adminSent: adminMail.successCount,
        customerSent: customerMail.sent,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
