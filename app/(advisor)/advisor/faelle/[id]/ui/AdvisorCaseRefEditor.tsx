"use client"

import { useState } from "react"

export default function AdvisorCaseRefEditor({
  caseId,
  initialValue,
  variant = "card",
}: {
  caseId: string
  initialValue: string | null
  variant?: "card" | "inline"
}) {
  const [value, setValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/app/cases/update-advisor-ref", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, advisorCaseRef: value }),
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

  const content = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Vorgangsnummer</div>
          <div className="mt-1 text-sm text-slate-600">
            Fuegt eine externe Vorgangsnummer hinzu, um den Fall spaeter sicher zuzuordnen.
          </div>
        </div>
        <div className="flex w-full max-w-md gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Vorgangsnummer"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
          >
            {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>
      {msg ? <div className="mt-2 text-sm text-slate-600">{msg}</div> : null}
    </>
  )

  if (variant === "inline") {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        {content}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      {content}
    </div>
  )
}
