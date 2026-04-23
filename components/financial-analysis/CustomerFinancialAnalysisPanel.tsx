"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  formatFinancialAnalysisEuro,
  getFinancialAnalysisDocumentKindLabel,
  getFinancialAnalysisServiceStatusLabel,
  parseFinancialAnalysisHouseholdCalculation,
  trimOrNull,
  type FinancialAnalysisHouseholdCalculation,
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

const RESULT_HIGHLIGHTS = [
  {
    label: "Haushalt",
    title: "Klare Monatsrechnung",
    text: "Einnahmen, Fixkosten und variable Ausgaben werden strukturiert gegenübergestellt.",
  },
  {
    label: "Kaufkraft",
    title: "Konkrete Hebel",
    text: "Empfehlungen zeigen, wo Liquidität verbessert oder Belastung reduziert werden kann.",
  },
  {
    label: "90 Tage",
    title: "Umsetzung",
    text: "Der Plan übersetzt die Analyse in realistische Schritte für die nächsten Wochen.",
  },
] as const

const ACTION_PHASES = [
  { label: "Tag 1-30", title: "Stabilisieren", width: "34%" },
  { label: "Tag 31-60", title: "Optimieren", width: "67%" },
  { label: "Tag 61-90", title: "Nachhalten", width: "100%" },
] as const

function getHouseholdTotalCosts(calculation: FinancialAnalysisHouseholdCalculation) {
  if (calculation.totalCostsMonthly != null) return calculation.totalCostsMonthly
  const costParts = [
    calculation.provenFixedCostsMonthly,
    calculation.bankHouseholdAllowanceMonthly,
    calculation.obligationsMonthly,
    calculation.variableCostsMonthly,
    calculation.safetyBufferMonthly,
  ]
  const hasCostParts = costParts.some((value) => value != null && Number.isFinite(Number(value)))
  return hasCostParts ? costParts.reduce<number>((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0) : null
}

function HouseholdMetricCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string
  value: string
  hint: string
  tone?: "slate" | "emerald" | "rose" | "cyan"
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : tone === "cyan"
          ? "border-cyan-200 bg-cyan-50 text-cyan-950"
          : "border-slate-200 bg-white text-slate-950"

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs leading-relaxed opacity-75">{hint}</div>
    </div>
  )
}

