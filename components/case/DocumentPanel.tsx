"use client"

import { useMemo, useState } from "react"

type DocRequest = {
  id: string
  case_id: string
  title: string
  required: boolean
  created_at: string
  created_by: string
}

type DocumentRow = {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  request_id?: string | null
  case_id?: string | null
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function formatBytes(n: number | null | undefined) {
  if (!n || Number.isNaN(n)) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function fileUrl(path: string) {
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}`
}

export default function DocumentPanel({
  caseId,
  requests,
  documents,
  canCreateRequest,
}: {
  caseId: string
  requests: DocRequest[]
  documents: DocumentRow[]
  canCreateRequest: boolean
}) {
  const [title, setTitle] = useState("")
  const [required, setRequired] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const docsByRequest = useMemo(() => {
    const map = new Map<string, DocumentRow[]>()
    for (const d of documents ?? []) {
      const key = d.request_id || "free"
      const arr = map.get(key) ?? []
      arr.push(d)
      map.set(key, arr)
    }
    return map
  }, [documents])

  async function uploadFiles(files: FileList, requestId?: string | null) {
    if (!files.length) return
    setMsg(null)
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append("caseId", caseId)
        if (requestId) form.append("requestId", requestId)
        form.append("file", file)
        const res = await fetch("/api/app/documents/upload", { method: "POST", body: form })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      }
      window.location.reload()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function removeDoc(id: string) {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/app/documents/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Loeschen fehlgeschlagen")
      window.location.reload()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  async function addRequest() {
    const t = title.trim()
    if (!t) return
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/app/documents/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, title: t, required }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Fehler")
      setTitle("")
      setRequired(true)
      window.location.reload()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-900">Dokumente</div>
        {canCreateRequest ? (
          <div className="text-xs text-slate-500">Berater / Admin</div>
        ) : (
          <div className="text-xs text-slate-500">Upload moeglich</div>
        )}
      </div>

      {canCreateRequest ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_120px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neues Dokument anfordern"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
            />
            Pflicht
          </label>
          <button
            onClick={addRequest}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-60"
          >
            Hinzufuegen
          </button>
        </div>
      ) : null}

      {msg ? <div className="mt-2 text-xs text-slate-600">{msg}</div> : null}

      <div className="mt-4 space-y-3">
        {(requests ?? []).map((r) => {
          const list = docsByRequest.get(r.id) ?? []
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                  <div className="text-xs text-slate-500">
                    {r.required ? "Pflicht" : "Optional"} - {dt(r.created_at)}
                  </div>
                </div>
                <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
                  Upload
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files?.length) uploadFiles(files, r.id)
                      e.currentTarget.value = ""
                    }}
                  />
                </label>
              </div>

              {list.length ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {d.mime_type?.startsWith("image/") ? (
                          <img src={fileUrl(d.file_path)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">DOC</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{d.file_name}</div>
                        <div className="text-xs text-slate-500">
                          {formatBytes(d.size_bytes)} - {dt(d.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a className="text-xs font-medium text-slate-700 hover:underline" href={fileUrl(d.file_path)} target="_blank">
                          Download
                        </a>
                        <button
                          onClick={() => removeDoc(d.id)}
                          disabled={busy}
                          className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-60"
                        >
                          Loeschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">Noch nichts hochgeladen.</div>
              )}
            </div>
          )
        })}

        {(requests ?? []).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Noch keine Dokumente angefordert.
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-600">Allgemeines Upload</div>
          <label className="mt-2 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm">
            Dateien hochladen
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files
                if (files?.length) uploadFiles(files, null)
                e.currentTarget.value = ""
              }}
            />
          </label>
          {(docsByRequest.get("free") ?? []).length ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(docsByRequest.get("free") ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {d.mime_type?.startsWith("image/") ? (
                      <img src={fileUrl(d.file_path)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">DOC</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{d.file_name}</div>
                    <div className="text-xs text-slate-500">
                      {formatBytes(d.size_bytes)} - {dt(d.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="text-xs font-medium text-slate-700 hover:underline" href={fileUrl(d.file_path)} target="_blank">
                      Download
                    </a>
                    <button
                      onClick={() => removeDoc(d.id)}
                      disabled={busy}
                      className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-60"
                    >
                      Loeschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">Noch keine Dateien hochgeladen.</div>
          )}
        </div>
      </div>
    </div>
  )
}
