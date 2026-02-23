"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import {
  GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO,
  GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO,
} from "@/lib/ads/googleAds"

type LoanKind = "privat" | "immobilie"
type Step = "produkt" | "summe" | "kontakt" | "dsgvo"
type PropertyType = "wohnung" | "haus" | "mehrfamilienhaus" | "grundstueck"

type FormState = {
  loanKind: LoanKind
  propertyType: PropertyType
  amountInput: string
  firstName: string
  lastName: string
  email: string
  phone: string
  consentAccepted: boolean
  website: string
}

const STEPS: Step[] = ["produkt", "summe", "kontakt", "dsgvo"]

const PROPERTY_OPTIONS: Array<{ value: PropertyType; label: string }> = [
  { value: "haus", label: "Einfamilienhaus" },
  { value: "wohnung", label: "Eigentumswohnung" },
  { value: "mehrfamilienhaus", label: "Mehrfamilienhaus" },
  { value: "grundstueck", label: "Grundstück" },
]

const DEFAULT_AMOUNTS: Record<LoanKind, number> = {
  privat: 25000,
  immobilie: 280000,
}

const QUICK_AMOUNTS: Record<LoanKind, number[]> = {
  privat: [10000, 20000, 35000, 50000],
  immobilie: [150000, 250000, 350000, 500000],
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function formatCurrency(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatAmountInput(value: number) {
  return formatCurrency(value)
}

function parseAmount(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  if (!Number.isFinite(num)) return null
  return Math.round(num)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 6
}

function getNextStep(step: Step) {
  return STEPS[STEPS.indexOf(step) + 1] ?? null
}

function getPrevStep(step: Step) {
  return STEPS[STEPS.indexOf(step) - 1] ?? null
}

function stepNumber(step: Step) {
  return STEPS.indexOf(step) + 1
}

function productLabel(kind: LoanKind) {
  return kind === "privat" ? "Privatkredit (Neustart-Kredit)" : "Immobilienkredit (Umschuldung)"
}

function productShort(kind: LoanKind) {
  return kind === "privat" ? "Privatkredit" : "Immobilienkredit"
}

function StepChip({
  label,
  number,
  active,
  done,
}: {
  label: string
  number: number
  active: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold",
          active && "border-white bg-white text-slate-900",
          !active && done && "border-emerald-300 bg-emerald-300/10 text-emerald-100",
          !active && !done && "border-white/20 bg-white/5 text-slate-300",
        )}
      >
        {number}
      </span>
      <span className={cn("text-xs font-medium", active ? "text-white" : "text-slate-300")}>{label}</span>
    </div>
  )
}

const INITIAL_FORM: FormState = {
  loanKind: "privat",
  propertyType: "haus",
  amountInput: formatAmountInput(DEFAULT_AMOUNTS.privat),
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consentAccepted: false,
  website: "",
}

