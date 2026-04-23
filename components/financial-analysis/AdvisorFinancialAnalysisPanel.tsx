"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  formatFinancialAnalysisPrice,
  getFinancialAnalysisAnalysisStatusLabel,
  getFinancialAnalysisDocumentKindLabel,
  getFinancialAnalysisServiceStatusLabel,
  trimOrNull,
  type FinancialAnalysisDocumentRow,
  type FinancialAnalysisServiceRow,
} from "@/lib/financial-analysis/service"

type FeedbackState = { type: "success" | "error"; text: string } | null

function formatDateTime(value: string | null | undefined) {
  const normalized = trimOrNull(value)
  if (!normalized) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(normalized))
}

function downloadHref(path: string | null | undefined, fileName: string | null | undefined) {
  const normalizedPath = trimOrNull(path)
  if (!normalizedPath) return null
  const fileNamePart = trimOrNull(fileName) ? `&filename=${encodeURIComponent(String(fileName))}` : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(normalizedPath)}&raw=1&download=1${fileNamePart}`
}

export default function AdvisorFinancialAnalysisPanel({
  caseId,
  service,
  documents,
}: {
  caseId: string
  service: FinancialAnalysisServiceRow | null
  documents: FinancialAnalysisDocumentRow[]
}) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [offerSummary, setOfferSummary] = useState(service?.offer_summary ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY)
  const [householdOverview, setHouseholdOverview] = useState(service?.published_household_overview ?? "")
  const [recommendations, setRecommendations] = useState(service?.published_recommendations ?? "")
  const [actionPlan, setActionPlan] = useState(service?.published_action_plan ?? "")
  const [schufaNotes, setSchufaNotes] = useState(service?.published_schufa_notes ?? "")

  const serviceStatus = String(service?.service_status ?? "").trim().toLowerCase()
  const isActive = serviceStatus === "active"
  const canPublish =
    Boolean(service?.id) &&
    isActive &&
    [householdOverview, recommendations, actionPlan, schufaNotes].some((value) => Boolean(trimOrNull(value)))

  async function runAction(
    action: "create_offer" | "send_offer_email" | "mark_payment_received" | "publish_results"
  ) {
    setBusyAction(action)
    setFeedback(null)

    try {
      const response = await fetch("/api/app/cases/schufa-frei/financial-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          action,
          offerSummary,
          publishedHouseholdOverview: action === "publish_results" ? householdOverview : undefined,
          publishedRecommendations: action === "publish_results" ? recommendations : undefined,
          publishedActionPlan: action === "publish_results" ? actionPlan : undefined,
          publishedSchufaNotes: action === "publish_results" ? schufaNotes : undefined,
        }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json?.ok) {
        throw new Error(
          json?.error === "customer_email_missing"
            ? "Beim Kunden ist keine E-Mail-Adresse hinterlegt."
            : json?.error === "mail_not_configured"
              ? "Der E-Mail-Versand ist noch nicht konfiguriert."
              : json?.error === "financial_analysis_not_active"
                ? "Die Finanzanalyse ist noch nicht aktiv. Bitte zuerst Kundenbestaetigung und Zahlung abschliessen."
                : json?.error === "financial_analysis_content_missing"
                  ? "Bitte mindestens einen Auswertungsbereich befuellen."
                  : json?.error || "Aktion fehlgeschlagen."
        )
      }

      if (action === "create_offer") {
        setFeedback({ type: "success", text: "Das Angebot fuer die Finanzanalyse wurde gespeichert." })
      } else if (action === "send_offer_email") {
        setFeedback({
          type: "success",
          text: `Die separate Aktivierungsmail wurde an ${String(json?.sentTo ?? "den Kunden")} versendet.`,
        })
      } else if (action === "mark_payment_received") {
        setFeedback({
          type: "success",
          text:
            String(json?.service?.service_status ?? "").trim().toLowerCase() === "active"
              ? "Zahlung markiert. Die Finanzanalyse ist jetzt aktiv."
              : "Zahlung wurde markiert. Es fehlt noch die aktive Kundenbestaetigung.",
        })
      } else {
        setFeedback({ type: "success", text: "Die Auswertung wurde fuer den Kunden im Dashboard veroeffentlicht." })
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">{FINANCIAL_ANALYSIS_SERVICE_TITLE}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Getrennter Zusatzservice fuer persoenliche Finanzanalyse, Haushaltsrechnung und 90-Tage-Massnahmenplan.
              Der Bereich im Kundendashboard wird erst freigeschaltet, wenn der Kunde aktiv bestaetigt hat und die
              Zahlung intern markiert wurde.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <label className="block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Angebotsbeschreibung</div>
              <textarea
                value={offerSummary}
                onChange={(event) => setOfferSummary(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
              />
            </label>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => runAction("create_offer")}
                disabled={busyAction !== null}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "create_offer" ? "Speichere..." : service?.id ? "Angebot aktualisieren" : "Angebot anlegen"}
              </button>

              <button
                type="button"
                onClick={() => runAction("send_offer_email")}
                disabled={busyAction !== null || !service?.id}
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-950 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "send_offer_email" ? "Versende..." : "Aktivierungsmail senden"}
              </button>

              <button
                type="button"
                onClick={() => runAction("mark_payment_received")}
                disabled={busyAction !== null || !service?.id || Boolean(service?.payment_received_at)}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "mark_payment_received" ? "Markiere..." : "Zahlung markieren"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Kundensicht vorbereiten</div>
                <p className="mt-1 text-sm text-slate-600">
                  Veroeffentlichen Sie hier die fertige Haushaltsrechnung, Empfehlungen und den 90-Tage-Plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => runAction("publish_results")}
                disabled={busyAction !== null || !canPublish}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "publish_results" ? "Veroeffentliche..." : "Im Dashboard veroeffentlichen"}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Haushaltsrechnung</div>
                <textarea
                  value={householdOverview}
                  onChange={(event) => setHouseholdOverview(event.target.value)}
                  rows={5}
                  disabled={!isActive}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Empfehlungen</div>
                <textarea
                  value={recommendations}
                  onChange={(event) => setRecommendations(event.target.value)}
                  rows={4}
                  disabled={!isActive}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">90-Tage-Massnahmenplan</div>
                <textarea
                  value={actionPlan}
                  onChange={(event) => setActionPlan(event.target.value)}
                  rows={5}
                  disabled={!isActive}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>

              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Schufa-Hinweise</div>
                <textarea
                  value={schufaNotes}
                  onChange={(event) => setSchufaNotes(event.target.value)}
                  rows={4}
                  disabled={!isActive}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Hochgeladene Unterlagen</div>
            {documents.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Noch keine Finanzanalyse-Unterlagen vorhanden.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {documents.map((document) => {
                  const href = downloadHref(document.file_path, document.file_name)
                  return (
                    <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{document.file_name ?? "Dokument"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {getFinancialAnalysisDocumentKindLabel(document.document_kind)} - {formatDateTime(document.created_at)}
                          </div>
                        </div>
                        {href ? (
                          <a
                            href={href}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                          >
                            Herunterladen
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
            <div className="mt-2 text-base font-semibold text-slate-900">{getFinancialAnalysisServiceStatusLabel(service?.service_status)}</div>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <div>Preis: {formatFinancialAnalysisPrice(service?.price_gross_cents)}</div>
              <div>Analyse: {getFinancialAnalysisAnalysisStatusLabel(service?.analysis_status)}</div>
              <div>Mail gesendet: {formatDateTime(service?.offer_email_sent_at)}</div>
              <div>Bestaetigt: {formatDateTime(service?.customer_confirmed_at)}</div>
              <div>Zahlung: {formatDateTime(service?.payment_received_at)}</div>
              <div>Aktiv bis: {formatDateTime(service?.access_expires_at)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Hinweis</div>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
              <div>Der Kunde sieht den Bereich im Dashboard erst nach aktiver Bestaetigung und Zahlungsmarkierung.</div>
              <div>Der Aktivierungslink fuehrt bewusst auf eine separate Serviceseite ausserhalb des Dashboards.</div>
              <div>Nach 90 Tagen laeuft der Zugang ab und der Berater kann einen neuen Zyklus starten.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
