"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO } from "@/lib/ads/googleAds"

type CallbackState = {
  phone: string
  callbackTime: string
}

const INITIAL_STATE: CallbackState = {
  phone: "",
  callbackTime: "",
}

export default function PrivatkreditCallbackBox() {
  const router = useRouter()
  const [form, setForm] = useState<CallbackState>(INITIAL_STATE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch<K extends keyof CallbackState>(key: K, value: CallbackState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.phone.trim()) {
      setError("Bitte Telefonnummer angeben.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/privatkredit/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestType: "callback",
          phone: form.phone,
          callbackTime: form.callbackTime,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error || "Rückruf-Anfrage konnte nicht gesendet werden."))
        return
      }

      setForm(INITIAL_STATE)
      const params = new URLSearchParams({
        source: "privatkredit",
        conversion: GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      router.push(`/erfolgreich?${params.toString()}`)
      return
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-12 h-36 w-36 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="relative">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          Rückruf
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Rückruf direkt anfordern</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Sie möchten lieber telefonieren? Telefonnummer eintragen und wir melden uns schnell bei Ihnen.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-700">Telefonnummer *</div>
            <input
            value={form.phone}
            onChange={(e) => patch("phone", e.target.value)}
            placeholder="z. B. 0151 12345678"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
            required
          />
        </label>

          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-700">Beste Erreichbarkeit</div>
            <input
            value={form.callbackTime}
            onChange={(e) => patch("callbackTime", e.target.value)}
            placeholder="z. B. heute 17:00-19:00 Uhr"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:text-sm"
          />
        </label>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <div>
            <button
              type="submit"
              disabled={busy}
              className="h-12 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-900 px-5 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sende Rückruf..." : "Rückruf anfordern"}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
