"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { formatDate, formatTime, isSameDay } from "@/components/appointments/utils"

type AppointmentItem = {
  id: string
  case_id: string
  case_ref?: string | null
  advisor_name?: string | null
  start_at: string
  end_at: string
  reason?: string | null
  status?: string | null
  advisor_waiting_at?: string | null
  customer_waiting_at?: string | null
}

function sortByStart(a: AppointmentItem, b: AppointmentItem) {
  return +new Date(a.start_at) - +new Date(b.start_at)
}

export default function CustomerTermine() {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [liveTickets, setLiveTickets] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const todayAppointments = useMemo(
    () => appointments.filter((a) => isSameDay(new Date(a.start_at), new Date())).sort(sortByStart),
    [appointments]
  )
  const upcomingAppointments = useMemo(
    () => appointments.filter((a) => !isSameDay(new Date(a.start_at), new Date())).sort(sortByStart),
    [appointments]
  )

  async function loadAppointments() {
    setLoading(true)
    try {
      const res = await fetch("/api/app/appointments?upcoming=1&limit=200")
      const json = await res.json().catch(() => ({}))
      if (res.ok) setAppointments(Array.isArray(json.items) ? json.items : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!active) return
        setUserId(data.user?.id ?? null)
      } catch (err: unknown) {
        if (!active) return
        if (!(err instanceof Error) || err.name !== "AbortError") {
          console.error("CustomerTermine getUser error:", err)
        }
        setUserId(null)
      }
    })()
    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel("case_appointments_customer")
      .on("postgres_changes", { event: "*", schema: "public", table: "case_appointments" }, () => loadAppointments())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`live_queue_customer_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_queue_tickets", filter: `customer_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as { status?: string | null; id?: string | null }
          if (next?.status !== "active" || !next?.id) return
          router.push(`/live/${next.id}`)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, router])

  async function setWaiting(appt: AppointmentItem, status: "enter" | "leave") {
    setInfo(null)
    setActionId(appt.id)
    try {
      await fetch("/api/app/appointments/waiting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id, status }),
      })

      if (status === "enter") {
        const res = await fetch("/api/live/queue/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ caseId: appt.case_id }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setInfo("Der Warteraum konnte gerade nicht geöffnet werden.")
          return
        }
        if (json?.ticket?.id) {
          if (json.ticket.status === "active") {
            router.push(`/live/${json.ticket.id}`)
            return
          }
          setLiveTickets((prev) => ({ ...prev, [appt.id]: json.ticket.id }))
          setInfo("Sie sind im Warteraum. Wir benachrichtigen Sie sofort, sobald die Beratung startet.")
        }
      } else {
        const ticketId = liveTickets[appt.id]
        if (ticketId) {
          await fetch("/api/live/queue/leave", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ticketId, caseId: appt.case_id }),
          })
        }
        setLiveTickets((prev) => {
          const next = { ...prev }
          delete next[appt.id]
          return next
        })
        setInfo("Sie haben den Warteraum verlassen.")
      }

      await loadAppointments()
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -top-12 right-0 h-32 w-32 rounded-full bg-cyan-200/45 blur-3xl" />
        <h1 className="relative text-2xl font-semibold tracking-tight text-slate-900">Termine</h1>
        <p className="relative mt-2 text-sm text-slate-600">
          Hier verwalten Sie Ihre Beratungstermine und betreten bei Bedarf direkt den Warteraum.
        </p>
      </section>

      {info ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">{info}</div>
      ) : null}

      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Heute</div>
            <div className="text-xs text-slate-500">Direkter Einstieg in den Warteraum</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
            {todayAppointments.length} Termin(e)
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Lade Termine…</div>
        ) : todayAppointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            Für heute sind keine Termine geplant.
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppointments.map((a) => {
              const start = new Date(a.start_at)
              const end = new Date(a.end_at)
              const advisorReady = !!a.advisor_waiting_at
              const customerWaiting = !!a.customer_waiting_at
              const isCancelled = a.status === "cancelled"
              const busy = actionId === a.id

              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">
                        Fall {a.case_ref || "—"} · {a.advisor_name || "Berater"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {formatDate(start)} · {formatTime(start)} – {formatTime(end)}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{a.reason || "Beratungstermin"}</div>
                    </div>

                    {advisorReady ? (
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        Berater bereit
                      </div>
                    ) : customerWaiting ? (
                      <div className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700">
                        Im Warteraum
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setWaiting(a, customerWaiting ? "leave" : "enter")}
                      disabled={isCancelled || busy}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCancelled
                        ? "Abgesagt"
                        : busy
                          ? "Bitte warten…"
                          : customerWaiting
                            ? "Warteraum verlassen"
                            : "Warteraum öffnen"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Weitere Termine</div>
            <div className="text-xs text-slate-500">Alle kommenden Buchungen</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
            {upcomingAppointments.length} Termin(e)
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Lade Termine…</div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            Keine weiteren Termine vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((a) => {
              const start = new Date(a.start_at)
              const end = new Date(a.end_at)
              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-base font-semibold text-slate-900">
                    Fall {a.case_ref || "—"} · {a.advisor_name || "Berater"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {formatDate(start)} · {formatTime(start)} – {formatTime(end)}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{a.reason || "Beratungstermin"}</div>
                  <div className="mt-3 text-[11px] text-slate-500">Der Warteraum wird am Termin-Tag automatisch freigeschaltet.</div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
