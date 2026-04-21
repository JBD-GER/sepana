"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { INSURANCE_ROUTE_STATUS_OPTIONS } from "@/lib/insurance/invoice"

export default function InsuranceCaseStatusPanel({
  caseId,
  value,
}: {
  caseId: string
  value: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState(String(value ?? "new"))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/insurance/cases/${encodeURIComponent(caseId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Status konnte nicht gespeichert werden.")
      setMessage("Status gespeichert.")
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message ?? "Status konnte nicht gespeichert werden.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vertriebsstatus</div>
      <div className="mt-2 text-sm text-slate-600">Nur intern fuer den Versicherungsbereich sichtbar.</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        >
          {INSURANCE_ROUTE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Speichere..." : "Status speichern"}
        </button>
      </div>
      {message ? <div className="mt-3 text-sm text-slate-600">{message}</div> : null}
    </div>
  )
}
