"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

type Ticket = {
  id: string
  status: string
  created_at: string
  guest_token?: string | null
}

type LiveQueueUpdate = {
  status?: string | null
  guest_token?: string | null
}

export default function CustomerQueue({
  caseId,
  caseRef,
  backHref,
}: {
  caseId: string
  caseRef: string
  backHref: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [guestToken, setGuestToken] = useState<string | null>(null)
  const [waitMinutes, setWaitMinutes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [ended, setEnded] = useState(false)
  const rejoinRef = useRef(false)

  async function joinQueue() {
    const res = await fetch("/api/live/queue/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId, guest: true }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) return null
    const nextTicket: Ticket | null = json.ticket ?? null
    const token = json.guestToken ?? nextTicket?.guest_token ?? null
    if (token && nextTicket?.id) {
      try {
        localStorage.setItem(`live_guest_${nextTicket.id}`, token)
      } catch {
        // ignore
      }
    }
    setTicket(nextTicket)
    setGuestToken(token)
    setWaitMinutes(typeof json.waitMinutes === "number" ? json.waitMinutes : null)

    if (nextTicket?.status === "active") {
      const guestParam = token ? `?guest=${encodeURIComponent(token)}` : ""
      router.replace(`/live/${nextTicket.id}${guestParam}`)
    }

    return nextTicket
  }

  useEffect(() => {
    if (!caseId) return
    let alive = true
    ;(async () => {
      const next = await joinQueue()
      if (!alive) return
      setLoading(false)
      if (!next) setEnded(true)
    })()
    return () => {
      alive = false
    }
  }, [caseId])

  useEffect(() => {
    if (ticket?.id && !guestToken) {
      try {
        const stored = localStorage.getItem(`live_guest_${ticket.id}`)
        if (stored) setGuestToken(stored)
      } catch {
        // ignore
      }
    }
  }, [ticket?.id, guestToken])

  useEffect(() => {
    if (!ticket?.id) return
    const channel = supabase
      .channel(`live_ticket_${ticket.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_queue_tickets", filter: `id=eq.${ticket.id}` },
        async (payload: RealtimePostgresChangesPayload<LiveQueueUpdate>) => {
          const next = payload.new as Partial<LiveQueueUpdate>
          if (next?.guest_token) {
            setGuestToken(next.guest_token)
            try {
              localStorage.setItem(`live_guest_${ticket.id}`, next.guest_token)
            } catch {
              // ignore
            }
          }
          const nextStatus = next.status
          if (typeof nextStatus === "string") {
            setTicket((prev) => (prev ? { ...prev, status: nextStatus } : prev))
          }
          if (nextStatus === "active") {
            const token = next?.guest_token || guestToken
            const guestParam = token ? `?guest=${encodeURIComponent(token)}` : ""
            router.replace(`/live/${ticket.id}${guestParam}`)
          }
          if (nextStatus === "cancelled" || nextStatus === "ended") {
            if (!rejoinRef.current) {
              rejoinRef.current = true
              const newTicket = await joinQueue()
              if (newTicket && (newTicket.status === "waiting" || newTicket.status === "active")) {
                setEnded(false)
                rejoinRef.current = false
                return
              }
            }
            setEnded(true)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, ticket?.id, guestToken, router])

  async function leaveQueue() {
    if (!ticket?.id) return
    await fetch("/api/live/queue/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id, caseId, guestToken }),
    })
    router.replace(backHref)
  }

  if (!caseId) {
    return <div className="text-sm text-slate-600">Kein Fall gefunden.</div>
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Warteschlange wird geladen...</div>
  }

  if (ended) {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div>Die Live-Beratung wurde beendet.</div>
        <a href={backHref} className="text-sm font-medium text-slate-900 underline underline-offset-4">
          Zurueck zur Auswahl
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-700">
        Fall-Referenz: <span className="font-semibold text-slate-900">{caseRef || "-"}</span>
      </div>

      {waitMinutes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Erwartete Wartezeit ca. {waitMinutes} Minuten.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Bitte bleiben Sie auf dieser Seite. Sobald ein Berater annimmt, starten wir automatisch.
      </div>

      <button
        onClick={leaveQueue}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
      >
        Warteschlange verlassen
      </button>
    </div>
  )
}
