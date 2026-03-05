"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO } from "@/lib/ads/googleAds"

type QuickStartFormState = {
  email: string
  phone: string
  privacyAccepted: boolean
}

const INITIAL_STATE: QuickStartFormState = {
  email: "",
  phone: "",
  privacyAccepted: false,
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

export default function PvQuickStartForm() {
  const router = useRouter()
  const [form, setForm] = useState<QuickStartFormState>(INITIAL_STATE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch<K extends keyof QuickStartFormState>(key: K, value: QuickStartFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const email = form.email.trim().toLowerCase()
    const phone = form.phone.trim()

    if (!email && !phone) {
      setError("Bitte E-Mail oder Telefonnummer eintragen.")
      return
    }
    if (email && !isEmail(email)) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.")
      return
    }
    if (phone && !isPhone(phone)) {
      setError("Bitte eine gültige Telefonnummer eingeben.")
      return
    }
    if (!form.privacyAccepted) {
      setError("Bitte Datenschutz akzeptieren.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/privatkredit/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestType: "quick_start",
          email: email || null,
          phone: phone || null,
          purpose: "pv_anlage",
          pagePath: "/privatkredit/kredit-pv-anlage",
          message: "Schnellstart-Anfrage über PV-Landingpage.",
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; leadId?: string | number; externalLeadId?: string | number; existingAccount?: boolean }
        | null
      if (!response.ok || !json?.ok) {
        setError(json?.error || "Anfrage konnte nicht gesendet werden.")
        return
      }

      setForm(INITIAL_STATE)
      const params = new URLSearchParams({
        source: "privatkredit",
        conversion: GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      if (json?.existingAccount) params.set("existing", "1")
      router.push(`/erfolgreich?${params.toString()}`)
      return
    } catch {
      setError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="quick-start"
      className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.10)] sm:p-6"
    >
      <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
        Schnellstart in 24 Stunden
      </div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Kreditanfrage starten</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
        Hinterlassen Sie E-Mail oder Telefonnummer. Wir melden uns in der Regel innerhalb von 24 Stunden mit der
        passenden nächsten Aktion für Ihre PV-Finanzierung.
      </p>
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Alternativ direkt anrufen:{" "}
        <a href="tel:050353169996" className="font-semibold underline underline-offset-2">
          05035 3169996
        </a>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3">
        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">E-Mail</div>
          <input
            type="email"
            value={form.email}
            onChange={(event) => patch("email", event.target.value)}
            placeholder="name@beispiel.de"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Telefon</div>
          <input
            value={form.phone}
            onChange={(event) => patch("phone", event.target.value)}
            placeholder="z. B. 0151 12345678"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={form.privacyAccepted}
            onChange={(event) => patch("privacyAccepted", event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
            required
          />
          <span>
            Ich stimme der Verarbeitung meiner Angaben gemäß Datenschutzerklärung zu.
            <Link href="/datenschutz" className="ml-1 font-semibold underline underline-offset-2" target="_blank" rel="noreferrer">
              Details
            </Link>
          </span>
        </label>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-xl bg-gradient-to-r from-slate-900 to-emerald-700 px-4 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Sende Anfrage..." : "Kreditanfrage starten"}
        </button>
      </form>
    </section>
  )
}
