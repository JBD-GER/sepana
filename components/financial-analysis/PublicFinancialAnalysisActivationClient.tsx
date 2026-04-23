"use client"

import { useState } from "react"
import Link from "next/link"

type ServiceSnapshot = {
  service_status?: string | null
  customer_confirmed_at?: string | null
}

type FeedbackState = { type: "success" | "error"; text: string } | null

export default function PublicFinancialAnalysisActivationClient({
  token,
  initialService,
  portalHref,
}: {
  token: string
  initialService: ServiceSnapshot
  portalHref: string
}) {
  const [busy, setBusy] = useState(false)
  const [service, setService] = useState<ServiceSnapshot>(initialService)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const serviceStatus = String(service.service_status ?? "").trim().toLowerCase()
  const alreadyConfirmed = Boolean(service.customer_confirmed_at)
  const isActive = serviceStatus === "active"

  async function confirm() {
    setBusy(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/financial-analysis/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error === "financial_analysis_not_available"
            ? "Dieser Service steht nicht mehr zur Verfügung."
            : json?.error === "case_invoices_missing" || json?.error === "case_invoice_number_missing"
              ? "Die Rechnung konnte gerade technisch noch nicht erstellt werden."
              : json?.error || "Bestätigung fehlgeschlagen."
        )
      }

      setService(json.service ?? service)
      setFeedback({
        type: "success",
        text:
          String(json?.service?.service_status ?? "").trim().toLowerCase() === "active"
            ? "Danke. Die Finanzanalyse ist jetzt freigeschaltet."
            : json?.invoiceEmailSent
              ? "Danke. Ihre Bestätigung liegt vor. Die Rechnung wurde gerade per E-Mail versendet. Nach Zahlungseingang wird der Bereich freigeschaltet."
              : "Danke. Ihre Bestätigung liegt vor. Die Rechnung wird separat versendet. Nach Zahlungseingang wird der Bereich freigeschaltet.",
      })
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Bestätigung fehlgeschlagen.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-sm font-semibold text-slate-900">Aktive Bestätigung</div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Bitte bestätigen Sie den Zusatzservice aktiv. Direkt danach wird automatisch Ihre Rechnung erstellt und per
        E-Mail versendet. Der Bereich im Kundendashboard wird erst nach interner Zahlungsmarkierung freigeschaltet.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={confirm}
          disabled={busy || alreadyConfirmed}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Bestätige..." : alreadyConfirmed ? "Bereits bestätigt" : "Finanzanalyse aktiv bestätigen"}
        </button>

        {isActive ? (
          <Link
            href={portalHref}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300"
          >
            Zum Dashboard
          </Link>
        ) : null}
      </div>

      {feedback ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  )
}
