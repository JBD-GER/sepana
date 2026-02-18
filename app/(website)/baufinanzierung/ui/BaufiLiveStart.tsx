"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function errorLabel(code: string | null) {
  if (!code) return "Etwas ist schiefgelaufen. Bitte erneut versuchen."
  if (code === "invalid_email") return "Bitte eine gültige E-Mail eingeben."
  if (code === "email_in_use") return "Diese E-Mail gehört bereits zu einem Beraterkonto."
  return "Etwas ist schiefgelaufen. Bitte erneut versuchen."
}

export default function BaufiLiveStart() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState<{ onlineCount: number; availableCount: number; waitMinutes: number } | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

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

  if (statusLoading) return null
  const onlineCount = liveStatus?.onlineCount ?? 0
  if (onlineCount <= 0) return null
  const availableCount = liveStatus?.availableCount ?? 0
  const waitMinutes = liveStatus?.waitMinutes ?? 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!isEmail(trimmed)) {
      setError("Bitte eine gültige E-Mail eingeben.")
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
      const url = `/baufinanzierung/auswahl/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(
        caseRef
      )}${existing}&source=landing`
      router.push(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/18 via-white/10 to-white/5 p-4 text-white shadow-[0_18px_60px_rgba(15,23,42,0.35)] ring-1 ring-white/10 backdrop-blur-md">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-10 h-20 w-20 rounded-full bg-white/10 blur-2xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200/80">
          Live-Beratung
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/40 bg-emerald-200/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
          Sofort starten
        </span>
      </div>

      <div className="mt-2 text-sm font-semibold">Direkt mit Berater starten</div>
      <p className="mt-1 text-xs text-slate-200/90">
        E-Mail angeben, Einladung erhalten und sofort in die Warteschlange.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail für die Live-Session"
            className="h-11 w-full rounded-xl border border-white/40 bg-white/95 px-3 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/70"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 shrink-0 rounded-xl bg-cyan-300/95 px-4 text-sm font-semibold text-slate-900 shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Starte..." : "Live starten"}
        </button>
      </form>

      {error ? <div className="mt-2 text-xs text-rose-200">{error}</div> : null}

      {availableCount === 0 ? (
        <div className="mt-2 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-[11px] text-amber-100">
          Alle Berater sind aktuell im Gespräch. Wartezeit ca. {waitMinutes || 15} Minuten.
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-200/80">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/90" />
          Einladung per E-Mail
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/90" />
          Platz in der Warteschlange sichern
        </span>
      </div>
    </div>
  )
}
