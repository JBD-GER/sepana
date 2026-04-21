"use client"

import { useState } from "react"

export default function AdvisorInsuranceForwardButton({
  caseId,
  initialRouted = false,
}: {
  caseId: string
  initialRouted?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [routed, setRouted] = useState(initialRouted)
  const [error, setError] = useState<string | null>(null)

  async function forward() {
    if (loading || routed) return

    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/app/cases/schufa-frei/insurance-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, action: "forward" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Weiterleitung fehlgeschlagen.")
      }
      setRouted(true)
    } catch (err: any) {
      setError(err?.message ?? "Weiterleitung fehlgeschlagen.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={forward}
        disabled={loading || routed}
        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed ${
          routed
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-100"
            : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
        }`}
      >
        {loading ? "Leite weiter..." : routed ? "Weitergeleitet" : "Versicherung"}
      </button>
      {error ? <div className="text-[11px] text-rose-600">{error}</div> : null}
    </div>
  )
}
