"use client"

import { startTransition, useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { EuropaceFlowSummary } from "@/lib/europace/flow"

type EuropaceMeta = {
  vorgangsnummer?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  sync_status?: string | null
  last_sync_at?: string | null
  letzte_aenderung_am?: string | null
  letztes_ereignis_am?: string | null
  last_error?: string | null
} | null

type EuropaceApplicationRow = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  antragstellerstatus?: string | null
  produktanbieterstatus?: string | null
  provisionsforderungsstatus?: string | null
}

type EuropaceDocumentSummary = {
  remoteDocumentCount: number
  pageCount: number
  assignedPageCount: number
  releasedPageCount: number
} | null

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function labelSyncStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return "Noch nicht synchronisiert"
  if (raw === "synced") return "Synchronisiert"
  if (raw === "imported") return "Importiert"
  if (raw === "error") return "Fehler"
  if (raw === "pending") return "Ausstehend"
  return raw
}

function labelValue(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  const normalized = raw.replace(/_/g, " ").toLowerCase()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function milestoneTone(state: EuropaceFlowSummary["bankLegitimationState"] | EuropaceFlowSummary["bankSignatureState"]) {
  if (state === "completed") return "border-emerald-200 bg-emerald-50"
  if (state === "pending") return "border-amber-200 bg-amber-50"
  if (state === "waiting") return "border-slate-200/70 bg-slate-50"
  return "border-slate-200/70 bg-white"
}

export default function EuropaceStatusCard({
  caseId,
  endpoint,
  initialMeta,
  initialApplications,
  initialFlow,
  hideTechnicalBranding = false,
}: {
  caseId: string
  endpoint: string
  initialMeta: EuropaceMeta
  initialApplications: EuropaceApplicationRow[]
  initialFlow?: EuropaceFlowSummary | null
  hideTechnicalBranding?: boolean
}) {
  const router = useRouter()
  const [meta, setMeta] = useState<EuropaceMeta>(initialMeta ?? null)
  const [applications, setApplications] = useState<EuropaceApplicationRow[]>(initialApplications ?? [])
  const [flow, setFlow] = useState<EuropaceFlowSummary | null>(initialFlow ?? null)
  const [documentSummary, setDocumentSummary] = useState<EuropaceDocumentSummary>(null)
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMeta(initialMeta ?? null)
  }, [initialMeta])

  useEffect(() => {
    setApplications(initialApplications ?? [])
  }, [initialApplications])

  useEffect(() => {
    setFlow(initialFlow ?? null)
  }, [initialFlow])

  const refreshStatus = useCallback(async (manual: boolean) => {
    if (manual) {
      setBusy(true)
      setMessage(null)
      setError(null)
    } else {
      setPolling(true)
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, includeDocuments: manual }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        if (manual) setError(String(json?.error ?? (hideTechnicalBranding ? "Status konnte nicht aktualisiert werden." : "Europace-Status konnte nicht aktualisiert werden.")))
        return
      }

      const nextMeta = (json?.europace ?? null) as EuropaceMeta
      const nextApplications = (Array.isArray(json?.applications) ? json.applications : []) as EuropaceApplicationRow[]
      const nextDocumentSummary = (json?.documentSummary ?? null) as EuropaceDocumentSummary
      const nextFlow = (json?.flow ?? null) as EuropaceFlowSummary | null
      const documentsError = trimOrNull(json?.documentsError)

      setMeta(nextMeta)
      setApplications(nextApplications)
      setDocumentSummary(nextDocumentSummary)
      setFlow(nextFlow)

      if (manual) {
        const applicationCount = nextApplications.length
        const applicationLabel =
          applicationCount > 1
            ? `${applicationCount} Anträge aktualisiert.`
            : applicationCount === 1
              ? "1 Antrag aktualisiert."
              : "Status aktualisiert."
        const documentLabel = json?.documentsSynchronized ? " Dokumentstatus wurde ebenfalls neu geladen." : ""
        setMessage(`${applicationLabel}${documentLabel}`)
        if (documentsError) setError(documentsError)
        startTransition(() => router.refresh())
      }
    } finally {
      if (manual) setBusy(false)
      else setPolling(false)
    }
  }, [caseId, endpoint, hideTechnicalBranding, router])

  useEffect(() => {
    if (!trimOrNull(meta?.antragsnummer) && applications.length === 0) return

    const interval = window.setInterval(() => {
      void refreshStatus(false)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [applications.length, meta?.antragsnummer, refreshStatus])

  return (
    <div className="rounded-3xl border border-sky-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {hideTechnicalBranding ? "Antragsstatus" : "Europace Status"}
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Antrag und Verlauf</h2>
          <p className="mt-1 text-sm text-slate-600">
            {hideTechnicalBranding
              ? "Aktualisiert deinen Antrag erneut. Beim manuellen Abruf werden auch Dokumentstatus und Freigaben mitgeladen."
              : "Aktualisiert den Europace-Vorgang erneut. Beim manuellen Abruf werden auch Dokumentstatus und Freigaben mitgezogen."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshStatus(true)}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Aktualisiere..." : polling ? "Laufendes Polling..." : "Status aktualisieren"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Sync</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{labelSyncStatus(meta?.sync_status)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Antrag</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 break-all">{trimOrNull(meta?.antragsnummer) || "-"}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letzter Sync</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.last_sync_at)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produktanbieter-Ref</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
            {trimOrNull(meta?.produktanbieterantragsnummer) || "-"}
          </div>
        </div>
      </div>

      {flow ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            className={`rounded-2xl border p-4 ${
              flow.isCompleted
                ? "border-emerald-200 bg-emerald-50"
                : flow.hasRejectedApplication
                  ? "border-rose-200 bg-rose-50"
                  : "border-cyan-200 bg-cyan-50"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Aktueller Stand</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{flow.advisorLabel}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{flow.advisorDescription}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Kontocheck</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{flow.accountCheckRequired ? "Ja" : "Nein"}</div>
            <div className="mt-1 text-xs text-slate-600">
              {flow.directOnlineBankCompletionFlow ? "Direkt-online bei der Bank" : "Normale Unterlagen-/Beraterstrecke"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Blocker</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{flow.blockerLabel ?? "Keiner"}</div>
            <div className="mt-1 text-xs text-slate-600">
              {flow.isCompleted ? "Der Antrag ist abgeschlossen." : flow.hasRejectedApplication ? "Angebot wurde abgelehnt." : flow.customerDescription}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Bankdokumente</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {flow.importedBankDocumentCount > 0
                ? `${flow.importedBankDocumentCount} im Fall`
                : flow.bankDocumentCount > 0
                  ? `${flow.bankDocumentCount} erkannt`
                  : "-"}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {flow.bankContinuationReady ? "Legitimation / Signatur bereit" : flow.directOnlineBankCompletionFlow ? "Wartet auf Bank-Rückmeldung" : "Keine Bankdokumente in dieser Strecke"}
            </div>
          </div>
        </div>
      ) : null}

      {flow?.directOnlineBankCompletionFlow ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${milestoneTone(flow.bankLegitimationState)}`}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Legitimation</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{flow.bankLegitimationLabel}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{flow.bankLegitimationDescription}</div>
          </div>
          <div className={`rounded-2xl border p-4 ${milestoneTone(flow.bankSignatureState)}`}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Digitale Signatur</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{flow.bankSignatureLabel}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">{flow.bankSignatureDescription}</div>
          </div>
        </div>
      ) : null}

      {(meta?.letzte_aenderung_am || meta?.letztes_ereignis_am || documentSummary) ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letzte Änderung</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.letzte_aenderung_am)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letztes Ereignis</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.letztes_ereignis_am)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Remote Dokumente</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{documentSummary?.remoteDocumentCount ?? "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Freigegebene Seiten</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {documentSummary ? `${documentSummary.releasedPageCount}/${documentSummary.pageCount}` : "-"}
            </div>
          </div>
        </div>
      ) : null}

      {flow?.isCompleted ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <div className="font-semibold">Abgeschlossen</div>
          <div className="mt-1">
            {flow.advisorDescription}
          </div>
        </div>
      ) : applications.length ? (
        <div className="mt-4 space-y-3">
          {applications.map((application, index) => {
            const key =
              trimOrNull(application.antragsnummer) ??
              trimOrNull(application.produktanbieterantragsnummer) ??
              `europace-application-${index}`

            return (
              <div key={key} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Antrag {trimOrNull(application.antragsnummer) || `#${index + 1}`}
                    </div>
                    <div className="mt-1 break-all text-xs text-slate-600">
                      Produktanbieter-Ref: {trimOrNull(application.produktanbieterantragsnummer) || "-"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Antragstellerstatus</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {labelValue(application.antragstellerstatus)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Produktanbieterstatus</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {labelValue(application.produktanbieterstatus)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Provisionsstatus</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {labelValue(application.provisionsforderungsstatus)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
          Noch kein Antrag mit Statusdaten vorhanden.
        </div>
      )}

      {message ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      ) : meta?.last_error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {hideTechnicalBranding ? "Letzter Hinweis" : "Letzter Europace-Hinweis"}: {meta.last_error}
        </div>
      ) : null}
    </div>
  )
}
