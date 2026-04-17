import { NextResponse } from "next/server"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { createCaseFromLead, ensureCustomerAccount, pickStickyAdvisorId, type LeadRow } from "@/lib/admin/leads"
import { createPublicCaseAccessToken } from "@/lib/onlinekredit/publicAccess"
import {
  getSchufaFreeEmploymentMonthsSince,
  runSchufaFreePrecheck,
  type SchufaFreeEmploymentMode,
  type SchufaFreeNationalityGroup,
} from "@/lib/schufa-frei/precheck"
import { resolveSchufaFreeProfessionFromEmploymentMode } from "@/lib/schufa-frei/application"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const SOURCE = "website_schufa_frei"
const DEFAULT_ADMIN_RECIPIENT = "info@sepana.de"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  return value.replace(/\D/g, "").length >= 6
}

function parseAmount(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount) : null
}

function normalizeNationalityGroup(value: unknown): SchufaFreeNationalityGroup {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "de") return "de"
  if (normalized === "eu_ch" || normalized === "euch" || normalized === "eu" || normalized === "ch") return "eu_ch"
  return "other"
}

function normalizeEmploymentMode(value: unknown): SchufaFreeEmploymentMode {
  return String(value ?? "").trim().toLowerCase() === "hourly" ? "hourly" : "salary"
}

function parseAdminRecipients() {
  const configured = [
    process.env.PRIVATKREDIT_NOTIFY_TO,
    process.env.ADMIN_NOTIFY_TO,
    process.env.LIVE_QUEUE_ALERT_TO,
    process.env.INVITE_ACCEPTED_NOTIFY_TO,
  ]
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .join(" ")

  return Array.from(
    new Set(
      `${configured} ${DEFAULT_ADMIN_RECIPIENT}`
        .split(/[;,\s]+/g)
        .map((entry) => entry.trim().replace(/^["'<]+|[>"']+$/g, "").toLowerCase())
        .filter((entry) => entry.includes("@"))
    )
  )
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

function extractMissingColumnName(error: unknown) {
  const err = error as { message?: string } | null
  const message = String(err?.message ?? "")
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i)
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1]

  const postgresMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']?/i)
  if (postgresMatch?.[1]) return postgresMatch[1]

  return null
}

async function insertLeadWithRetry(admin: ReturnType<typeof supabaseAdmin>, rowBase: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const externalLeadId = nextExternalLeadId()
    const payload = { ...rowBase, external_lead_id: externalLeadId } as Record<string, unknown>

    while (true) {
      const query = await admin.from("webhook_leads").insert(payload).select("id,external_lead_id").single()
      if (!query.error) return { data: query.data, error: null as null }

      const missingColumn = extractMissingColumnName(query.error)
      if (missingColumn && missingColumn in payload) {
        delete payload[missingColumn]
        continue
      }

      if (isMissingLeadCaseTypeColumnError(query.error) && "lead_case_type" in payload) {
        delete payload.lead_case_type
        continue
      }

      if (String((query.error as { code?: string } | null)?.code ?? "") !== "23505") {
        return { data: null, error: query.error }
      }

      break
    }
  }

  return { data: null, error: new Error("duplicate_external_lead_id") }
}

async function updateLeadWithFallback(
  admin: ReturnType<typeof supabaseAdmin>,
  leadId: string,
  payload: Record<string, unknown>
) {
  const mutablePayload = { ...payload }

  while (true) {
    const query = await admin.from("webhook_leads").update(mutablePayload).eq("id", leadId)
    if (!query.error) return query

    const missingColumn = extractMissingColumnName(query.error)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      continue
    }

    if (isMissingLeadCaseTypeColumnError(query.error) && "lead_case_type" in mutablePayload) {
      delete mutablePayload.lead_case_type
      continue
    }

    return query
  }
}