export default function ScheidungKreditLeadForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("produkt")
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountValue = parseAmount(form.amountInput)

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function chooseKind(next: LoanKind) {
    setForm((prev) => ({
      ...prev,
      loanKind: next,
      amountInput: formatAmountInput(DEFAULT_AMOUNTS[next]),
    }))
  }

  function validateAmount() {
    if (amountValue === null || amountValue <= 0) return "Bitte eine benötigte Summe eingeben."
    if (form.loanKind === "immobilie" && amountValue < 10000) return "Bitte mindestens 10.000 EUR angeben."
    if (form.loanKind === "immobilie" && amountValue > 10000000) return "Bitte einen realistischen Betrag angeben."
    return null
  }

  function validateContact() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phone.trim()) {
      return "Bitte Vorname, Nachname, E-Mail und Telefon ausfüllen."
    }
    if (!isEmail(form.email)) return "Bitte eine gültige E-Mail eingeben."
    if (!isPhone(form.phone)) return "Bitte eine gültige Telefonnummer eingeben."
    return null
  }

  function goNext() {
    setError(null)
    if (step === "summe") {
      const message = validateAmount()
      if (message) {
        setError(message)
        return
      }
    }
    if (step === "kontakt") {
      const message = validateContact()
      if (message) {
        setError(message)
        return
      }
    }
    const next = getNextStep(step)
    if (next) setStep(next)
  }

  function goBack() {
    setError(null)
    const prev = getPrevStep(step)
    if (prev) setStep(prev)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const amountMessage = validateAmount()
    if (amountMessage) {
      setStep("summe")
      setError(amountMessage)
      return
    }

    const contactMessage = validateContact()
    if (contactMessage) {
      setStep("kontakt")
      setError(contactMessage)
      return
    }

    if (!form.consentAccepted) {
      setError("Bitte Datenschutz akzeptieren.")
      return
    }

    if (amountValue === null) {
      setError("Bitte eine benötigte Summe eingeben.")
      return
    }

    const isPrivat = form.loanKind === "privat"
    const endpoint = isPrivat ? "/api/privatkredit/request" : "/api/baufi/lead-request"
    const payload = isPrivat
      ? {
          requestType: "contact" as const,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          loanAmount: amountValue,
          purpose: "sonstiges",
          callbackTime: "",
          message: "Landingpage Scheidung/Trennung: Neustart-Finanzierung nach Trennung",
        }
      : {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          financingNeed: amountValue,
          purpose: "umschuldung",
          propertyType: form.propertyType,
          consentAccepted: true,
          website: form.website,
        }

    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; leadId?: string | number; externalLeadId?: string | number; existingAccount?: boolean }
        | null
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Anfrage konnte nicht gesendet werden.")
        return
      }

      const params = new URLSearchParams({
        source: isPrivat ? "scheidung-kredit-privat" : "scheidung-kredit-immobilie",
        conversion: isPrivat ? GOOGLE_ADS_PRIVATKREDIT_LEAD_SEND_TO : GOOGLE_ADS_BAUFINANZIERUNG_LEAD_SEND_TO,
      })
      params.set("convref", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
      if (json?.leadId) params.set("leadId", String(json.leadId))
      if (json?.externalLeadId) params.set("externalLeadId", String(json.externalLeadId))
      if (json?.existingAccount) params.set("existing", "1")
      router.push(`/erfolgreich?${params.toString()}`)
    } catch {
      setError("Anfrage konnte nicht gesendet werden.")
    } finally {
      setBusy(false)
    }
  }

  const productDone = step !== "produkt"
  const amountDone = step === "kontakt" || step === "dsgvo"
  const contactDone = step === "dsgvo"

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/15 bg-white/10 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.4)] backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 right-0 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
            Kostenloser Service
          </span>
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
            Mehrschrittformular
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Anfrageformular</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
          Erst Produkt wählen, dann Summe, dann Kontaktdaten, dann DSGVO bestätigen und abschicken.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <StepChip label="Produkt" number={1} active={step === "produkt"} done={productDone} />
          <StepChip label="Summe" number={2} active={step === "summe"} done={amountDone} />
          <StepChip label="Kontakt" number={3} active={step === "kontakt"} done={contactDone} />
          <StepChip label="DSGVO" number={4} active={step === "dsgvo"} done={false} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {step === "produkt" ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">Welche Anfrage möchten Sie starten?</div>

              <button
                type="button"
                onClick={() => chooseKind("privat")}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition",
                  form.loanKind === "privat"
                    ? "border-white bg-white text-slate-900"
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10",
                )}
              >
                <div className="text-sm font-semibold">Privatkredit</div>
                <div className={cn("mt-1 text-xs", form.loanKind === "privat" ? "text-slate-600" : "text-slate-300")}>
                  Neustart-Finanzierung nach Trennung (Umzug, Kaution, Einrichtung, Überbrückung)
                </div>
              </button>

              <button
                type="button"
                onClick={() => chooseKind("immobilie")}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition",
                  form.loanKind === "immobilie"
                    ? "border-white bg-white text-slate-900"
                    : "border-white/15 bg-white/5 text-white hover:bg-white/10",
                )}
              >
                <div className="text-sm font-semibold">Immobilienkredit (nur Umschuldung)</div>
                <div className={cn("mt-1 text-xs", form.loanKind === "immobilie" ? "text-slate-600" : "text-slate-300")}>
                  Für Hauskredit bei Trennung / Scheidung. Keine Schuldhaftentlassung- oder Bürgschaftsberatung.
                </div>
              </button>
            </div>
          ) : null}

          {step === "summe" ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Benötigte Summe</div>
                <p className="mt-1 text-xs text-slate-300">
                  Schritt {stepNumber(step)} von 4 für {productLabel(form.loanKind)}
                </p>
              </div>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-200">Betrag *</div>
                <input
                  value={form.amountInput}
                  onChange={(e) => patch("amountInput", e.target.value)}
                  onBlur={() => {
                    if (amountValue !== null) patch("amountInput", formatAmountInput(amountValue))
                  }}
                  className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                  placeholder={form.loanKind === "privat" ? "z. B. 25.000 EUR" : "z. B. 280.000 EUR"}
                  inputMode="numeric"
                  required
                />
                <div className="mt-1 text-xs text-slate-300">
                  Erkannt: <span className="font-medium text-white">{formatCurrency(amountValue)}</span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_AMOUNTS[form.loanKind].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => patch("amountInput", formatAmountInput(amount))}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm",
                      amountValue === amount
                        ? "border-white bg-white text-slate-900"
                        : "border-white/15 bg-white/5 text-white hover:bg-white/10",
                    )}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {form.loanKind === "immobilie" ? (
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-200">Immobilienart *</div>
                  <select
                    value={form.propertyType}
                    onChange={(e) => patch("propertyType", e.target.value as PropertyType)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                  >
                    {PROPERTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {step === "kontakt" ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Kontaktdaten (Pflicht)</div>
                <p className="mt-1 text-xs text-slate-300">Vorname, Nachname, E-Mail und Telefon sind Pflichtfelder.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-200">Vorname *</div>
                  <input
                    value={form.firstName}
                    onChange={(e) => patch("firstName", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-200">Nachname *</div>
                  <input
                    value={form.lastName}
                    onChange={(e) => patch("lastName", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-200">E-Mail *</div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => patch("email", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                    required
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-200">Telefon *</div>
                  <input
                    value={form.phone}
                    onChange={(e) => patch("phone", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-white focus:ring-2 focus:ring-white/30"
                    required
                  />
                </label>
              </div>
            </div>
          ) : null}

          {step === "dsgvo" ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">DSGVO & Abschicken</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Zusammenfassung prüfen, Datenschutz akzeptieren und kostenlos absenden.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Zusammenfassung</div>
                <div className="mt-2 space-y-2">
                  <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                    Produkt: <span className="font-semibold">{productShort(form.loanKind)}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                    Summe: <span className="font-semibold">{formatCurrency(amountValue)}</span>
                  </div>
                  {form.loanKind === "immobilie" ? (
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                      Immobilienart:{" "}
                      <span className="font-semibold">
                        {PROPERTY_OPTIONS.find((x) => x.value === form.propertyType)?.label ?? form.propertyType}
                      </span>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                    Kontakt:{" "}
                    <span className="font-semibold">
                      {form.firstName} {form.lastName}
                    </span>
                  </div>
                </div>
              </div>

              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="hidden"
                value={form.website}
                onChange={(e) => patch("website", e.target.value)}
              />

              <label className="flex items-start gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-xs leading-relaxed text-slate-200">
                <input
                  type="checkbox"
                  checked={form.consentAccepted}
                  onChange={(e) => patch("consentAccepted", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                  required
                />
                <span>
                  Ich stimme der Verarbeitung meiner Angaben zur Bearbeitung meiner Anfrage gemäß{" "}
                  <Link href="/datenschutz" className="font-semibold underline underline-offset-2">
                    Datenschutz
                  </Link>{" "}
                  zu.
                </span>
              </label>

              <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 px-3 py-3 text-xs leading-relaxed text-amber-100">
                Im Immobilienbereich gilt auf dieser Seite nur Umschuldung / Anschlussfinanzierung. Keine Beratung zu
                Schuldhaftentlassung oder Bürgschaft.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {step !== "produkt" ? (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60 sm:w-auto"
              >
                Zurück
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}

            {step !== "dsgvo" ? (
              <button
                type="button"
                onClick={goNext}
                className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 sm:w-auto"
              >
                Weiter
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {busy ? "Sende Anfrage..." : "Kostenlos anfragen"}
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
