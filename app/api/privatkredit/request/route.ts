import { NextResponse } from "next/server"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { createCaseFromLead, ensureCustomerAccount, pickStickyAdvisorId, LeadRow } from "@/lib/admin/leads"

export const runtime = "nodejs"

const SOURCE = "website_privatkredit"
const MAX_MESSAGE_LENGTH = 2000
const MAX_CALLBACK_LENGTH = 120
const DEFAULT_ADMIN_RECIPIENT = "info@sepana.de"
const DEFAULT_PAGE_PATH = "/privatkredit"
const MAX_PAGE_PATH_LENGTH = 180

type RequestType = "contact" | "callback" | "quick_start"
type MailSendResult = { ok?: boolean; error?: unknown } | null | undefined

function normalizeRequestType(value: unknown): RequestType {
  const v = String(value ?? "").trim().toLowerCase()
  if (v === "quick_start" || v === "quickstart" || v === "quick") return "quick_start"
  if (v === "callback") return "callback"
  return "contact"
}

function trimOrNull(value: unknown) {
  const s = String(value ?? "").trim()
  return s ? s : null
}

function splitFullName(value: string | null) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) {
    return { firstName: null as string | null, lastName: null as string | null }
  }
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ").trim() || null,
  }
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
  if (v === "pv_anlage") return "PV-Anlage Finanzierung"
  if (v === "pv") return "PV-Anlage Finanzierung"
  if (v === "photovoltaik") return "PV-Anlage Finanzierung"
  if (v === "solaranlage") return "PV-Anlage Finanzierung"
  if (v === "freie_verwendung") return "Freie Verwendung"
  if (v === "umschuldung") return "Umschuldung"
  if (v === "auto") return "Auto"
  if (v === "autokredit") return "Auto"
  if (v === "modernisierung") return "Modernisierung"
  if (v === "renovierung") return "Modernisierung"
  if (v === "moebel") return "Moebel / Elektronik"
  if (v === "sonstiges") return "Sonstiges"
  return "Privatkredit"
}

function requestTypeLabel(value: RequestType) {
  if (value === "quick_start") return "Schnellstart-Anfrage"
  return value === "callback" ? "Rueckruf-Anfrage" : "Privatkredit-Anfrage"
}

function requestTypeKey(value: RequestType) {
  if (value === "quick_start") return "privatkredit_quick_start"
  return value === "callback" ? "privatkredit_callback" : "privatkredit_contact"
}

function productNameForPurpose(purpose: string) {
  const normalized = purpose.toLowerCase()
  if (normalized.includes("pv") || normalized.includes("photovoltaik") || normalized.includes("solar")) {
    return "Privatkredit PV-Anlage"
  }
  return "Privatkredit"
}

