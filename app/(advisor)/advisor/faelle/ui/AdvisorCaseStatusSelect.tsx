"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const OPTIONS = [
  { value: "neu", label: "Neu" },
  { value: "kontaktaufnahme", label: "Kontaktaufnahme" },
  { value: "terminiert", label: "Terminiert" },
  { value: "angebot", label: "Angebot" },
  { value: "nachfrage", label: "Nachfrage" },
  { value: "abgelehnt", label: "Abgelehnt" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
]

export default function AdvisorCaseStatusSelect({
  caseId,
  value,
  compact,
}: {
  caseId: string
  value: string
  compact?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(value)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save(nextValue: string) {
    setMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/app/cases/update-advisor-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, advisorStatus: nextValue }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")
      setSelected(nextValue)
      router.refresh()
    } catch (error: any) {
      setMsg(error?.message ?? "Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <select
        value={selected}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {msg ? <div className="text-[11px] text-slate-500">{msg}</div> : null}
    </div>
  )
}
