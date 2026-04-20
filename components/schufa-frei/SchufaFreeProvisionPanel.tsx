"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SCHUFA_FREE_PROVISION_BANK,
  SCHUFA_FREE_PROVISION_RATE,
  SCHUFA_FREE_PROVISION_VAT_RATE,
  buildSchufaFreeProvisionPaymentReference,
  formatEuro,
  formatPercent,
  getSchufaFreeProvisionBreakdown,
  getSchufaFreeProvisionRefundLines,
  getSchufaFreeProvisionStatusLabel,
  getSchufaFreeProvisionInvoiceNumber,
  isSchufaFreeProvisionPaid,
} from "@/lib/schufa-frei/provisionInvoice"

type InvoiceRow = {
  id: string
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | null
  loan_amount?: number | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
}

type FeedbackState =
  | { type: "success" | "warning" | "error"; text: string }
  | null

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function BreakdownRow({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "accent"
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-200/80 bg-cyan-50/70"
      : "border-slate-200/80 bg-white/90"

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</div> : null}
    </div>
  )
}

export default function SchufaFreeProvisionPanel({
  mode,
  caseId,
  caseRef,
  loanAmount,
  invoice,
}: {
  mode: "advisor" | "customer"
  caseId?: string
  caseRef?: string | null
  loanAmount?: number | null
  invoice?: InvoiceRow | null
}) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const normalizedStatus = String(invoice?.status ?? "").trim().toLowerCase()
  const isPaid = isSchufaFreeProvisionPaid(normalizedStatus)
  const isRefunded = normalizedStatus === "refunded"
  const isSent = normalizedStatus === "sent"
  const statusLabel = getSchufaFreeProvisionStatusLabel(invoice?.status)
  const effectiveLoanAmount = Number(invoice?.loan_amount ?? loanAmount ?? 0)
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdown(effectiveLoanAmount)
  const invoiceHref = invoice?.id ? `/api/app/cases/invoices/${invoice.id}` : null
  const invoiceNumber = getSchufaFreeProvisionInvoiceNumber(invoice?.invoice_number)
  const paymentReference = buildSchufaFreeProvisionPaymentReference(invoiceNumber, caseId) ?? caseRef ?? invoiceNumber

  async function runAction(action: "send" | "mark_paid" | "mark_refunded" | "mark_sent") {
    if (!caseId) {
      setFeedback({ type: "error", text: "Fall-ID fehlt." })
      return
    }

    setBusyAction(action)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/provision-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Aktion fehlgeschlagen.")
      }

      if (action === "send") {
        setFeedback({
          type: json?.emailSent ? "success" : "warning",
          text: json?.emailSent
            ? "Vorauszahlungsrechnung gespeichert und per E-Mail versendet."
            : "Vorauszahlungsrechnung gespeichert. Die E-Mail konnte nicht versendet werden.",
        })
      } else if (action === "mark_paid") {
        setFeedback({ type: "success", text: "Zahlungseingang wurde bestätigt." })
      } else if (action === "mark_refunded") {
        setFeedback({ type: "success", text: "Erstattung wurde markiert." })
      } else {
        setFeedback({ type: "success", text: "Vorauszahlungsstatus wurde zurückgesetzt." })
      }

      startTransition(() => router.refresh())
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Aktion fehlgeschlagen.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  const toneClass = isPaid
    ? "border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(180deg,#ffffff,#f0fdf4)]"
    : isRefunded
      ? "border-amber-200/80 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_35%),linear-gradient(180deg,#ffffff,#fffbeb)]"
      : isSent
        ? "border-cyan-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#ffffff,#f8fcff)]"
        : "border-slate-200/70 bg-white"

  if (mode === "advisor") {
    return (
      <div className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${toneClass}`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Vorauszahlungsrechnung vor dem Vertrag</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Nach vollständigem Dokumenteneingang wird zuerst die Vorauszahlungsrechnung versendet. Der Vertrag wird
                erst freigegeben, wenn der Zahlungseingang bestätigt wurde.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <BreakdownRow
                    label="Zwischensumme"
                    value={formatEuro(netAmount)}
                    hint={`${formatPercent(SCHUFA_FREE_PROVISION_RATE)} netto von ${formatEuro(effectiveLoanAmount)}`}
                  />
                  <BreakdownRow
                    label="MwSt."
                    value={formatEuro(vatAmount)}
                    hint={`${formatPercent(SCHUFA_FREE_PROVISION_VAT_RATE)} Umsatzsteuer`}
                  />
                  <BreakdownRow
                    label="Überweisungsbetrag"
                    value={formatEuro(grossAmount)}
                    hint="Gesamtbetrag inkl. MwSt."
                    tone="accent"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel}</div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>Versand: {formatDateTime(invoice?.sent_at)}</div>
                    <div>Zahlung: {formatDateTime(invoice?.paid_at)}</div>
                    <div>Rechnungsnummer: {invoiceNumber ?? "-"}</div>
                    <div>Verwendungszweck: {paymentReference ?? "-"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={() => runAction("send")}
                  disabled={busyAction !== null}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {busyAction === "send"
                    ? "Versende..."
                    : invoice?.id
                      ? "Rechnung erneut senden"
                      : "Vorauszahlungsrechnung senden"}
                </button>

                {!isPaid ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_paid")}
                    disabled={busyAction !== null || !invoice?.id}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {busyAction === "mark_paid" ? "Bestätige..." : "Als bezahlt markieren"}
                  </button>
                ) : null}

                {isPaid ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_refunded")}
                    disabled={busyAction !== null || !invoice?.id}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {busyAction === "mark_refunded" ? "Markiere..." : "Erstattung markieren"}
                  </button>
                ) : null}

                {(isSent || isRefunded) && invoice?.id ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_sent")}
                    disabled={busyAction !== null}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {busyAction === "mark_sent" ? "Setze zurück..." : "Auf offen zurücksetzen"}
                  </button>
                ) : null}

                {invoiceHref ? (
                  <a
                    href={invoiceHref}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 sm:w-auto"
                  >
                    Rechnung herunterladen
                  </a>
                ) : null}
              </div>
            </div>

            {feedback ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : feedback.type === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                {feedback.text}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Banküberweisung an</div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <div>{SCHUFA_FREE_PROVISION_BANK.accountHolder}</div>
                <div>IBAN: {SCHUFA_FREE_PROVISION_BANK.iban}</div>
                <div>BIC: {SCHUFA_FREE_PROVISION_BANK.bic}</div>
                <div>Rechnungsnummer: {invoiceNumber ?? "-"}</div>
                <div>Verwendungszweck: {paymentReference ?? "-"}</div>
              </div>
              <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-semibold text-cyan-900">
                Überweisungsbetrag: {formatEuro(grossAmount)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rückerstattung</div>
              <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
                {getSchufaFreeProvisionRefundLines().map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${toneClass}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isPaid ? "Vorauszahlung bestätigt" : isRefunded ? "Vorauszahlung wurde erstattet" : "Vorauszahlung vor dem Vertrag"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {isPaid
                ? "Der Zahlungseingang wurde bestätigt. Als Nächstes wird dein Vertrag bereitgestellt."
                : isRefunded
                  ? "Die Vorauszahlung wurde im Fall als erstattet markiert."
                  : invoice?.id
                    ? "Es geht erst weiter, wenn die Vorauszahlung bei uns eingegangen ist. Erst danach wird der Vertrag freigegeben."
                    : "Sobald deine Unterlagen vollständig geprüft sind, erhältst du hier die Vorauszahlungsrechnung und die Zahlungsdaten."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <BreakdownRow
                label="Zwischensumme"
                value={formatEuro(netAmount)}
                hint={`${formatPercent(SCHUFA_FREE_PROVISION_RATE)} netto von ${formatEuro(effectiveLoanAmount)}`}
              />
              <BreakdownRow
                label="MwSt."
                value={formatEuro(vatAmount)}
                hint={`${formatPercent(SCHUFA_FREE_PROVISION_VAT_RATE)} Umsatzsteuer`}
              />
              <BreakdownRow
                label="Gesamtbetrag"
                value={formatEuro(grossAmount)}
                hint="Überweisungsbetrag inkl. MwSt."
                tone="accent"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel}</div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <div>Versand: {formatDateTime(invoice?.sent_at)}</div>
                  <div>Zahlung: {formatDateTime(invoice?.paid_at)}</div>
                  <div>Rechnungsnummer: {invoiceNumber ?? "-"}</div>
                  <div>Verwendungszweck: {paymentReference ?? "-"}</div>
                </div>
              </div>

              {invoiceHref ? (
                <a
                  href={invoiceHref}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition sm:w-auto"
                >
                  Rechnung herunterladen
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Banküberweisung an</div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <div>{SCHUFA_FREE_PROVISION_BANK.accountHolder}</div>
              <div>IBAN: {SCHUFA_FREE_PROVISION_BANK.iban}</div>
              <div>BIC: {SCHUFA_FREE_PROVISION_BANK.bic}</div>
              <div>Rechnungsnummer: {invoiceNumber ?? "-"}</div>
              <div>Verwendungszweck: {paymentReference ?? "-"}</div>
            </div>
            <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-semibold text-cyan-900">
              Überweisungsbetrag: {formatEuro(grossAmount)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Wichtiger Hinweis</div>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
              <div>Es handelt sich um eine Vorauszahlung auf die Serviceprovision inklusive 19 % MwSt.</div>
              {getSchufaFreeProvisionRefundLines().map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
