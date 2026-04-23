"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import {
  formatEuro,
  getSchufaFreeProvisionBreakdownFromGrossAmount,
  getSchufaFreeProvisionInvoiceNumber,
  getSchufaFreeProvisionStatusLabel,
  getSchufaFreeServiceFeeInfoLines,
  isSchufaFreeProvisionPaid,
} from "@/lib/schufa-frei/provisionInvoice"

type InvoiceRow = {
  id: string
  invoice_type?: string | null
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | null
  created_at?: string | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
} | null

type FeedbackState = { type: "success" | "error"; text: string } | null

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function normalizeMoneyInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\s+/g, "").replace(/\./g, "").replace(",", ".")
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric * 100) / 100
}

function toMoneyInput(value: number | null | undefined) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || numeric <= 0) return ""
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
}

function StatCard({
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
  const toneClass = tone === "accent" ? "border-cyan-200/80 bg-cyan-50/70" : "border-slate-200/80 bg-white/90"

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</div> : null}
    </div>
  )
}

export default function SchufaFreeServiceFeePanel({
  caseId,
  invoice,
  cancellationInvoice,
}: {
  caseId: string
  invoice?: InvoiceRow
  cancellationInvoice?: InvoiceRow
}) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [draftGrossAmount, setDraftGrossAmount] = useState<string>(toMoneyInput(invoice?.amount_total ?? null))

  const normalizedStatus = String(invoice?.status ?? "").trim().toLowerCase()
  const isPaid = isSchufaFreeProvisionPaid(normalizedStatus)
  const isRefunded = normalizedStatus === "refunded"
  const isCancelled = normalizedStatus === "cancelled" || Boolean(cancellationInvoice?.id)
  const invoiceNumber = getSchufaFreeProvisionInvoiceNumber(invoice?.invoice_number)
  const cancellationInvoiceNumber = getSchufaFreeProvisionInvoiceNumber(cancellationInvoice?.invoice_number)
  const parsedGrossAmount = normalizeMoneyInput(draftGrossAmount)
  const effectiveGrossAmount =
    parsedGrossAmount ?? Math.abs(Number(invoice?.amount_total ?? cancellationInvoice?.amount_total ?? 0)) ?? 0
  const { netAmount, vatAmount, grossAmount } = getSchufaFreeProvisionBreakdownFromGrossAmount(effectiveGrossAmount)
  const statusLabel = getSchufaFreeProvisionStatusLabel(invoice?.status, invoice?.invoice_type)
  const invoiceHref = invoice?.id ? `/api/app/cases/invoices/${invoice.id}` : null
  const cancellationInvoiceHref = cancellationInvoice?.id ? `/api/app/cases/invoices/${cancellationInvoice.id}` : null
  const canEditAmount = !invoice?.id || normalizedStatus === "sent" || isCancelled

  async function runAction(action: "save" | "recreate" | "mark_paid" | "mark_refunded" | "mark_open") {
    setBusyAction(action)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/provision-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          action,
          amountTotal: action === "save" || action === "recreate" ? parsedGrossAmount : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          json?.error === "amount_total_invalid"
            ? "Bitte einen gueltigen Bruttobetrag fuer die Servicepauschale eingeben."
            : json?.error || "Aktion fehlgeschlagen."
        )
      }

      if (action === "save") {
        setFeedback({
          type: "success",
          text: "Rechnung wurde intern gespeichert. Gesonderter Vermittlungsauftrag und Vertragsbereich sind jetzt freigeschaltet.",
        })
      } else if (action === "recreate") {
        setFeedback({
          type: "success",
          text: "Neue Rechnung wurde angelegt. Gesonderter Vermittlungsauftrag und Vertragsbereich sind wieder freigeschaltet.",
        })
      } else if (action === "mark_paid") {
        setFeedback({ type: "success", text: "Zahlungseingang wurde bestaetigt." })
      } else if (action === "mark_refunded") {
        setFeedback({ type: "success", text: "Erstattung wurde markiert." })
      } else {
        setFeedback({ type: "success", text: "Status wurde wieder auf offen gesetzt." })
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

  return (
    <div className="rounded-[28px] border border-cyan-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_36%),linear-gradient(180deg,#ffffff,#f8fcff)] p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isCancelled ? "Servicepauschale storniert" : "Servicepauschale intern verwalten"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Der Berater erfasst hier den Bruttobetrag inklusive MwSt. Die Rechnung wird nur intern im Backend
              angelegt. Mit dem Speichern werden gesonderter Vermittlungsauftrag und Vertragsbereich freigeschaltet.
              Faellig wird die Servicepauschale erst nach Kreditauszahlung. Der Kunde erhaelt dazu keine automatische
              Benachrichtigung.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Nettobetrag" value={formatEuro(netAmount)} />
                <StatCard label="MwSt." value={formatEuro(vatAmount)} hint="19 % enthalten" />
                <StatCard label="Gesamtbetrag" value={formatEuro(grossAmount)} hint="Bruttobetrag" tone="accent" />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel}</div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <div>Rechnungsnummer: {invoiceNumber ?? "-"}</div>
                  <div>Angelegt: {formatDateTime(invoice?.created_at)}</div>
                  <div>Bezahlt: {formatDateTime(invoice?.paid_at)}</div>
                  <div>Erstattet: {formatDateTime(invoice?.refunded_at)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bruttobetrag inkl. MwSt.</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draftGrossAmount}
                  onChange={(event) => setDraftGrossAmount(event.target.value)}
                  disabled={!canEditAmount}
                  placeholder="z. B. 399,00"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {!isCancelled ? (
                  <button
                    type="button"
                    onClick={() => runAction("save")}
                    disabled={busyAction !== null || !parsedGrossAmount || !canEditAmount}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "save"
                      ? "Speichere..."
                      : invoice?.id
                        ? "Rechnung aktualisieren"
                        : "Rechnung intern anlegen"}
                  </button>
                ) : null}

                {isCancelled ? (
                  <button
                    type="button"
                    onClick={() => runAction("recreate")}
                    disabled={busyAction !== null || !parsedGrossAmount}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "recreate" ? "Erstelle..." : "Neue Rechnung"}
                  </button>
                ) : null}

                {!isCancelled && !isPaid ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_paid")}
                    disabled={busyAction !== null || !invoice?.id}
                    className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "mark_paid" ? "Bestaetige..." : "Als bezahlt markieren"}
                  </button>
                ) : null}

                {!isCancelled && isPaid ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_refunded")}
                    disabled={busyAction !== null || !invoice?.id}
                    className="inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "mark_refunded" ? "Markiere..." : "Erstattung markieren"}
                  </button>
                ) : null}

                {!isCancelled && isRefunded ? (
                  <button
                    type="button"
                    onClick={() => runAction("mark_open")}
                    disabled={busyAction !== null || !invoice?.id}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "mark_open" ? "Setze zurueck..." : "Auf offen zuruecksetzen"}
                  </button>
                ) : null}

                {invoiceHref ? (
                  <a
                    href={invoiceHref}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                  >
                    Rechnung herunterladen
                  </a>
                ) : null}

                {cancellationInvoiceHref ? (
                  <a
                    href={cancellationInvoiceHref}
                    className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-900 shadow-sm transition hover:border-rose-300"
                  >
                    Stornorechnung herunterladen
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Interner Hinweis</div>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
              {getSchufaFreeServiceFeeInfoLines().map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Storno</div>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
              <div>Die Stornierung bleibt im Admin verfuegbar.</div>
              <div>Nach einer Stornierung kann der Berater hier direkt wieder eine neue gueltige Rechnung anlegen.</div>
              <div>Stornorechnung: {cancellationInvoiceNumber ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
