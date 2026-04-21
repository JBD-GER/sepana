import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { updateCaseStatusCompat } from "@/lib/caseStatusCompat"
import { renderSchufaFreeProvisionInvoicePdf } from "@/lib/schufa-frei/renderProvisionInvoicePdf"
import {
  SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_RATE,
  buildSchufaFreeProvisionCancellationDescription,
  buildSchufaFreeProvisionCancellationInvoiceTitle,
  getSchufaFreeProvisionBreakdown,
  getSchufaFreeProvisionInvoiceNumber,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type AdminClient = ReturnType<typeof supabaseAdmin>

type CaseRow = {
  id: string
  case_ref?: string | null
  case_type?: string | null
  status?: string | null
}

type CaseInvoiceRow = {
  id: string
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | string | null
  loan_amount?: number | string | null
  recipient_name?: string | null
  recipient_email?: string | null
  created_at?: string | null
}

type DetailsRow = {
  loan_amount_requested?: number | string | null
  street?: string | null
  house_number?: string | null
  zipcode?: string | null
  city?: string | null
}

type CancelSuccess = {
  ok: true
  alreadyCancelled: boolean
  invoice: CaseInvoiceRow
  cancellationInvoice: CaseInvoiceRow
  emailSent: boolean
  emailError: string | null
  caseStatusApplied: string | null
  caseStatusFallbackApplied: boolean
}

type CancelFailure = {
  ok: false
  status: number
  error: string
}

export type CancelSchufaFreeProvisionInvoiceResult = CancelSuccess | CancelFailure

function isMissingCaseInvoicesTableError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42P01") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("case_invoices") && (msg.includes("relation") || msg.includes("table"))
}

function isMissingCaseInvoiceNumberMigrationError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false

  const code = String(anyError.code ?? "").trim()
  const msg = String(anyError.message ?? "").toLowerCase()

  if (code === "23502" && msg.includes("invoice_number")) return true
  if (code === "42704" && msg.includes("case_invoice_number_seq")) return true
  return msg.includes("case_invoice_number_seq") || (msg.includes("invoice_number") && msg.includes("default"))
}

