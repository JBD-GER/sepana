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

const BAUFI_FACTS = [
  "Eine laengere Zinsbindung gibt mehr Planungssicherheit, ist aber meist etwas teurer.",
  "Schon 0,2 % Zinsunterschied koennen ueber die Laufzeit viele tausend Euro ausmachen.",
  "Mehr Eigenkapital verbessert in der Regel die Konditionen deutlich.",
  "Die Haushaltsrechnung ist fuer Banken oft wichtiger als Einzelwerte im Formular.",
  "Sondertilgungen geben Flexibilitaet bei Gehaltserhoehungen oder Boni.",
  "Ein realistischer Puffer fuer Nebenkosten hilft gegen spaetere Engpaesse.",
  "Bereitstellungszinsen koennen bei Bauprojekten relevant werden.",
  "Forward-Darlehen sichern fruehzeitig heutige Konditionen fuer die Zukunft.",
  "Der Effektivzins ist meist aussagekraeftiger als nur der Sollzins.",
  "Region, Objektart und Bonitaet beeinflussen die Bankenbewertung stark.",
  "Eine solide Anschlussfinanzierungsstrategie spart spaeter oft viel Geld.",
  "Auch kleine bestehende Kredite beeinflussen die Gesamttragfaehigkeit.",
  "Ein sauberer, aktueller Unterlagenstand beschleunigt den Entscheidungsprozess.",
  "Nicht nur der Preis, auch die Vertragsflexibilitaet ist wichtig.",
  "Tilgungswechsel kann bei veraendertem Einkommen hilfreich sein.",
  "Familienplanung sollte bei Laufzeit und Rate mitbedacht werden.",
  "KfW-Programme koennen je nach Vorhaben interessante Bausteine sein.",
  "Eine zu knappe Rate kann spaeter zu Nachfinanzierungsdruck fuehren.",
  "Banken schauen auf Stabilitaet von Einkommen und Beschaeftigung.",
  "Auch kleine Schufa-Themen koennen den Zinssatz beeinflussen.",
  "Bei Neubau sind Zeitplanung und Abrufstrategie besonders wichtig.",
  "Nebenkosten wie Notar, Steuer und Makler sollten voll eingeplant sein.",
  "Ein realistischer Beleihungsauslauf verbessert oft den Zinssatz.",
  "Vergleichbar wird ein Angebot erst mit denselben Laufzeit- und Tilgungsparametern.",
  "Fragen zur Bankrueckmeldung am besten sofort mit dem Berater klaeren.",
] as const

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
  const leftRef = useRef(false)

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
    leftRef.current = false
  }, [ticket?.id])

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
    leftRef.current = true
    await fetch("/api/live/queue/leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id, caseId, guestToken }),
      keepalive: true,
    })
    router.replace(backHref)
  }

  useEffect(() => {
    if (!ticket?.id || ticket.status !== "waiting") return

    const payload = JSON.stringify({ ticketId: ticket.id, caseId, guestToken })
    const url = "/api/live/queue/leave"

    const sendLeave = () => {
      if (leftRef.current) return
      leftRef.current = true
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" })
          const sent = navigator.sendBeacon(url, blob)
          if (sent) return
        }
      } catch {
        // ignore
      }
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // ignore
      })
    }

    const onPageHide = () => sendLeave()
    const onBeforeUnload = () => sendLeave()

    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [ticket?.id, ticket?.status, caseId, guestToken])

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
        <div className="font-semibold text-slate-900">Wichtiger Hinweis</div>
        <div className="mt-1">
          Bitte verlassen Sie dieses Fenster nicht. In wenigen Minuten geht es los - Ihr Berater ist aktuell noch im aktiven Gespraech.
        </div>
        <div className="mt-2 text-xs text-slate-600">
          Sobald der Berater frei ist, starten wir die Live-Beratung automatisch.
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold text-slate-900">
          25 wissenswerte Infos zur Baufinanzierung
        </summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-xs text-slate-600 sm:grid-cols-2 sm:gap-x-6">
          {BAUFI_FACTS.map((fact, index) => (
            <li key={index}>{fact}</li>
          ))}
        </ol>
      </details>

      <button
        onClick={leaveQueue}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
      >
        Warteschlange verlassen und zur Bankauswahl
      </button>
    </div>
  )
}
