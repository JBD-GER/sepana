"use client"

import { startTransition, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type EuropaceRemoteDocument = {
  id: string
  key?: string | null
  displayName?: string | null
  fileName?: string | null
  createdAt?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  caseId?: string | null
  encrypted?: boolean
  categorizationStatus?: string | null
  selfUrl?: string | null
  previewUrl?: string | null
  downloadUrl?: string | null
  publicDownloadUrl?: string | null
}

type EuropacePage = {
  documentId: string
  pageNumber: number
  archived: boolean
  checkedAt?: string | null
  categories?: string[]
  neededProofIds?: string[]
  assignment?: {
    category?: string | null
    referenceId?: string | null
    status?: string | null
  } | null
  shares?: Array<{
    applicationNo?: string | null
    sharedAt?: string | null
    retrievalStatus?: string | null
    retrievalMessage?: string | null
    category?: string | null
    referenceId?: string | null
  }>
}

type EuropaceUploadTarget = {
  key: string
  title: string
  category_id: string
  category_name?: string | null
  category_description?: string | null
  assignment_id?: string | null
  assignment_type?: string | null
  assignment_name?: string | null
  assignment_role_name?: string | null
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let current = Number(value)
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function labelCategorizationStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "Unbekannt"
  if (raw === "DONE") return "Kategorisiert"
  if (raw === "PENDING") return "In Bearbeitung"
  if (raw === "FAILED") return "Fehler"
  return raw
}

function labelAssignmentStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "Offen"
  if (raw === "VOLLSTAENDIG") return "Vollstaendig"
  if (raw === "UNVOLLSTAENDIG") return "Unvollstaendig"
  return raw
}

function labelRetrievalStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "Keine Freigabe"
  if (raw === "DONE") return "Abgerufen"
  if (raw === "PENDING" || raw === "IN_PROGRESS") return "In Bearbeitung"
  if (raw === "FAILED" || raw === "ERROR") return "Fehler"
  return raw
}

function buildAssignmentKey(category: string | null | undefined, assignmentId: string | null | undefined) {
  const normalizedCategory = String(category ?? "").trim()
  if (!normalizedCategory) return null
  const normalizedAssignmentId = String(assignmentId ?? "").trim() || "none"
  return `${normalizedCategory}::${normalizedAssignmentId}`
}

function pickInitialAssignmentKey(pages: EuropacePage[], uploadTargets: EuropaceUploadTarget[]) {
  const assignmentKeys = Array.from(
    new Set(
      pages
        .map((page) => buildAssignmentKey(page.assignment?.category, page.assignment?.referenceId))
        .filter(Boolean) as string[]
    )
  )

  if (assignmentKeys.length === 1) {
    return uploadTargets.some((target) => target.key === assignmentKeys[0]) ? assignmentKeys[0] : uploadTargets[0]?.key ?? assignmentKeys[0]
  }

  return uploadTargets[0]?.key ?? ""
}

function describeAssignment(pages: EuropacePage[], uploadTargets: EuropaceUploadTarget[]) {
  const assignmentKeys = Array.from(
    new Set(
      pages
        .map((page) => buildAssignmentKey(page.assignment?.category, page.assignment?.referenceId))
        .filter(Boolean) as string[]
    )
  )

  if (!assignmentKeys.length) return "Keine feste Zuordnung"
  if (assignmentKeys.length > 1) return "Gemischte Zuordnung"

  const match = uploadTargets.find((target) => target.key === assignmentKeys[0])
  if (match) return match.title

  const [category, assignmentId] = assignmentKeys[0].split("::")
  return assignmentId && assignmentId !== "none" ? `${category} - ${assignmentId}` : category
}

