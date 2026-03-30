"use client"

import Link from "next/link"
import { startTransition, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { isImportedBankDocumentPath } from "@/lib/europace/flow"

const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tif,.tiff"
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_UPLOAD_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/tiff"])
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "tif",
  "tiff",
])

type UploadRequirement = {
  key: string
  title: string
  request_id?: string | null
  category_id?: string | null
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
  source: "request" | "uploaded"
  required: boolean
}

type DocumentRow = {
  id: string
  request_id?: string | null
  file_name: string
  file_path: string
  mime_type?: string | null
  size_bytes?: number | null
  created_at: string
}

type EuropaceDocumentRow = {
  local_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
  upload_status?: string | null
  last_error?: string | null
}

type DocumentWithEuropace = DocumentRow & {
  europace?: EuropaceDocumentRow | null
}

type UploadOptions = {
  requestId?: string | null
  requestTitle?: string | null
  keepUnassigned?: boolean
  europaceCategory?: string | null
  europaceAssignmentId?: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value))
}

function formatBytes(n: number | null | undefined) {
  if (!n || Number.isNaN(n)) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return "Upload fehlgeschlagen."
}

function fileExt(name: string) {
  const raw = String(name ?? "")
  const dot = raw.lastIndexOf(".")
  if (dot < 0) return ""
  return raw.slice(dot + 1).trim().toLowerCase()
}

function isAllowedUploadFile(file: File) {
  const mime = String(file.type ?? "").trim().toLowerCase()
  if (mime && ALLOWED_UPLOAD_MIME_TYPES.has(mime)) return true
  return ALLOWED_UPLOAD_EXTENSIONS.has(fileExt(file.name))
}

function fileUrl(path: string, filename?: string | null) {
  const filenameParam = filename ? `&filename=${encodeURIComponent(filename)}` : ""
  return `/api/baufi/logo?bucket=case_documents&raw=1&download=1&path=${encodeURIComponent(path)}${filenameParam}`
}

function buildTargetKey(category: string | null | undefined, assignmentId: string | null | undefined) {
  return `${trimOrNull(category) ?? "none"}::${trimOrNull(assignmentId) ?? "none"}`
}

function translateUploadStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "uploaded") return "Erfolgreich übernommen."
  if (normalized === "error") return "Gespeichert und wird gleich erneut verarbeitet."
  if (normalized === "pending") return "Wird gerade verarbeitet."
  return normalized
}

function canSendDocumentToEuropace(row: EuropaceDocumentRow | null | undefined) {
  const normalized = String(row?.upload_status ?? "").trim().toLowerCase()
  return normalized !== "uploaded" && normalized !== "pending" && normalized !== "local_deleted"
}

