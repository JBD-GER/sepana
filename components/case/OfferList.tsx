"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { translateOfferStatus, translateBankStatus } from "@/lib/caseStatus"

type OfferItem = {
  id: string
  status: string
  bank_status?: string | null
  provider_id: string
  provider_name?: string | null
  provider_logo_path?: string | null
  loan_amount: number | null
  rate_monthly: number | null
  apr_effective: number | null
  interest_nominal: number | null
  term_months: number | null
  zinsbindung_years: number | null
  special_repayment: string | null
  created_at: string
}

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function logoSrc(pathLike?: unknown) {
  if (!pathLike || typeof pathLike !== "string") return null
  const path = pathLike.trim()
  if (!path) return null
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(path)}`
}

export default function OfferList({
  offers,
  canManage,
  filterStatuses,
}: {
  offers: OfferItem[]
  canManage: boolean
  filterStatuses?: string[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const visible = filterStatuses?.length
    ? offers.filter((o) => filterStatuses.includes(o.status))
    : offers
  const ordered = visible
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

  async function removeOffer(offerId: string) {
    if (!confirm("Finales Angebot wirklich entfernen?")) return
    setBusyId(offerId)
    try {
      const res = await fetch("/api/app/offers/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Entfernen fehlgeschlagen.")
        return
      }
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function updateOfferStatus(offerId: string, status: string) {
    setStatusBusyId(offerId)
    try {
      const res = await fetch("/api/app/offers/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Status-Aenderung fehlgeschlagen.")
        return
      }
      router.refresh()
    } finally {
      setStatusBusyId(null)
    }
  }

  async function updateBankStatus(offerId: string, bankStatus: string) {
    setStatusBusyId(offerId)
    try {
      const res = await fetch("/api/app/offers/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, bankStatus }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Status-Aenderung fehlgeschlagen.")
        return
      }
      router.refresh()
    } finally {
      setStatusBusyId(null)
    }
  }

  if (!ordered || ordered.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
        Noch keine finalen Angebote vorhanden.
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {ordered.map((o) => {
        const offerLogo = o.provider_logo_path ? logoSrc(o.provider_logo_path) : null
        return (
          <div key={o.id} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-slate-900">Angebot</div>
                  {offerLogo ? (
                    <img
                      src={offerLogo}
                      alt=""
                      className="h-7 w-auto max-w-[140px] object-contain"
                      loading="lazy"
                    />
                  ) : null}
                </div>

                <div className="mt-0.5 text-xs text-slate-600">
                  {o.provider_name ? <span className="text-slate-900 font-medium">{o.provider_name}</span> : null}
                  {o.provider_name ? " · " : ""}
                  Status: {translateOfferStatus(o.status)} · Erstellt: {dt(o.created_at)}
                </div>
                {o.status === "accepted" ? (
                  <div className="mt-1 text-xs text-slate-600">
                    Bankrueckmeldung: {translateBankStatus(o.bank_status || "submitted")}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="break-all">ID: {o.id}</div>
                {canManage ? (
                  <select
                    value={o.status}
                    onChange={(e) => updateOfferStatus(o.id, e.target.value)}
                    disabled={statusBusyId === o.id}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm"
                  >
                    <option value="draft">Erstellt</option>
                    <option value="sent">Abgeschickt</option>
                    <option value="accepted">Angenommen</option>
                    <option value="rejected">Abgelehnt</option>
                  </select>
                ) : null}
                {canManage && o.status === "accepted" ? (
                  <select
                    value={o.bank_status && o.bank_status !== "submitted" ? o.bank_status : ""}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value) updateBankStatus(o.id, value)
                    }}
                    disabled={statusBusyId === o.id}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm"
                  >
                    <option value="" disabled>
                      Eingereicht
                    </option>
                    <option value="approved">Angenommen</option>
                    <option value="declined">Abgelehnt</option>
                  </select>
                ) : null}
                {canManage ? (
                  <button
                    onClick={() => removeOffer(o.id)}
                    disabled={busyId === o.id}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"
                  >
                    Entfernen
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                <div className="text-[11px] text-slate-600">Rate</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(o.rate_monthly)}</div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                <div className="text-[11px] text-slate-600">Effektivzins</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatPct(o.apr_effective)}</div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                <div className="text-[11px] text-slate-600">Darlehen</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(o.loan_amount)}</div>
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-600">
              Sondertilgung: {o.special_repayment || "-"} · Zinsbindung:{" "}
              {o.zinsbindung_years ? `${o.zinsbindung_years} Jahre` : "-"} · Laufzeit:{" "}
              {o.term_months ? `${o.term_months} Monate` : "-"}
            </div>
          </div>
        )
      })}
    </div>
  )
}


