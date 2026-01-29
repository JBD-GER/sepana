"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

export default function AssignAdvisorButton({
  caseId,
  currentAdvisorId,
  advisorIds,
  emailById,
}: {
  caseId: string
  currentAdvisorId: string | null
  advisorIds: string[]
  emailById: Record<string, string>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>(currentAdvisorId ?? "")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const options = useMemo(
    () => advisorIds.map((id) => ({ id, label: emailById[id] || id })),
    [advisorIds, emailById]
  )

  async function save() {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/cases/assign-advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, advisorId: selected || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Zuweisung fehlgeschlagen")

      setMsg("Gespeichert ✅")
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-800">Berater zuweisen</div>
        <button
          className="text-xs text-slate-600 hover:text-slate-900"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? "Schließen" : "Öffnen"}
        </button>
      </div>

      {open ? (
        <div className="mt-2 space-y-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={loading}
          >
            <option value="">— keinen —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={save}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:border-slate-300 disabled:opacity-60"
            type="button"
          >
            {loading ? "Speichere..." : "Speichern"}
          </button>

          {msg ? <div className="text-xs text-slate-600">{msg}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
