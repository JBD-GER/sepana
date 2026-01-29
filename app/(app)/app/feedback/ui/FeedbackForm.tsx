"use client"

import { useState } from "react"

export default function FeedbackForm({
  cases,
}: {
  cases: Array<{ id: string; label: string }>
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? "")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    setMsg(null)
    if (!caseId) return setMsg("Bitte wählen Sie einen Fall.")
    if (message.trim().length < 5) return setMsg("Bitte schreiben Sie mindestens 5 Zeichen.")
    setLoading(true)
    try {
      const res = await fetch("/api/app/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, message }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Feedback konnte nicht gesendet werden.")
      setMsg("Danke! Feedback wurde gesendet ✅")
      setMessage("")
    } catch (e: any) {
      setMsg(e.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-sm font-medium text-slate-900">Feedback senden</div>

      <div className="mt-4 grid gap-3">
        <label className="text-xs font-medium text-slate-700">Fall</label>
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <label className="text-xs font-medium text-slate-700">Nachricht</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="Was sollen wir verbessern? Oder was war besonders gut?"
          className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <button
          onClick={submit}
          disabled={loading}
          className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 disabled:opacity-60"
        >
          {loading ? "Sende..." : "Feedback senden"}
        </button>

        {msg ? <div className="text-sm text-slate-700">{msg}</div> : null}
      </div>
    </div>
  )
}
