"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type AdvisorOption = {
  id: string
  label: string
}

type FormState = {
  productType: "baufi" | "konsum"
  advisorId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  birthDate: string
  addressStreet: string
  addressZip: string
  addressCity: string
  employmentType: string
  netIncomeMonthly: string
  loanPurpose: string
  loanAmountTotal: string
  propertyZip: string
  propertyCity: string
  propertyType: string
  propertyPurchasePrice: string
  notes: string
}

const initialState: FormState = {
  productType: "baufi",
  advisorId: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: "",
  addressStreet: "",
  addressZip: "",
  addressCity: "",
  employmentType: "",
  netIncomeMonthly: "",
  loanPurpose: "",
  loanAmountTotal: "",
  propertyZip: "",
  propertyCity: "",
  propertyType: "",
  propertyPurchasePrice: "",
  notes: "",
}

export default function CreateManualLeadForm({ advisorOptions }: { advisorOptions: AdvisorOption[] }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit() {
    setMsg(null)
    setSaving(true)

    try {
      const res = await fetch("/api/admin/leads/create-manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Lead konnte nicht erstellt werden.")

      setMsg(String(json?.message ?? "Lead erstellt."))
      setForm(initialState)
      router.refresh()
    } catch (error: any) {
      setMsg(error?.message ?? "Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Manueller Lead</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Lead direkt anlegen</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pflichtfelder ausfuellen. Danach wird der Fall erstellt und die Einladung versendet.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Produkt</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={form.productType}
              onChange={(e) => updateField("productType", (e.target.value === "konsum" ? "konsum" : "baufi"))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="baufi">Baufinanzierung</option>
              <option value="konsum">Privatkredit</option>
            </select>
          </div>

          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Kunde</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              placeholder="Vorname"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <input
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              placeholder="Nachname"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="Telefon"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <input
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="E-Mail"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => updateField("birthDate", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </div>

          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Adresse</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={form.addressStreet}
              onChange={(e) => updateField("addressStreet", e.target.value)}
              placeholder="Strasse + Nr"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:col-span-2"
            />
            <input
              value={form.addressZip}
              onChange={(e) => updateField("addressZip", e.target.value)}
              placeholder="PLZ"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
            <input
              value={form.addressCity}
              onChange={(e) => updateField("addressCity", e.target.value)}
              placeholder="Ort"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </div>

          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Beschaeftigung</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={form.employmentType}
              onChange={(e) => updateField("employmentType", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            >
              <option value="">Anstellungsart waehlen</option>
              <option value="employed">Angestellt</option>
              <option value="self_employed">Selbststaendig</option>
              <option value="civil_servant">Beamter</option>
              <option value="student">Student</option>
              <option value="retired">Rentner</option>
              <option value="unemployed">Arbeitslos</option>
              <option value="other">Sonstiges</option>
            </select>
            <input
              value={form.netIncomeMonthly}
              onChange={(e) => updateField("netIncomeMonthly", e.target.value)}
              placeholder="Einkommen netto (monatlich)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Darlehen</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={form.loanPurpose}
              onChange={(e) => updateField("loanPurpose", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:col-span-2"
            >
              <option value="">Art des Darlehens waehlen</option>
              {form.productType === "konsum" ? (
                <>
                  <option value="freie_verwendung">Freie Verwendung</option>
                  <option value="umschuldung">Umschuldung</option>
                  <option value="auto">Auto</option>
                  <option value="modernisierung">Modernisierung</option>
                  <option value="sonstiges">Sonstiges</option>
                </>
              ) : (
                <>
                  <option value="buy">Kauf Immobilie / Grundstueck</option>
                  <option value="build">Eigenes Bauvorhaben</option>
                  <option value="refi">Anschlussfinanzierung / Umschuldung</option>
                  <option value="modernize">Umbau / Modernisierung</option>
                  <option value="equity_release">Kapitalbeschaffung</option>
                </>
              )}
            </select>
            <input
              value={form.loanAmountTotal}
              onChange={(e) => updateField("loanAmountTotal", e.target.value)}
              placeholder="Gesamte Summe"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            />
          </div>

          {form.productType === "baufi" ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Immobilie</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={form.propertyZip}
                  onChange={(e) => updateField("propertyZip", e.target.value)}
                  placeholder="Immobilie PLZ"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
                <input
                  value={form.propertyCity}
                  onChange={(e) => updateField("propertyCity", e.target.value)}
                  placeholder="Immobilie Ort"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
                <select
                  value={form.propertyType}
                  onChange={(e) => updateField("propertyType", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                >
                  <option value="">Art der Immobilie waehlen</option>
                  <option value="condo">Eigentumswohnung</option>
                  <option value="house">Einfamilienhaus</option>
                  <option value="two_family">Zweifamilienhaus</option>
                  <option value="multi">Mehrfamilienhaus</option>
                  <option value="land">Grundstueck</option>
                  <option value="other">Sonstiges</option>
                </select>
                <input
                  value={form.propertyPurchasePrice}
                  onChange={(e) => updateField("propertyPurchasePrice", e.target.value)}
                  placeholder="Kaufpreis"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                />
              </div>
            </>
          ) : null}

          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Berater</div>
          <select
            value={form.advisorId}
            onChange={(e) => updateField("advisorId", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          >
            <option value="">- Berater auswaehlen -</option>
            {advisorOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Notizen (optional)"
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
        >
          {saving ? "Erstelle..." : "Lead erstellen"}
        </button>
        {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
      </div>
    </div>
  )
}
