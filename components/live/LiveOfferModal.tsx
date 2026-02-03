"use client"

import { useEffect, useMemo, useState } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createBrowserSupabaseClientNoAuth } from "@/lib/supabase/browser"

type Offer = {
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
}

type ProviderItem = { provider: { id: string; name: string } }

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

export default function LiveOfferModal({
  caseId,
  ticketId,
  guestToken,
}: {
  caseId: string
  ticketId: string
  guestToken?: string
}) {
  const supabase = useMemo(() => createBrowserSupabaseClientNoAuth(), [])
  const [offer, setOffer] = useState<Offer | null>(null)
  const [providers, setProviders] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const qs = new URLSearchParams({ caseId })
      if (ticketId) qs.set("ticketId", ticketId)
      if (guestToken) qs.set("guestToken", guestToken)
      const res = await fetch(`/api/live/offer?${qs.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) return
      const next = json.offer ?? null
      if (next && ["draft", "sent"].includes(String(next.status))) {
        setOffer(next)
      } else {
        setOffer(null)
      }
    })()
  }, [caseId, ticketId, guestToken])

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/baufi/providers?product=baufi")
      const json = await res.json().catch(() => ({}))
      const items: ProviderItem[] = Array.isArray(json?.items) ? json.items : []
      const map: Record<string, string> = {}
      for (const item of items) map[item.provider.id] = item.provider.name
      setProviders(map)
    })()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`live_offer_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_offers", filter: `case_id=eq.${caseId}` },
        (payload: RealtimePostgresChangesPayload<Offer>) => {
          const next = payload.new as Offer
          if (next.status === "sent" || next.status === "draft") setOffer(next)
          if (next.status === "accepted" || next.status === "rejected") setOffer(null)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, caseId])

  async function decide(decision: "accept" | "reject") {
    if (!offer) return
    setBusy(true)
    try {
      await fetch("/api/live/offer/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, decision, guestToken }),
      })
      setOffer(null)
    } finally {
      setBusy(false)
    }
  }

  if (!offer) return null

  const providerLabel = providers[offer.provider_id] || "Bankpartner"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/90 text-white shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-slate-500/20 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-300">Neues Angebot</div>
          <div className="mt-1 text-lg font-semibold">{providerLabel}</div>
          <div className="mt-1 text-sm text-slate-200">{formatEUR(offer.rate_monthly)} pro Monat</div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="text-slate-300">Effektivzins</div>
            <div className="text-right font-semibold">{formatPct(offer.apr_effective)}</div>
            <div className="text-slate-300">Nominalzins</div>
            <div className="text-right font-semibold">{formatPct(offer.interest_nominal)}</div>
            <div className="text-slate-300">Tilgung</div>
            <div className="text-right font-semibold">{formatPct(offer.tilgung_pct)}</div>
            <div className="text-slate-300">Zinsbindung</div>
            <div className="text-right font-semibold">
              {offer.zinsbindung_years ? `${offer.zinsbindung_years} Jahre` : "—"}
            </div>
            <div className="text-slate-300">Darlehen</div>
            <div className="text-right font-semibold">{formatEUR(offer.loan_amount)}</div>
          </div>

          {offer.special_repayment ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
              Sondertilgung: {offer.special_repayment}
            </div>
          ) : null}

          {offer.notes_for_customer ? (
            <div className="mt-2 text-xs leading-relaxed text-slate-300">{offer.notes_for_customer}</div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => decide("accept")}
              disabled={busy}
              className="rounded-xl bg-emerald-500/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Angebot annehmen
            </button>
            <button
              onClick={() => decide("reject")}
              disabled={busy}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Angebot ablehnen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
