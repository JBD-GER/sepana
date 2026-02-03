"use client"

import { useEffect, useMemo, useState } from "react"
import { getCountryOptions } from "@/lib/countries"

type PrimaryDetails = {
  nationality?: string | null
}

type AdditionalDetails = {
  equity_total?: string | number | null
  equity_used?: string | number | null
  property_address_type?: string | null
  property_street?: string | null
  property_no?: string | null
  property_zip?: string | null
  property_city?: string | null
  property_plot_size?: string | number | null
  current_warm_rent?: string | number | null
  current_warm_rent_none?: boolean | null
  birth_place?: string | null
  id_document_number?: string | null
  id_issued_place?: string | null
  id_issued_at?: string | null
  id_expires_at?: string | null
  address_since?: string | null
  probation?: boolean | null
  probation_months?: string | number | null
  salary_payments_per_year?: string | number | null
  household_persons?: string | number | null
  vehicle_count?: string | number | null
  vehicle_cost_total?: string | number | null
  bank_account_holder?: string | null
  bank_iban?: string | null
  bank_bic?: string | null
  has_children?: boolean | null
  maintenance_income_monthly?: string | number | null
}

type ChildRow = {
  id?: string | null
  name?: string | null
  birth_date?: string | null
  maintenance_income_monthly?: string | number | null
}

const PROPERTY_ADDRESS_OPTIONS = [
  { value: "property", label: "Immobilienadresse" },
  { value: "plot", label: "Grundstuecksadresse" },
]

const SALARY_PAYMENTS_OPTIONS = ["12", "12.5", "13", "13.5", "14", "14.5"]

function toInput(value: any) {
  if (value === null || value === undefined) return ""
  return String(value)
}

