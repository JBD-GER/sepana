"use client"

import Image from "next/image"
import { startTransition, useMemo, useState } from "react"
import FunnelIcon from "./FunnelIcon"
import {
  BAUFI_PURPOSE_OPTIONS,
  buildFlow,
  CO_APPLICANT_OPTIONS,
  EMPLOYMENT_OPTIONS,
  FAMILY_STATUS_OPTIONS,
  type FormState,
  INITIAL_FORM,
  KREDIT_PURPOSE_OPTIONS,
  OBJECT_SELECTED_OPTIONS,
  OBJECT_TYPE_OPTIONS,
  type OptionItem,
  PROPERTY_USE_OPTIONS,
  PRODUCT_OPTIONS,
  SALUTATION_OPTIONS,
  STEP_META,
  TERM_OPTIONS,
} from "./funnelData"

function formatCurrency(value: string) {
  const n = Number(value.replace(",", "."))
  if (!Number.isFinite(n) || n <= 0) return "—"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n)
}

function parseNumericInput(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function optionPill(selected: boolean) {
  return selected
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600"
}

function OptionCard<T extends string>({
  item,
  selected,
  onSelect,
}: {
  item: OptionItem<T>
  selected: boolean
  onSelect: (value: T) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className={`rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        selected
          ? "border-emerald-300 bg-emerald-50/70 shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${optionPill(selected)}`}>
          <FunnelIcon name={item.icon} className="h-5 w-5" />
        </div>
        <div className="flex min-h-11 flex-col justify-center">
          <div className="text-sm font-semibold text-slate-900">{item.label}</div>
          {item.description ? <div className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</div> : null}
        </div>
      </div>
    </button>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400 ${props.className ?? ""}`}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 ${props.className ?? ""}`}
    />
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-800">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </label>
  )
}

type FunnelTemplateProps = {
  variant?: "template" | "kreditanfrage"
  eyebrow?: string
  heading?: string
  description?: string
  heroImageSrc?: string | null
  heroImageAlt?: string
}

