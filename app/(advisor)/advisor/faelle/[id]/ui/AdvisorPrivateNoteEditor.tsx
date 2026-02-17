"use client"

import { useState } from "react"

const MAX_NOTE_LENGTH = 4000

export default function AdvisorPrivateNoteEditor({
  caseId,
  initialValue,
}: {
  caseId: string
  initialValue: string | null
}) {
  const [value, setValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/app/cases/update-advisor-private-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, advisorPrivateNote: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")
      setMsg("Gespeichert")
    } catch (error: any) {
      setMsg(error?.message ?? "Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Interne Notiz</div>
      <div className="mt-1 text-sm text-slate-600">Nur fuer Berater/Admin sichtbar. Kunden sehen diese Notiz nicht.</div>
      <div className="mt-3 space-y-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Interne Notizen zum Fall"
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">{value.length} / {MAX_NOTE_LENGTH} Zeichen</div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
          >
            {saving ? "Speichere..." : "Notiz speichern"}
          </button>
        </div>
      </div>
      {msg ? <div className="mt-2 text-sm text-slate-600">{msg}</div> : null}
    </div>
  )
}
