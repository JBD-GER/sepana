"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AppointmentStatusButton({
  appointmentId,
  status,
}: {
  appointmentId: string
  status: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const isCancelled = status === "cancelled"

  async function cancel() {
    if (isCancelled || busy) return
    if (!confirm("Termin wirklich absagen?")) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/appointments/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId, status: "cancelled" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Absagen fehlgeschlagen.")
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy || isCancelled}
      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
        isCancelled
          ? "border-slate-200 bg-slate-100 text-slate-400"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {isCancelled ? "Abgesagt" : busy ? "Absage..." : "Absagen"}
    </button>
  )
}