function normalizeSiteOrigin(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = trimOrNull(raw)
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function buildCancellationEventCopy(input: {
  automatic?: boolean
  automaticReason?: string | null
  emailSent: boolean
  originalInvoiceCancelled: boolean
}) {
  const automatic = input.automatic === true
  const reasonSuffix = input.automaticReason ? ` ${input.automaticReason}` : ""

  if (automatic) {
    return {
      title: "Kreditanfrage automatisch storniert",
      body: input.emailSent
        ? input.originalInvoiceCancelled
          ? `Die fehlende Stornorechnung wurde${reasonSuffix} nachträglich automatisch erzeugt und der Kunde per E-Mail informiert.`
          : `Die Vorauszahlungsrechnung wurde${reasonSuffix} automatisch storniert und der Kunde per E-Mail informiert.`
        : input.originalInvoiceCancelled
          ? `Die fehlende Stornorechnung wurde${reasonSuffix} nachträglich automatisch erzeugt.`
          : `Die Vorauszahlungsrechnung wurde${reasonSuffix} automatisch storniert.`,
    }
  }

  return {
    title: "Kreditanfrage storniert",
    body: input.emailSent
      ? input.originalInvoiceCancelled
        ? "Die fehlende Stornorechnung wurde nachträglich erzeugt und der Kunde per E-Mail informiert."
        : "Die Vorauszahlungsrechnung wurde storniert und der Kunde per E-Mail informiert."
      : input.originalInvoiceCancelled
        ? "Die fehlende Stornorechnung wurde nachträglich erzeugt."
        : "Die Vorauszahlungsrechnung wurde storniert.",
  }
}

export async function cancelSchufaFreeProvisionInvoice(input: {
  admin: AdminClient
  caseId: string
  actorId?: string | null
  actorRole?: string | null
  siteOrigin?: string
  automatic?: boolean
  automaticReason?: string | null
}): Promise<CancelSchufaFreeProvisionInvoiceResult> {
  const admin = input.admin
  const caseId = trimOrNull(input.caseId)
  if (!caseId) {
    return { ok: false, status: 400, error: "caseId fehlt" }
  }

  const { data: caseRowRaw, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,case_type,status")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) {
    return { ok: false, status: 400, error: caseError.message }
  }

  const caseRow = (caseRowRaw ?? null) as CaseRow | null
  if (!caseRow) {
    return { ok: false, status: 404, error: "Fall nicht gefunden" }
  }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return { ok: false, status: 409, error: "case_type_not_supported" }
  }

  const [{ data: existingInvoiceRaw, error: invoiceLoadError }, { data: cancellationInvoiceRaw, error: cancellationLoadError }] =
    await Promise.all([
      admin
        .from("case_invoices")
        .select("*")
        .eq("case_id", caseId)
        .eq("invoice_type", SCHUFA_FREE_PROVISION_INVOICE_TYPE)
        .maybeSingle(),
      admin
        .from("case_invoices")
        .select("*")
        .eq("case_id", caseId)
        .eq("invoice_type", SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE)
        .maybeSingle(),
    ])

  if (invoiceLoadError || cancellationLoadError) {
    const loadError = invoiceLoadError ?? cancellationLoadError
    if (isMissingCaseInvoicesTableError(loadError)) {
      return { ok: false, status: 503, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." }
    }
    return { ok: false, status: 400, error: loadError?.message ?? "invoice_load_failed" }
  }

  const existingInvoice = (existingInvoiceRaw ?? null) as CaseInvoiceRow | null
  const cancellationInvoice = (cancellationInvoiceRaw ?? null) as CaseInvoiceRow | null

  if (!existingInvoice) {
    return { ok: false, status: 404, error: "Rechnung noch nicht angelegt" }
  }

  const now = new Date().toISOString()
  const originalInvoiceCancelled = String(existingInvoice.status ?? "").trim().toLowerCase() === "cancelled"
  const currentCaseStatus = String(caseRow.status ?? "").trim().toLowerCase()
  const caseAlreadyClosed = currentCaseStatus === "cancelled" || currentCaseStatus === "closed"

  if (cancellationInvoice) {
    let caseStatusCompat: { appliedStatus: string; fallbackApplied: boolean } | null = null

    if (!caseAlreadyClosed) {
      try {
        caseStatusCompat = await updateCaseStatusCompat(admin, {
          caseId,
          status: "cancelled",
          updatedAt: now,
        })
      } catch (error) {
        return {
          ok: false,
          status: 400,
          error: error instanceof Error ? error.message : "case_status_update_failed",
        }
      }
    }

    return {
      ok: true,
      alreadyCancelled: true,
      invoice: existingInvoice,
      cancellationInvoice,
      emailSent: false,
      emailError: null,
      caseStatusApplied: caseStatusCompat?.appliedStatus ?? caseRow.status ?? null,
      caseStatusFallbackApplied: caseStatusCompat?.fallbackApplied ?? false,
    }
  }

  const [{ data: detailsRaw }, caseMeta] = await Promise.all([
    admin
      .from("case_schufa_free_details")
      .select("loan_amount_requested,street,house_number,zipcode,city")
      .eq("case_id", caseId)
      .maybeSingle(),
    getCaseMeta(caseId),
  ])

  const details = (detailsRaw ?? null) as DetailsRow | null
  const loanAmount = Number(existingInvoice.loan_amount ?? details?.loan_amount_requested ?? 0)
  const { grossAmount } = getSchufaFreeProvisionBreakdown(loanAmount)
  const absoluteTotalAmount = Math.abs(Number(existingInvoice.amount_total ?? grossAmount ?? 0))
  const originalInvoiceNumber =
    getSchufaFreeProvisionInvoiceNumber(existingInvoice.invoice_number) ?? trimOrNull(existingInvoice.id)?.slice(0, 8) ?? null
  const cancellationDescription = buildSchufaFreeProvisionCancellationDescription({
    loanAmount,
    originalInvoiceNumber,
  })
  const recipientName = caseMeta?.customer_name ?? trimOrNull(existingInvoice.recipient_name)
  const recipientEmail = caseMeta?.customer_email ?? trimOrNull(existingInvoice.recipient_email)

  const { data: insertedCancellationInvoiceRaw, error: insertCancellationError } = await admin
    .from("case_invoices")
    .insert({
      case_id: caseId,
      case_type: "schufa_frei",
      invoice_type: SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
      title: buildSchufaFreeProvisionCancellationInvoiceTitle(),
      description: cancellationDescription,
      status: "cancelled",
      loan_amount: loanAmount > 0 ? loanAmount : null,
      percentage_rate: SCHUFA_FREE_PROVISION_RATE,
      amount_total: -absoluteTotalAmount,
      currency: "EUR",
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      sent_at: now,
      paid_at: null,
      refunded_at: null,
      created_by: input.actorId ?? null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (insertCancellationError) {
    if (insertCancellationError.code === "23505") {
      return { ok: false, status: 409, error: "Rechnung wurde bereits storniert" }
    }
    if (isMissingCaseInvoicesTableError(insertCancellationError)) {
      return { ok: false, status: 503, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." }
    }
    if (isMissingCaseInvoiceNumberMigrationError(insertCancellationError)) {
      return {
        ok: false,
        status: 503,
        error: "DB-Migration fehlt: fortlaufende Rechnungsnummer in case_invoices ist noch nicht vorhanden.",
      }
    }
    return { ok: false, status: 400, error: insertCancellationError.message }
  }

  const insertedCancellationInvoice = insertedCancellationInvoiceRaw as CaseInvoiceRow
  const cancellationInvoiceNumber = getSchufaFreeProvisionInvoiceNumber(insertedCancellationInvoice.invoice_number)
  if (!cancellationInvoiceNumber) {
    return {
      ok: false,
      status: 503,
      error: "Stornorechnungsnummer konnte nicht erzeugt werden. Bitte DB-Migration pruefen.",
    }
  }

  let updatedOriginalInvoice = existingInvoice
  if (!originalInvoiceCancelled) {
    const { data: refreshedOriginalInvoiceRaw, error: originalUpdateError } = await admin
      .from("case_invoices")
      .update({
        status: "cancelled",
        paid_at: null,
        refunded_at: null,
        updated_at: now,
      })
      .eq("id", existingInvoice.id)
      .select("*")
      .single()

    if (originalUpdateError) {
      return { ok: false, status: 400, error: originalUpdateError.message }
    }

    updatedOriginalInvoice = refreshedOriginalInvoiceRaw as CaseInvoiceRow
  }

  let caseStatusCompat: { appliedStatus: string; fallbackApplied: boolean }
  try {
    caseStatusCompat = await updateCaseStatusCompat(admin, {
      caseId,
      status: "cancelled",
      updatedAt: now,
    })
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: error instanceof Error ? error.message : "case_status_update_failed",
    }
  }

  const siteOrigin = normalizeSiteOrigin(input.siteOrigin)
  const customerPortalUrl = `${siteOrigin}/app/faelle/${caseId}#schufa-vorauszahlung`
  const invoiceFileName = `Stornorechnung-${cancellationInvoiceNumber}.pdf`

  let emailSent = false
  let emailError: string | null = null

  if (recipientEmail) {
    const html = buildEmailHtml({
      title: "Ihre Kreditanfrage wurde storniert",
      intro: caseRow.case_ref
        ? `Ihr Vorgang ${caseRow.case_ref} wurde von uns storniert.`
        : "Ihre Kreditanfrage wurde von uns storniert.",
      bodyHtml: `
        <p style="margin:14px 0 0 0; font-size:14px; line-height:22px; color:#334155;">
          Die bereits erzeugte Vorauszahlungsrechnung wurde aufgehoben. Als Nachweis erhalten Sie die Stornorechnung im Anhang.
        </p>
        <p style="margin:14px 0 0 0; font-size:14px; line-height:22px; color:#334155;">
          Rechnungsnummer der Stornierung: <strong style="color:#0f172a;">${cancellationInvoiceNumber}</strong>
        </p>
      `,
      steps: [
        "Es sind keine weiteren Unterlagen oder Zahlungen mehr erforderlich.",
        "Die Kreditanfrage wird nicht weiterbearbeitet.",
        "Die Stornierung liegt zusätzlich im SEPANA-Dashboard vor.",
      ],
      ctaLabel: "Zum Kundendashboard",
      ctaUrl: customerPortalUrl,
      preheader: "Ihre Kreditanfrage und die zugehörige Rechnung wurden storniert.",
      eyebrow: "SEPANA - Stornierung",
      supportNote: "Die Stornorechnung hängt als PDF an dieser E-Mail.",
    })

    const pdfBytes = await renderSchufaFreeProvisionInvoicePdf({
      invoiceNumber: cancellationInvoiceNumber,
      createdAt: trimOrNull(insertedCancellationInvoice.created_at) ?? now,
      caseRef: trimOrNull(caseRow.case_ref) ?? cancellationInvoiceNumber,
      paymentReference: cancellationInvoiceNumber,
      recipientName,
      recipientEmail,
      recipientStreet: trimOrNull(details?.street),
      recipientHouseNumber: trimOrNull(details?.house_number),
      recipientZipcode: trimOrNull(details?.zipcode),
      recipientCity: trimOrNull(details?.city),
      loanAmount,
      amountTotal: Number(insertedCancellationInvoice.amount_total ?? -absoluteTotalAmount),
      status: trimOrNull(insertedCancellationInvoice.status),
      invoiceType: SCHUFA_FREE_PROVISION_CANCELLATION_INVOICE_TYPE,
      description: cancellationDescription,
    })

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: "Stornierung Ihrer Kreditanfrage",
      html,
      attachments: [
        {
          filename: invoiceFileName,
          content: Buffer.from(pdfBytes).toString("base64"),
        },
      ],
    }).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "mail_failed",
    }))

    emailSent = Boolean(emailResult?.ok)
    emailError = emailSent ? null : String(emailResult?.error ?? "mail_failed")
  } else {
    emailError = "missing_customer_email"
  }

  const eventCopy = buildCancellationEventCopy({
    automatic: input.automatic,
    automaticReason: input.automaticReason,
    emailSent,
    originalInvoiceCancelled,
  })

  await logCaseEvent({
    caseId,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    type: "schufa_free_provision_cancelled",
    title: eventCopy.title,
    body: eventCopy.body,
    meta: {
      invoice_id: updatedOriginalInvoice.id,
      cancellation_invoice_id: insertedCancellationInvoice.id,
      email_sent: emailSent,
      case_status_applied: caseStatusCompat.appliedStatus,
      case_status_fallback_applied: caseStatusCompat.fallbackApplied,
      automatic: input.automatic === true,
    },
    notifyAdvisor: false,
  })

  return {
    ok: true,
    alreadyCancelled: false,
    invoice: updatedOriginalInvoice,
    cancellationInvoice: insertedCancellationInvoice,
    emailSent,
    emailError,
    caseStatusApplied: caseStatusCompat.appliedStatus,
    caseStatusFallbackApplied: caseStatusCompat.fallbackApplied,
  }
}
