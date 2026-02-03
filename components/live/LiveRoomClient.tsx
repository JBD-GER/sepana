"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client"
import { createBrowserSupabaseClientNoAuth } from "@/lib/supabase/browser"
import LiveOfferPanel from "@/components/live/LiveOfferPanel"
import LiveOfferModal from "@/components/live/LiveOfferModal"
import LiveCasePanel from "@/components/live/LiveCasePanel"

type OfferSummary = {
  id: string
  status: string
  provider_id: string
  loan_amount: number | null
  rate_monthly: number | null
  apr_effective: number | null
  interest_nominal: number | null
  term_months: number | null
  zinsbindung_years: number | null
  tilgung_pct: number | null
  special_repayment: string | null
  notes_for_customer: string | null
  created_at: string
}

type ProviderItem = { provider: { id: string; name: string } }

type TicketUpdate = {
  status?: string | null
  accepted_at?: string | null
  ended_at?: string | null
}

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—"
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}m ${sec}s`
}

function dt(d: string | null | undefined) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d))
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "accepted" ? "Angenommen" : status === "rejected" ? "Abgelehnt" : status === "sent" ? "Gesendet" : status
  const classes =
    status === "accepted"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700"
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  )
}

function VideoTile({
  track,
  muted,
  cover,
}: {
  track: RemoteTrack | LocalVideoTrack | null
  muted?: boolean
  cover?: boolean
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!track || !element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])

  return (
    <video
      ref={ref}
      muted={muted}
      className={`h-full w-full rounded-2xl ${cover ? "object-cover" : "object-contain"}`}
      playsInline
      autoPlay
    />
  )
}

function AudioTile({ track }: { track: RemoteTrack | null }) {
  const ref = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!track || !element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])

  return <audio ref={ref} autoPlay />
}

export default function LiveRoomClient({
  ticketId,
  caseId,
  caseRef,
  canOffer,
  isCustomer,
  guestToken,
  initialStatus,
  initialCreatedAt,
  initialAcceptedAt,
  initialEndedAt,
}: {
  ticketId: string
  caseId: string
  caseRef: string | null
  canOffer: boolean
  isCustomer: boolean
  guestToken?: string
  initialStatus: string
  initialCreatedAt: string | null
  initialAcceptedAt: string | null
  initialEndedAt: string | null
}) {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClientNoAuth(), [])
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }))

  const [connected, setConnected] = useState(false)
  const [localVideo, setLocalVideo] = useState<LocalVideoTrack | null>(null)
  const [localAudio, setLocalAudio] = useState<LocalAudioTrack | null>(null)
  const [remoteVideo, setRemoteVideo] = useState<RemoteTrack | null>(null)
  const [remoteAudio, setRemoteAudio] = useState<RemoteTrack | null>(null)

  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [ticketStatus, setTicketStatus] = useState(initialStatus)
  const [acceptedAt, setAcceptedAt] = useState<string | null>(initialAcceptedAt)
  const [endedAt, setEndedAt] = useState<string | null>(initialEndedAt)

  const [summaryOffers, setSummaryOffers] = useState<OfferSummary[]>([])
  const [providerMap, setProviderMap] = useState<Record<string, string>>({})
  const [summaryLoading, setSummaryLoading] = useState(false)

  const summaryLoaded = useRef(false)
  const endingRef = useRef(false)
  const showOfferPanel = canOffer && !isCustomer
  const hasEnded = ticketStatus === "ended" || ticketStatus === "cancelled"

  const loadSummary = useCallback(async () => {
    if (summaryLoaded.current) return
    summaryLoaded.current = true
    setSummaryLoading(true)
    try {
      const qs = new URLSearchParams({ caseId, includeHistory: "1", ticketId })
      if (guestToken) qs.set("guestToken", guestToken)

      const [offerRes, providerRes] = await Promise.all([
        fetch(`/api/live/offer?${qs.toString()}`),
        fetch("/api/baufi/providers?product=baufi"),
      ])
      const offerJson = await offerRes.json().catch(() => ({}))
      const providerJson = await providerRes.json().catch(() => ({}))

      const offers: OfferSummary[] = Array.isArray(offerJson?.offers) ? offerJson.offers : []
      const providerItems: ProviderItem[] = Array.isArray(providerJson?.items) ? providerJson.items : []

      const map: Record<string, string> = {}
      for (const item of providerItems) map[item.provider.id] = item.provider.name

      setProviderMap(map)
      setSummaryOffers(offers)
    } finally {
      setSummaryLoading(false)
    }
  }, [caseId, ticketId, guestToken])

  async function endCall() {
    if (endingRef.current) return
    endingRef.current = true
    await fetch("/api/live/queue/end", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId, guestToken }),
    })

    room.disconnect()

    if (isCustomer) {
      setTicketStatus("ended")
      setEndedAt(new Date().toISOString())
      loadSummary()
      return
    }

    router.replace("/advisor")
  }

  const handleRemoteEnd = useCallback((nextEndedAt?: string | null) => {
    if (endingRef.current) return
    endingRef.current = true

    room.disconnect()
    setTicketStatus("ended")
    if (nextEndedAt) setEndedAt(nextEndedAt)

    if (isCustomer) {
      loadSummary()
      return
    }
    router.replace("/advisor")
  }, [isCustomer, loadSummary, room, router])

  useEffect(() => {
    const channel = supabase
      .channel(`live_ticket_${ticketId}_end`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_queue_tickets", filter: `id=eq.${ticketId}` },
        (payload: RealtimePostgresChangesPayload<TicketUpdate>) => {
          const next = payload.new as Partial<TicketUpdate>
          if (next?.status) setTicketStatus(next.status)
          if (next?.accepted_at) setAcceptedAt(next.accepted_at)
          if (next?.ended_at) setEndedAt(next.ended_at)
          if (next?.status === "ended" || next?.status === "cancelled") {
            handleRemoteEnd(next.ended_at ?? null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, ticketId, handleRemoteEnd])

  useEffect(() => {
    if (hasEnded && isCustomer) loadSummary()
  }, [hasEnded, isCustomer, loadSummary])

  useEffect(() => {
    if (hasEnded) return
    let active = true

    const onTrackSubscribed = (track: RemoteTrack) => {
      if (track.kind === "video") setRemoteVideo(track)
      if (track.kind === "audio") setRemoteAudio(track)
    }
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === "video") setRemoteVideo(null)
      if (track.kind === "audio") setRemoteAudio(null)
    }

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)

    ;(async () => {
      try {
        const res = await fetch("/api/live/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ticketId, guestToken }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Token-Fehler")

        await room.connect(json.url, json.token)
        if (!active) return
        setConnected(true)

        const audio = await createLocalAudioTrack()
        await room.localParticipant.publishTrack(audio)
        setLocalAudio(audio)

        try {
          const video = await createLocalVideoTrack()
          await room.localParticipant.publishTrack(video)
          setLocalVideo(video)
        } catch {
          setCamOn(false)
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Verbindung fehlgeschlagen"
        setErr(message)
      }
    })()

    return () => {
      active = false
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      room.disconnect()
    }
  }, [room, ticketId, guestToken, hasEnded])

  async function toggleMic() {
    if (!localAudio) return
    if (micOn) {
      await localAudio.mute()
      setMicOn(false)
    } else {
      await localAudio.unmute()
      setMicOn(true)
    }
  }

  async function toggleCam() {
    if (camOn) {
      if (localVideo) await localVideo.mute()
      setCamOn(false)
      return
    }

    try {
      if (!localVideo) {
        const video = await createLocalVideoTrack()
        await room.localParticipant.publishTrack(video)
        setLocalVideo(video)
      } else {
        await localVideo.unmute()
      }
      setCamOn(true)
    } catch {
      setCamOn(false)
      setErr("Kamera konnte nicht gestartet werden. Bitte Berechtigung prüfen und erneut versuchen.")
    }
  }

  const summaryItems = summaryOffers
    .filter((offer) => offer.status === "accepted" || offer.status === "rejected")
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.2),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.85),rgba(2,6,23,1))]" />

      <div className="relative border-b border-white/10 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Live-Session</div>
            <div className="mt-1 text-base font-semibold text-white">{caseRef || "Beratung"}</div>
            <div className="mt-1 text-xs text-slate-300">
              {isCustomer ? "Kunde" : "Berater"} · Start {dt(acceptedAt || initialCreatedAt)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                hasEnded
                  ? "border-slate-500/60 bg-slate-700/40 text-slate-200"
                  : connected
                    ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                    : "border-amber-300/40 bg-amber-500/20 text-amber-100"
              }`}
            >
              {hasEnded ? "Beendet" : connected ? "Verbunden" : "Verbinde…"}
            </span>
            {!hasEnded ? (
              <button
                onClick={endCall}
                className="rounded-full border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
              >
                Gespräch beenden
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {err ? (
        <div className="relative mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
        </div>
      ) : hasEnded && isCustomer ? (
        <div className="relative mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-8">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
            <div className="text-sm text-slate-300">Gespräch beendet</div>
            <div className="mt-2 text-xl font-semibold text-white">Danke für Ihre Zeit.</div>
            <div className="mt-2 text-sm text-slate-200">
              Dauer:{" "}
              <span className="font-semibold text-white">{formatDuration(acceptedAt || initialCreatedAt, endedAt)}</span> ·
              Beendet: <span className="font-semibold text-white">{dt(endedAt)}</span>
            </div>
            <button
              onClick={() => router.replace("/app")}
              className="mt-4 inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Zum Dashboard
            </button>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold text-white">Angebotsübersicht</div>
              <div className="text-xs text-slate-300">{summaryItems.length} Entscheidung(en)</div>
            </div>

            {summaryLoading ? (
              <div className="mt-3 text-sm text-slate-300">Lade Angebote…</div>
            ) : summaryItems.length === 0 ? (
              <div className="mt-3 text-sm text-slate-300">Noch keine angenommenen oder abgelehnten Angebote vorhanden.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {summaryItems.map((offer) => (
                  <div key={offer.id} className="rounded-2xl border border-white/15 bg-slate-950/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-white">
                        {providerMap[offer.provider_id] || "Bankpartner"} · {formatEUR(offer.rate_monthly)} / Monat
                      </div>
                      <StatusBadge status={offer.status} />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-2">
                      <div>Effektivzins</div>
                      <div className="text-right font-semibold text-white">{formatPct(offer.apr_effective)}</div>
                      <div>Nominalzins</div>
                      <div className="text-right font-semibold text-white">{formatPct(offer.interest_nominal)}</div>
                      <div>Tilgung</div>
                      <div className="text-right font-semibold text-white">{formatPct(offer.tilgung_pct)}</div>
                      <div>Zinsbindung</div>
                      <div className="text-right font-semibold text-white">
                        {offer.zinsbindung_years ? `${offer.zinsbindung_years} Jahre` : "—"}
                      </div>
                      <div>Darlehen</div>
                      <div className="text-right font-semibold text-white">{formatEUR(offer.loan_amount)}</div>
                    </div>

                    {offer.special_repayment ? (
                      <div className="mt-2 text-xs text-slate-200">Sondertilgung: {offer.special_repayment}</div>
                    ) : null}
                    {offer.notes_for_customer ? (
                      <div className="mt-2 text-xs text-slate-200">{offer.notes_for_customer}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`relative mx-auto grid max-w-7xl gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 ${isCustomer ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_360px]"}`}>
          <div className="space-y-4">
            <div className={`relative overflow-hidden rounded-[30px] border border-white/15 bg-black/30 shadow-2xl ${isCustomer ? "min-h-[52vh] lg:min-h-[62vh]" : "aspect-video"}`}>
              {remoteVideo ? (
                <VideoTile track={remoteVideo} cover />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-300">
                  {connected ? "Warte auf die Gegenseite…" : "Verbinde…"}
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

              <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                {connected ? "Live" : "Verbindung wird aufgebaut"}
              </div>

              <div className="absolute bottom-3 right-3 h-[92px] w-[38vw] max-w-[168px] min-w-[112px] overflow-hidden rounded-2xl border border-white/20 bg-black/45 shadow-lg backdrop-blur sm:bottom-4 sm:right-4 sm:h-[112px] sm:w-[168px]">
                {camOn && localVideo ? (
                  <VideoTile track={localVideo} muted cover />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-200">Kamera aus</div>
                )}
              </div>
            </div>

            {!hasEnded ? (
              <div className="grid gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:grid-cols-3">
                <button
                  onClick={toggleMic}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-rose-500/30 text-rose-100 hover:bg-rose-500/40"
                  }`}
                >
                  {micOn ? "Mikrofon an" : "Mikrofon aus"}
                </button>
                <button
                  onClick={toggleCam}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-rose-500/30 text-rose-100 hover:bg-rose-500/40"
                  }`}
                >
                  {camOn ? "Kamera an" : "Kamera aus"}
                </button>
                <button
                  onClick={endCall}
                  className="rounded-xl bg-rose-500/30 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/40"
                >
                  Sitzung beenden
                </button>
              </div>
            ) : null}

            <LiveCasePanel
              caseId={caseId}
              caseRef={caseRef}
              ticketId={ticketId}
              guestToken={guestToken}
              defaultCollapsed
            />
          </div>

          {showOfferPanel ? (
            <div className="rounded-[26px] border border-white/15 bg-white/10 p-3 shadow-xl backdrop-blur">
              <LiveOfferPanel caseId={caseId} />
            </div>
          ) : !isCustomer ? null : (
            <div className="rounded-[26px] border border-white/15 bg-white/10 p-5 shadow-xl backdrop-blur">
              <div className="text-sm font-semibold text-white">Sitzungsinfo</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div>Fall: {caseRef || "—"}</div>
                <div>Start: {dt(acceptedAt || initialCreatedAt)}</div>
                <div>Status: {hasEnded ? "Beendet" : connected ? "Aktiv" : "Wird verbunden"}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {remoteAudio ? <AudioTile track={remoteAudio} /> : null}
      {!hasEnded && isCustomer ? <LiveOfferModal caseId={caseId} ticketId={ticketId} guestToken={guestToken} /> : null}
    </div>
  )
}
