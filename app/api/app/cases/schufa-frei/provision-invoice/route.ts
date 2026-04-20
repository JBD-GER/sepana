import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { renderSchufaFreeProvisionInvoicePdf } from "@/lib/schufa-frei/renderProvisionInvoicePdf"
import {
  SCHUFA_FREE_PROVISION_BANK,
  SCHUFA_FREE_PROVISION_INVOICE_TYPE,
  SCHUFA_FREE_PROVISION_RATE,
  SCHUFA_FREE_PROVISION_VAT_RATE,
  buildSchufaFreeProvisionDescription,
  buildSchufaFreeProvisionInvoiceTitle,
  buildSchufaFreeProvisionPaymentReference,
  formatEuro,
  formatPercent,
  getSchufaFreeProvisionBreakdown,
  getSchufaFreeProvisionInvoiceNumber,
  trimOrNull,
} from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type SupportedAction = "send" | "mark_paid" | "mark_refunded" | "mark_sent"

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

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  return new URL(req.url).origin
}

function isSupportedAction(value: string): value is SupportedAction {
  return value === "send" || value === "mark_paid" || value === "mark_refunded" || value === "mark_sent"
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const actionRaw = String(body?.action ?? "").trim().toLowerCase()

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }
  if (!isSupportedAction(actionRaw)) {
    return NextResponse.json({ ok: false, error: "Ungueltige Aktion" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) {
    return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  }
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { data: existingInvoice, error: invoiceLoadError } = await admin
    .from("case_invoices")
    .select("*")
    .eq("case_id", caseId)
    .eq("invoice_type", SCHUFA_FREE_PROVISION_INVOICE_TYPE)
    .maybeSingle()

  if (invoiceLoadError) {
    if (isMissingCaseInvoicesTableError(invoiceLoadError)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: invoiceLoadError.message }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (actionRaw !== "send") {
    if (!existingInvoice) {
      return NextResponse.json({ ok: false, error: "Rechnung noch nicht angelegt" }, { status: 404 })
    }

    const nextStatus = actionRaw === "mark_paid" ? "paid" : actionRaw === "mark_refunded" ? "refunded" : "sent"
    const patch =
      nextStatus === "paid"
        ? { status: "paid", paid_at: now, refunded_at: null, updated_at: now }
        : nextStatus === "refunded"
          ? { status: "refunded", refunded_at: now, updated_at: now }
          : { status: "sent", paid_at: null, refunded_at: null, updated_at: now }

    const { data: updatedInvoice, error: updateError } = await admin
      .from("case_invoices")
      .update(patch)
      .eq("id", existingInvoice.id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 })
    }

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type:
        nextStatus === "paid"
          ? "schufa_free_provision_paid"
          : nextStatus === "refunded"
            ? "schufa_free_provision_refunded"
            : "schufa_free_provision_reset",
      title:
        nextStatus === "paid"
          ? "Vorauszahlung bestaetigt"
          : nextStatus === "refunded"
            ? "Vorauszahlung erstattet"
            : "Vorauszahlungsstatus zurueckgesetzt",
      body:
        nextStatus === "paid"
          ? "Die Vorauszahlung wurde als eingegangen markiert. Der naechste Schritt ist jetzt der Vertrag."
          : nextStatus === "refunded"
            ? "Die Vorauszahlung wurde als erstattet markiert."
            : "Der Vorauszahlungsstatus wurde wieder auf offen gesetzt.",
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, invoice: updatedInvoice })
  }

  const [{ data: details }, caseMeta] = await Promise.all([
    admin
      .from("case_schufa_free_details")
      .select("loan_amount_requested,street,house_number,zipcode,city")
      .eq("case_id", caseId)
      .maybeSingle(),
    getCaseMeta(caseId),
  ])

  const loanAmount = Number(details?.loan_amount_requested ?? 0)
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdown(loanAmount)

  if (!Number.isFinite(loanAmount) || loanAmount <= 0 || grossAmount <= 0) {
    return NextResponse.json({ ok: false, error: "Kreditsumme fuer Vorauszahlungsrechnung fehlt." }, { status: 400 })
  }

  const recipientName = caseMeta?.customer_name ?? null
  const recipientEmail = caseMeta?.customer_email ?? null
  const description = buildSchufaFreeProvisionDescription(loanAmount)

  const { data: upsertedInvoice, error: upsertError } = await admin
    .from("case_invoices")
    .upsert(
      {
        case_id: caseId,
        case_type: "schufa_frei",
        invoice_type: SCHUFA_FREE_PROVISION_INVOICE_TYPE,
        title: buildSchufaFreeProvisionInvoiceTitle(),
        description,
        status: "sent",
        loan_amount: loanAmount,
        percentage_rate: SCHUFA_FREE_PROVISION_RATE,
        amount_total: grossAmount,
        currency: "EUR",
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        sent_at: now,
        paid_at: null,
        refunded_at: null,
        created_by: user.id,
        updated_at: now,
      },
      { onConflict: "case_id,invoice_type" }
    )
    .select("*")
    .single()

  if (upsertError) {
    if (isMissingCaseInvoicesTableError(upsertError)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: Tabelle case_invoices ist noch nicht vorhanden." },
        { status: 503 }
      )
    }
    if (isMissingCaseInvoiceNumberMigrationError(upsertError)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: fortlaufende Rechnungsnummer in case_invoices ist noch nicht vorhanden." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 400 })
  }

  const invoiceNumber = getSchufaFreeProvisionInvoiceNumber(upsertedInvoice.invoice_number)
  if (!invoiceNumber) {
    return NextResponse.json(
      { ok: false, error: "Rechnungsnummer konnte nicht erzeugt werden. Bitte DB-Migration pruefen." },
      { status: 503 }
    )
  }
  if (!/^\d+$/.test(invoiceNumber)) {
    return NextResponse.json(
      { ok: false, error: "Fortlaufende Rechnungsnummer fehlt noch. Bitte die neue DB-Migration ausfuehren." },
      { status: 503 }
    )
  }

  const paymentReference = buildSchufaFreeProvisionPaymentReference(invoiceNumber, caseId) ?? invoiceNumber
  const siteOrigin = resolveSiteOrigin(req)
  const customerPortalUrl = `${siteOrigin}/app/faelle/${caseId}#schufa-vorauszahlung`
  const invoiceDownloadUrl = `${siteOrigin}/api/app/cases/invoices/${upsertedInvoice.id}`
  const invoiceFileName = `Rechnung-${invoiceNumber}.pdf`

  let emailSent = false
  let emailError: string | null = null

  if (recipientEmail) {
    const paymentHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
        <tr>
          <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
            <div style="font-size:13px; color:#334155; line-height:21px;">
              <div><strong style="color:#0f172a;">Zwischensumme netto:</strong> ${formatEuro(netAmount)}</div>
              <div><strong style="color:#0f172a;">zzgl. MwSt.:</strong> ${formatEuro(vatAmount)} (${formatPercent(SCHUFA_FREE_PROVISION_VAT_RATE)})</div>
              <div><strong style="color:#0f172a;">Gesamtbetrag:</strong> ${formatEuro(grossAmount)}</div>
              <div><strong style="color:#0f172a;">Kontoinhaber:</strong> ${SCHUFA_FREE_PROVISION_BANK.accountHolder}</div>
              <div><strong style="color:#0f172a;">IBAN:</strong> ${SCHUFA_FREE_PROVISION_BANK.iban}</div>
              <div><strong style="color:#0f172a;">BIC:</strong> ${SCHUFA_FREE_PROVISION_BANK.bic}</div>
              <div><strong style="color:#0f172a;">Rechnungsnummer:</strong> ${invoiceNumber}</div>
              <div><strong style="color:#0f172a;">Verwendungszweck:</strong> ${paymentReference}</div>
            </div>
          </td>
        </tr>
      </table>
    `

    const html = buildEmailHtml({
      title: "Vorauszahlung vor dem Vertragsversand",
      intro: caseRow.case_ref
        ? `Fuer Ihren Fall ${caseRow.case_ref} ist jetzt die Vorauszahlung in Hoehe von ${formatEuro(grossAmount)} faellig.`
        : `Fuer Ihren Fall ist jetzt die Vorauszahlung in Hoehe von ${formatEuro(grossAmount)} faellig.`,
      bodyHtml: `${paymentHtml}
        <p style="margin:14px 0 0 0; font-size:14px; line-height:22px; color:#334155;">
          Bitte beachten Sie: Es handelt sich um eine Vorauszahlung auf die Serviceprovision in Hoehe von ${formatPercent(
            SCHUFA_FREE_PROVISION_RATE
          )} netto zuzueglich ${formatPercent(
            SCHUFA_FREE_PROVISION_VAT_RATE
          )} MwSt. Der naechste Schritt erfolgt erst nach bestaetigtem Zahlungseingang. Falls keine positive Rueckmeldung der SIGMA Kreditbank AG vorliegt und keine Auszahlung stattfindet, oder wenn der Vertrag fristgerecht widerrufen wurde, wird der Betrag erstattet.
        </p>`,
      steps: [
        `Ueberweisen Sie ${formatEuro(grossAmount)} mit dem Verwendungszweck ${paymentReference}.`,
        "Sobald der Zahlungseingang bestaetigt ist, geht der Fall in den Vertragsprozess.",
        "Die Rechnung und der Status liegen zusaetzlich in Ihrem SEPANA-Dashboard bereit.",
      ],
      ctaLabel: "Zum Kundendashboard",
      ctaUrl: customerPortalUrl,
      preheader: "Bitte leisten Sie jetzt die Vorauszahlung fuer Ihren Schufa-frei-Fall.",
      eyebrow: "SEPANA - Vorauszahlung",
      supportNote: "Die Rechnung haengt zusaetzlich als PDF an dieser E-Mail und liegt jederzeit auch in Ihrem Dashboard bereit.",
    })

    const emailResult = await (async () => {
      const pdfBytes = await renderSchufaFreeProvisionInvoicePdf({
        invoiceNumber,
        createdAt: upsertedInvoice.created_at,
        caseId,
        caseRef: trimOrNull(caseRow.case_ref) ?? invoiceNumber,
        paymentReference,
        recipientName,
        recipientEmail,
        recipientStreet: trimOrNull(details?.street),
        recipientHouseNumber: trimOrNull(details?.house_number),
        recipientZipcode: trimOrNull(details?.zipcode),
        recipientCity: trimOrNull(details?.city),
        loanAmount,
        amountTotal: grossAmount,
        status: trimOrNull(upsertedInvoice.status),
      })

      return sendEmail({
        to: recipientEmail,
        subject: "Vorauszahlungsrechnung fuer Ihren Kreditantrag",
        html,
        attachments: [
          {
            filename: invoiceFileName,
            content: Buffer.from(pdfBytes).toString("base64"),
          },
        ],
      })
    })().catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "mail_failed",
    }))

    emailSent = Boolean(emailResult?.ok)
    emailError = emailSent ? null : String(emailResult?.error ?? "mail_failed")
  } else {
    emailError = "missing_customer_email"
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "schufa_free_provision_invoice_sent",
    title: "Vorauszahlungsrechnung bereitgestellt",
    body: emailSent
      ? "Die Vorauszahlungsrechnung wurde im Dashboard hinterlegt und zusaetzlich per E-Mail versendet."
      : "Die Vorauszahlungsrechnung wurde im Dashboard hinterlegt.",
    meta: {
      invoice_id: upsertedInvoice.id,
      invoice_download_url: invoiceDownloadUrl,
      email_sent: emailSent,
    },
    notifyAdvisor: false,
  })

  return NextResponse.json({
    ok: true,
    invoice: upsertedInvoice,
    emailSent,
    emailError,
    invoiceDownloadUrl,
  })
}
