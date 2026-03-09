import { NextResponse } from "next/server"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const SOURCE = "website_baufi_anschluss_kurzanfrage"
const DEFAULT_ADMIN_RECIPIENT = "info@sepana.de"
const DEFAULT_PAGE_PATH = "/baufinanzierung/anschlussfinanzierung"
const MAX_PAGE_PATH_LENGTH = 180
const MAX_CALCULATION_SUMMARY_LENGTH = 1200

type RequestBody = {
  email?: string
  phone?: string
  consentAccepted?: boolean
  website?: string
  pagePath?: string
  calculationSummary?: string
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

function normalizePagePath(value: unknown) {
  const raw = trimOrNull(value)
  if (!raw) return DEFAULT_PAGE_PATH

  const pathOnly = raw.split(/[?#]/, 1)[0] ?? ""
  if (!pathOnly || pathOnly.length > MAX_PAGE_PATH_LENGTH) return DEFAULT_PAGE_PATH
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) return DEFAULT_PAGE_PATH
  if (pathOnly.includes("://")) return DEFAULT_PAGE_PATH

  return pathOnly
}

function normalizeCalculationSummary(value: unknown) {
  const raw = trimOrNull(value)
  if (!raw) return null
  return raw.replace(/\s+/g, " ").slice(0, MAX_CALCULATION_SUMMARY_LENGTH)
}

function escapeHtml(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function parseAdminRecipients() {
  const configured = [
    process.env.BAUFI_LEAD_NOTIFY_TO,
    process.env.ADMIN_NOTIFY_TO,
    process.env.LIVE_QUEUE_ALERT_TO,
    process.env.INVITE_ACCEPTED_NOTIFY_TO,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ")

  const normalized = `${configured} ${DEFAULT_ADMIN_RECIPIENT}`
  const unique = new Set(
    normalized
      .split(/[;,\s]+/g)
      .map((item) => item.trim().replace(/^["'<]+|[>"']+$/g, "").toLowerCase())
      .filter((item) => item.includes("@"))
  )
  return Array.from(unique)
}

function nextExternalLeadId() {
  return Date.now() * 100 + Math.floor(Math.random() * 100)
}

function isMissingLeadCaseTypeColumnError(error: unknown) {
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  if (String(err.code ?? "") === "42703") return true
  const msg = String(err.message ?? "").toLowerCase()
  return msg.includes("lead_case_type") && (msg.includes("column") || msg.includes("schema cache"))
}

async function insertLeadWithRetry(admin: ReturnType<typeof supabaseAdmin>, rowBase: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const externalLeadId = nextExternalLeadId()
    const payload = { ...rowBase, external_lead_id: externalLeadId }
    const { data, error } = await admin
      .from("webhook_leads")
      .insert(payload)
      .select("id,external_lead_id")
      .single()

    if (!error) return { data, error: null as null }

    if (isMissingLeadCaseTypeColumnError(error)) {
      const fallbackPayload = { ...payload }
      delete (fallbackPayload as { lead_case_type?: unknown }).lead_case_type
      const fallback = await admin
        .from("webhook_leads")
        .insert(fallbackPayload)
        .select("id,external_lead_id")
        .single()
      if (!fallback.error) return { data: fallback.data, error: null as null }
      if (String((fallback.error as { code?: string } | null)?.code ?? "") !== "23505") {
        return { data: null, error: fallback.error }
      }
      continue
    }

    if (String((error as { code?: string } | null)?.code ?? "") !== "23505") return { data: null, error }
  }

  return { data: null, error: new Error("duplicate_external_lead_id") }
}

async function sendAdminNotification(opts: {
  email: string
  phone: string
  leadId: string | number | null
  externalLeadId: string | number | null
  calculationSummary: string | null
}) {
  const recipients = parseAdminRecipients()
  if (!recipients.length) {
    return { attempted: 0, successCount: 0, error: "missing_recipients" as string | null }
  }

  const subject = "Neue Kurzanfrage (Anschlussfinanzierung)"
  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <div style="font-size:13px; line-height:22px; color:#334155;">
            <div><strong style="color:#0f172a;">Typ:</strong> Kurzanfrage Anschlussfinanzierung</div>
            <div><strong style="color:#0f172a;">E-Mail:</strong> ${escapeHtml(opts.email)}</div>
            <div><strong style="color:#0f172a;">Telefon:</strong> ${escapeHtml(opts.phone)}</div>
            <div><strong style="color:#0f172a;">Lead-ID:</strong> ${escapeHtml(String(opts.leadId ?? "-"))}</div>
            <div><strong style="color:#0f172a;">Externe Lead-ID:</strong> ${escapeHtml(String(opts.externalLeadId ?? "-"))}</div>
            ${
              opts.calculationSummary
                ? `<div><strong style="color:#0f172a;">Rechnerdaten:</strong> ${escapeHtml(opts.calculationSummary)}</div>`
                : ""
            }
          </div>
        </td>
      </tr>
    </table>
  `

  const html = buildEmailHtml({
    title: subject,
    intro: "Es wurde eine neue Kurzanfrage über die Landingpage Anschlussfinanzierung eingereicht.",
    bodyHtml,
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

async function sendCustomerConfirmation(email: string) {
  const subject = "Ihre Kurzanfrage ist eingegangen"
  const html = buildEmailHtml({
    title: subject,
    intro: "Vielen Dank für Ihre Kurzanfrage zur Anschlussfinanzierung.",
    steps: [
      "Wir melden uns zeitnah bei Ihnen.",
      "Im Gespräch klären wir Restschuld, Timing und Forward-Optionen.",
      "Bei Rückfragen erreichen Sie uns unter 05035 3169996.",
    ],
    preheader: subject,
    eyebrow: "SEPANA - Bestätigung",
  })

  const result = await sendEmail({ to: email, subject, html })
  return {
    sent: !!result?.ok,
    error: result?.ok ? null : String((result as { error?: unknown } | null)?.error ?? "mail_send_failed"),
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

    const email = trimOrNull(body.email)?.toLowerCase() ?? null
    const phone = trimOrNull(body.phone)
    const consentAccepted = body.consentAccepted === true
    const pagePath = normalizePagePath(body.pagePath)
    const calculationSummary = normalizeCalculationSummary(body.calculationSummary)

    if (!consentAccepted) {
      return NextResponse.json({ ok: false, error: "Bitte Datenschutz akzeptieren." }, { status: 400 })
    }
    if (!email || !phone) {
      return NextResponse.json({ ok: false, error: "Bitte E-Mail und Telefonnummer angeben." }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "Bitte eine gültige E-Mail eingeben." }, { status: 400 })
    }
    if (!isPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Bitte eine gültige Telefonnummer eingeben." }, { status: 400 })
    }

    const now = new Date().toISOString()
    const admin = supabaseAdmin()
    const rowBase = {
      source: SOURCE,
      event_type: "lead.new",
      status: "new",
      source_created_at: now,
      last_event_at: now,
      first_name: null,
      last_name: null,
      email,
      phone,
      phone_mobile: phone,
      product_name: "Baufinanzierung Anschlussfinanzierung",
      lead_case_type: "baufi",
      loan_purpose: "Anschlussfinanzierung",
      notes: "Kurzanfrage über Landingpage Anschlussfinanzierung",
      additional: {
        origin: "website",
        page: pagePath,
        request_type: "anschluss_kurzanfrage",
        consent_accepted: true,
        calculation_summary: calculationSummary,
      },
    }

    const { data, error } = await insertLeadWithRetry(admin, rowBase)
    if (error) {
      const message =
        error instanceof Error
          ? error.message
          : String((error as { message?: unknown } | null)?.message ?? "Lead konnte nicht gespeichert werden.")
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    const leadId = data?.id ?? null
    const externalLeadId = data?.external_lead_id ?? null

    const [adminMail, customerMail] = await Promise.all([
      sendAdminNotification({ email, phone, leadId, externalLeadId, calculationSummary }),
      sendCustomerConfirmation(email),
    ])

    if (adminMail.successCount === 0 && adminMail.error) {
      console.error("[baufi-quick-request] admin mail failed", adminMail.error)
    }
    if (!customerMail.sent && customerMail.error) {
      console.error("[baufi-quick-request] customer mail failed", customerMail.error)
    }

    return NextResponse.json({
      ok: true,
      leadId,
      externalLeadId,
      message: "Kurzanfrage gespeichert",
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

