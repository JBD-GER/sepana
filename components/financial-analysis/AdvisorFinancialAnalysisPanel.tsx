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

function normalizedDocumentKind(document: FinancialAnalysisDocumentRow) {
  return String(document.document_kind ?? "").trim().toLowerCase()
}

function financialAnalysisActionErrorMessage(error: unknown) {
  const normalized = String(error ?? "").trim()
  if (normalized === "customer_email_missing") return "Beim Kunden ist keine E-Mail-Adresse hinterlegt."
  if (normalized === "mail_not_configured") return "Der E-Mail-Versand ist noch nicht konfiguriert."
  if (normalized === "financial_analysis_customer_confirmation_missing") {
    return "Der Kunde muss den Zusatzservice zuerst aktiv bestätigen. Danach wird automatisch die Rechnung versendet."
  }
  if (normalized === "financial_analysis_invoice_missing") return "Es liegt noch keine Rechnung zur Finanzanalyse vor."
  if (normalized === "financial_analysis_invoice_not_payable") return "Die zugehörige Rechnung ist nicht mehr zahlbar."
  if (normalized === "financial_analysis_not_active") {
    return "Die Finanzanalyse ist noch nicht aktiv. Bitte zuerst Kundenbestätigung und Zahlung abschließen."
  }
  if (normalized === "financial_analysis_content_missing") return "Bitte mindestens einen Auswertungsbereich befüllen."
  if (normalized === "financial_analysis_bank_statement_missing") {
    return "Für den KI-Entwurf muss mindestens ein Kontoauszug hochgeladen sein."
  }
  if (normalized === "financial_analysis_documents_missing") return "Es wurden noch keine Finanzanalyse-Unterlagen hochgeladen."
  if (normalized === "financial_analysis_documents_unreadable") {
    return "Die hochgeladenen Dateien konnten nicht ausgelesen werden. Bitte prüfen Sie PDF/Textqualität oder laden Sie klarere Unterlagen hoch."
  }
  if (normalized === "openai_not_configured") {
    return "OPENAI_API_KEY ist nicht konfiguriert. Der KI-Entwurf kann deshalb noch nicht erzeugt werden."
  }
  if (normalized === "financial_analysis_ai_output_truncated") {
    return "Die KI-Antwort wurde abgeschnitten. Bitte weniger Unterlagen verwenden oder erneut starten."
  }
  return normalized || "Aktion fehlgeschlagen."
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
  const bankStatementCount = documents.filter((document) => normalizedDocumentKind(document) === "bank_statement").length
  const hasBankStatement = bankStatementCount > 0
  const hasSchufaReport = documents.some((document) => normalizedDocumentKind(document) === "schufa_report")
  const actionPlanPdfHref = trimOrNull(actionPlan)
    ? `/api/app/cases/schufa-frei/financial-analysis/action-plan?caseId=${encodeURIComponent(caseId)}`
    : null
  const canGenerateAiDraft = Boolean(service?.id) && isActive && hasBankStatement
  const canPublish =
    Boolean(service?.id) &&
    isActive &&
    [householdOverview, recommendations, actionPlan, schufaNotes].some((value) => Boolean(trimOrNull(value)))
  const canMarkPayment = Boolean(service?.id) && Boolean(service?.customer_confirmed_at) && !Boolean(service?.payment_received_at)

  async function runAction(
    action: "create_offer" | "send_offer_email" | "mark_payment_received" | "generate_ai_draft" | "publish_results"
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
        throw new Error(financialAnalysisActionErrorMessage(json?.error))
      }

      if (action === "create_offer") {
        setFeedback({ type: "success", text: "Das Angebot für die Finanzanalyse wurde gespeichert." })
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
              ? "Zahlung markiert. Die Rechnung wurde als bezahlt verbucht und die Finanzanalyse ist jetzt aktiv."
              : "Zahlung wurde markiert. Es fehlt noch die aktive Kundenbestätigung.",
        })
      } else if (action === "generate_ai_draft") {
        const nextService = json?.service ?? {}
        setHouseholdOverview(String(nextService?.published_household_overview ?? json?.generated?.householdOverview ?? ""))
        setRecommendations(String(nextService?.published_recommendations ?? json?.generated?.recommendations ?? ""))
        setActionPlan(String(nextService?.published_action_plan ?? json?.generated?.actionPlan ?? ""))
        setSchufaNotes(String(nextService?.published_schufa_notes ?? json?.generated?.schufaNotes ?? ""))
        setFeedback({
          type: "success",
          text: json?.hasSchufaReport
            ? "KI-Entwurf erstellt. Bitte prüfen, anpassen und danach manuell veröffentlichen."
            : "KI-Entwurf erstellt. Schufa-Hinweise bleiben bewusst eingeschränkt, bis eine Schufa-Auskunft hochgeladen wurde.",
        })
      } else {
        setFeedback({
          type: "success",
          text: json?.publishedEmailSent
            ? "Die Auswertung wurde veröffentlicht und der Kunde per E-Mail informiert."
            : "Die Auswertung wurde veröffentlicht. Die Kundenmail konnte nicht automatisch versendet werden.",
        })
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
              Getrennter Zusatzservice für persönliche Finanzanalyse, Haushaltsrechnung und 90-Tage-Maßnahmenplan.
              Der Bereich im Kundendashboard wird erst freigeschaltet, wenn der Kunde aktiv bestätigt hat, die
              Rechnung erstellt wurde und die Zahlung intern markiert ist.
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
                disabled={busyAction !== null || !canMarkPayment}
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === "mark_payment_received" ? "Markiere..." : "Zahlung markieren"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,#052e2b,#0f172a)] p-4 text-white shadow-sm sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
              <div>
                <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  KI-Auswertung
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Entwurf aus Kontoauszügen erstellen</h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
                  Die KI liest die hochgeladenen Finanzanalyse-Unterlagen aus und erstellt einen prüfbaren Entwurf für
                  Haushaltsrechnung, Empfehlungen und 90-Tage-Maßnahmenplan. Veröffentlicht wird erst nach Ihrer Freigabe.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">Kontoauszüge</div>
                    <div className="mt-1 text-lg font-semibold">{bankStatementCount}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">Schufa</div>
                    <div className="mt-1 text-lg font-semibold">{hasSchufaReport ? "vorhanden" : "fehlt"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">Status</div>
                    <div className="mt-1 text-lg font-semibold">{isActive ? "bereit" : "gesperrt"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <button
                  type="button"
                  onClick={() => runAction("generate_ai_draft")}
                  disabled={busyAction !== null || !canGenerateAiDraft}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "generate_ai_draft" ? "KI analysiert..." : "KI-Entwurf erstellen"}
                </button>
                <p className="mt-3 text-xs leading-relaxed text-emerald-50/80">
                  Schufa-Hinweise werden erst erzeugt, wenn eine aktuelle Schufa-Auskunft hochgeladen wurde. Ohne
                  Kontoauszug bleibt der KI-Button deaktiviert.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Kundensicht vorbereiten</div>
                <p className="mt-1 text-sm text-slate-600">
                  Veröffentlichen Sie hier die fertige Haushaltsrechnung, Empfehlungen und den 90-Tage-Plan.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {actionPlanPdfHref ? (
                  <a
                    href={actionPlanPdfHref}
                    className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:border-emerald-300"
                  >
                    90-Tage-Plan PDF
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => runAction("publish_results")}
                  disabled={busyAction !== null || !canPublish}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "publish_results" ? "Veröffentliche..." : "Im Dashboard veröffentlichen"}
                </button>
              </div>
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
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">90-Tage-Maßnahmenplan</div>
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
              <div>Bestätigt: {formatDateTime(service?.customer_confirmed_at)}</div>
              <div>Zahlung: {formatDateTime(service?.payment_received_at)}</div>
              <div>Aktiv bis: {formatDateTime(service?.access_expires_at)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Hinweis</div>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
              <div>Der Kunde bestätigt den Service zuerst auf der separaten Serviceseite.</div>
              <div>Nach der Bestätigung wird die Rechnung automatisch erstellt und per E-Mail an den Kunden gesendet.</div>
              <div>Erst nach Zahlungsmarkierung startet die 90-Tage-Laufzeit und der Dashboard-Bereich wird freigeschaltet.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