async function notifyAdmin(input: {
  fullName: string
  email: string
  phone: string
  desiredAmount: number
  termMonths: number
  minimumIncomeRequired: number | null
  eligible: boolean
  incomeCheckPending: boolean
  reason: string | null
}) {
  const recipients = parseAdminRecipients()
  if (!recipients.length) return

  const steps = [
    `Ergebnis: ${input.eligible ? "positiv" : "negativ"}`,
    `Name: ${input.fullName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    `Variante: ${input.desiredAmount.toLocaleString("de-DE")} EUR / ${input.termMonths} Monate`,
    input.minimumIncomeRequired
      ? `Erforderliches Mindestnetto: ${input.minimumIncomeRequired.toLocaleString("de-DE")} EUR`
      : "Mindestnetto: laut Precheck nicht aufgeloest",
    input.incomeCheckPending ? "Einkommen wird erst im Vollantrag abgefragt." : null,
    input.reason ? `Begruendung: ${input.reason}` : null,
  ].filter((entry): entry is string => Boolean(entry))

  const html = buildEmailHtml({
    title: input.eligible ? "Neue Vorpruefung: Kredit ohne Schufa" : "Negative Vorpruefung: Kredit ohne Schufa",
    intro: input.eligible
      ? "Es wurde eine neue erste Vorpruefung fuer Kredit ohne Schufa angelegt."
      : "Es wurde eine neue Anfrage fuer Kredit ohne Schufa in der Vorpruefung abgelehnt.",
    steps,
    ctaLabel: "Zu den Faellen",
    ctaUrl: `${String(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sepana.de").replace(/\/$/, "")}/advisor/faelle?product=schufa_frei`,
    eyebrow: input.eligible ? "SEPANA - Neue Schufa-frei Anfrage" : "SEPANA - Negative Schufa-frei Vorpruefung",
  })

  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: input.eligible ? "Neue Vorpruefung: Kredit ohne Schufa" : "Negative Vorpruefung: Kredit ohne Schufa",
        html,
      }).catch(() => null)
    )
  )
}

