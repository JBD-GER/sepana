"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type ProviderOption = {
  id: string
  label: string
}

export default function CreateLeadStartOfferButton({
  leadId,
  providerOptions,
}: {
  leadId: string
  providerOptions: ProviderOption[]
}) {
  const router = useRouter()
  const [providerId, setProviderId] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function createStartschuss() {
    if (!providerId) {
      setMsg("Bitte Anbieter auswaehlen.")
      return
    }

    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/admin/leads/create-start-offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, providerId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Startschuss konnte nicht erstellt werden.")
      setMsg("Startschuss erstellt.")
      router.refresh()
    } catch (error: any) {
      setMsg(error?.message ?? "Fehler")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <select
        value={providerId}
        onChange={(e) => setProviderId(e.target.value)}
        disabled={busy}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">- Anbieter fuer Startschuss -</option>
        {providerOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={createStartschuss}
        disabled={busy}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-60"
      >
        {busy ? "Erstelle..." : "Startschuss erstellen"}
      </button>
      {msg ? <div className="text-xs text-slate-500">{msg}</div> : null}
    </div>
  )
}
