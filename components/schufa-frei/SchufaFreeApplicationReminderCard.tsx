"use client"

import { useState } from "react"
import type { SchufaFreeCompletedOtherApplication } from "@/lib/schufa-frei/applicationReminder"

type FeedbackState = { type: "success" | "error"; text: string } | null

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  } catch {
    return value
  }
}

function resolveErrorText(value: unknown) {
  const code = String(value ?? "").trim()
  if (code === "mail_not_configured") return "Mailversand ist derzeit nicht konfiguriert."
  if (code === "customer_email_missing") return "Beim Kunden ist keine E-Mail-Adresse hinterlegt."
  if (code === "application_already_completed") return "Der Kunde hat das zweite Formular bereits abgeschlossen."
  if (code === "application_already_completed_for_other_request") {
    return "Mit dieser E-Mail wurde bereits ein anderer Schufa-frei-Antrag abgeschlossen."
  }
  if (code === "case_type_not_supported") return "Die Aktion ist nur fuer Kredit ohne Schufa verfuegbar."
  if (code === "case_ref_missing") return "Fuer diesen Fall fehlt aktuell die Fallnummer."
  if (code === "Forbidden" || code === "not_allowed") return "Sie haben keine Berechtigung fuer diesen Fall."
  return code || "E-Mail konnte nicht versendet werden."
}

function formatOtherApplicationLabel(value: SchufaFreeCompletedOtherApplication | null | undefined) {
  if (!value) return null
  const finishedAt = value.submittedToSkagAt ?? value.completedApplicationAt ?? null
  const finishedLabel = formatDateTime(finishedAt)
  if (value.caseRef && finishedLabel) return `Bereits fuer andere Anfrage abgeschlossen: ${value.caseRef} (${finishedLabel})`
  if (value.caseRef) return `Bereits fuer andere Anfrage abgeschlossen: ${value.caseRef}`
  if (finishedLabel) return `Bereits fuer andere Anfrage abgeschlossen: ${finishedLabel}`
  return "Bereits fuer andere Anfrage abgeschlossen."
}

export default function SchufaFreeApplicationReminderCard({
  caseId,
  completedApplicationAt = null,
  submittedToSkagAt = null,
  lastSentAt = null,
  otherCompletedApplication = null,
  compact = false,
}: {
  caseId: string
  completedApplicationAt?: string | null
  submittedToSkagAt?: string | null
  lastSentAt?: string | null
  otherCompletedApplication?: SchufaFreeCompletedOtherApplication | null
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [lastReminderAt, setLastReminderAt] = useState<string | null>(lastSentAt)

  const completedAt = submittedToSkagAt ?? completedApplicationAt ?? null
  const isCompleted = Boolean(completedAt)
  const isCompletedForOtherRequest = Boolean(otherCompletedApplication)
  const completedLabel = formatDateTime(completedAt)
  const lastReminderLabel = formatDateTime(lastReminderAt)
  const otherCompletedLabel = formatOtherApplicationLabel(otherCompletedApplication)

  async function sendReminder() {
    if (!caseId || busy || isCompleted || isCompletedForOtherRequest) return
    setBusy(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/application-reminder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(resolveErrorText(json?.error))
      }

      const sentAt = typeof json?.sentAt === "string" && json.sentAt.trim() ? json.sentAt : new Date().toISOString()
      setLastReminderAt(sentAt)
      setFeedback({ type: "success", text: "Erinnerung wurde an den Kunden versendet." })
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "E-Mail konnte nicht versendet werden.",
      })
    } finally {
      setBusy(false)
    }
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {isCompleted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Antrag abgeschlossen{completedLabel ? `: ${completedLabel}` : "."}
          </div>
        ) : isCompletedForOtherRequest ? (
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-900">
            {otherCompletedLabel}
          </div>
        ) : (
          <button
            type="button"
            onClick={sendReminder}
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Versende Erinnerung..." : "Erinnerung senden"}
          </button>
        )}

        {lastReminderLabel ? <div className="text-[11px] text-slate-500">Zuletzt erinnert: {lastReminderLabel}</div> : null}

        {feedback ? (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
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

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="text-sm font-semibold text-slate-900">Direktlink zum zweiten Formular</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Wenn der Kunde nach positiver Vorpruefung nicht weitergemacht hat, koennen Sie hier direkt eine Erinnerung mit
            Link zum offenen Schufa-frei-Antrag versenden.
          </p>
          {isCompleted ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Der Antrag wurde bereits abgeschlossen{completedLabel ? ` am ${completedLabel}` : ""}. Eine Erinnerung ist nicht mehr noetig.
            </div>
          ) : isCompletedForOtherRequest ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900">
              Mit dieser E-Mail wurde bereits ein anderer Schufa-frei-Antrag abgeschlossen. Fuer diesen offenen Duplikatfall
              wird keine Erinnerung mehr versendet.
              {otherCompletedLabel ? <div className="mt-2 text-xs text-slate-600">{otherCompletedLabel}</div> : null}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Das zweite Formular ist aktuell noch offen. Der Kunde erhaelt per E-Mail einen direkten Link zurueck in den Antrag.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reminder-Status</div>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <div>
              {isCompleted
                ? "Antrag bereits abgeschlossen"
                : isCompletedForOtherRequest
                  ? "Bereits ueber andere Anfrage abgeschlossen"
                  : "Zweitformular noch offen"}
            </div>
            {otherCompletedLabel ? <div>{otherCompletedLabel}</div> : null}
            <div>{lastReminderLabel ? `Zuletzt erinnert: ${lastReminderLabel}` : "Bisher wurde noch keine Erinnerung versendet."}</div>
          </div>
        </div>
      </div>

      {!isCompleted && !isCompletedForOtherRequest ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={sendReminder}
            disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {busy ? "Versende Erinnerung..." : "Erinnerung zum offenen Antrag senden"}
          </button>
        </div>
      ) : null}

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
