"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  buildInsuranceInvoicePaymentReference,
  calculateInsuranceNetAmountFromGrossAmount,
  calculateInsuranceVatAmountFromGrossAmount,
  formatEuro,
} from "@/lib/insurance/invoice"

type InvoiceRow = {
  id: string
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | null
  created_at?: string | null
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100) / 100
}

export default function InsuranceInvoicePanel({
  caseId,
  caseRef,
  partnerCode,
  invoice,
  editable = true,
}: {
  caseId: string
  caseRef: string | null
  partnerCode: string | null
  invoice: InvoiceRow | null
  editable?: boolean
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(invoice?.amount_total ? String(invoice.amount_total).replace(".", ",") : "")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const grossAmount = normalizeMoneyInput(amount)
  const netAmount = calculateInsuranceNetAmountFromGrossAmount(grossAmount)
  const vatAmount = calculateInsuranceVatAmountFromGrossAmount(grossAmount)
  const paymentReference = useMemo(
    () => buildInsuranceInvoicePaymentReference(partnerCode, caseRef),
    [caseRef, partnerCode]
  )

  async function save() {
    setMessage(null)
    if (!grossAmount) {
      setMessage("Bitte einen gueltigen Bruttobetrag eingeben.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/insurance/cases/${encodeURIComponent(caseId)}/invoice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", amountTotal: grossAmount }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Rechnung konnte nicht gespeichert werden.")
      setMessage("Interne Versicherungsrechnung gespeichert.")
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message ?? "Rechnung konnte nicht gespeichert werden.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Provision</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Versicherungsrechnung intern anlegen</h2>
          <p className="mt-1 text-sm text-slate-600">
            Bruttobetrag inkl. MwSt. manuell eingeben. Die Rechnung bleibt intern im Backend.
          </p>
        </div>
        {invoice?.id ? (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
            Rechnung {invoice.invoice_number ?? invoice.id.slice(0, 8)}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <label className="grid gap-1.5">
            <span className="text-xs text-slate-600">Bruttobetrag inkl. MwSt.</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="z.B. 357,00"
              disabled={!editable}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div>Fallnummer: <span className="font-medium text-slate-900">{caseRef ?? "-"}</span></div>
            <div className="mt-1">Partner-ID: <span className="font-medium text-slate-900">{partnerCode ?? "-"}</span></div>
            <div className="mt-1">Verwendungszweck: <span className="font-medium text-slate-900">{paymentReference || "-"}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">MwSt.-Aufteilung</div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span>Netto</span>
              <span className="font-semibold text-slate-900">{formatEuro(netAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>19 % MwSt.</span>
              <span className="font-semibold text-slate-900">{formatEuro(vatAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
              <span>Brutto</span>
              <span className="font-semibold text-slate-900">{formatEuro(grossAmount ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {editable ? (
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {loading ? "Speichere..." : invoice?.id ? "Rechnung aktualisieren" : "Rechnung anlegen"}
          </button>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Rechnungen koennen nur vom eingeloggten Versicherungspartner angelegt oder geaendert werden.
          </div>
        )}
        {invoice?.id ? (
          <a
            href={`/api/app/cases/invoices/${invoice.id}`}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Rechnung herunterladen
          </a>
        ) : null}
      </div>

      {message ? <div className="mt-3 text-sm text-slate-600">{message}</div> : null}
    </div>
  )
}
