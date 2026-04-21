"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminInvoiceCancelButton({
  caseId,
  kind = "schufa",
}: {
  caseId: string
  kind?: "schufa" | "insurance"
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function cancelInvoice() {
    if (busy) return

    const confirmText =
      kind === "insurance"
        ? "Versicherungsrechnung jetzt stornieren? Es wird keine Kundenmail verschickt."
        : "Rechnung und Fall jetzt stornieren? Es wird keine Kundenmail verschickt."
    if (!window.confirm(confirmText)) {
      return
    }

    setBusy(true)
    setMessage(null)

    try {
      const endpoint =
        kind === "insurance"
          ? `/api/insurance/cases/${encodeURIComponent(caseId)}/invoice`
          : "/api/app/cases/schufa-frei/provision-invoice"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, action: "cancel" }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Stornierung fehlgeschlagen.")
      }

      setMessage("Stornierung gespeichert.")
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
        {busy ? "Storniere..." : "Stornieren"}
      </button>
      {message ? <div className="text-[11px] leading-relaxed text-slate-500">{message}</div> : null}
    </div>
  )
}