export default function FunnelTemplate({
  variant = "template",
  eyebrow = "Funnel Vorlage",
  heading = "Multi-Step Funnel mit Icons",
  description = "Vorlage für Baufinanzierung und Privatkredit mit bedingten Schritten. Fokus: einfache Bedienung, klare Struktur und moderne Darstellung.",
  heroImageSrc = null,
  heroImageAlt = "Familie in der Kueche",
}: FunnelTemplateProps = {}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const flow = useMemo(() => buildFlow(form.productType), [form.productType])
  const stepId = flow[stepIndex] ?? flow[0]
  const stepMeta = STEP_META[stepId]
  const progress = ((stepIndex + 1) / flow.length) * 100
  const progressFromZero = submitted ? 100 : (stepIndex / Math.max(flow.length, 1)) * 100
  const isKreditanfrage = variant === "kreditanfrage"

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (error) setError(null)
  }

  function switchProduct(value: "baufi" | "privatkredit") {
    setForm((current) => ({
      ...INITIAL_FORM,
      productType: value,
      salutation: current.salutation,
      firstName: current.firstName,
      lastName: current.lastName,
      birthDate: current.birthDate,
      street: current.street,
      houseNumber: current.houseNumber,
      zip: current.zip,
      city: current.city,
      familyStatus: current.familyStatus,
      employmentStatus: current.employmentStatus,
      email: current.email,
      mobile: current.mobile,
    }))
    if (error) setError(null)
  }

  function purposeOptions() {
    if (form.productType === "baufi") return BAUFI_PURPOSE_OPTIONS
    if (form.productType === "privatkredit") return KREDIT_PURPOSE_OPTIONS
    return []
  }

  function selectedLabel(options: Array<{ value: string; label: string }>, value: string | null) {
    return options.find((item) => item.value === value)?.label ?? "—"
  }

  function validateCurrent(): string | null {
    switch (stepId) {
      case "product":
        return form.productType ? null : "Bitte wählen Sie Baufinanzierung oder Privatkredit."
      case "purpose":
        return form.purpose ? null : "Bitte wählen Sie ein Vorhaben."
      case "coApplicant":
        return form.coApplicant ? null : "Bitte wählen Sie eine Option."
      case "objectType":
        return form.objectType ? null : "Bitte wählen Sie die Objektart."
      case "propertyUse":
        return form.propertyUse ? null : "Bitte wählen Sie Eigennutzung oder Vermietung."
      case "objectSelected":
        return form.objectSelected ? null : "Bitte wählen Sie eine Option."
      case "baufiObjectData":
        if (!form.objectZip.trim()) return "Bitte PLZ des Objekts eintragen."
        if (!form.objectCity.trim()) return "Bitte Ort des Objekts eintragen."
        if (!form.purchasePrice.trim()) return "Bitte Kaufpreis eintragen."
        if (!form.brokerCommission.trim()) return "Bitte Maklerprovision eintragen."
        if (!form.equity.trim()) return "Bitte Eigenkapital eintragen."
        return null
      case "kreditData":
        if (!form.loanAmount.trim()) return "Bitte Kreditbedarf eintragen."
        if (!form.desiredTermMonths) return "Bitte Wunschlaufzeit auswählen."
        return null
      case "person":
        if (!form.salutation) return "Bitte Anrede auswählen."
        if (!form.firstName.trim()) return "Bitte Vorname eintragen."
        if (!form.lastName.trim()) return "Bitte Nachname eintragen."
        if (!form.birthDate) return "Bitte Geburtsdatum eintragen."
        if (!form.street.trim()) return "Bitte Straße eintragen."
        if (!form.houseNumber.trim()) return "Bitte Hausnummer eintragen."
        if (!form.zip.trim()) return "Bitte Postleitzahl eintragen."
        if (!form.city.trim()) return "Bitte Ort eintragen."
        if (!form.familyStatus) return "Bitte Familienstand auswählen."
        if (!form.employmentStatus) return "Bitte Beschäftigungsverhältnis auswählen."
        return null
      case "contact":
        if (!form.email.trim()) return "Bitte E-Mail eintragen."
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Bitte gültige E-Mail eintragen."
        if (!form.mobile.trim()) return "Bitte Mobilnummer eintragen."
        return null
      case "consent":
        if (!form.dsgvoConsent) return "Bitte DSGVO-Zustimmung bestätigen."
        if (!form.portalInviteConsent) return "Bitte Portal-Hinweis bestätigen."
        return null
      default:
        return null
    }
  }

  function next() {
    const v = validateCurrent()
    if (v) return setError(v)
    if (stepIndex >= flow.length - 1) return
    setError(null)
    startTransition(() => setStepIndex((current) => current + 1))
  }

  function back() {
    setError(null)
    startTransition(() => setStepIndex((current) => Math.max(0, current - 1)))
  }

  async function submitDemo() {
    const v = validateCurrent()
    if (v) return setError(v)
    setError(null)
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    setSubmitting(false)
    setSubmitted(true)
  }

  function buildBaufiFinancingNeed() {
    const purchasePrice = parseNumericInput(form.purchasePrice)
    const equity = parseNumericInput(form.equity)
    const brokerCommissionPct = parseNumericInput(form.brokerCommission)

    if (purchasePrice === null || equity === null || brokerCommissionPct === null) {
      return null
    }

    const brokerCommissionAmount = purchasePrice * (brokerCommissionPct / 100)
    return Math.round(purchasePrice + brokerCommissionAmount - equity)
  }

  async function submitLiveKreditanfrage() {
    const v = validateCurrent()
    if (v) return setError(v)

    if (!form.productType) {
      return setError("Bitte waehlen Sie zuerst ein Produkt.")
    }

    const pagePath = "/kreditanfrage"
    const commonHeaders = { "Content-Type": "application/json" }

    setError(null)
    setSubmitting(true)

    try {
      let endpoint = ""
      let payload: Record<string, unknown> = {}

      if (form.productType === "baufi") {
        const financingNeed = buildBaufiFinancingNeed()
        if (financingNeed === null || !Number.isFinite(financingNeed) || financingNeed <= 0) {
          setError("Finanzierungsbedarf konnte nicht berechnet werden. Bitte Angaben pruefen.")
          return
        }

        if (!form.objectType || !form.purpose) {
          setError("Bitte vervollstaendigen Sie die Baufinanzierungsdaten.")
          return
        }

        endpoint = "/api/baufi/lead-request"
        payload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.mobile.trim(),
          financingNeed,
          purpose: form.purpose,
          propertyType: form.objectType,
          consentAccepted: form.dsgvoConsent,
          pagePath,
          tracking: {
            source_funnel: "kreditanfrage",
            coApplicant: form.coApplicant,
            propertyUse: form.propertyUse,
            objectSelected: form.objectSelected,
            objectZip: form.objectZip.trim() || null,
            objectCity: form.objectCity.trim() || null,
            purchasePrice: form.purchasePrice.trim() || null,
            brokerCommission: form.brokerCommission.trim() || null,
            equity: form.equity.trim() || null,
          },
        }
      } else {
        endpoint = "/api/privatkredit/request"
        payload = {
          requestType: "contact",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.mobile.trim(),
          loanAmount: form.loanAmount.trim() || null,
          purpose: form.purpose,
          pagePath,
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(payload),
      })

      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !result?.ok) {
        setError(result?.error?.trim() || "Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.")
        return
      }

      setSubmitted(true)
      if (typeof window !== "undefined") {
        window.location.assign("/erfolgreich")
      }
    } catch {
      setError("Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.")
    } finally {
      setSubmitting(false)
    }
  }

  function renderStep() {
    if (stepId === "product") {
      return <div className="grid gap-3 sm:grid-cols-2">{PRODUCT_OPTIONS.map((item) => <OptionCard key={item.value} item={item} selected={form.productType === item.value} onSelect={switchProduct} />)}</div>
    }
    if (stepId === "purpose") {
      return <div className="grid gap-3 sm:grid-cols-2">{purposeOptions().map((item) => <OptionCard key={item.value} item={item} selected={form.purpose === item.value} onSelect={(v) => setField("purpose", v)} />)}</div>
    }
    if (stepId === "coApplicant") {
      return <div className="grid gap-3 sm:grid-cols-2">{CO_APPLICANT_OPTIONS.map((item) => <OptionCard key={item.value} item={item} selected={form.coApplicant === item.value} onSelect={(v) => setField("coApplicant", v)} />)}</div>
    }
    if (stepId === "objectType") {
      return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{OBJECT_TYPE_OPTIONS.map((item) => <OptionCard key={item.value} item={item} selected={form.objectType === item.value} onSelect={(v) => setField("objectType", v)} />)}</div>
    }
    if (stepId === "propertyUse") {
      return <div className="grid gap-3 sm:grid-cols-2">{PROPERTY_USE_OPTIONS.map((item) => <OptionCard key={item.value} item={item} selected={form.propertyUse === item.value} onSelect={(v) => setField("propertyUse", v)} />)}</div>
    }
    if (stepId === "objectSelected") {
      return <div className="grid gap-3 sm:grid-cols-2">{OBJECT_SELECTED_OPTIONS.map((item) => <OptionCard key={item.value} item={item} selected={form.objectSelected === item.value} onSelect={(v) => setField("objectSelected", v)} />)}</div>
    }
    if (stepId === "baufiObjectData") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postleitzahl Objekt"><Input inputMode="numeric" value={form.objectZip} onChange={(e) => setField("objectZip", e.target.value)} /></Field>
          <Field label="Ort Objekt"><Input value={form.objectCity} onChange={(e) => setField("objectCity", e.target.value)} /></Field>
          <Field label="Kaufpreis" hint={formatCurrency(form.purchasePrice)}><Input type="number" value={form.purchasePrice} onChange={(e) => setField("purchasePrice", e.target.value)} /></Field>
          <Field label="Maklerprovision (%)"><Input type="number" step="0.01" value={form.brokerCommission} onChange={(e) => setField("brokerCommission", e.target.value)} /></Field>
          <Field label="Eigenkapital" hint={formatCurrency(form.equity)}><Input type="number" value={form.equity} onChange={(e) => setField("equity", e.target.value)} /></Field>
        </div>
      )
    }
    if (stepId === "kreditData") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kreditbedarf" hint={formatCurrency(form.loanAmount)}><Input type="number" value={form.loanAmount} onChange={(e) => setField("loanAmount", e.target.value)} /></Field>
          <Field label="Wunschlaufzeit (Monate)">
            <Select value={form.desiredTermMonths} onChange={(e) => setField("desiredTermMonths", e.target.value)}>
              <option value="">Bitte wählen</option>
              {TERM_OPTIONS.map((m) => <option key={m} value={m}>{m} Monate</option>)}
            </Select>
          </Field>
        </div>
      )
    }
    if (stepId === "person") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Anrede"><Select value={form.salutation} onChange={(e) => setField("salutation", e.target.value)}><option value="">Bitte wählen</option>{SALUTATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Geburtsdatum"><Input type="date" value={form.birthDate} onChange={(e) => setField("birthDate", e.target.value)} /></Field>
          <Field label="Vorname"><Input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} /></Field>
          <Field label="Nachname"><Input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} /></Field>
          <Field label="Straße"><Input value={form.street} onChange={(e) => setField("street", e.target.value)} /></Field>
          <Field label="Hausnummer"><Input value={form.houseNumber} onChange={(e) => setField("houseNumber", e.target.value)} /></Field>
          <Field label="Postleitzahl"><Input inputMode="numeric" value={form.zip} onChange={(e) => setField("zip", e.target.value)} /></Field>
          <Field label="Ort"><Input value={form.city} onChange={(e) => setField("city", e.target.value)} /></Field>
          <Field label="Familienstand"><Select value={form.familyStatus} onChange={(e) => setField("familyStatus", e.target.value)}><option value="">Bitte wählen</option>{FAMILY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Beschäftigungsverhältnis"><Select value={form.employmentStatus} onChange={(e) => setField("employmentStatus", e.target.value)}><option value="">Bitte wählen</option>{EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        </div>
      )
    }
    if (stepId === "contact") {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-Mail" hint="Einladung ins Portal wird an diese Adresse gesendet."><Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} /></Field>
          <Field label="Mobil"><Input type="tel" value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} /></Field>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-relaxed text-emerald-900">
          {isKreditanfrage
            ? "Nach dem Absenden kann eine Einladung zum Portal folgen. Dort können Unterlagen hochgeladen und die nächsten Schritte digital weitergeführt werden."
            : "Nach dem Absenden erhält die Person eine Einladung zum Portal. Dort können Unterlagen hochgeladen und weitere Schritte mit der Beratung abgestimmt werden."}
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={form.dsgvoConsent} onChange={(e) => setField("dsgvoConsent", e.target.checked)} />
          <span>Ich stimme der Verarbeitung meiner Daten gemäß Datenschutzhinweisen zu.</span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={form.portalInviteConsent} onChange={(e) => setField("portalInviteConsent", e.target.checked)} />
          <span>Ich habe verstanden, dass ich eine Einladung ins SEPANA-Portal erhalten kann.</span>
        </label>
      </div>
    )
  }

  if (isKreditanfrage) {
    return (
      <div>
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.12),transparent_42%),radial-gradient(circle_at_86%_14%,rgba(16,185,129,0.11),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_18px_55px_rgba(15,23,42,0.06)] sm:rounded-[32px] sm:p-6 xl:min-h-[calc(100svh-8.5rem)] xl:p-8">
          <div className="pointer-events-none absolute -left-16 -top-14 h-44 w-44 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full bg-emerald-200/30 blur-3xl" />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col xl:min-h-[calc(100svh-13rem)] xl:justify-center">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                {eyebrow}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                {heading}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Baufinanzierung</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Privatkredit</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">In wenigen Schritten</span>
              </div>
            </div>

            {submitted ? (
              <div className="mx-auto mt-5 w-full max-w-4xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
                Anfrage erfolgreich gesendet. Weiterleitung...
              </div>
            ) : null}

            <section className="mx-auto mt-6 w-full max-w-5xl rounded-[24px] border border-white/90 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Schritt {stepIndex + 1} / {flow.length}
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{stepMeta.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{stepMeta.subtitle}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                <FunnelIcon name={stepMeta.icon} className="h-5 w-5" />
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            <div className="mt-5">{renderStep()}</div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={back}
                disabled={stepIndex === 0}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              >
                Zurück
              </button>
              {stepId === "consent" ? (
                <button
                  type="button"
                  onClick={submitLiveKreditanfrage}
                  disabled={submitting}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:pointer-events-none disabled:opacity-60"
                >
                  {submitting ? "Wird gesendet..." : "Anfrage absenden"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                >
                  Weiter
                </button>
              )}
            </div>
            </section>

            <section className="mx-auto mt-4 w-full max-w-5xl">
              <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur sm:p-5">
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    Ihre Vorteile
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    Schnell starten, stark vergleichen, sauber abgeschlossen.
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Der Antrag bleibt schlank. Wir strukturieren die Anfrage fuer eine schnelle Weitergabe an passende Banken.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                          <FunnelIcon name="heart" className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">4,9 Durchschnitt aus 100+ Bewertungen</div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-600">
                            Starker sozialer Beleg direkt vor dem Absenden Ihrer Kreditanfrage.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                          <FunnelIcon name="route" className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Bankenanfrage in ca. 48 Stunden vorbereitet</div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-600">
                            Vollstaendige Angaben helfen dabei, Ihre Anfrage schneller in die naechsten Schritte zu bringen.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                          <FunnelIcon name="shield" className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Eine Anfrage, mehrere passende Optionen</div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-600">
                            Klare Datenerfassung reduziert Rueckfragen und verbessert die Vergleichbarkeit der Angebote.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {heroImageSrc ? (
                  <div className="relative overflow-hidden rounded-[22px] border border-white/90 bg-white/90 p-3 shadow-sm ring-1 ring-slate-200/70 backdrop-blur sm:p-4">
                    <div className="relative h-[240px] overflow-hidden rounded-[16px] border border-slate-200 bg-slate-900 sm:h-[280px] lg:h-full lg:min-h-[360px]">
                      <Image
                        src={heroImageSrc}
                        alt={heroImageAlt}
                        fill
                        className="object-cover object-center"
                        sizes="(max-width: 1024px) 100vw, 48vw"
                        priority
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/10 to-transparent" />
                      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-white/10 p-3 text-white backdrop-blur">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Kreditanfrage</div>
                        <div className="mt-1 text-sm font-semibold sm:text-base">
                          In wenigen Schritten zur passenden Finanzierung.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur sm:p-5">
                    <div className="text-sm font-semibold text-slate-900">Schneller Start ohne lange Vorbereitung</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Waehlen Sie zuerst das Produkt und fuehren Sie die Anfrage Schritt fuer Schritt weiter.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="mx-auto mt-4 w-full max-w-5xl rounded-[20px] border border-slate-200/80 bg-white/92 p-4 shadow-sm ring-1 ring-white/80 backdrop-blur sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fortschritt</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">
                    Schritt {stepIndex + 1} von {flow.length}
                  </div>
                </div>
                <div className="max-w-full text-right text-xs text-slate-500 sm:max-w-[52%]">
                  <div className="truncate">{stepMeta.title}</div>
                  <div className="mt-0.5 font-semibold text-[#0b1f5e]">{Math.round(progressFromZero)}%</div>
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#0b1f5e] transition-all duration-300"
                  style={{ width: `${progressFromZero}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>Start</span>
                <span>Ziel: Anfrage absenden</span>
              </div>
            </section>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_10%_15%,rgba(16,185,129,0.09),transparent_40%),radial-gradient(circle_at_95%_5%,rgba(14,165,233,0.08),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              <FunnelIcon name="route" className="h-4 w-4" /> Funnel Vorlage
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Multi-Step Funnel mit Icons
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Vorlage für Baufinanzierung und Privatkredit mit bedingten Schritten. Fokus: einfache Bedienung, klare Struktur und moderne Darstellung.
            </p>
            {submitted ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Demo erfolgreich abgesendet. Nächster Schritt in echt: Speicherung in der passenden Lead-Kategorie und Zuweisung durch Admin an einen Berater.
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fortschritt</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Schritt {stepIndex + 1} von {flow.length}</div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <FunnelIcon name={stepMeta.icon} className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">{stepMeta.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              Template-Only: aktuell ohne API-Speicherung, aber auf reale Lead-Endpunkte vorbereitbar.
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt {stepIndex + 1} / {flow.length}</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{stepMeta.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{stepMeta.subtitle}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <FunnelIcon name={stepMeta.icon} className="h-5 w-5" />
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="mt-5">{renderStep()}</div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={back} disabled={stepIndex === 0} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40">
              Zurück
            </button>
            {stepId === "consent" ? (
              <button type="button" onClick={submitDemo} disabled={submitting} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-60">
                {submitting ? "Wird gesendet..." : "Anfrage absenden (Demo)"}
              </button>
            ) : (
              <button type="button" onClick={next} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95">
                Weiter
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Funnel-Flow</div>
            <div className="mt-3 space-y-2">
              {flow.map((s, i) => {
                const active = i === stepIndex
                const done = i < stepIndex
                return (
                  <button key={`${s}-${i}`} type="button" onClick={() => setStepIndex(i)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${active ? "border-slate-900 bg-slate-900 text-white" : done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${active ? "border-white/20 bg-white/10" : done ? "border-emerald-200 bg-white text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {done ? <FunnelIcon name="check" className="h-4 w-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{STEP_META[s].title}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live-Zusammenfassung</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Produkt</div>
                <div className="mt-1 font-semibold text-slate-900">{form.productType === "baufi" ? "Baufinanzierung" : form.productType === "privatkredit" ? "Privatkredit" : "—"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vorhaben</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedLabel(purposeOptions(), form.purpose)}</div>
              </div>
              {form.productType === "baufi" ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-3 text-slate-700">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">Baufi Snapshot</div>
                  <div className="mt-1 text-sm">Objekt: {selectedLabel(OBJECT_TYPE_OPTIONS, form.objectType)} · {selectedLabel(PROPERTY_USE_OPTIONS, form.propertyUse)}</div>
                  <div className="mt-1 text-sm">Kaufpreis {formatCurrency(form.purchasePrice)} · EK {formatCurrency(form.equity)}</div>
                </div>
              ) : form.productType === "privatkredit" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-slate-700">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Kredit Snapshot</div>
                  <div className="mt-1 text-sm">Bedarf {formatCurrency(form.loanAmount)} · Laufzeit {form.desiredTermMonths ? `${form.desiredTermMonths} Monate` : "—"}</div>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Kontakt</div>
                  <div className="mt-1 font-semibold text-slate-900">{[form.firstName, form.lastName].filter(Boolean).join(" ") || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Mit 2. Person</div>
                  <div className="mt-1 font-semibold text-slate-900">{form.coApplicant === "yes" ? "Ja" : form.coApplicant === "no" ? "Nein" : "—"}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-700">
                <FunnelIcon name="shield" className="h-4.5 w-4.5" />
              </div>
              <p className="text-sm leading-relaxed text-amber-900/90">
                Vorlage für UX/Flow. Im echten Setup werden die Daten je nach Produkt unter Leads gespeichert und anschließend im Admin einem Berater zugewiesen.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
