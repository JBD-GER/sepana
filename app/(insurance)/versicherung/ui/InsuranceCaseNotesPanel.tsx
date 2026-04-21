"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type NoteItem = {
  id: string
  body: string
  author_label: string
  created_at: string
}

const MAX_NOTE_LENGTH = 4000

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

export default function InsuranceCaseNotesPanel({
  caseId,
  notes,
}: {
  caseId: string
  notes: NoteItem[]
}) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setMessage(null)
    if (!value.trim()) {
      setMessage("Bitte zuerst eine Notiz eingeben.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/insurance/cases/${encodeURIComponent(caseId)}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Notiz konnte nicht gespeichert werden.")
      setValue("")
      setMessage("Notiz gespeichert.")
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message ?? "Notiz konnte nicht gespeichert werden.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Interne Kommunikation</div>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Versicherungsnotizen</h2>
      <p className="mt-1 text-sm text-slate-600">
        Diese Notizen bleiben komplett intern und sind fuer Kunden nicht sichtbar.
      </p>

      <div className="mt-4 space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Noch keine internen Versicherungsnotizen vorhanden.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{note.author_label}</div>
                <div className="text-xs text-slate-500">{formatDateTime(note.created_at)}</div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={5}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Neue interne Notiz"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {value.length} / {MAX_NOTE_LENGTH} Zeichen
          </div>
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Speichere..." : "Notiz speichern"}
          </button>
        </div>
      </div>

      {message ? <div className="mt-3 text-sm text-slate-600">{message}</div> : null}
    </div>
  )
}
