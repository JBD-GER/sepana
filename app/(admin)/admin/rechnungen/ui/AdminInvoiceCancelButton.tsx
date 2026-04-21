"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminInvoiceCancelButton({
  caseId,
  repairOnly,
}: {
  caseId: string
  repairOnly?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function cancelInvoice() {
    if (busy) return
    if (
      !window.confirm(
        repairOnly
          ? "Fehlende Stornorechnung jetzt erzeugen? Der Kunde erhaelt anschliessend die Stornierungsmail."
          : "Rechnung und Kreditanfrage jetzt stornieren? Der Kunde erhaelt anschliessend eine Stornierungsmail."
      )
    ) {
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/provision-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, action: "cancel" }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Stornierung fehlgeschlagen.")
      }

      if (json?.alreadyCancelled) {
        setMessage("Stornierung war bereits vorhanden. Fallstatus wurde geprueft.")
      } else {
        setMessage(json?.emailSent ? "Stornierung und Mail versendet." : "Storniert. Mail konnte nicht versendet werden.")
      }
      startTransition(() => router.refresh())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Stornierung fehlgeschlagen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={cancelInvoice}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 shadow-sm transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Erzeuge..." : repairOnly ? "Stornorechnung erzeugen" : "Stornieren"}
      </button>
      {message ? <div className="text-[11px] leading-relaxed text-slate-500">{message}</div> : null}
    </div>
  )
}