export default function EuropaceDocumentsCard({
  caseId,
  initialVorgangsnummer,
  initialAntragsnummer,
  localDocumentCount,
}: {
  caseId: string
  initialVorgangsnummer: string | null
  initialAntragsnummer: string | null
  localDocumentCount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [busyRelease, setBusyRelease] = useState(false)
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null)
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<EuropaceRemoteDocument[] | null>(null)
  const [pages, setPages] = useState<EuropacePage[]>([])
  const [uploadTargets, setUploadTargets] = useState<EuropaceUploadTarget[]>([])
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string>>({})
  const [vorgangsnummer, setVorgangsnummer] = useState<string | null>(initialVorgangsnummer)
  const [antragsnummer, setAntragsnummer] = useState<string | null>(initialAntragsnummer)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function applySnapshot(json: any) {
    const nextDocuments = (Array.isArray(json?.documents) ? json.documents : []) as EuropaceRemoteDocument[]
    const nextPages = (Array.isArray(json?.pages) ? json.pages : []) as EuropacePage[]
    const nextUploadTargets = (Array.isArray(json?.uploadTargets) ? json.uploadTargets : []) as EuropaceUploadTarget[]
    const nextVorgangsnummer = String(json?.vorgangsnummer ?? "").trim() || null
    const nextAntragsnummer = String(json?.antragsnummer ?? "").trim() || null

    setDocuments(nextDocuments)
    setPages(nextPages)
    setUploadTargets(nextUploadTargets)
    setVorgangsnummer(nextVorgangsnummer)
    setAntragsnummer(nextAntragsnummer)
    setAssignmentSelections((prev) => {
      const next: Record<string, string> = {}
      for (const document of nextDocuments) {
        const previousSelection = prev[document.id]
        if (previousSelection && nextUploadTargets.some((target) => target.key === previousSelection)) {
          next[document.id] = previousSelection
          continue
        }

        const documentPages = nextPages.filter((page) => page.documentId === document.id && !page.archived)
        const initialKey = pickInitialAssignmentKey(documentPages, nextUploadTargets)
        if (initialKey) {
          next[document.id] = initialKey
        }
      }
      return next
    })
  }

  async function refreshDocuments(silent = false) {
    if (!silent) {
      setMessage(null)
      setError(null)
    }

    setBusy(true)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        if (!silent) setError(String(json?.error ?? "Europace-Unterlagen konnten nicht geladen werden."))
        return
      }

      applySnapshot(json)
      if (!silent) {
        const nextDocuments = Array.isArray(json?.documents) ? json.documents : []
        const nextVorgangsnummer = String(json?.vorgangsnummer ?? "").trim() || null
        setMessage(
          nextVorgangsnummer
            ? `${nextDocuments.length} Europace-Dokumente fuer Vorgang ${nextVorgangsnummer} geladen.`
            : `${nextDocuments.length} Europace-Dokumente geladen.`
        )
      }
    } finally {
      setBusy(false)
    }
  }

  async function releaseDocuments() {
    setBusyRelease(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/documents/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Freigabe konnte nicht erstellt werden."))
        return
      }

      applySnapshot(json)
      const pagesShared = Number(json?.pagesShared ?? 0)
      const nextAntragsnummer = String(json?.antragsnummer ?? "").trim() || antragsnummer
      setAntragsnummer(nextAntragsnummer)
      setMessage(
        nextAntragsnummer
          ? `${pagesShared} Seite(n) fuer Antrag ${nextAntragsnummer} an Europace freigegeben.`
          : `${pagesShared} Seite(n) an Europace freigegeben.`
      )
      startTransition(() => router.refresh())
    } finally {
      setBusyRelease(false)
    }
  }

  async function deleteDocument(document: EuropaceRemoteDocument) {
    if (!window.confirm(`Dokument "${document.displayName || document.fileName || document.id}" wirklich in Europace loeschen?`)) {
      return
    }

    setBusyDeleteId(document.id)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/documents/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, documentId: document.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Dokument konnte nicht geloescht werden."))
        return
      }

      applySnapshot(json)
      setMessage(`Dokument "${document.displayName || document.fileName || document.id}" wurde in Europace geloescht.`)
      startTransition(() => router.refresh())
    } finally {
      setBusyDeleteId(null)
    }
  }

  async function assignDocument(document: EuropaceRemoteDocument) {
    const targetKey = assignmentSelections[document.id]
    const target = uploadTargets.find((row) => row.key === targetKey)
    if (!target) {
      setError("Bitte zuerst ein gueltiges Europace-Ziel fuer die Zuordnung waehlen.")
      return
    }

    setBusyAssignmentId(document.id)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/documents/assignment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          documentId: document.id,
          category: target.category_id,
          assignmentId: target.assignment_id ?? null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Zuordnung konnte nicht gesetzt werden."))
        return
      }

      applySnapshot(json)
      const assignedPages = Number(json?.assignedPages ?? 0)
      setMessage(
        assignedPages > 0
          ? `${assignedPages} Seite(n) wurden auf "${target.title}" umgestellt.`
          : `Das Dokument wurde auf "${target.title}" umgestellt.`
      )
      startTransition(() => router.refresh())
    } finally {
      setBusyAssignmentId(null)
    }
  }

  useEffect(() => {
    if (!initialVorgangsnummer) return
    void refreshDocuments(true)
  }, [caseId, initialVorgangsnummer])

  const rows = documents ?? []
  const categorizedCount = rows.filter((row) => String(row.categorizationStatus ?? "").trim().toUpperCase() === "DONE").length
  const assignedPageCount = pages.filter((page) => page.assignment?.category || page.assignment?.referenceId).length
  const sharedPageCount = pages.filter((page) => Array.isArray(page.shares) && page.shares.length > 0).length

  return (
    <div className="rounded-3xl border border-sky-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Europace Unterlagen</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Dokumente im Vorgang</h2>
          <p className="mt-1 text-sm text-slate-600">
            Zeigt die aktuell in Europace sichtbaren Dokumente fuer den Privatkredit-Vorgang inklusive Seiten,
            Zuordnung und Freigabestand. Einzelne Dokumente koennen hier manuell neu zugeordnet oder direkt in
            Europace geloescht werden.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshDocuments(false)}
            disabled={busy || !initialVorgangsnummer}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Lade Unterlagen..." : "Europace laden"}
          </button>
          <button
            type="button"
            onClick={() => void releaseDocuments()}
            disabled={busyRelease || !initialVorgangsnummer || !antragsnummer}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyRelease ? "Gebe frei..." : "Unterlagen freigeben"}
          </button>
        </div>
      </div>

      {!initialVorgangsnummer ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Noch kein Europace-Vorgang vorhanden. Bitte zuerst den Privatkredit-Sync ausfuehren.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Vorgang</div>
              <div className="mt-1 break-all text-sm font-semibold text-slate-900">{vorgangsnummer || "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Antrag</div>
              <div className="mt-1 break-all text-sm font-semibold text-slate-900">{antragsnummer || "-"}</div>
              <div className="mt-1 text-[11px] text-slate-500">
                {antragsnummer ? "Freigabe moeglich" : "Freigabe erst nach Angebotsannahme"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Europace Dokumente</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{rows.length}</div>
              <div className="mt-1 text-[11px] text-slate-500">{categorizedCount} kategorisiert</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Seitenstatus</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {assignedPageCount} / {pages.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{sharedPageCount} Seite(n) bereits freigegeben</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">SEPANA Spiegelung</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{localDocumentCount}</div>
              <div className="mt-1 text-[11px] text-slate-500">{uploadTargets.length} moegliche Europace-Ziele</div>
            </div>
          </div>

          {message ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          ) : null}

          {uploadTargets.length === 0 && documents ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Europace liefert aktuell keine moeglichen Ziel-Zuordnungen. Manuelles Re-Assignment ist damit im Moment
              nicht moeglich.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {documents && rows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
                In Europace sind aktuell keine Dokumente fuer diesen Vorgang sichtbar.
              </div>
            ) : null}

            {rows.map((document) => {
              const documentPages = pages.filter((page) => page.documentId === document.id)
              const visiblePages = documentPages.filter((page) => !page.archived)
              const selectedTargetKey = assignmentSelections[document.id] ?? ""
              const selectedTarget = uploadTargets.find((target) => target.key === selectedTargetKey) ?? null
              const assignmentLabel = describeAssignment(visiblePages, uploadTargets)
              const sharedStatuses = visiblePages.flatMap((page) => page.shares ?? [])
              const latestShare = [...sharedStatuses].sort((left, right) => {
                const leftTs = left.sharedAt ? new Date(left.sharedAt).getTime() : 0
                const rightTs = right.sharedAt ? new Date(right.sharedAt).getTime() : 0
                return rightTs - leftTs
              })[0]

              return (
                <div key={document.id} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {document.displayName || document.fileName || "Dokument"}
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-600">Dokument {document.id}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
                        Kategorisierung: {labelCategorizationStatus(document.categorizationStatus)}
                      </span>
                      {document.encrypted ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
                          Verschluesselt
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Datei</div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{document.fileName || "-"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Typ</div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{document.mimeType || "-"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Groesse</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatBytes(document.sizeBytes)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Erstellt</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{dt(document.createdAt)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Zuordnung</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{assignmentLabel}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-500">Freigabe</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {labelRetrievalStatus(latestShare?.retrievalStatus)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-700">
                        {visiblePages.length} aktive Seite(n), {documentPages.length - visiblePages.length} archiviert
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-700">
                        {visiblePages.filter((page) => page.assignment?.category || page.assignment?.referenceId).length} Seite(n)
                        zugeordnet
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-700">
                        {sharedStatuses.length} Freigabe(n) protokolliert
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:min-w-[420px]">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Dokument neu zuordnen
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          value={selectedTargetKey}
                          onChange={(event) =>
                            setAssignmentSelections((prev) => ({
                              ...prev,
                              [document.id]: event.target.value,
                            }))
                          }
                          disabled={uploadTargets.length === 0 || visiblePages.length === 0 || busyAssignmentId === document.id}
                          className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadTargets.length === 0 ? <option value="">Keine Europace-Ziele verfuegbar</option> : null}
                          {uploadTargets.map((target) => (
                            <option key={target.key} value={target.key}>
                              {target.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void assignDocument(document)}
                          disabled={
                            !selectedTarget || visiblePages.length === 0 || busyAssignmentId === document.id || busyDeleteId === document.id
                          }
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyAssignmentId === document.id ? "Ordne zu..." : "Zuordnung setzen"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDocument(document)}
                          disabled={busyDeleteId === document.id || busyAssignmentId === document.id}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyDeleteId === document.id ? "Loesche..." : "In Europace loeschen"}
                        </button>
                      </div>
                      {selectedTarget ? (
                        <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-600">
                          Ziel: {selectedTarget.category_name ?? selectedTarget.category_id}
                          {selectedTarget.assignment_name || selectedTarget.assignment_role_name
                            ? ` | Bezug: ${[selectedTarget.assignment_role_name, selectedTarget.assignment_name].filter(Boolean).join(" - ")}`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {visiblePages.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {visiblePages.map((page) => {
                        const topCategory = page.categories?.[0] ?? null
                        const latestPageShare = [...(page.shares ?? [])].sort((left, right) => {
                          const leftTs = left.sharedAt ? new Date(left.sharedAt).getTime() : 0
                          const rightTs = right.sharedAt ? new Date(right.sharedAt).getTime() : 0
                          return rightTs - leftTs
                        })[0]

                        return (
                          <div key={`${page.documentId}:${page.pageNumber}`} className="rounded-xl border border-slate-200/70 bg-white px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900">Seite {page.pageNumber}</div>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                {labelAssignmentStatus(page.assignment?.status)}
                              </span>
                              {topCategory ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                  {topCategory}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 text-xs text-slate-600">
                              Zuordnung: {page.assignment?.category || "-"}
                              {page.assignment?.referenceId ? ` | Bezug ${page.assignment.referenceId}` : ""}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">Geprueft: {dt(page.checkedAt ?? null)}</div>
                            {latestPageShare ? (
                              <div className="mt-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                                Freigabe: {labelRetrievalStatus(latestPageShare.retrievalStatus)} am {dt(latestPageShare.sharedAt)}
                                {latestPageShare.applicationNo ? ` | Antrag ${latestPageShare.applicationNo}` : ""}
                                {latestPageShare.retrievalMessage ? ` | ${latestPageShare.retrievalMessage}` : ""}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-white px-3 py-3 text-sm text-slate-600">
                      Fuer dieses Dokument sind aktuell keine aktiven Seiten in Europace sichtbar.
                    </div>
                  )}
                </div>
              )
            })}

            {!documents && initialVorgangsnummer ? (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
                Die Europace-Unterlagen werden automatisch geladen, sobald die Karte sichtbar ist.
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
