"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type ProviderItem = {
  provider: { id: string; name: string }
}

type OfferStatus = "draft" | "sent" | "accepted" | "rejected" | null

function normalizeDecimalInput(value: string) {
  return value.replace(/\./g, ",")
}

export default function OfferEditor({ caseId }: { caseId: string }) {
  const router = useRouter()
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
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [status, setStatus] = useState<OfferStatus>(null)

  useEffect(() => {
    ;(async () => {
      const res = await fetch("/api/baufi/providers?product=baufi")
      const json = await res.json().catch(() => ({}))
      const items = Array.isArray(json?.items) ? json.items : []
      setProviders(items)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/live/offer?caseId=${encodeURIComponent(caseId)}&includeHistory=1`)
      const json = await res.json().catch(() => ({}))
      const offers = Array.isArray(json?.offers) ? json.offers : []
      const latest = (offers[0]?.status ?? null) as OfferStatus
      setStatus(latest)
      if (latest === "accepted") {
        setStatusNote("Angebot wurde angenommen. Kein weiteres Angebot moeglich.")
      } else if (latest === "draft") {
        setStatusNote("Angebot wurde als Entwurf erstellt. Erst nach Status 'Abgeschickt' sieht es der Kunde.")
      } else if (latest === "sent") {
        setStatusNote("Angebot ist gesendet. Warte auf Feedback vom Kunden.")
      } else if (latest === "rejected") {
        setStatusNote("Angebot wurde abgelehnt. Neues Angebot moeglich.")
      } else {
        setStatusNote(null)
      }
    })()
  }, [caseId])

  async function submit() {
    if (!providerId) {
      setMsg("Bitte Bank auswaehlen.")
      return
    }
    setMsg(null)
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
        setMsg(json?.error === "offer_exists" ? "Es gibt bereits ein angenommenes Angebot." : json?.error || "Fehler beim Erstellen.")
        return
      }
      router.refresh()
      setStatus("draft")
      setStatusNote("Angebot wurde als Entwurf erstellt. Erst nach Status 'Abgeschickt' sieht es der Kunde.")
    } finally {
      setBusy(false)
    }
  }

  const blocked = status === "accepted"

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="text-sm font-medium text-slate-900">Finales Angebot erstellen</div>
      <p className="mt-1 text-xs text-slate-600">Du kannst mehrere finale Angebote anlegen. Sichtbar fuer den Kunden erst mit Status "Abgeschickt".</p>

      {statusNote ? <div className="mt-2 text-xs text-slate-600">{statusNote}</div> : null}
      {msg ? <div className="mt-2 text-xs text-rose-600">{msg}</div> : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Bank
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            disabled={busy || blocked}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">Bitte auswaehlen</option>
            {providers.map((p) => (
              <option key={p.provider.id} value={p.provider.id}>
                {p.provider.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-600">
          Darlehen
          <input
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            disabled={busy || blocked}
            placeholder="z.B. 300000"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Rate / Monat
          <input
            value={rateMonthly}
            onChange={(e) => setRateMonthly(normalizeDecimalInput(e.target.value))}
            inputMode="decimal"
            disabled={busy || blocked}
            placeholder="z.B. 1250,50"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Effektivzins %
          <input
            value={aprEffective}
            onChange={(e) => setAprEffective(normalizeDecimalInput(e.target.value))}
            inputMode="decimal"
            disabled={busy || blocked}
            placeholder="z.B. 3,2"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Nominalzins %
          <input
            value={interestNominal}
            onChange={(e) => setInterestNominal(normalizeDecimalInput(e.target.value))}
            inputMode="decimal"
            disabled={busy || blocked}
            placeholder="z.B. 3,0"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Tilgung %
          <input
            value={tilgungPct}
            onChange={(e) => setTilgungPct(normalizeDecimalInput(e.target.value))}
            inputMode="decimal"
            disabled={busy || blocked}
            placeholder="z.B. 2,0"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Zinsbindung (Jahre)
          <input
            value={zinsbindungYears}
            onChange={(e) => setZinsbindungYears(e.target.value)}
            disabled={busy || blocked}
            placeholder="z.B. 10"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="text-xs text-slate-600">
          Laufzeit (Monate)
          <input
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            disabled={busy || blocked}
            placeholder="z.B. 360"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Sondertilgung / Hinweis
          <input
            value={specialRepayment}
            onChange={(e) => setSpecialRepayment(e.target.value)}
            disabled={busy || blocked}
            placeholder="z.B. 5% p.a."
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="text-xs text-slate-600">
          Weitere Infos
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy || blocked}
            placeholder="Zusatzinfos"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={submit}
          disabled={busy || blocked}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-60"
        >
        Angebot erstellen
      </button>
      </div>
    </div>
  )
}
