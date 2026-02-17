"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function errorLabel(code: string | null) {
  if (!code) return "Live-Start gerade nicht moeglich. Bitte erneut versuchen."
  if (code === "invalid_email") return "Bitte eine gueltige E-Mail eingeben."
  if (code === "email_in_use") return "Diese E-Mail gehoert bereits zu einem Beraterkonto."
  return "Live-Start gerade nicht moeglich. Bitte erneut versuchen."
}

export default function PrivatkreditLiveStart() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState<{ onlineCount: number; availableCount: number; waitMinutes: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/live/status", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok && json?.ok) {
          setLiveStatus({
            onlineCount: Number(json.onlineCount || 0),
            availableCount: Number(json.availableCount || 0),
            waitMinutes: Number(json.waitMinutes || 0),
          })
        } else {
          setLiveStatus(null)
        }
      } catch {
        if (alive) setLiveStatus(null)
      } finally {
        if (alive) setStatusLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const onlineCount = liveStatus?.onlineCount ?? 0
  const availableCount = liveStatus?.availableCount ?? 0
  const waitMinutes = liveStatus?.waitMinutes ?? 0
  const canStartLive = onlineCount > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!isEmail(trimmed)) {
      setError("Bitte eine gueltige E-Mail eingeben.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/live/landing/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, language: "de" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(errorLabel(String(json?.error ?? null)))
        return
      }
      const caseId = String(json.caseId || "").trim()
      const caseRef = String(json.caseRef || "").trim()
      const existing = json.existingAccount ? "&existing=1" : ""
      if (!caseId) {
        setError("Konnte Live-Session nicht starten.")
        return
      }
      const url = `/privatkredit/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(
        caseRef
      )}${existing}&source=privatkredit`
      router.push(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live-Beratung</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Direkter Start mit Berater</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
        E-Mail eintragen, Platz in der Warteschlange sichern und im Browser mit einem Berater sprechen.
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail fuer die Live-Beratung"
          required
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          disabled={busy || !canStartLive}
          className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Starte..." : "Jetzt live starten"}
        </button>
      </form>

      {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}

      {statusLoading ? (
        <div className="mt-3 text-xs text-slate-500">Pruefe Live-Verfuegbarkeit...</div>
      ) : canStartLive ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {availableCount > 0
            ? "Berater sind jetzt verfuegbar. Sie koennen direkt starten."
            : `Alle Berater sind aktuell im Gespraech. Wartezeit ca. ${waitMinutes || 15} Minuten.`}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Aktuell ist kein Berater online. Nutzen Sie das Kontaktformular, wir melden uns kurzfristig.
        </div>
      )}
    </section>
  )
}