function HouseholdCalculationView({
  calculation,
  fallbackText,
}: {
  calculation: FinancialAnalysisHouseholdCalculation | null
  fallbackText: string | null | undefined
}) {
  if (!calculation) {
    return (
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {fallbackText}
      </div>
    )
  }

  const totalCosts = getHouseholdTotalCosts(calculation)
  const freeLiquidity =
    calculation.freeLiquidityMonthly ??
    (calculation.incomeMonthly != null && totalCosts != null ? Number(calculation.incomeMonthly) - Number(totalCosts) : null)
  const isPositive = Number(freeLiquidity ?? 0) >= 0
  const rows = [
    { label: "Belegte Fixkosten", value: calculation.provenFixedCostsMonthly, tone: "bg-slate-700" },
    { label: "Bankübliche Haushaltspauschale", value: calculation.bankHouseholdAllowanceMonthly, tone: "bg-cyan-500" },
    { label: "Laufende Verpflichtungen/Raten", value: calculation.obligationsMonthly, tone: "bg-amber-500" },
    { label: "Variable Kosten", value: calculation.variableCostsMonthly, tone: "bg-emerald-500" },
    { label: "Sicherheitsabschlag", value: calculation.safetyBufferMonthly, tone: "bg-rose-500" },
  ].filter((row) => row.value != null && Number(row.value) !== 0)
  const maxRowValue = Math.max(1, ...rows.map((row) => Math.abs(Number(row.value ?? 0))), Math.abs(Number(calculation.incomeMonthly ?? 0)))

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HouseholdMetricCard
          label="Einnahmen pro Monat"
          value={formatFinancialAnalysisEuro(calculation.incomeMonthly)}
          hint="Aus Kontoauszug belegt oder vorsichtig angenommen"
          tone="emerald"
        />
        <HouseholdMetricCard
          label="Kosten nach Banklogik"
          value={formatFinancialAnalysisEuro(totalCosts)}
          hint="Fixkosten, Pauschale, Verpflichtungen und Puffer"
          tone="slate"
        />
        <HouseholdMetricCard
          label="Bank-Pauschale"
          value={formatFinancialAnalysisEuro(calculation.bankHouseholdAllowanceMonthly)}
          hint="Lebenshaltung/Haushalt bankähnlich angesetzt"
          tone="cyan"
        />
        <HouseholdMetricCard
          label="Freie Liquidität"
          value={formatFinancialAnalysisEuro(freeLiquidity)}
          hint={isPositive ? "Monatlich rechnerisch verfügbar" : "Monatlich rechnerisch überlastet"}
          tone={isPositive ? "emerald" : "rose"}
        />
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Monatliche Bankrechnung</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">So setzt sich die Haushaltsrechnung zusammen</div>
          </div>
          <div className={`rounded-2xl px-4 py-2 text-sm font-semibold ${isPositive ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
            Ergebnis: {formatFinancialAnalysisEuro(freeLiquidity)}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Einnahmen</span>
              <span>{formatFinancialAnalysisEuro(calculation.incomeMonthly)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (Math.abs(Number(calculation.incomeMonthly ?? 0)) / maxRowValue) * 100)}%` }} />
            </div>
          </div>

          {rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                <span>{row.label}</span>
                <span>{formatFinancialAnalysisEuro(row.value)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-3 rounded-full ${row.tone}`} style={{ width: `${Math.min(100, (Math.abs(Number(row.value ?? 0)) / maxRowValue) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {trimOrNull(calculation.assessment) ? (
          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm leading-relaxed text-slate-700">
            {calculation.assessment}
          </div>
        ) : null}
      </div>

      {calculation.items?.length ? (
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Detailpositionen</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {calculation.items.slice(0, 12).map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.category || item.basis || "Position"}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-slate-900">{formatFinancialAnalysisEuro(item.amountMonthly)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

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
  const householdCalculation = parseFinancialAnalysisHouseholdCalculation(service.published_household_overview)
  const bankStatementCount = documents.filter((document) => String(document.document_kind ?? "").trim().toLowerCase() === "bank_statement").length
  const hasSchufaReport = documents.some((document) => String(document.document_kind ?? "").trim().toLowerCase() === "schufa_report")

  async function upload(kind: FinancialAnalysisDocumentKind, files: FileList) {
    const selectedFiles = Array.from(files)
    if (!selectedFiles.length) return

    setBusyKind(kind)
    setFeedback(null)

    try {
      for (const [index, file] of selectedFiles.entries()) {
        const form = new FormData()
        form.set("caseId", caseId)
        form.set("serviceId", service.id)
        form.set("documentKind", kind)
        form.set("sendCustomerUploadMail", index === 0 ? "1" : "0")
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
    <div className="mx-auto w-full max-w-7xl rounded-[28px] border border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%),linear-gradient(180deg,#ffffff,#f8fffc)] p-5 shadow-sm sm:p-6">
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

      <section className="mt-6 rounded-[30px] border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ihre Uploads</div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Hochgeladene Unterlagen</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Diese Dokumente nutzt Ihr Berater für die Finanzanalyse. Sie können jederzeit weitere Unterlagen ergänzen.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-700">
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-900">{bankStatementCount} Konto</div>
            <div className="rounded-2xl bg-cyan-50 px-3 py-2 text-cyan-900">{hasSchufaReport ? "Schufa da" : "Schufa offen"}</div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2">{documents.length} Gesamt</div>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            Noch keine Unterlagen hochgeladen.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => {
              const href = downloadHref(document.file_path, document.file_name)
              const kind = String(document.document_kind ?? "").trim().toLowerCase()
              const tone =
                kind === "bank_statement"
                  ? "border-emerald-100 bg-emerald-50/70 text-emerald-900"
                  : kind === "schufa_report"
                    ? "border-cyan-100 bg-cyan-50/70 text-cyan-900"
                    : "border-slate-200 bg-slate-50 text-slate-800"
              return (
                <article key={document.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc)] p-4 shadow-sm">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone}`}>
                    {getFinancialAnalysisDocumentKindLabel(document.document_kind)}
                  </div>
                  <div className="mt-3 break-words text-sm font-semibold text-slate-900">{document.file_name ?? "Dokument"}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(document.created_at)}</div>
                  {href ? (
                    <a
                      href={href}
                      className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-900"
                    >
                      Herunterladen
                    </a>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        {service.published_at ? (
          <div className="overflow-hidden rounded-[32px] border border-emerald-200 bg-white shadow-sm">
            <div className="bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.28),transparent_34%),radial-gradient(circle_at_left,rgba(14,165,233,0.18),transparent_32%),linear-gradient(135deg,#052e2b,#0f172a)] p-5 text-white sm:p-7">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">Veröffentlichte Auswertung</div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ihr 90-Tage-Plan steht bereit.</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-emerald-50/90">
                    Die Finanzanalyse wurde freigegeben. SEPANA meldet sich zeitnah telefonisch, um die Ergebnisse
                    persönlich mit Ihnen zu besprechen.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                  {actionPlanPdfHref ? (
                    <a
                      href={actionPlanPdfHref}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-50"
                    >
                      90-Tage-Plan als PDF herunterladen
                    </a>
                  ) : null}
                  <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                    Veröffentlicht am {formatDateTime(service.published_at)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {RESULT_HIGHLIGHTS.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">{item.label}</div>
                    <div className="mt-2 text-base font-semibold text-white">{item.title}</div>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-50/80">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {trimOrNull(service.published_household_overview) ? (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 xl:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Haushaltsrechnung</div>
                    <HouseholdCalculationView
                      calculation={householdCalculation}
                      fallbackText={service.published_household_overview}
                    />
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
              </div>

              {trimOrNull(service.published_action_plan) ? (
                <section className="rounded-[30px] border border-slate-900/10 bg-[linear-gradient(135deg,#ffffff,#f0fdf4)] p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        90-Tage-Maßnahmenplan
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">Stabilisieren. Optimieren. Nachhalten.</div>
                    </div>
                    {actionPlanPdfHref ? (
                      <a
                        href={actionPlanPdfHref}
                        className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm"
                      >
                        PDF herunterladen
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {ACTION_PHASES.map((phase) => (
                      <div key={phase.label} className="rounded-3xl border border-emerald-100 bg-white/85 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">{phase.label}</div>
                        <div className="mt-2 text-base font-semibold text-slate-900">{phase.title}</div>
                        <div className="mt-3 h-2 rounded-full bg-emerald-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: phase.width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-3xl border border-white bg-white/70 p-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
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
      </section>
    </div>
  )
}
