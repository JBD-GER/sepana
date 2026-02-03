"use client"

import { useEffect, useMemo, useState } from "react"

type ServiceState = "operational" | "degraded" | "outage"

type Service = {
  id: string
  name: string
  state: ServiceState
  latencyMs: number
  uptime: string
  note: string
}

type Incident = {
  id: string
  date: string
  title: string
  resolution: string
  state: string
}

type StatusPayload = {
  platformState: ServiceState
  checkedAt: string
  services: Service[]
  incidents: Incident[]
}

function stateClass(state: ServiceState) {
  if (state === "operational") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (state === "degraded") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-rose-200 bg-rose-50 text-rose-700"
}

function stateLabel(state: ServiceState) {
  if (state === "operational") return "Operational"
  if (state === "degraded") return "Beeinträchtigt"
  return "Störung"
}

export default function SystemStatusBoard() {
  const [data, setData] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setError(null)
        const response = await fetch("/api/system/status", { cache: "no-store" })
        const payload = (await response.json()) as StatusPayload

        if (!mounted) return

        if (!response.ok) {
          throw new Error("Statusdaten konnten nicht geladen werden.")
        }

        setData(payload)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Statusdaten konnten nicht geladen werden.")
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    void load()
    const interval = window.setInterval(() => {
      void load()
    }, 30000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const checkedAt = useMemo(() => {
    if (!data?.checkedAt) return "-"
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(data.checkedAt))
  }, [data?.checkedAt])

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Lade Systemstatus...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        {error || "Statusdaten sind aktuell nicht verfügbar."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Plattformstatus</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Systemüberblick</div>
          </div>

          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${stateClass(data.platformState)}`}>
            {stateLabel(data.platformState)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(service.state)}`}>
                  {stateLabel(service.state)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-600">{service.note}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Latenz: {service.latencyMs} ms</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Uptime: {service.uptime}</span>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">Letztes Update: {checkedAt}</p>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Incident Log</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">Letzte Ereignisse</div>

        <div className="mt-4 space-y-3">
          {data.incidents.map((incident) => (
            <article key={incident.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{incident.title}</h3>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  {incident.state}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{incident.resolution}</p>
              <p className="mt-2 text-[11px] text-slate-500">Datum: {incident.date}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