function toDateInput(value: any) {
  if (!value) return ""
  const raw = String(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

export default function ExtraDataForm({ caseId, caseRef }: { caseId: string; caseRef: string }) {
  const countryOptions = useMemo(() => getCountryOptions("de-DE"), [])
  const [primary, setPrimary] = useState<PrimaryDetails>({})
  const [additional, setAdditional] = useState<AdditionalDetails>({})
  const [children, setChildren] = useState<ChildRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!caseId) return
    ;(async () => {
      const qs = new URLSearchParams({ caseId, caseRef })
      const res = await fetch(`/api/baufi/extra?${qs.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (json?.ok) {
        setPrimary({
          ...(json.primary ?? {}),
        })
        setAdditional({
          ...(json.additional ?? {}),
          current_warm_rent_none: !!json?.additional?.current_warm_rent_none,
          probation: !!json?.additional?.probation,
          has_children: !!json?.additional?.has_children,
          address_since: toDateInput(json?.additional?.address_since),
          id_issued_at: toDateInput(json?.additional?.id_issued_at),
          id_expires_at: toDateInput(json?.additional?.id_expires_at),
        })
        setChildren(
          Array.isArray(json.children)
            ? json.children.map((c: any) => ({
                ...c,
                birth_date: toDateInput(c?.birth_date),
              }))
            : []
        )
      }
    })()
  }, [caseId, caseRef])

  function updateAdditional(key: keyof AdditionalDetails, value: any) {
    setAdditional((prev) => ({ ...prev, [key]: value }))
  }

  function updatePrimary(key: keyof PrimaryDetails, value: any) {
    setPrimary((prev) => ({ ...prev, [key]: value }))
  }

  function addChild() {
    setChildren((prev) => [...prev, { name: "", birth_date: "", maintenance_income_monthly: "" }])
  }

  function removeChild(idx: number) {
    setChildren((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateChild(idx: number, patch: Partial<ChildRow>) {
    setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  async function save() {
    if (!caseId) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/baufi/extra", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, caseRef, primary, additional, children }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setMsg(json?.error || "Speichern fehlgeschlagen.")
        return
      }
      setMsg("Daten gespeichert. Vielen Dank!")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
      <div className="text-sm font-semibold text-slate-900">100% digitaler Abschluss</div>
      <p className="mt-1 text-xs text-slate-600">
        Bitte ergaenzen Sie die folgenden Daten. Damit kann Ihr Berater den digitalen Abschluss starten.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Eigenkapital</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              Eigenkapital insgesamt
              <input
                value={toInput(additional.equity_total)}
                onChange={(e) => updateAdditional("equity_total", e.target.value)}
                placeholder="z. B. 50.000"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Eingesetztes Eigenkapital
              <input
                value={toInput(additional.equity_used)}
                onChange={(e) => updateAdditional("equity_used", e.target.value)}
                placeholder="z. B. 25.000"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Immobilien- / Grundstuecksadresse</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              Adressart
              <select
                value={toInput(additional.property_address_type)}
                onChange={(e) => updateAdditional("property_address_type", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Bitte waehlen</option>
                {PROPERTY_ADDRESS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Strasse
              <input
                value={toInput(additional.property_street)}
                onChange={(e) => updateAdditional("property_street", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Nr.
              <input
                value={toInput(additional.property_no)}
                onChange={(e) => updateAdditional("property_no", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              PLZ
              <input
                value={toInput(additional.property_zip)}
                onChange={(e) => updateAdditional("property_zip", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Ort
              <input
                value={toInput(additional.property_city)}
                onChange={(e) => updateAdditional("property_city", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Grundstuecksgroesse
              <input
                value={toInput(additional.property_plot_size)}
                onChange={(e) => updateAdditional("property_plot_size", e.target.value)}
                placeholder="m²"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Legitimation</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              Staatsangehoerigkeit
              <select
                value={toInput(primary.nationality)}
                onChange={(e) => updatePrimary("nationality", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Bitte waehlen</option>
                {countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Ausweisnummer
              <input
                value={toInput(additional.id_document_number)}
                onChange={(e) => updateAdditional("id_document_number", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Ausstellungsort
              <input
                value={toInput(additional.id_issued_place)}
                onChange={(e) => updateAdditional("id_issued_place", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Ausgestellt am
              <input
                type="date"
                value={toDateInput(additional.id_issued_at)}
                onChange={(e) => updateAdditional("id_issued_at", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Ablauf am
              <input
                type="date"
                value={toDateInput(additional.id_expires_at)}
                onChange={(e) => updateAdditional("id_expires_at", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Weitere Angaben</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              Aktuelle Warmmiete
              <input
                value={toInput(additional.current_warm_rent)}
                onChange={(e) => updateAdditional("current_warm_rent", e.target.value)}
                disabled={!!additional.current_warm_rent_none}
                placeholder="z. B. 1.050"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-50"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={!!additional.current_warm_rent_none}
                onChange={(e) => updateAdditional("current_warm_rent_none", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Entfaellt
            </label>
            <label className="text-xs text-slate-600">
              Geburtsort
              <input
                value={toInput(additional.birth_place)}
                onChange={(e) => updateAdditional("birth_place", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Wohnhaft seit
              <input
                type="date"
                value={toDateInput(additional.address_since)}
                onChange={(e) => updateAdditional("address_since", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={!!additional.probation}
                onChange={(e) => updateAdditional("probation", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              Probezeit
            </label>
            <label className="text-xs text-slate-600">
              Probezeit (Monate)
              <input
                value={toInput(additional.probation_months)}
                onChange={(e) => updateAdditional("probation_months", e.target.value)}
                disabled={!additional.probation}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-50"
              />
            </label>
            <label className="text-xs text-slate-600">
              Anzahl Gehaelter
              <select
                value={toInput(additional.salary_payments_per_year)}
                onChange={(e) => updateAdditional("salary_payments_per_year", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Bitte waehlen</option>
                {SALARY_PAYMENTS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Haushaltsgroesse
              <input
                value={toInput(additional.household_persons)}
                onChange={(e) => updateAdditional("household_persons", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Anzahl KFZ
              <input
                value={toInput(additional.vehicle_count)}
                onChange={(e) => updateAdditional("vehicle_count", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              KFZ Kosten gesamt
              <input
                value={toInput(additional.vehicle_cost_total)}
                onChange={(e) => updateAdditional("vehicle_cost_total", e.target.value)}
                placeholder="z. B. 250"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Bankverbindung</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              Kontoinhaber
              <input
                value={toInput(additional.bank_account_holder)}
                onChange={(e) => updateAdditional("bank_account_holder", e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              IBAN
              <input
                value={toInput(additional.bank_iban)}
                onChange={(e) => updateAdditional("bank_iban", e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              BIC
              <input
                value={toInput(additional.bank_bic)}
                onChange={(e) => updateAdditional("bank_bic", e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <div className="text-xs font-semibold text-slate-700">Kinder</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={!!additional.has_children}
              onChange={(e) => updateAdditional("has_children", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            Kinder vorhanden
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              Unterhaltseinnahmen / Monat
              <input
                value={toInput(additional.maintenance_income_monthly)}
                onChange={(e) => updateAdditional("maintenance_income_monthly", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>

          <div className="mt-3 space-y-2">
            {children.map((c, i) => (
              <div key={c.id ?? i} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-xs text-slate-600">
                    Name
                    <input
                      value={toInput(c.name)}
                      onChange={(e) => updateChild(i, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Geburtsdatum
                    <input
                      type="date"
                      value={toDateInput(c.birth_date)}
                      onChange={(e) => updateChild(i, { birth_date: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Unterhalt / Monat
                    <input
                      value={toInput(c.maintenance_income_monthly)}
                      onChange={(e) => updateChild(i, { maintenance_income_monthly: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeChild(i)}
                  className="mt-2 text-xs font-semibold text-rose-600"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addChild}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
            >
              + Kind hinzufuegen
            </button>
          </div>
        </div>
      </div>

      {msg ? <div className="mt-3 text-xs text-slate-700">{msg}</div> : null}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {busy ? "Speichern..." : "Daten speichern"}
      </button>
    </div>
  )
}
