"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function errorLabel(code: string | null) {
  if (!code) return "Live-Start gerade nicht möglich. Bitte erneut versuchen."
  if (code === "invalid_email") return "Bitte eine gültige E-Mail eingeben."
  if (code === "email_in_use") return "Diese E-Mail gehört bereits zu einem Beraterkonto."
  return "Live-Start gerade nicht möglich. Bitte erneut versuchen."
}

type LiveStatus = {
  onlineCount: number
  availableCount: number
  waitMinutes: number
  availableAdvisorName: string | null
}

export default function PrivatkreditLiveStart() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)

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
            availableAdvisorName: typeof json.availableAdvisorName === "string" ? json.availableAdvisorName : null,
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
  const availableAdvisorName = String(liveStatus?.availableAdvisorName ?? "").trim() || "Ein Berater"
  const canStartLive = onlineCount > 0

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

      const url = `/privatkredit/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(
        caseRef
      )}${existing}&source=privatkredit`
      router.push(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-16 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Live-Beratung
          </span>
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            Direkt im Browser
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Jetzt live mit einer Beraterin oder einem Berater sprechen
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
          E-Mail eintragen, Platz in der Warteschlange sichern und direkt im Browser verbunden werden.
        </p>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Vorteil: Wir prüfen Ihre Anfrage live und können bei Eignung direkt gemeinsam beantragen, ohne Umwege.
        </div>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail für die Live-Beratung"
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
          />
          <button
            type="submit"
            disabled={busy || !canStartLive}
            className="h-12 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-900 px-5 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Starte..." : "Live-Beratung starten"}
          </button>
        </form>
        <div className="mt-2 text-xs text-slate-500">Live-Beratung starten und direkte Ersteinschätzung in wenigen Minuten erhalten.</div>

        {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}

        {statusLoading ? (
          <div className="mt-3 text-xs text-slate-500">Prüfe Live-Verfügbarkeit...</div>
        ) : canStartLive ? (
          <>
            {availableCount > 0 ? (
              <div className="live-ready-wrap mt-4 rounded-2xl border border-emerald-300/70 bg-gradient-to-r from-emerald-500/15 via-cyan-400/20 to-teal-400/20 p-4 text-emerald-900 shadow-[0_12px_35px_rgba(16,185,129,0.18)]">
                <div className="live-scan" aria-hidden />
                <div className="relative flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.18)]">
                    <span className="live-ping" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Live jetzt verfügbar
                    </div>
                    <div className="mt-1 text-lg font-semibold text-emerald-900">{availableAdvisorName} wartet bereits live auf Sie</div>
                    <div className="mt-1 text-sm text-emerald-800/90">
                      {availableCount > 1
                        ? `+ ${availableCount - 1} weitere Berater sind aktuell frei.`
                        : "Direkter Start ohne Wartezeit möglich."}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {`Alle Berater sind aktuell im Gespräch. Wartezeit ca. ${waitMinutes || 15} Minuten.`}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Aktuell ist kein Berater online. Nutzen Sie das Kontaktformular, wir melden uns kurzfristig.
          </div>
        )}
      </div>

      <style jsx>{`
        .live-ready-wrap {
          position: relative;
          overflow: hidden;
          animation: live-breathe 2.1s ease-in-out infinite;
        }
        .live-scan {
          position: absolute;
          top: -20%;
          left: -18%;
          width: 24%;
          height: 140%;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0));
          transform: rotate(8deg);
          animation: live-scan 2.4s linear infinite;
          pointer-events: none;
        }
        .live-ping {
          position: absolute;
          inset: -3px;
          border-radius: 9999px;
          border: 2px solid rgba(16, 185, 129, 0.55);
          animation: live-ping 1.6s ease-out infinite;
          content: "";
        }
        @keyframes live-scan {
          0% {
            transform: translateX(-180%) rotate(8deg);
          }
          100% {
            transform: translateX(620%) rotate(8deg);
          }
        }
        @keyframes live-breathe {
          0%,
          100% {
            box-shadow: 0 12px 35px rgba(16, 185, 129, 0.16);
          }
          50% {
            box-shadow: 0 16px 44px rgba(6, 182, 212, 0.22);
          }
        }
        @keyframes live-ping {
          0% {
            transform: scale(0.85);
            opacity: 0.75;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  )
}