export default function OnlinekreditDocumentUploadPanel({
  caseId,
  caseRef,
  accessToken,
  requirements,
  documents,
  europaceDocuments,
}: {
  caseId: string
  caseRef: string
  accessToken: string
  requirements: UploadRequirement[]
  documents: DocumentRow[]
  europaceDocuments: EuropaceDocumentRow[]
}) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const uploadBusy = busyKey !== null
  const managedDocuments = useMemo(
    () => (documents ?? []).filter((document) => !isImportedBankDocumentPath(document.file_path)),
    [documents]
  )
  const requiredRequirements = useMemo(() => requirements.filter((requirement) => requirement.required), [requirements])
  const optionalRequirements = useMemo(() => requirements.filter((requirement) => !requirement.required), [requirements])

  const europaceMap = useMemo(() => {
    const map = new Map<string, EuropaceDocumentRow>()
    for (const row of europaceDocuments ?? []) {
      const localDocumentId = trimOrNull(row.local_document_id)
      if (!localDocumentId || map.has(localDocumentId)) continue
      map.set(localDocumentId, row)
    }
    return map
  }, [europaceDocuments])

  const requirementDocumentMap = useMemo(() => {
    const map = new Map<string, DocumentWithEuropace[]>()

    for (const requirement of requirements) {
        const rows = (managedDocuments ?? []).filter((document) => {
          const europaceRow = europaceMap.get(document.id) ?? null
          if (requirement.request_id && trimOrNull(document.request_id) === trimOrNull(requirement.request_id)) {
            return true
        }

        const requirementKey = buildTargetKey(requirement.category_id, requirement.assignment_id)
        const documentKey = buildTargetKey(europaceRow?.category, europaceRow?.assignment_id)
        return requirementKey !== "none::none" && requirementKey === documentKey
      })

      map.set(
        requirement.key,
        rows.map((document) => ({
          ...document,
          europace: europaceMap.get(document.id) ?? null,
        }))
      )
    }

    return map
  }, [managedDocuments, europaceMap, requirements])

  const unmatchedDocuments = useMemo(() => {
    const matchedIds = new Set(
      Array.from(requirementDocumentMap.values())
        .flat()
        .map((document) => document.id)
    )
    return (managedDocuments ?? [])
      .filter((document) => !matchedIds.has(document.id))
      .map((document) => ({
        ...document,
        europace: europaceMap.get(document.id) ?? null,
      }))
  }, [managedDocuments, europaceMap, requirementDocumentMap])

  async function syncDocumentToEuropace(document: DocumentWithEuropace, options: {
    key: string
    europaceCategory?: string | null
    europaceAssignmentId?: string | null
  }) {
    setBusyKey(options.key)
    setStatusText(null)
    setErrorText(null)

    try {
      const response = await fetch("/api/onlinekredit/documents/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
          localDocumentId: document.id,
          europaceCategory: options.europaceCategory ?? null,
          europaceAssignmentId: options.europaceAssignmentId ?? null,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(String(json?.error ?? "Die Datei konnte gerade noch nicht übernommen werden. Bitte versuche es gleich erneut."))
      }

      setStatusText(`${document.file_name} wurde erfolgreich deinem Antrag zugeordnet.`)
      startTransition(() => router.refresh())
    } catch (error) {
      setErrorText(getErrorMessage(error))
      startTransition(() => router.refresh())
    } finally {
      setBusyKey(null)
    }
  }

  async function uploadFiles(files: FileList, target: UploadOptions & { key: string }) {
    if (!files.length) return
    setBusyKey(target.key)
    setStatusText(null)
    setErrorText(null)

    try {
      const selectedFiles = Array.from(files)
      for (const file of selectedFiles) {
        if (!isAllowedUploadFile(file)) {
          throw new Error(`"${file.name}" wird nicht unterstützt. Erlaubt sind PDF, JPG, PNG und TIFF.`)
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`"${file.name}" ist zu groß. Maximal ${formatBytes(MAX_UPLOAD_BYTES)} pro Datei.`)
        }
      }

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        setStatusText(`Upload ${index + 1}/${selectedFiles.length}: ${file.name}`)
        const form = new FormData()
        form.set("caseId", caseId)
        form.set("caseRef", caseRef)
        form.set("access", accessToken)
        form.set("file", file)
        if (target.requestId) form.set("requestId", target.requestId)
        if (target.requestTitle) form.set("requestTitle", target.requestTitle)
        if (target.keepUnassigned) form.set("keepUnassigned", "1")
        if (target.europaceCategory) form.set("europaceCategory", target.europaceCategory)
        if (target.europaceAssignmentId) form.set("europaceAssignmentId", target.europaceAssignmentId)

        const response = await fetch("/api/onlinekredit/documents/upload", {
          method: "POST",
          body: form,
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json?.ok) {
          throw new Error(String(json?.error ?? "Upload fehlgeschlagen."))
        }

        const europaceSync = (json as { europaceSync?: { attempted?: boolean; ok?: boolean; reason?: string | null } | null }).europaceSync
        if (europaceSync && (!europaceSync.attempted || !europaceSync.ok)) {
          startTransition(() => router.refresh())
          throw new Error(
            europaceSync.reason
              ? `${file.name} wurde gespeichert, konnte aber noch nicht vollständig verarbeitet werden. Bitte versuche es gleich erneut.`
              : `${file.name} wurde gespeichert und wird jetzt weiter verarbeitet.`
          )
        }
      }

      setStatusText(`${selectedFiles.length} Datei(en) erfolgreich hochgeladen.`)
      startTransition(() => router.refresh())
    } catch (error) {
      setErrorText(getErrorMessage(error))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="rounded-[32px] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,1))] p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Deine Unterlagen</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Lade jetzt die angeforderten Dokumente hoch</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Hier siehst du nur die Unterlagen, die für deinen Antrag bereits konkret gebraucht werden oder schon in
            Bearbeitung sind. Allgemeine Standardlisten blenden wir bewusst aus, damit du nur das siehst, was jetzt
            wirklich relevant ist.
          </p>
        </div>

        <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Jetzt noch offen</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{requiredRequirements.length}</div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Kann später folgen</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{optionalRequirements.length}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
        Du musst dafür nicht extra in einen anderen Bereich wechseln. Sobald später weitere Unterlagen konkret
        angefragt werden, erscheinen sie automatisch direkt hier in deinem Vorgang.
      </div>

      <div className="mt-4 grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Wichtig für den nächsten Schritt</div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
            Lade zuerst die Pflichtunterlagen hoch. Optionale Dokumente wie zum Beispiel eine Meldebescheinigung können
            später folgen und halten deinen Antrag in der Regel nicht auf.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Erlaubte Formate</div>
          <div className="mt-1 font-semibold text-slate-900">PDF, JPG, PNG, TIFF</div>
        </div>
      </div>

      {statusText ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusText}
        </div>
      ) : null}

      {errorText ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorText}</div>
      ) : null}

      {requirements.length ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {requirements.map((requirement) => {
            const matchedDocuments = requirementDocumentMap.get(requirement.key) ?? []
            const assignmentLabel = [requirement.assignment_role_name, requirement.assignment_name].filter(Boolean).join(" - ")
            const busy = uploadBusy
            const buttonLabel =
              busyKey === requirement.key ? "Upload läuft..." : uploadBusy ? "Bitte warten..." : "Unterlagen hochladen"

            return (
              <div
                key={requirement.key}
                className="h-full rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-full flex-col">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                      {requirement.category_name || requirement.category_id ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                          {requirement.category_name ?? requirement.category_id}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-3 py-1 ${
                          requirement.required
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {requirement.required ? "Pflicht" : "Optional"}
                      </span>
                      {matchedDocuments.length ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                          {matchedDocuments.length} Datei(en) vorhanden
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                          Jetzt benötigt
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{requirement.title}</h3>
                    {assignmentLabel ? <p className="mt-1 text-sm font-medium text-slate-600">Bezug: {assignmentLabel}</p> : null}
                    {requirement.category_description ? (
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">{requirement.category_description}</p>
                    ) : null}
                  </div>

                  <label
                    className={`inline-flex h-11 min-w-[164px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 ${
                      busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                  >
                    {buttonLabel}
                    <input
                      type="file"
                      multiple
                      accept={UPLOAD_ACCEPT}
                      className="hidden"
                      disabled={busy}
                      onChange={(event) => {
                        const files = event.target.files
                        if (files?.length) {
                          void uploadFiles(files, {
                            key: requirement.key,
                            requestId: requirement.request_id ?? null,
                            requestTitle: requirement.title,
                            europaceCategory: requirement.category_id ?? null,
                            europaceAssignmentId: requirement.assignment_id ?? null,
                          })
                        }
                        event.currentTarget.value = ""
                      }}
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200/70 bg-slate-50/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schon in deinem Vorgang</div>
                    <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {matchedDocuments.length} Datei(en)
                    </div>
                  </div>
                  {matchedDocuments.length ? (
                    <div className="mt-3 space-y-3">
                      {matchedDocuments.map((document) => {
                        const uploadStatus = translateUploadStatus(document.europace?.upload_status)
                        const syncKey = `sync:${document.id}`
                        const syncBusy = busyKey === syncKey
                        const allowResync = !uploadBusy && canSendDocumentToEuropace(document.europace)
                        return (
                          <div
                            key={document.id}
                            className="rounded-2xl border border-white/90 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{document.file_name}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {dt(document.created_at)} | {formatBytes(document.size_bytes)}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {allowResync ? (
                                  <button
                                    type="button"
                                    disabled={uploadBusy}
                                    onClick={() =>
                                      void syncDocumentToEuropace(document, {
                                        key: syncKey,
                                        europaceCategory: requirement.category_id ?? document.europace?.category ?? null,
                                        europaceAssignmentId: requirement.assignment_id ?? document.europace?.assignment_id ?? null,
                                      })
                                    }
                                    className={`inline-flex h-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 ${
                                      uploadBusy ? "cursor-not-allowed opacity-60" : ""
                                    }`}
                                  >
                                    {syncBusy ? "Wird gesendet..." : "Erneut übermitteln"}
                                  </button>
                                ) : null}
                                <Link
                                  href={fileUrl(document.file_path, document.file_name)}
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900"
                                >
                                  Datei öffnen
                                </Link>
                              </div>
                            </div>
                            {uploadStatus ? <div className="mt-2 text-xs text-slate-600">{uploadStatus}</div> : null}
                            {trimOrNull(document.europace?.last_error) ? (
                              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                Diese Datei wird noch geprüft: {document.europace?.last_error}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/75 px-4 py-4 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">Für diese Anforderung liegt noch keine Datei vor.</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-500">
                        Lade die passende Datei direkt hier hoch. Nach dem Upload findest du sie sofort in dieser Box.
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-slate-200/70 bg-white px-5 py-4 text-sm text-slate-600">
          Aktuell gibt es noch keine konkret angeforderten Unterlagen für deinen Antrag. Sobald etwas benötigt wird,
          erscheint es automatisch direkt hier.
        </div>
      )}

      {unmatchedDocuments.length ? (
        <div className="mt-6 rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Weitere Dateien in deinem Vorgang</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {unmatchedDocuments.map((document) => {
              const uploadStatus = translateUploadStatus(document.europace?.upload_status)
              const syncKey = `sync:${document.id}`
              const syncBusy = busyKey === syncKey
              const allowResync = !uploadBusy && canSendDocumentToEuropace(document.europace)

              return (
                <div key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{document.file_name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {dt(document.created_at)} | {formatBytes(document.size_bytes)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allowResync ? (
                        <button
                          type="button"
                          disabled={uploadBusy}
                          onClick={() =>
                            void syncDocumentToEuropace(document, {
                              key: syncKey,
                              europaceCategory: document.europace?.category ?? null,
                              europaceAssignmentId: document.europace?.assignment_id ?? null,
                            })
                          }
                          className={`inline-flex h-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 ${
                            uploadBusy ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          {syncBusy ? "Wird gesendet..." : "Erneut übermitteln"}
                        </button>
                      ) : null}
                      <Link
                        href={fileUrl(document.file_path, document.file_name)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900"
                      >
                        Datei öffnen
                      </Link>
                    </div>
                  </div>
                  {uploadStatus ? <div className="mt-2 text-xs text-slate-600">{uploadStatus}</div> : null}
                  {trimOrNull(document.europace?.last_error) ? (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Diese Datei wird noch geprüft: {document.europace?.last_error}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
