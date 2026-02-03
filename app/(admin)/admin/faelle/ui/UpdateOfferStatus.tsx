"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { translateBankStatus, translateOfferStatus } from "@/lib/caseStatus"

type Offer = {
  id: string
  status: "draft" | "sent" | "accepted" | "rejected"
  bank_status?: "submitted" | "documents" | "approved" | "declined" | "questions" | null
  bank_feedback_note?: string | null
  loan_amount: number | null
  notes_for_customer: string | null
  created_at: string
}

const OFFER_STATUSES = ["draft", "sent", "accepted", "rejected"] as const
const BANK_DECISIONS = ["documents", "approved", "declined", "questions"] as const

function isOfferStatus(value: string): value is (typeof OFFER_STATUSES)[number] {
  return OFFER_STATUSES.includes(value as (typeof OFFER_STATUSES)[number])
}

function isBankDecision(value: string): value is (typeof BANK_DECISIONS)[number] {
  return BANK_DECISIONS.includes(value as (typeof BANK_DECISIONS)[number])
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
  const [questionsOffer, setQuestionsOffer] = useState<Offer | null>(null)
  const [questionsNote, setQuestionsNote] = useState("")
  const [questionsError, setQuestionsError] = useState<string | null>(null)

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

      setMsg("Offer aktualisiert âœ…")
      router.refresh()
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler")
    } finally {
      setLoading(false)
    }
  }

  async function handleBankDecisionChange(offer: Offer, value: string) {
    if (!isBankDecision(value)) return
    if (value === "questions") {
      setQuestionsOffer(offer)
      setQuestionsNote((offer.bank_feedback_note ?? "").trim())
      setQuestionsError(null)
      return
    }
    await update(offer.id, { bank_status: value, bank_feedback_note: null })
  }

  function closeQuestionsModal() {
    setQuestionsOffer(null)
    setQuestionsNote("")
    setQuestionsError(null)
  }

  async function submitQuestionsModal() {
    if (!questionsOffer) return
    const note = questionsNote.trim()
    if (!note) {
      setQuestionsError("Bitte Rueckfragen eingeben.")
      return
    }
    await update(questionsOffer.id, { bank_status: "questions", bank_feedback_note: note })
    closeQuestionsModal()
  }

  return (
    <>
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-800">Angebote / VorgÃ¤nge</div>
        <button
          className="text-xs text-slate-600 hover:text-slate-900"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? "SchlieÃŸen" : `Ã–ffnen (${offers.length})`}
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
                    Status: <span className="font-medium text-slate-900">{translateOfferStatus(o.status)}</span>
                    {o.status === "accepted" ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        Bank-Status: {translateBankStatus(o.bank_status || "submitted")}
                        {String(o.bank_status || "").toLowerCase() === "documents" ? (
                          <div className="mt-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-800">
                            Kunde muss alle Unterlagen im Bereich Dokumente hochladen.
                          </div>
                        ) : null}
                        {String(o.bank_status || "").toLowerCase() === "questions" && o.bank_feedback_note ? (
                          <div className="mt-1 whitespace-pre-wrap rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] text-orange-800">
                            Rueckfragen: {o.bank_feedback_note}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">{Number(o.loan_amount ?? 0).toLocaleString("de-DE")} â‚¬</div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                      Berater-Status
                    </div>
                    <select
                      defaultValue={o.status}
                      onChange={(e) => {
                        const value = e.target.value
                        if (isOfferStatus(value)) update(o.id, { status: value })
                      }}
                      className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs"
                      disabled={loading}
                    >
                      <option value="draft">Erstellt</option>
                      <option value="sent">Abgeschickt</option>
                      <option value="accepted">Angenommen</option>
                      <option value="rejected">Abgelehnt</option>
                    </select>
                  </div>

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

                {o.status === "accepted" ? (
                  <div className="mt-2">
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                        Bank-Status
                      </div>
                      <select
                        defaultValue={o.bank_status && o.bank_status !== "submitted" ? o.bank_status : ""}
                        onChange={(e) => handleBankDecisionChange(o, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs"
                        disabled={loading}
                      >
                        <option value="" disabled>
                          Eingereicht
                        </option>
                        <option value="documents">Dokumente</option>
                        <option value="questions">Rueckfragen</option>
                        <option value="approved">Angenommen</option>
                        <option value="declined">Abgelehnt</option>
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {msg ? <div className="text-xs text-slate-600">{msg}</div> : null}

          {offers.length > 3 ? (
            <div className="text-xs text-slate-500">Weitere Angebote werden spÃ¤ter als Detailseite ergÃ¤nzt.</div>
          ) : null}
        </div>
      ) : null}
    </div>
    {questionsOffer ? (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="text-sm font-semibold text-slate-900">Rueckfragen der Bank erfassen</div>
          <p className="mt-1 text-xs text-slate-600">
            Bitte die Rueckfragen hier als Freitext eintragen.
          </p>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Hinweis: Diese Nachricht wird exakt so per E-Mail an den Kunden gesendet.
          </p>
          <textarea
            value={questionsNote}
            onChange={(e) => {
              setQuestionsNote(e.target.value)
              if (questionsError) setQuestionsError(null)
            }}
            placeholder="Rueckfragen der Bank..."
            className="mt-3 min-h-[140px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
          {questionsError ? <div className="mt-2 text-xs text-rose-600">{questionsError}</div> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeQuestionsModal}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={submitQuestionsModal}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Rueckfragen speichern
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
