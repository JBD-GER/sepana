"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  getFinancialAnalysisDocumentKindLabel,
  getFinancialAnalysisServiceStatusLabel,
  trimOrNull,
  type FinancialAnalysisDocumentKind,
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

type UploadCard = {
  kind: FinancialAnalysisDocumentKind
  title: string
  description: string
}

const UPLOAD_CARDS: UploadCard[] = [
  {
    kind: "bank_statement",
    title: "Kontoauszüge hochladen",
    description: "Bitte laden Sie hier Ihre aktuellen Kontoauszüge hoch, damit die Haushaltsrechnung erstellt werden kann.",
  },
  {
    kind: "schufa_report",
    title: "Aktuelle Schufa hochladen",
    description: "Laden Sie Ihre aktuelle Schufa hoch, damit mögliche Optimierungen sauber eingeordnet werden können.",
  },
  {
    kind: "supporting_document",
    title: "Weitere Unterlagen",
    description: "Nutzen Sie diesen Bereich für Zusatzdokumente, Ergänzungen oder sonstige Nachweise.",
  },
]

export default function CustomerFinancialAnalysisPanel({
  caseId,
  service,
  documents,
}: {
  caseId: string
  service: FinancialAnalysisServiceRow
  documents: FinancialAnalysisDocumentRow[]
}) {
  const router = useRouter()
  const [busyKind, setBusyKind] = useState<FinancialAnalysisDocumentKind | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const actionPlanPdfHref =
    service.published_at && trimOrNull(service.published_action_plan)
      ? `/api/app/cases/schufa-frei/financial-analysis/action-plan?caseId=${encodeURIComponent(caseId)}`
      : null
  const bankStatementCount = documents.filter((document) => String(document.document_kind ?? "").trim().toLowerCase() === "bank_statement").length
  const hasSchufaReport = documents.some((document) => String(document.document_kind ?? "").trim().toLowerCase() === "schufa_report")

  async function upload(kind: FinancialAnalysisDocumentKind, files: FileList) {
    const selectedFiles = Array.from(files)
    if (!selectedFiles.length) return

    setBusyKind(kind)
    setFeedback(null)

    try {
      for (const file of selectedFiles) {
        const form = new FormData()
        form.set("caseId", caseId)
        form.set("serviceId", service.id)
        form.set("documentKind", kind)
        form.set("file", file)

        const response = await fetch("/api/app/cases/schufa-frei/financial-analysis/upload", {
          method: "POST",
          body: form,
        })
        const json = await response.json().catch(() => ({}))

        if (!response.ok || !json?.ok) {
          throw new Error(
            json?.error === "financial_analysis_not_active"
              ? "Der Bereich ist aktuell nicht aktiv."
              : json?.error === "datei_zu_gross"
                ? "Die Datei ist zu groß. Maximal 20 MB sind erlaubt."
                : json?.error === "dateityp_nicht_unterstuetzt"
                  ? "Bitte laden Sie PDF-Dateien oder Bilder hoch."
                  : json?.error || "Upload fehlgeschlagen."
          )
        }
      }

      setFeedback({ type: "success", text: "Dokument(e) erfolgreich hochgeladen." })
      startTransition(() => router.refresh())
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Upload fehlgeschlagen.",
      })
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <div className="rounded-[28px] border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%),linear-gradient(180deg,#ffffff,#f8fffc)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Finanzanalyse</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{FINANCIAL_ANALYSIS_SERVICE_TITLE}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Laden Sie hier Ihre Unterlagen hoch und verfolgen Sie die veröffentlichte Auswertung direkt im Dashboard.
          </p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:grid-cols-3 xl:min-w-[360px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
          <div className="font-semibold text-slate-900">{getFinancialAnalysisServiceStatusLabel(service.service_status)}</div>
          <div className="text-xs text-slate-500 sm:text-right">Aktiv bis: {formatDateTime(service.access_expires_at)}</div>
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            Kontoauszüge: {bankStatementCount}
          </div>
          <div className="rounded-2xl bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">
            Schufa: {hasSchufaReport ? "hochgeladen" : "optional offen"}
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            Uploads: {documents.length}
          </div>
        </div>
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

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {UPLOAD_CARDS.map((card) => (
          <article key={card.kind} className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">{card.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
            <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm">
              {busyKind === card.kind ? "Upload..." : "Dateien auswählen"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={busyKind !== null}
                onChange={(event) => {
                  const files = event.target.files
                  if (files?.length) {
                    upload(card.kind, files)
                  }
                  event.currentTarget.value = ""
                }}
              />
            </label>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {service.published_at ? (
            <div className="overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-sm">
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.25),transparent_34%),linear-gradient(135deg,#052e2b,#0f172a)] p-5 text-white sm:p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">Veröffentlichte Auswertung</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Ihr 90-Tage-Plan steht bereit.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/90">
                  Die Finanzanalyse wurde freigegeben. SEPANA meldet sich zeitnah telefonisch, um die Ergebnisse
                  persönlich mit Ihnen zu besprechen.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {actionPlanPdfHref ? (
                    <a
                      href={actionPlanPdfHref}
                      className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-50"
                    >
                      90-Tage-Plan als PDF herunterladen
                    </a>
                  ) : null}
                  <span className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                    Veröffentlicht am {formatDateTime(service.published_at)}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:p-5">
                {trimOrNull(service.published_household_overview) ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Haushaltsrechnung</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {service.published_household_overview}
                    </div>
                  </section>
                ) : null}

                {trimOrNull(service.published_recommendations) ? (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50/60 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">Empfehlungen</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {service.published_recommendations}
                    </div>
                  </section>
                ) : null}

                {trimOrNull(service.published_action_plan) ? (
                  <section className="rounded-3xl border border-slate-900/10 bg-[linear-gradient(135deg,#ffffff,#f0fdf4)] p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                          90-Tage-Maßnahmenplan
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">Stabilisieren. Optimieren. Nachhalten.</div>
                      </div>
                      {actionPlanPdfHref ? (
                        <a
                          href={actionPlanPdfHref}
                          className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm"
                        >
                          PDF
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {["Tag 1-30", "Tag 31-60", "Tag 61-90"].map((label) => (
                        <div key={label} className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-3">
                          <div className="text-xs font-semibold text-emerald-900">{label}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-emerald-100">
                            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: "70%" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {service.published_action_plan}
                    </div>
                  </section>
                ) : null}

                {trimOrNull(service.published_schufa_notes) ? (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">Schufa-Hinweise</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {service.published_schufa_notes}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-5 shadow-sm sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Auswertung in Vorbereitung</div>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Ihr Berater erstellt die Finanzanalyse.</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Sobald Haushaltsrechnung, Empfehlungen und 90-Tage-Maßnahmenplan freigegeben sind, sehen Sie alles direkt hier.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Ihre Uploads</div>
          {documents.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Noch keine Unterlagen hochgeladen.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {documents.map((document) => {
                const href = downloadHref(document.file_path, document.file_name)
                return (
                  <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">{document.file_name ?? "Dokument"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {getFinancialAnalysisDocumentKindLabel(document.document_kind)} - {formatDateTime(document.created_at)}
                    </div>
                    {href ? (
                      <a
                        href={href}
                        className="mt-3 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
                      >
                        Herunterladen
                      </a>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
