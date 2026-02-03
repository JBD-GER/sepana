"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createBrowserSupabaseClientNoAuth } from "@/lib/supabase/browser"

type ProviderItem = {
  provider: { id: string; name: string }
}

type OfferStatus = "draft" | "sent" | "accepted" | "rejected" | null
type OfferRealtimeUpdate = { status?: OfferStatus }

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

export default function LiveOfferPanel({ caseId }: { caseId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClientNoAuth(), [])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [providerId, setProviderId] = useState("")
  const [loanAmount, setLoanAmount] = useState("")
  const [rateMonthly, setRateMonthly] = useState("")
  const [aprEffective, setAprEffective] = useState("")
  const [interestNominal, setInterestNominal] = useState("")
  const [tilgungPct, setTilgungPct] = useState("")
  const [zinsbindungYears, setZinsbindungYears] = useState("")
  const [termMonths, setTermMonths] = useState("")
  const [specialRepayment, setSpecialRepayment] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [offerStatus, setOfferStatus] = useState<OfferStatus>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "danger">("neutral")
  const [overlay, setOverlay] = useState<{ message: string; tone: "success" | "danger" } | null>(null)
  const lastStatusRef = useRef<OfferStatus>(null)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showOverlay(message: string, tone: "success" | "danger") {
    setOverlay({ message, tone })
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    overlayTimerRef.current = setTimeout(() => setOverlay(null), 4500)
  }

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/baufi/providers?product=baufi")
      const json = await res.json().catch(() => ({}))
      const items = Array.isArray(json?.items) ? json.items : []
      setProviders(items)
    })()
  }, [])

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    }
  }, [])

  async function syncLatestStatus() {
    const res = await fetch(`/api/live/offer?caseId=${encodeURIComponent(caseId)}&includeHistory=1`)
    const json = await res.json().catch(() => ({}))
    const list = Array.isArray(json?.offers) ? json.offers : []
    const nextStatus = (list[0]?.status ?? null) as OfferStatus
    if (nextStatus !== lastStatusRef.current) {
      lastStatusRef.current = nextStatus
      setOfferStatus(nextStatus)
      if (nextStatus === "accepted") {
        setToast("Angebot wurde angenommen.")
        showOverlay("Angebot angenommen!", "success")
      } else if (nextStatus === "rejected") {
        setToast("Angebot wurde abgelehnt.")
        showOverlay("Angebot abgelehnt.", "danger")
      }
      if (nextStatus === "accepted") {
        setStatusNote("Angebot wurde angenommen. Kein weiteres Angebot moeglich.")
        setStatusTone("success")
      } else if (nextStatus === "rejected") {
        setStatusNote("Angebot wurde abgelehnt. Du kannst ein neues Angebot erstellen.")
        setStatusTone("danger")
      } else if (nextStatus === "draft") {
        setStatusNote("Angebot erstellt. Kunde kann es jetzt annehmen oder ablehnen.")
        setStatusTone("neutral")
      } else if (nextStatus === "sent") {
        setStatusNote("Angebot ist gesendet. Warte auf Feedback vom Kunden.")
        setStatusTone("neutral")
      } else {
        setStatusNote(null)
        setStatusTone("neutral")
      }
    }
  }

  useEffect(() => {
    syncLatestStatus()
    const id = setInterval(syncLatestStatus, 5000)
    return () => clearInterval(id)
  }, [caseId])

  useEffect(() => {
    const channel = supabase
      .channel(`offer_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_offers", filter: `case_id=eq.${caseId}` },
        (payload: RealtimePostgresChangesPayload<OfferRealtimeUpdate>) => {
          const next = payload.new as Partial<OfferRealtimeUpdate>
          if (next?.status) {
            if (next.status === "accepted") {
              setToast("Angebot wurde angenommen.")
              showOverlay("Angebot angenommen!", "success")
              setStatusNote("Angebot wurde angenommen. Kein weiteres Angebot moeglich.")
              setStatusTone("success")
            } else if (next.status === "rejected") {
              setToast("Angebot wurde abgelehnt.")
              showOverlay("Angebot abgelehnt.", "danger")
              setStatusNote("Angebot wurde abgelehnt. Du kannst ein neues Angebot erstellen.")
              setStatusTone("danger")
            } else if (next.status === "draft") {
              setToast("Angebot wurde erstellt.")
              setStatusNote("Angebot erstellt. Kunde kann es jetzt annehmen oder ablehnen.")
              setStatusTone("neutral")
            } else if (next.status === "sent") {
              setToast("Angebot wurde gesendet.")
              setStatusNote("Angebot ist gesendet. Warte auf Feedback vom Kunden.")
              setStatusTone("neutral")
            }
            lastStatusRef.current = next.status
            setOfferStatus(next.status)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, caseId])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  async function submit() {
    setMsg(null)
    if (!providerId) {
      setMsg("Bitte Bank auswaehlen.")
      return
    }
    if (offerStatus === "accepted") {
      setMsg("Angebot wurde bereits angenommen.")
      return
    }
    if (offerStatus === "sent" || offerStatus === "draft") {
      setMsg("Es gibt bereits ein aktives Angebot.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/live/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          providerId,
          loanAmount,
          rateMonthly,
          aprEffective,
          interestNominal,
          tilgungPct,
          zinsbindungYears,
          termMonths,
          specialRepayment,
          notes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMsg(json?.error === "offer_exists" ? "Es gibt bereits ein aktives Angebot." : "Senden fehlgeschlagen.")
        return
      }
      setOfferStatus("draft")
      setMsg("Angebot erstellt.")
    } finally {
      setBusy(false)
    }
  }

  const locked = offerStatus === "accepted" || offerStatus === "sent" || offerStatus === "draft"

  const overlayView =
    overlay && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 text-center text-white backdrop-blur">
            <div className="rounded-[32px] border border-white/20 bg-white/10 px-10 py-8 shadow-2xl">
              <div className="text-xs uppercase tracking-[0.3em] text-white/70">Feedback</div>
              <div className="mt-3 text-3xl font-semibold">{overlay.message}</div>
              <div className="mt-2 text-sm text-white/70">Live-Entscheidung des Kunden</div>
            </div>
          </div>,
          document.body
        )
      : null

  const toastView = toast ? (
    <div className="fixed right-6 top-6 z-[80] rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg">
      {toast}
    </div>
  ) : null

  return (
    <>
      {overlayView}
      {toastView}
      <div className="relative rounded-3xl border border-white/70 bg-white/80 p-5 text-sm text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="text-sm font-semibold">Angebot erstellen</div>
      {statusNote ? (
        <div
          className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
            statusTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : statusTone === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {statusNote}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-600">Bank</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            disabled={locked}
          >
            <option value="">Bitte waehlen</option>
            {providers.map((p) => (
              <option key={p.provider.id} value={p.provider.id}>
                {p.provider.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-600">Darlehen</label>
          <input
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            placeholder="z.B. 300000"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Rate / Monat</label>
          <input
            value={rateMonthly}
            onChange={(e) => setRateMonthly(e.target.value)}
            placeholder="z.B. 1250"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Effektivzins %</label>
          <input
            value={aprEffective}
            onChange={(e) => setAprEffective(e.target.value)}
            placeholder="z.B. 3.2"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Nominalzins %</label>
          <input
            value={interestNominal}
            onChange={(e) => setInterestNominal(e.target.value)}
            placeholder="z.B. 3.0"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Tilgung %</label>
          <input
            value={tilgungPct}
            onChange={(e) => setTilgungPct(e.target.value)}
            placeholder="z.B. 2.0"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Zinsbindung (Jahre)</label>
          <input
            value={zinsbindungYears}
            onChange={(e) => setZinsbindungYears(e.target.value)}
            placeholder="z.B. 10"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600">Laufzeit (Monate)</label>
          <input
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            placeholder="z.B. 360"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-slate-600">Sondertilgung / Hinweis</label>
          <input
            value={specialRepayment}
            onChange={(e) => setSpecialRepayment(e.target.value)}
            placeholder="z.B. 5% p.a."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Weitere Infos</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Zusatzinfos"
            className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            disabled={locked}
          />
        </div>
      </div>

      {msg ? <div className="mt-3 text-xs text-slate-700">{msg}</div> : null}

      <button
        onClick={submit}
        disabled={busy || locked}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
      >
        Angebot erstellen
      </button>

        <div className="mt-2 text-[11px] text-slate-500">
          Beispiel: {formatEUR(Number(loanAmount || 0))} - {aprEffective || "-"}% effektiv
        </div>
      </div>
    </>
  )
}