async function notifyCustomer(input: { email: string; firstName: string | null }) {
  const html = buildEmailHtml({
    title: "Erste Vorpruefung positiv",
    intro: input.firstName
      ? `Hallo ${input.firstName}, Ihre erste Vorpruefung fuer Kredit ohne Schufa ist positiv ausgefallen.`
      : "Ihre erste Vorpruefung fuer Kredit ohne Schufa ist positiv ausgefallen.",
    steps: [
      "Im naechsten Schritt vervollstaendigen Sie bitte Ihre Angaben inklusive Einkommen.",
      "Danach koennen Sie die benoetigten Unterlagen direkt hochladen.",
      "Sobald sich im Fall etwas aendert, informiert SEPANA Sie automatisch.",
    ],
    eyebrow: "SEPANA - Kredit ohne Schufa",
  })

  await sendEmail({
    to: input.email,
    subject: "Ihre erste Vorpruefung ist positiv",
    html,
  }).catch(() => null)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const firstName = trimOrNull(body?.firstName)
    const lastName = trimOrNull(body?.lastName)
    const email = trimOrNull(body?.email)?.toLowerCase() ?? null
    const phone = trimOrNull(body?.phone)
    const familySituationRaw = Number(body?.familySituation ?? 1)
    const familySituation = Number.isFinite(familySituationRaw) ? familySituationRaw : 1
    const spouseRelevant = [2, 6].includes(familySituation)
    const spouseFirstName = spouseRelevant ? trimOrNull(body?.spouseFirstName) : null
    const spouseBirthName = spouseRelevant ? trimOrNull(body?.spouseBirthName) : null
    const spouseBirthDate = spouseRelevant ? trimOrNull(body?.spouseBirthDate) : null
    const desiredAmount = parseAmount(body?.desiredAmount)
    const termMonths = Number(body?.termMonths ?? 0)
    const dependentChildrenCount = Number(body?.dependentChildrenCount ?? 0)
    const nationalityGroup = normalizeNationalityGroup(body?.nationalityGroup)
    const sigmaExistingCustomer = Boolean(body?.sigmaExistingCustomer)
    const employmentMode = normalizeEmploymentMode(body?.employmentMode)
    const employmentStartDate = trimOrNull(body?.employmentStartDate)
    const netIncomeMonthly = parseAmount(body?.netIncomeMonthly)
    const acceptsProvisionAgreement = Boolean(body?.acceptsProvisionAgreement)
    const deferCustomerInvite = Boolean(body?.deferCustomerInvite)

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ ok: false, error: "Bitte alle Kontaktfelder ausfuellen." }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-Mail ist ungueltig." }, { status: 400 })
    }
    if (!isPhone(phone)) {
      return NextResponse.json({ ok: false, error: "Telefonnummer ist ungueltig." }, { status: 400 })
    }
    if (!desiredAmount || !termMonths || !employmentStartDate) {
      return NextResponse.json({ ok: false, error: "Bitte alle Vorpruefungsfelder ausfuellen." }, { status: 400 })
    }
    if (!acceptsProvisionAgreement) {
      return NextResponse.json({ ok: false, error: "Bitte die Provisionsvereinbarung bestaetigen." }, { status: 400 })
    }

    const employmentMonthsCurrent = getSchufaFreeEmploymentMonthsSince(employmentStartDate)
    if (employmentMonthsCurrent === null) {
      return NextResponse.json(
        { ok: false, error: "Bitte ein gueltiges Eintrittsdatum beim aktuellen Arbeitgeber angeben." },
        { status: 400 }
      )
    }

    const precheck = runSchufaFreePrecheck(
      {
        desiredAmount,
        termMonths,
        dependentChildrenCount,
        nationalityGroup,
        sigmaExistingCustomer,
        employmentMode,
        employmentStartDate,
        employmentMonthsCurrent,
        netIncomeMonthly,
      },
      { requireIncomeCheck: false },
    )

    const admin = supabaseAdmin()
    const now = new Date().toISOString()
    const notes = [
      `Vorpruefung ${precheck.eligible ? "positiv" : "negativ"} fuer ${desiredAmount.toLocaleString("de-DE")} EUR / ${termMonths} Monate`,
      precheck.minimumIncomeRequired
        ? `Mindestnetto: ${precheck.minimumIncomeRequired.toLocaleString("de-DE")} EUR`
        : null,
      `Aktueller Arbeitgeber seit: ${employmentStartDate}`,
      precheck.employmentMonthsCurrent != null
        ? `Berechnete Beschaeftigungsdauer: ${precheck.employmentMonthsCurrent} Monate`
        : null,
      precheck.employmentRequirementText,
      precheck.incomeCheckPending ? "Einkommen: wird erst im Vollantrag erfasst" : null,
      precheck.reason ? `Begruendung: ${precheck.reason}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const rowBase = {
      source: SOURCE,
      event_type: "lead.new",
      status: precheck.eligible ? "new" : "precheck_rejected",
      source_created_at: now,
      last_event_at: now,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      phone_mobile: phone,
      product_name: "Kredit ohne Schufa",
      lead_case_type: "schufa_frei",
      product_price: desiredAmount,
      loan_amount_total: desiredAmount,
      loan_term_months: termMonths,
      net_income_monthly: null,
      notes,
      additional: {
        origin: "website",
        page: "/kredit-ohne-schufa",
        nationality_group: nationalityGroup,
        sigma_existing_customer: sigmaExistingCustomer,
        employment_mode: employmentMode,
        employment_start_date: employmentStartDate,
        employment_months_current: employmentMonthsCurrent,
        dependent_children_count: dependentChildrenCount,
        family_situation: familySituation,
        spouse_first_name: spouseFirstName,
        spouse_birth_name: spouseBirthName,
        spouse_birth_date: spouseBirthDate,
        precheck_variant: precheck.variantKey,
        precheck_eligible: precheck.eligible,
        precheck_reason: precheck.reason,
        precheck_income_pending: precheck.incomeCheckPending,
      },
    }

    if (!precheck.eligible) {
      const insertedRejectedLead = await insertLeadWithRetry(admin, rowBase)
      if (insertedRejectedLead.error) {
        console.error("Failed to persist rejected schufa-free precheck lead", insertedRejectedLead.error)
      }

      await Promise.all([
        notifyAdmin({
          fullName: `${firstName} ${lastName}`.trim(),
          email,
          phone,
          desiredAmount,
          termMonths,
          minimumIncomeRequired: precheck.minimumIncomeRequired,
          eligible: false,
          incomeCheckPending: precheck.incomeCheckPending,
          reason: precheck.reason,
        }),
      ])

      return NextResponse.json(
        {
          ok: false,
          error: precheck.reason ?? "Die Vorpruefung ist aktuell nicht positiv.",
          precheck,
        },
        { status: 422 }
      )
    }

    const insertedLead = await insertLeadWithRetry(admin, rowBase)
    if (insertedLead.error) {
      throw insertedLead.error
    }

    const leadId = String(insertedLead.data?.id ?? "")
    const externalLeadId = Number(insertedLead.data?.external_lead_id ?? 0)

    const account = await ensureCustomerAccount({
      admin,
      req,
      email,
      firstName,
      lastName,
      deferInvite: deferCustomerInvite,
    })

    const stickyAdvisorId = await pickStickyAdvisorId(admin, account.userId)
    const leadForCase: LeadRow = {
      id: leadId,
      linked_case_id: null,
      external_lead_id: externalLeadId,
      assigned_advisor_id: stickyAdvisorId,
      lead_case_type: "schufa_frei",
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
        phone_mobile: phone,
        phone_work: null,
        birth_date: null,
        marital_status: null,
        employment_status: null,
        employment_type: employmentMode,
        net_income_monthly: null,
        address_street: null,
        address_zip: null,
        address_city: null,
      product_name: "Kredit ohne Schufa",
      product_price: desiredAmount,
      loan_purpose: "Kredit ohne Schufa",
      loan_amount_total: desiredAmount,
      loan_term_months: termMonths,
      property_zip: null,
      property_city: null,
      property_type: null,
      property_purchase_price: null,
      notes,
    }

    const createdCase = await createCaseFromLead({
      admin,
      lead: leadForCase,
      customerId: account.userId,
      advisorId: stickyAdvisorId,
      caseType: "schufa_frei",
      entryChannel: "website_schufa_frei",
      initialStatus: "prequalified",
    })

    await admin.from("case_schufa_free_details").upsert(
      {
        case_id: createdCase.caseId,
        loan_amount_requested: desiredAmount,
        term_months: termMonths,
        precheck_variant: precheck.variantKey,
        precheck_passed: true,
        precheck_reason: precheck.reason,
        minimum_income_required: precheck.minimumIncomeRequired,
        nationality_group: nationalityGroup,
        sigma_existing_customer: sigmaExistingCustomer,
        employment_mode: employmentMode,
        employment_months_current: employmentMonthsCurrent,
        net_income_monthly: null,
        dependent_children_count: dependentChildrenCount,
        family_situation: familySituation,
        profession: resolveSchufaFreeProfessionFromEmploymentMode(employmentMode),
        profession_begin_date: employmentStartDate,
        nationality: nationalityGroup === "de" ? "DE" : null,
        email,
        phone_primary: phone,
        spouse_first_name: spouseFirstName,
        spouse_birth_name: spouseBirthName,
        spouse_birth_date: spouseBirthDate,
        updated_at: now,
      },
      { onConflict: "case_id" }
    )

    const updatePayload: Record<string, unknown> = {
      linked_case_id: createdCase.caseId,
      assigned_advisor_id: stickyAdvisorId,
      assigned_at: stickyAdvisorId ? now : null,
      lead_case_type: "schufa_frei",
    }
    const updateResult = await updateLeadWithFallback(admin, leadId, updatePayload)
    if (updateResult.error) {
      console.error("Failed to update schufa-free lead linkage", updateResult.error)
    }

    const accessToken = createPublicCaseAccessToken({
      caseId: createdCase.caseId,
      caseRef: createdCase.caseRef,
      customerId: account.userId,
    })
    const applicationHref = `/kredit-ohne-schufa/antrag?caseId=${encodeURIComponent(createdCase.caseId)}&caseRef=${encodeURIComponent(createdCase.caseRef)}&access=${encodeURIComponent(accessToken)}${account.existingAccount ? "&existing=1" : ""}`

    await Promise.all([
      notifyAdmin({
        fullName: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        desiredAmount,
        termMonths,
        minimumIncomeRequired: precheck.minimumIncomeRequired,
        eligible: true,
        incomeCheckPending: precheck.incomeCheckPending,
        reason: null,
      }),
      notifyCustomer({
        email,
        firstName,
      }),
    ])

    return NextResponse.json({
      ok: true,
      precheck,
      linkedCaseId: createdCase.caseId,
      linkedCaseRef: createdCase.caseRef,
      publicAccessToken: accessToken,
      applicationHref,
      existingAccount: account.existingAccount,
    })
  } catch (error) {
    console.error("[schufa-frei/request] unexpected error", error)
    const message =
      error instanceof Error
        ? error.message
        : trimOrNull((error as { message?: unknown; details?: unknown } | null)?.message) ??
          trimOrNull((error as { details?: unknown } | null)?.details) ??
          "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
