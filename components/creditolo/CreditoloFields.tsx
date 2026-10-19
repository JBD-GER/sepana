"use client"

import { needsResidencePermit } from "@/lib/creditolo/payload"
import { CREDITOLO_NOTICE } from "@/lib/creditolo/notice"
import { CREDITOLO_PROFESSIONS, type CreditoloExtra } from "@/lib/creditolo/fields"

export default function CreditoloFields({
  value,
  onChange,
  schufaFree = false,
  nationality = "",
}: {
  value: CreditoloExtra
  onChange: (value: CreditoloExtra) => void
  schufaFree?: boolean
  nationality?: string
}) {
  const update = (key: keyof CreditoloExtra, next: string | boolean) => onChange({ ...value, [key]: next })
  const style = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
  const moneyFields = [
    ["otherIncome", "Belegbares Nebeneinkommen"],
    ["childIncome", "Kinder- oder Pflegegeld"],
    ["maintenanceIncome", "Erhaltene Unterhaltszahlungen"],
    ["pensionIncome", "Renten"],
    ["rentalIncome", "Miet- oder Pachteinnahmen"],
    ["socialIncome", "Sonstige Einkünfte / Sozialleistungen"],
    ["mortgageRate", "Baufinanzierungsrate"],
    ["privateHealthCosts", "Private Krankenversicherung"],
    ["maintenanceCosts", "Gezahlter Unterhalt"],
  ] as const
  return (
    <section className="my-5 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4 text-sm text-slate-700">
      <h3 className="text-lg font-semibold text-slate-900">Kreditanfrage bei Creditolo</h3>
      <p className="mt-2">
        {CREDITOLO_NOTICE} Bitte prüfen Sie die zusätzlichen Angaben. Beträge gelten pro Monat in Euro; tragen
        Sie 0 ein, wenn keine Einnahmen oder Kosten vorliegen.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          Berufsgruppe *
          <select
            className={style}
            required
            aria-required="true"
            value={value.profession}
            onChange={(e) => update("profession", e.target.value)}
          >
            <option value="">Bitte auswählen</option>
            {CREDITOLO_PROFESSIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        {!schufaFree && (
          <>
            <label>
              Steuerklasse {(["Arbeiter", "Angestellter oeffentlicher Dienst", "Angestellter Privatwirtschaft", "Auszubildender/Lehrling", "Beamter", "Soldat"] as string[]).includes(value.profession) ? "*" : "(falls zutreffend)"}
              <select
                className={style}
                required={["Arbeiter", "Angestellter oeffentlicher Dienst", "Angestellter Privatwirtschaft", "Auszubildender/Lehrling", "Beamter", "Soldat"].includes(value.profession)}
                value={value.taxClass}
                onChange={(e) => update("taxClass", e.target.value)}
              >
                <option value="">Bitte auswählen</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Erwachsene im Haushalt *
              <select
                className={style}
                required
                aria-required="true"
                value={value.adults}
                onChange={(e) => update("adults", e.target.value)}
              >
                <option value="">Bitte auswählen</option>
                <option>1</option>
                <option>2</option>
              </select>
            </label>
            {moneyFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className={style}
                  required
                  type="number"
                  min="0"
                  max={key.endsWith("Costs") || key === "mortgageRate" ? "9999" : "99999"}
                  step="1"
                  value={value[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </label>
            ))}
          </>
        )}
        <label className="sm:col-span-2">
          Aufenthaltstitel gültig bis {nationality && needsResidencePermit(nationality) ? "*" : "(falls erforderlich)"}
          <input
            type="date"
            className={style}
            required={Boolean(nationality && needsResidencePermit(nationality))}
            value={value.residencePermitUntil}
            onChange={(e) => update("residencePermitUntil", e.target.value)}
          />
          <span className="mt-1 block text-xs">
            Bei unbefristetem Aufenthaltstitel: 31.12.2099. Für viele europäische Staatsangehörigkeiten ist
            diese Angabe nicht erforderlich.
          </span>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          required
          aria-required="true"
          checked={value.consent}
          onChange={(e) => update("consent", e.target.checked)}
        />
        <span>
          Ich bestätige die Angaben und willige ein, dass SEPANA meine Kontakt-, persönlichen,
          Beschäftigungs-, Einkommens- und Bankdaten zur Bearbeitung dieser Kreditanfrage an die creditolo
          GmbH übermittelt.{" "}
          <a
            href="https://www.creditolo.de/datenschutz/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Datenschutz bei Creditolo
          </a>
        </span>
      </label>
      {!schufaFree && (
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            required
            aria-required="true"
            checked={value.schufaConsent}
            onChange={(e) => update("schufaConsent", e.target.checked)}
          />
          <span>
            Ich willige in die erforderliche SCHUFA-Abfrage zur Bearbeitung meiner Kreditanfrage ein.
          </span>
        </label>
      )}
    </section>
  )
}
