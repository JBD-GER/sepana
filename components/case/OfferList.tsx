"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { translateOfferStatus, translateBankStatus } from "@/lib/caseStatus"

type OfferItem = {
  id: string
  status: string
  bank_status?: string | null
  bank_feedback_note?: string | null
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
  canRespond = false,
  filterStatuses,
}: {
  offers: OfferItem[]
  canManage: boolean
  canRespond?: boolean
  filterStatuses?: string[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null)
  const [questionsModalOfferId, setQuestionsModalOfferId] = useState<string | null>(null)
  const [questionsNote, setQuestionsNote] = useState("")
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const visible = filterStatuses?.length
    ? offers.filter((o) => filterStatuses.includes(o.status))
    : offers
  const ordered = visible
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  const hasAcceptedOffer = ordered.some((offer) => offer.status === "accepted")

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

  async function updateBankStatus(
    offerId: string,
    bankStatus: string,
    bankFeedbackNote?: string | null,
  ) {
    setStatusBusyId(offerId)
    try {
      const res = await fetch("/api/app/offers/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, bankStatus, bankFeedbackNote }),
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

  async function decideOffer(offerId: string, decision: "accept" | "reject") {
    setDecisionBusyId(offerId)
    try {
      const res = await fetch("/api/live/offer/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId, decision }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        if (json?.error === "already_accepted") {
          alert("Es wurde bereits ein anderes Angebot angenommen.")
        } else {
          alert(json?.error || "Entscheidung konnte nicht gespeichert werden.")
        }
        return
      }
      router.refresh()
    } finally {
      setDecisionBusyId(null)
    }
  }

  function openQuestionsModal(offerId: string, currentNote?: string | null) {
    setQuestionsModalOfferId(offerId)
    setQuestionsNote((currentNote ?? "").trim())
    setQuestionsError(null)
  }

  function closeQuestionsModal() {
    setQuestionsModalOfferId(null)
    setQuestionsNote("")
    setQuestionsError(null)
  }

  async function submitQuestionsModal() {
    if (!questionsModalOfferId) return
    const note = questionsNote.trim()
    if (!note) {
      setQuestionsError("Bitte Rueckfragen eingeben.")
      return
    }
    await updateBankStatus(questionsModalOfferId, "questions", note)
    closeQuestionsModal()
  }

  if (!ordered || ordered.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
        Noch keine finalen Angebote vorhanden.
      </div>
    )
  }

  return (
    <>
    <div className="mt-4 space-y-3">
      {ordered.map((o) => {
        const offerLogo = o.provider_logo_path ? logoSrc(o.provider_logo_path) : null
        const bankStatus = String(o.bank_status || "submitted").toLowerCase()
        const bankDocuments = bankStatus === "documents"
        const bankApproved = bankStatus === "approved"
        const bankDeclined = bankStatus === "declined"
        const bankQuestions = bankStatus === "questions"
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
                  {o.provider_name ? " | " : ""}
                  Status: {translateOfferStatus(o.status)} | Erstellt: {dt(o.created_at)}
                </div>
                {o.status === "accepted" ? (
                  <div
                    className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
                      bankApproved
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : bankDeclined
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : bankDocuments
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                          : bankQuestions
                            ? "border-orange-200 bg-orange-50 text-orange-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Bankrueckmeldung
                    </div>
                    <div className="mt-1 font-semibold">
                      {bankApproved
                        ? "\u{1F389} Die Bank hat das Angebot angenommen."
                        : bankDeclined
                          ? "Die Bank hat das Angebot abgelehnt."
                          : bankDocuments
                            ? "Bitte laden Sie alle benoetigten Unterlagen im Bereich Dokumente hoch."
                          : bankQuestions
                            ? "Die Bank hat Rueckfragen."
                          : `Eingereicht bei der Bank: ${translateBankStatus(bankStatus)}`}
                    </div>
                    {bankQuestions && o.bank_feedback_note ? (
                      <div className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">
                        {o.bank_feedback_note}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <div className="break-all">ID: {o.id}</div>
                {canManage ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-2 py-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                      Berater-Status
                    </div>
                    <select
                      value={o.status}
                      onChange={(e) => updateOfferStatus(o.id, e.target.value)}
                      disabled={statusBusyId === o.id}
                      className="mt-1 rounded-full border border-sky-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm"
                    >
                      <option value="draft">Erstellt</option>
                      <option value="sent">Abgeschickt</option>
                      <option value="accepted">Angenommen</option>
                      <option value="rejected">Abgelehnt</option>
                    </select>
                  </div>
                ) : null}
                {canManage && o.status === "accepted" ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-2 py-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                      Bank-Status
                    </div>
                    <select
                      value={o.bank_status && o.bank_status !== "submitted" ? o.bank_status : ""}
                      onChange={async (e) => {
                        const value = e.target.value
                        if (!value) return
                        if (value === "questions") {
                          openQuestionsModal(o.id, o.bank_feedback_note)
                          return
                        }
                        updateBankStatus(o.id, value, null)
                      }}
                      disabled={statusBusyId === o.id}
                      className="mt-1 rounded-full border border-orange-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm"
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
                {canRespond && o.status === "sent" ? (
                  <>
                    <button
                      onClick={() => decideOffer(o.id, "accept")}
                      disabled={decisionBusyId === o.id || hasAcceptedOffer}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annehmen
                    </button>
                    <button
                      onClick={() => decideOffer(o.id, "reject")}
                      disabled={decisionBusyId === o.id || hasAcceptedOffer}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Ablehnen
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {canRespond && o.status === "sent" && hasAcceptedOffer ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Es wurde bereits ein anderes Angebot angenommen. Pro Fall ist nur eine Angebotsannahme moeglich.
              </div>
            ) : null}

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
              Sondertilgung: {o.special_repayment || "-"} | Zinsbindung:{" "}
              {o.zinsbindung_years ? `${o.zinsbindung_years} Jahre` : "-"} | Laufzeit:{" "}
              {o.term_months ? `${o.term_months} Monate` : "-"}
            </div>
          </div>
        )
      })}
    </div>
    {questionsModalOfferId ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4">
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



