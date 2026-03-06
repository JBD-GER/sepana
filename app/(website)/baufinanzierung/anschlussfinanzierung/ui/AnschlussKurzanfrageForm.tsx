"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO } from "@/lib/ads/googleAds"

type FormState = {
  email: string
  phone: string
}

const INITIAL_FORM: FormState = {
  email: "",
  phone: "",
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

export default function AnschlussKurzanfrageForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const email = form.email.trim().toLowerCase()
    const phone = form.phone.trim()

    if (!email || !phone) {
      setError("Bitte E-Mail und Telefonnummer eingeben.")
      return
    }
    if (!isEmail(email)) {
      setError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!isPhone(phone)) {
      setError("Bitte eine gültige Telefonnummer eingeben.")
      return
    }
    if (!consentAccepted) {
      setError("Bitte Datenschutz akzeptieren.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/baufi/quick-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          consentAccepted: true,
          pagePath: "/baufinanzierung/anschlussfinanzierung",
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; leadId?: string | number; externalLeadId?: string | number; existingAccount?: boolean }
        | null
      if (!response.ok || !json?.ok) {
        setError(json?.error || "Kurzanfrage konnte nicht gesendet werden.")
        return
      }

      setForm(INITIAL_FORM)
      setConsentAccepted(false)
      const params = new URLSearchParams({
        source: "baufi",
        conversion: GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO,
      })
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      if (json?.existingAccount) params.set("existing", "1")
      router.push(`/erfolgreich?${params.toString()}`)
      return
    } catch {
      setError("Kurzanfrage konnte nicht gesendet werden.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="kurzanfrage"
      className="scroll-mt-24 rounded-[30px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_58px_rgba(15,23,42,0.10)] sm:p-6"
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kurzanfrage</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Rückruf zur Anschlussfinanzierung anfordern
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            E-Mail und Telefonnummer reichen für den Start. Wir melden uns mit einer ersten Einschätzung zu Ihrer
            Anschlussfinanzierung und möglichen Forward-Option.
          </p>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2" noValidate>
            <label className="block">
              <div className="mb-1 text-xs font-medium text-slate-700">E-Mail *</div>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-medium text-slate-700">Telefonnummer *</div>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </label>

            <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                required
              />
              <span>
                Ich stimme der Verarbeitung meiner Angaben gemäß Datenschutz zu.
                {" "}
                <Link href="/datenschutz" className="font-semibold underline underline-offset-2" target="_blank" rel="noreferrer">
                  Datenschutz
                </Link>
              </span>
            </label>

            {error ? (
              <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sende..." : "Kurzanfrage senden"}
              </button>
            </div>
          </form>
        </div>

        <aside className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-900">
          <div className="absolute left-3 top-3 z-20 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100">
            Ihr Berater
          </div>
          <div className="relative h-[340px] sm:h-[380px]">
            <Image
              src="/pfad.png"
              alt="Herr Pfad berät zur Anschlussfinanzierung"
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 100vw, 42vw"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/15 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/20 bg-white/10 p-3 text-white backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Rückmelde-Garantie</div>
            <div className="mt-1 text-sm font-semibold">Persönlicher Erstkontakt innerhalb von 24 Stunden (werktags)</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-200/95">
              Sie sprechen mit einem festen Ansprechpartner und erhalten eine klare nächste Empfehlung.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
