"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Offer = {
  id: string
  status: "draft" | "sent" | "accepted" | "rejected"
  loan_amount: number | null
  notes_for_customer: string | null
  created_at: string
}

export default function UpdateOfferStatus({
  offers,
}: {
  caseId: string
  offers: Offer[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function update(offerId: string, patch: Partial<Offer>) {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch("/api/admin/offers/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, ...patch }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Update fehlgeschlagen")

      setMsg("Offer aktualisiert ✅")
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-800">Angebote / Vorgänge</div>
        <button
          className="text-xs text-slate-600 hover:text-slate-900"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? "Schließen" : `Öffnen (${offers.length})`}
        </button>
      </div>

      {open ? (
        <div className="mt-2 space-y-2">
          {offers.length === 0 ? (
            <div className="text-xs text-slate-500">Keine Angebote vorhanden.</div>
          ) : (
            offers.slice(0, 3).map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-200/70 bg-white p-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-700">
                    Status: <span className="font-medium text-slate-900">{o.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">{Number(o.loan_amount ?? 0).toLocaleString("de-DE")} €</div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    defaultValue={o.status}
                    onChange={(e) => update(o.id, { status: e.target.value as any })}
                    className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs"
                    disabled={loading}
                  >
                    <option value="draft">draft</option>
                    <option value="sent">sent</option>
                    <option value="accepted">accepted</option>
                    <option value="rejected">rejected</option>
                  </select>

                  <input
                    defaultValue={o.loan_amount ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      update(o.id, { loan_amount: v ? Number(v) : null } as any)
                    }}
                    placeholder="Loan Amount"
                    className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs"
                    disabled={loading}
                  />
                </div>
              </div>
            ))
          )}

          {msg ? <div className="text-xs text-slate-600">{msg}</div> : null}

          {offers.length > 3 ? (
            <div className="text-xs text-slate-500">Weitere Angebote werden später als Detailseite ergänzt.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