function formatAmount(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function esc(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
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

function normalizePagePath(value: unknown) {
  const raw = trimOrNull(value)
  if (!raw) return DEFAULT_PAGE_PATH

  const pathOnly = raw.split(/[?#]/, 1)[0] ?? ""
  if (!pathOnly || pathOnly.length > MAX_PAGE_PATH_LENGTH) return DEFAULT_PAGE_PATH
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) return DEFAULT_PAGE_PATH
  if (pathOnly.includes("://")) return DEFAULT_PAGE_PATH

  return pathOnly
}

function parseAdminRecipients() {
  const configured = [
    process.env.PRIVATKREDIT_NOTIFY_TO,
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
      .map((x) => x.trim().replace(/^["'<]+|[>"']+$/g, "").toLowerCase())
      .filter((x) => x.includes("@"))
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

    if (!error) {
      return { data, error: null as null }
    }

    if (isMissingLeadCaseTypeColumnError(error)) {
      const fallbackPayload = { ...payload }
      delete (fallbackPayload as { lead_case_type?: unknown }).lead_case_type
      const fallback = await admin
        .from("webhook_leads")
        .insert(fallbackPayload)
        .select("id,external_lead_id")
        .single()
      if (!fallback.error) {
        return { data: fallback.data, error: null as null }
      }
      if (String((fallback.error as { code?: string } | null)?.code ?? "") !== "23505") {
        return { data: null, error: fallback.error }
      }
      continue
    }

    if (String((error as { code?: unknown } | null)?.code ?? "") !== "23505") {
      return { data: null, error }
    }
  }

  return { data: null, error: new Error("duplicate_external_lead_id") }
}

function requestSummaryHtml(opts: {
  requestType: RequestType
  fullName: string | null
  email: string | null
  phone: string | null
  loanAmount: number | null
  purpose: string
  callbackTime: string | null
  message: string | null
  leadId: string | number | null
  externalLeadId: string | number | null
}) {
  const rows = [
    ["Typ", requestTypeLabel(opts.requestType)],
    ["Name", opts.fullName || "-"],
    ["E-Mail", opts.email || "-"],
    ["Telefon", opts.phone || "-"],
    ["Kreditsumme", formatAmount(opts.loanAmount)],
    ["Verwendungszweck", opts.purpose || "-"],
    ["Beste Erreichbarkeit", opts.callbackTime || "-"],
    ["Nachricht", opts.message || "-"],
    ["Lead-ID", opts.leadId || "-"],
    ["Externe Lead-ID", opts.externalLeadId || "-"],
  ]

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <div style="font-size:13px; line-height:22px; color:#334155;">
            ${rows
              .map(
                ([label, value]) =>
                  `<div><strong style="color:#0f172a;">${esc(label)}:</strong> ${esc(String(value ?? "-"))}</div>`
              )
              .join("")}
          </div>
        </td>
      </tr>
    </table>
  `
}

async function sendAdminNotification(opts: {
  requestType: RequestType
  fullName: string | null
  email: string | null
  phone: string | null
  loanAmount: number | null
  purpose: string
  callbackTime: string | null
  message: string | null
  leadId: string | number | null
  externalLeadId: string | number | null
}) {
  const recipients = parseAdminRecipients()
  if (!recipients.length) {
    return { attempted: 0, successCount: 0, error: "missing_recipients" as string | null }
  }

  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const adminUrl = `${siteUrl}/admin/leads`
  const bodyHtml = requestSummaryHtml(opts)
  const subject = (() => {
    if (opts.requestType === "callback") return "Neue Rueckruf-Anfrage (Privatkredit)"
    if (opts.requestType === "quick_start") return "Neue Schnellstart-Anfrage (Privatkredit)"
    return "Neue Privatkredit-Anfrage"
  })()

  const html = buildEmailHtml({
    title: subject,
    intro: "Es wurde eine neue Anfrage ueber die Privatkredit-Landingpage eingereicht.",
    bodyHtml,
    ctaLabel: "Zu den Leads",
    ctaUrl: adminUrl,
    preheader: subject,
    eyebrow: "SEPANA - Lead Eingang",
  })

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject,
        html,
      })
    )
  )

  const successCount = results.filter((x: MailSendResult) => x?.ok).length
  const failed = results.find((x: MailSendResult) => !x?.ok)
  return {
    attempted: recipients.length,
    successCount,
    error: failed ? String((failed as { error?: unknown }).error ?? "mail_send_failed") : null,
  }
}

async function sendCustomerConfirmation(opts: {
  requestType: RequestType
  firstName: string | null
  email: string | null
  callbackTime: string | null
}) {
  if (!opts.email) {
    return { sent: false, skipped: true, error: null as string | null }
  }

  const salutation = opts.firstName ? `Hallo ${opts.firstName},` : "Hallo,"
  const subject = (() => {
    if (opts.requestType === "callback") return "Ihre Rueckruf-Anfrage ist eingegangen"
    if (opts.requestType === "quick_start") return "Ihre Schnellstart-Anfrage ist eingegangen"
    return "Ihre Privatkredit-Anfrage ist eingegangen"
  })()
  const steps = (() => {
    if (opts.requestType === "callback") {
      return [
        "Wir pruefen Ihre Rueckruf-Anfrage kurzfristig.",
        opts.callbackTime
          ? `Wir orientieren uns an Ihrer Wunschzeit: ${opts.callbackTime}.`
          : "Wir melden uns in der Regel zeitnah telefonisch bei Ihnen.",
        "Bei Rueckfragen erreichen Sie uns auch direkt unter 05035 3169996.",
      ]
    }
    if (opts.requestType === "quick_start") {
      return [
        "Wir sichten Ihre Schnellstart-Anfrage und melden uns in der Regel innerhalb von 24 Stunden.",
        "Falls eine Telefonnummer vorliegt, stimmen wir die naechsten Schritte gern direkt telefonisch ab.",
        "Bei Rueckfragen erreichen Sie uns unter 05035 3169996.",
      ]
    }
    return [
      "Wir pruefen Ihre Angaben und melden uns mit einer klaren Einschaetzung.",
      "Auf Wunsch pruefen wir Ihre Anfrage direkt live und beantragen ohne Umwege.",
      "Bei Rueckfragen erreichen Sie uns unter 05035 3169996.",
    ]
  })()

  const html = buildEmailHtml({
    title: subject,
    intro: `${salutation} vielen Dank fuer Ihre Anfrage bei SEPANA.`,
    steps,
    preheader: subject,
    eyebrow: "SEPANA - Bestaetigung",
  })

  const result = await sendEmail({
    to: opts.email,
    subject,
    html,
  })

  return {
    sent: !!result?.ok,
    skipped: false,
    error: result?.ok ? null : String((result as { error?: unknown } | null)?.error ?? "mail_send_failed"),
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const requestType = normalizeRequestType(body?.requestType)

    let firstName = trimOrNull(body?.firstName)
    let lastName = trimOrNull(body?.lastName)
    const fullName = trimOrNull(body?.fullName)
    if ((!firstName || !lastName) && fullName) {
      const parsed = splitFullName(fullName)
      firstName = firstName || parsed.firstName
      lastName = lastName || parsed.lastName
    }

    const email = trimOrNull(body?.email)?.toLowerCase() ?? null
    const phone = trimOrNull(body?.phone)
    const loanAmountRaw = trimOrNull(body?.loanAmount)
    const purposeRaw = trimOrNull(body?.purpose)
    const callbackTime = trimOrNull(body?.callbackTime)
    const message = trimOrNull(body?.message)

    if (requestType === "contact") {
      if (!phone) {
        return NextResponse.json({ ok: false, error: "Bitte Telefonnummer angeben." }, { status: 400 })
      }
      if (!isPhone(phone)) {
        return NextResponse.json({ ok: false, error: "Telefonnummer ist ungültig." }, { status: 400 })
      }
      if (!firstName || !lastName || !email) {
        return NextResponse.json({ ok: false, error: "Bitte Pflichtfelder ausfüllen." }, { status: 400 })
      }
      if (!isEmail(email)) {
        return NextResponse.json({ ok: false, error: "E-Mail ist ungültig." }, { status: 400 })
      }
    } else if (requestType === "callback") {
      if (!phone) {
        return NextResponse.json({ ok: false, error: "Bitte Telefonnummer angeben." }, { status: 400 })
      }
      if (!isPhone(phone)) {
        return NextResponse.json({ ok: false, error: "Telefonnummer ist ungültig." }, { status: 400 })
      }
      if (email && !isEmail(email)) {
        return NextResponse.json({ ok: false, error: "E-Mail ist ungültig." }, { status: 400 })
      }
    } else {
      if (!email && !phone) {
        return NextResponse.json({ ok: false, error: "Bitte E-Mail oder Telefonnummer angeben." }, { status: 400 })
      }
      if (email && !isEmail(email)) {
        return NextResponse.json({ ok: false, error: "E-Mail ist ungültig." }, { status: 400 })
      }
      if (phone && !isPhone(phone)) {
        return NextResponse.json({ ok: false, error: "Telefonnummer ist ungültig." }, { status: 400 })
      }
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
    const pagePath = normalizePagePath(body?.pagePath)
    const notes = [callbackTime ? `Beste Erreichbarkeit: ${callbackTime}` : null, message].filter(Boolean).join("\n\n") || null
    const fullNameResolved = [firstName, lastName].filter(Boolean).join(" ").trim() || null
    const purpose = purposeLabel(purposeRaw)
    const productName = productNameForPurpose(purpose)

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
      product_name: productName,
      lead_case_type: "konsum",
      product_price: loanAmount,
      loan_purpose: purpose,
      loan_amount_total: loanAmount,
      notes,
      additional: {
        origin: "website",
        page: pagePath,
        callback_time: callbackTime,
        request_type: requestTypeKey(requestType),
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
    let linkedCaseId: string | null = null
    let existingAccount = false

    const [adminMail, customerMail] = await Promise.all([
      sendAdminNotification({
        requestType,
        fullName: fullNameResolved,
        email,
        phone,
        loanAmount,
        purpose,
        callbackTime,
        message,
        leadId,
        externalLeadId,
      }),
      sendCustomerConfirmation({
        requestType,
        firstName,
        email,
        callbackTime,
      }),
    ])

    if (leadId && email && requestType === "contact") {
      try {
        const account = await ensureCustomerAccount({
          admin,
          req,
          email,
          firstName,
          lastName,
        })
        existingAccount = account.existingAccount

        const stickyAdvisorId = await pickStickyAdvisorId(admin, account.userId)
        const safeExternalLeadId = Number.isFinite(Number(externalLeadId)) ? Number(externalLeadId) : 0
        const leadForCase: LeadRow = {
          id: String(leadId),
          linked_case_id: null,
          external_lead_id: safeExternalLeadId,
          assigned_advisor_id: stickyAdvisorId,
          lead_case_type: "konsum",
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          phone_mobile: phone,
          phone_work: null,
          birth_date: null,
          marital_status: null,
          employment_status: null,
          employment_type: null,
          net_income_monthly: null,
          address_street: null,
          address_zip: null,
          address_city: null,
          product_name: productName,
          product_price: loanAmount,
          loan_purpose: purpose,
          loan_amount_total: loanAmount,
          property_zip: null,
          property_city: null,
          property_type: null,
          property_purchase_price: null,
          notes,
        }

        const created = await createCaseFromLead({
          admin,
          lead: leadForCase,
          customerId: account.userId,
          advisorId: stickyAdvisorId,
          caseType: "konsum",
          entryChannel: "website_privatkredit",
        })
        linkedCaseId = created.caseId

        const updatePayload: Record<string, unknown> = {
          linked_case_id: created.caseId,
          assigned_advisor_id: stickyAdvisorId,
          assigned_at: stickyAdvisorId ? now : null,
          lead_case_type: "konsum",
        }
        const updateQuery = await admin.from("webhook_leads").update(updatePayload).eq("id", String(leadId))
        if (updateQuery.error && isMissingLeadCaseTypeColumnError(updateQuery.error) && "lead_case_type" in updatePayload) {
          delete updatePayload.lead_case_type
          await admin.from("webhook_leads").update(updatePayload).eq("id", String(leadId))
        }
      } catch (accountOrCaseError) {
        console.error("[privatkredit-request] account/case linking failed", accountOrCaseError)
      }
    }

    if (adminMail.successCount === 0 && adminMail.error) {
      console.error("[privatkredit-request] admin mail failed", adminMail.error)
    }
    if (!customerMail.skipped && !customerMail.sent && customerMail.error) {
      console.error("[privatkredit-request] customer mail failed", customerMail.error)
    }

    return NextResponse.json({
      ok: true,
      leadId,
      externalLeadId,
      linkedCaseId,
      existingAccount,
      message: "Anfrage gespeichert",
      mail: {
        adminAttempted: adminMail.attempted,
        adminSent: adminMail.successCount,
        customerSent: customerMail.sent,
        customerSkipped: customerMail.skipped,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
