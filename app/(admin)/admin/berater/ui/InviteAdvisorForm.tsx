"use client"

import { useState } from "react"

const PRIMARY = "#07183d"

export default function InviteAdvisorForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onInvite() {
    setMsg(null)
    if (!email.includes("@")) return setMsg("Bitte eine gültige E-Mail eingeben.")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/invite-advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Einladung fehlgeschlagen")
      setMsg("Einladung wurde versendet ✅")
      setEmail("")
    } catch (e: any) {
      setMsg(e.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-sm font-medium text-slate-900">Berater einladen</div>
      <p className="mt-1 text-sm text-slate-600">
        Der Berater erhält eine Supabase Invite-Mail und wird als <span className="font-medium">advisor</span> angelegt.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="berater@domain.de"
          className="w-full rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <button
          onClick={onInvite}
          disabled={loading}
          className="rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-60"
          style={{ background: PRIMARY }}
        >
          {loading ? "Sende..." : "Einladen"}
        </button>
      </div>

      {msg ? <div className="mt-3 text-sm text-slate-700">{msg}</div> : null}
    </div>
  )
}
