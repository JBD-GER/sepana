"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type AdvisorOption = {
  id: string
  label: string
}

export default function AssignLeadAdvisorButton({
  leadId,
  currentAdvisorId,
  advisorOptions,
}: {
  leadId: string
  currentAdvisorId: string | null
  advisorOptions: AdvisorOption[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentAdvisorId ?? "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/admin/leads/assign-advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId,
          advisorId: selected || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen")
      setMsg(String(json?.message ?? "Gespeichert"))
      router.refresh()
    } catch (error: any) {
      setMsg(error?.message ?? "Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={saving}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">- kein Berater -</option>
        {advisorOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-60"
      >
        {saving ? "Speichere..." : "Zuweisen"}
      </button>
      {msg ? <div className="text-xs text-slate-500">{msg}</div> : null}
    </div>
  )
}
