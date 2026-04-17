"use client"

import { useState } from "react"
import { deriveImportantSchufaFreeDocuments } from "@/lib/schufa-frei/documentRecommendations"

type RequestRow = {
  id: string
  title: string
  required?: boolean | null
}

type DocumentRow = {
  id: string
  file_name: string
  created_at: string
  request_id?: string | null
}

type SkagDocumentRow = {
  local_document_id?: string | null
  upload_status?: string | null
  last_error?: string | null
}

function dt(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function uploadStatusLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return "bei SEPANA gespeichert"
  if (normalized === "uploaded") return "an SEPANA übermittelt"
  if (normalized === "pending_credit_id") return "wartet auf SEPANA-Fall"
  if (normalized === "error") return "Upload prüfen"
  if (normalized === "pending") return "wird vorbereitet"
  return "bei SEPANA gespeichert"
}

export default function SchufaFreeDocumentUploadPanel({
  caseId,
  caseRef,
  accessToken,
  requests,
  documents,
  skagDocuments,
}: {
  caseId: string
  caseRef: string
  accessToken: string
  requests: RequestRow[]
  documents: DocumentRow[]
  skagDocuments: SkagDocumentRow[]
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const skagDocumentMap = new Map(
    skagDocuments
      .map((row) => [String(row.local_document_id ?? "").trim(), row] as const)
      .filter(([id]) => Boolean(id))
  )
  const importantDocuments = deriveImportantSchufaFreeDocuments(requests, 5)
  const requiredRequests = requests.filter((request) => Boolean(request.required))

  async function upload(files: FileList, requestId: string | null, requestTitle: string | null, keepUnassigned = false) {
    const selectedFiles = Array.from(files)
    if (!selectedFiles.length) return

    setBusyKey(requestId ?? "free")
    setMessage(null)
    try {
      for (const file of selectedFiles) {
        const form = new FormData()
        form.set("caseId", caseId)
        form.set("caseRef", caseRef)
        form.set("access", accessToken)
        if (requestId) form.set("requestId", requestId)
        if (requestTitle) form.set("requestTitle", requestTitle)
        if (keepUnassigned) form.set("keepUnassigned", "1")
        form.set("file", file)

        const response = await fetch("/api/schufa-frei/documents/upload", {
          method: "POST",
          body: form,
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json?.ok) {
          throw new Error(String(json?.error ?? "Upload fehlgeschlagen."))
        }
      }

      setMessage("Dokument(e) erfolgreich bei SEPANA hochgeladen.")
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen.")
    } finally {
      setBusyKey(null)
    }
  }

  function documentsForRequest(requestId: string | null) {
    return documents.filter((row) => (row.request_id ?? null) === requestId)
  }

  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm sm:rounded-[32px] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Unterlagen</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dokumente direkt hochladen</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Neue Uploads werden direkt im SEPANA-Fall gespeichert.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
          {documents.length} Uploads
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Jetzt zuerst hochladen</div>
          <div className="mt-2 text-base font-semibold text-slate-900">Diese Unterlagen sind für die Prüfung am wichtigsten</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {importantDocuments.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white px-3 py-3 text-sm text-slate-700">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <div className="leading-relaxed">{item}</div>
              </div>
            ))}
          </div>
          {requiredRequests.length ? (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-600">
              Offene Pflichtunterlagen: {requiredRequests.map((request) => request.title).filter(Boolean).join(", ")}.
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/80 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Upload-Hinweis</div>
          <div className="mt-2 text-base font-semibold text-slate-900">Pflichtunterlagen zuerst, Zusatzdokumente danach</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Alle Uploads bleiben direkt im SEPANA-Fall sichtbar und nachvollziehbar.</p>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <div className="rounded-2xl border border-white/80 bg-white px-3 py-3">Jede Datei wird sauber dem richtigen SEPANA-Fall zugeordnet.</div>
            <div className="rounded-2xl border border-white/80 bg-white px-3 py-3">Der Status bleibt pro Upload im Fall nachvollziehbar.</div>
            <div className="rounded-2xl border border-white/80 bg-white px-3 py-3">Freie Zusatzunterlagen können Sie später jederzeit nachreichen.</div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {requests.map((request) => {
          const requestDocuments = documentsForRequest(request.id)

          return (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{request.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {request.required ? "Pflichtdokument" : "Optionales Dokument"}
                  </div>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm">
                  {busyKey === request.id ? "Upload..." : "Datei hochladen"}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={busyKey !== null}
                    onChange={(event) => {
                      const files = event.target.files
                      if (files?.length) {
                        upload(files, request.id, request.title)
                      }
                      event.currentTarget.value = ""
                    }}
                  />
                </label>
              </div>

              {requestDocuments.length ? (
                <div className="mt-4 grid gap-3">
                  {requestDocuments.map((document) => {
                    const syncRow = skagDocumentMap.get(document.id) ?? null
                    return (
                      <div key={document.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{document.file_name}</div>
                        <div className="mt-1 text-xs text-slate-500">{dt(document.created_at)}</div>
                        <div className="mt-2 text-xs font-semibold text-slate-700">
                          {uploadStatusLabel(syncRow?.upload_status ?? null)}
                        </div>
                        {syncRow?.last_error ? (
                          <div className="mt-1 text-xs text-amber-700">{syncRow.last_error}</div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </article>
          )
        })}

        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Weiteres Dokument</div>
              <div className="mt-1 text-xs text-slate-500">Für freie Zusatzunterlagen oder neue Rückfragen.</div>
            </div>
            <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm">
              {busyKey === "free" ? "Upload..." : "Freies Dokument hochladen"}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={busyKey !== null}
                onChange={(event) => {
                  const files = event.target.files
                  if (files?.length) {
                    upload(files, null, null, true)
                  }
                  event.currentTarget.value = ""
                }}
              />
            </label>
          </div>
        </article>
      </div>
    </section>
  )
}
