"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getAdvisorCaseStatusOptions } from "@/lib/advisor/caseStatusOptions"

export default function AdvisorCaseStatusSelect({
  caseId,
  value,
  caseType,
  compact,
}: {
  caseId: string
  value: string
  caseType?: string | null
  compact?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(value)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const options = getAdvisorCaseStatusOptions(caseType)

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
      setMsg(typeof json?.warning === "string" && json.warning ? json.warning : null)
      router.refresh()
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Fehler")
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
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {msg ? <div className="text-[11px] text-slate-500">{msg}</div> : null}
    </div>
  )
}
