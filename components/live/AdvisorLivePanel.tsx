"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type QueueItem = {
  id: string
  case_id: string
  created_at: string
  case_ref: string | null
  case_type: string | null
  applicant_name: string | null
  applicant?: {
    email?: string | null
    phone?: string | null
    birth_date?: string | null
    marital_status?: string | null
    address_street?: string | null
    address_zip?: string | null
    address_city?: string | null
    employment_status?: string | null
    employer_name?: string | null
    net_income_monthly?: number | null
    other_income_monthly?: number | null
    expenses_monthly?: number | null
    existing_loans_monthly?: number | null
  } | null
  baufi?: {
    purpose?: string | null
    property_type?: string | null
    purchase_price?: number | null
  } | null
}

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d))
}

function labelPurpose(v?: string | null) {
  switch (v) {
    case "buy":
      return "Kauf Immobilie / Grundstück"
    case "build":
      return "Eigenes Bauvorhaben"
    case "refi":
      return "Anschlussfinanzierung / Umschuldung"
    case "modernize":
      return "Umbau / Modernisierung"
    case "equity_release":
      return "Kapitalbeschaffung"
    default:
      return "-"
  }
}

function labelPropertyType(v?: string | null) {
  switch (v) {
    case "condo":
      return "Eigentumswohnung"
    case "house":
      return "Einfamilienhaus"
    case "two_family":
      return "Zweifamilienhaus"
    case "multi":
      return "Mehrfamilienhaus"
    case "land":
      return "Grundstück"
    case "other":
      return "Sonstiges"
    default:
      return "-"
  }
}

export default function AdvisorLivePanel() {
  const router = useRouter()

  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)

  async function loadAll() {
    try {
      const [sRes, qRes] = await Promise.all([fetch("/api/live/advisor/status"), fetch("/api/live/queue")])
      const sJson = await sRes.json().catch(() => ({}))
      const qJson = await qRes.json().catch(() => ({}))

      if (sRes.status === 401 || sRes.status === 403 || sJson?.error === "not_allowed") {
        setNotAllowed(true)
        setQueue([])
        setOnline(false)
        setBusy(false)
        return
      }

      setNotAllowed(false)
      if (sJson?.ok) {
        setOnline(!!sJson.isOnline)
        setBusy(!!sJson.busy)
      }
      if (qJson?.ok) {
        setQueue(Array.isArray(qJson.items) ? qJson.items : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (notAllowed) return
    const id = setInterval(() => {
      loadAll()
    }, 5000)
    return () => clearInterval(id)
  }, [notAllowed])

  async function toggleOnline(next: boolean) {
    setActionBusy("online")
    try {
      const res = await fetch("/api/live/advisor/online", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ online: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok) setOnline(next)
    } finally {
      setActionBusy(null)
    }
  }

  async function accept(ticketId: string) {
    setActionBusy(ticketId)
    try {
      const res = await fetch("/api/live/queue/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok?.ticket || json?.ticket) {
        const id = json.ticket?.id ?? ticketId
        router.push(`/live/${id}`)
        return
      }
      if (json?.error) {
        alert(json.error === "busy" ? "Du bist bereits im Gespräch." : "Konnte nicht annehmen.")
      }
    } finally {
      setActionBusy(null)
    }
  }

  if (notAllowed) return null

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Live-Beratung</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">Bereit für neue Anfragen</div>
            <div className="mt-1 text-sm text-slate-600">Schalten Sie sich online, um Kunden in der Warteschlange zu sehen.</div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                online
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {online ? "Online" : "Offline"}
            </span>
            <button
              onClick={() => toggleOnline(!online)}
              disabled={actionBusy === "online"}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                online ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {online ? "Offline setzen" : "Online gehen"}
            </button>
          </div>
        </div>

        {busy ? (
          <div className="relative mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Sie sind aktuell in einer Live-Beratung.
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Warteschlange</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Neue Kundenanfragen</div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
            {queue.length} Anfrage(n)
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
            Warteschlange wird geladen...
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
            Keine wartenden Kunden vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {ticket.case_ref || ticket.case_id.slice(0, 8)}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {ticket.applicant_name || "Kunde"} | Erstellt {dt(ticket.created_at)}
                    </div>
                  </div>

                  <button
                    onClick={() => accept(ticket.id)}
                    disabled={!online || busy || actionBusy === ticket.id}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionBusy === ticket.id ? "Öffne..." : "Annehmen"}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                  <div>E-Mail: {ticket.applicant?.email || "-"}</div>
                  <div>Telefon: {ticket.applicant?.phone || "-"}</div>
                  <div>Geburtsdatum: {ticket.applicant?.birth_date || "-"}</div>
                  <div>Familienstand: {ticket.applicant?.marital_status || "-"}</div>
                  <div>Adresse: {ticket.applicant?.address_street || "-"}</div>
                  <div>
                    PLZ/Ort: {ticket.applicant?.address_zip || "-"} {ticket.applicant?.address_city || ""}
                  </div>
                  <div>Beruf: {ticket.applicant?.employment_status || "-"}</div>
                  <div>Arbeitgeber: {ticket.applicant?.employer_name || "-"}</div>
                  <div>Nettoeinkommen: {formatEUR(ticket.applicant?.net_income_monthly)}</div>
                  <div>Weitere Einkünfte: {formatEUR(ticket.applicant?.other_income_monthly)}</div>
                  <div>Ausgaben: {formatEUR(ticket.applicant?.expenses_monthly)}</div>
                  <div>Bestehende Kredite: {formatEUR(ticket.applicant?.existing_loans_monthly)}</div>
                  <div>Vorhaben: {labelPurpose(ticket.baufi?.purpose ?? null)}</div>
                  <div>Objekt: {labelPropertyType(ticket.baufi?.property_type ?? null)}</div>
                  <div>Kaufpreis: {formatEUR(ticket.baufi?.purchase_price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
