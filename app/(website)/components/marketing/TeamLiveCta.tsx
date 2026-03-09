"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type LiveStatus = {
  onlineCount: number
  availableCount: number
  availableAdvisorName: string | null
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

export default function TeamLiveCta({
  href = "/live-beratung",
  buttonLabel = "Jetzt live Umschuldung berechnen",
}: {
  href?: string
  buttonLabel?: string
}) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<LiveStatus | null>(null)

  useEffect(() => {
    let alive = true
    let intervalId: number | null = null

    const loadStatus = async () => {
      try {
        const res = await fetch("/api/live/status", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!alive) return

        if (res.ok && json?.ok) {
          setStatus({
            onlineCount: Number(json.onlineCount || 0),
            availableCount: Number(json.availableCount || 0),
            availableAdvisorName: typeof json.availableAdvisorName === "string" ? json.availableAdvisorName : null,
          })
        } else {
          setStatus(null)
        }
      } catch {
        if (alive) setStatus(null)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void loadStatus()
    intervalId = window.setInterval(() => {
      void loadStatus()
    }, 25000)

    return () => {
      alive = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  const onlineCount = status?.onlineCount ?? 0
  const availableCount = status?.availableCount ?? 0
  const availableAdvisorName = String(status?.availableAdvisorName ?? "").trim() || "Ein Berater"
  const available = availableCount > 0
  const online = onlineCount > 0

  return (
    <div
      className={cn(
        "mt-6 rounded-[24px] border p-4 shadow-sm sm:p-5",
        available && "border-emerald-300/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.14)_0%,rgba(6,182,212,0.14)_100%)]",
        !available && online && "border-amber-200 bg-amber-50",
        !online && "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
              available && "border border-emerald-300/60 bg-white/70 text-emerald-800",
              !available && online && "border border-amber-200 bg-white/80 text-amber-800",
              !online && "border border-slate-200 bg-white text-slate-600"
            )}
          >
            {loading ? "Live-Status wird geprüft" : available ? "Live-Beratung verfügbar" : online ? "Berater online" : "Live-Beratung"}
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            {available ? "Jetzt live Umschuldung berechnen" : "Direkt zur Live-Beratung"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {loading
              ? "Wir prüfen gerade, ob ein Berater direkt live verfügbar ist."
              : available
                ? `${availableAdvisorName} oder ein weiterer Berater kann Ihre Umschuldung jetzt direkt live mit Ihnen durchgehen.`
                : online
                  ? "Ein Berater ist online. Wenn gerade alle Gespräche laufen, kommen Sie über die Live-Beratung direkt in den richtigen Einstieg."
                  : "Auch wenn gerade niemand live frei ist, ist sofort klar erkennbar, dass SEPANA Live-Beratung anbietet und Sie direkt dorthin wechseln können."}
          </p>
        </div>

        <Link
          href={href}
          className={cn(
            "inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition",
            available && "bg-slate-900 text-white shadow-[0_14px_34px_rgba(15,23,42,0.22)] hover:bg-slate-800",
            !available && "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
          )}
        >
          {available ? buttonLabel : "Zur Live-Beratung"}
        </Link>
      </div>
    </div>
  )
}
