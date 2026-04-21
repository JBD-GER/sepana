"use client"

import { useState } from "react"

type DecisionType = "approved" | "rejected"

type FeedbackState =
  | { type: "success" | "error"; text: string }
  | null

const LABELS: Record<DecisionType, { idle: string; busy: string; success: string }> = {
  approved: {
    idle: "Vorprüfung erfolgreich senden",
    busy: "Versende Erfolgs-Mail...",
    success: "Erfolgs-Mail wurde an den Kunden versendet.",
  },
  rejected: {
    idle: "Vorprüfung fehlgeschlagen senden",
    busy: "Versende Absage-Mail...",
    success: "Absage-Mail wurde an den Kunden versendet.",
  },
}

export default function SchufaFreePrecheckDecisionPanel({ caseId }: { caseId: string }) {
  const [busyDecision, setBusyDecision] = useState<DecisionType | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  async function sendDecision(decision: DecisionType) {
    setBusyDecision(decision)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/precheck-decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, decision }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          json?.error === "customer_email_missing"
            ? "Beim Kunden ist keine E-Mail-Adresse hinterlegt."
            : json?.error === "case_type_not_supported"
              ? "Die Aktion ist nur für Kredit ohne Schufa verfügbar."
              : json?.error || "E-Mail konnte nicht versendet werden."
        )
      }

      setFeedback({ type: "success", text: LABELS[decision].success })
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "E-Mail konnte nicht versendet werden.",
      })
    } finally {
      setBusyDecision(null)
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="text-sm font-semibold text-slate-900">Kundenmail zur Vorprüfung</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Versenden Sie hier direkt die Rückmeldung zur Vorprüfung. Bei einer positiven Rückmeldung erhält der Kunde
            die nächsten Schritte bis zur Auszahlung. Bei einer negativen Rückmeldung wird sauber kommuniziert, dass
            aktuell keine positive Entscheidung vorliegt.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Inhalt der Erfolgs-Mail</div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>Kreditvertrag unterzeichnen</li>
            <li>PostIdent abschliessen</li>
            <li>Geld erhalten</li>
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => sendDecision("approved")}
          disabled={busyDecision !== null}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busyDecision === "approved" ? LABELS.approved.busy : LABELS.approved.idle}
        </button>

        <button
          type="button"
          onClick={() => sendDecision("rejected")}
          disabled={busyDecision !== null}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busyDecision === "rejected" ? LABELS.rejected.busy : LABELS.rejected.idle}
        </button>
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
