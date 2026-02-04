// app/(website)/baufinanzierung/ui/BaufiStart.tsx
"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import BaufiWizard, { type BaufiEckdaten } from "./BaufiWizard"

const PRIMARY = "#07183d"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

const nfCurrency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function parseMoneyToNumber(v?: string) {
  if (!v) return 0
  const cleaned = String(v).replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return 0
  const normalized = cleaned.replace(/\./g, "").replace(",", ".")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function formatMoneyFromNumber(n: number) {
  if (!Number.isFinite(n)) return ""
  return nfCurrency.format(n)
}

function IconGift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 7H2v5h20V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 22V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M12 7H8.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 7h3.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-sm font-medium text-slate-900">{label}</span>
        {hint ? <span className="text-xs text-slate-500 sm:text-right">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
          "focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        )}
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        const n = parseMoneyToNumber(value)
        if (String(value).trim() === "") return onChange("")
        onChange(formatMoneyFromNumber(n))
      }}
      inputMode="decimal"
      placeholder={placeholder || "z. B. 300.000"}
      className={cn(
        "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
        "placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
      )}
    />
  )
}

export default function BaufiStart() {
  const wizardRef = useRef<HTMLDivElement | null>(null)

  const [started, setStarted] = useState(false)
  const [startNonce, setStartNonce] = useState(0)

  const [baufi, setBaufi] = useState<BaufiEckdaten>({
    purpose: "buy",
    property_type: "condo",
    purchase_price: "",
  })

  const purchasePriceOk = useMemo(() => parseMoneyToNumber(baufi.purchase_price) > 0, [baufi.purchase_price])

  function start() {
    if (!purchasePriceOk) return
    setStarted(true)
    setStartNonce((n) => n + 1)
    requestAnimationFrame(() => wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(2,6,23,0.08)]">
          <div className="p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
              <div className="lg:col-span-2">
                <h2 className="text-balance text-[22px] font-semibold leading-tight text-slate-900 sm:text-[30px]">
                  Finden Sie die passende Baufinanzierung –{" "}
                  <span style={{ color: PRIMARY }}>mit Best-Zins-Check</span>
                </h2>
                <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  Starten Sie mit 3 Eckdaten. Danach ergänzen Sie Haushaltswerte und ggf. weitere Kreditnehmer –
                  auf Wunsch mit Expertenberatung.
                </p>

                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>Abgleich nach Vorhaben, Objekt und Budget statt starrer Einheitsvorgaben.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>Sie sehen direkt, welche Angebote online möglich sind und wo Live-Beratung sinnvoll ist.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>Konditionshinweise mit Stand-Datum schaffen eine klare Erwartung vor dem eigentlichen Antrag.</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-1">
                <div className="h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-600">Bonus bei erfolgreichem Abschluss</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2">
                        <div className="text-3xl font-semibold tracking-tight" style={{ color: PRIMARY }}>
                          350 €
                        </div>
                        <div className="text-sm font-medium text-slate-800">extra für Sie</div>
                      </div>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: PRIMARY }}>
                        <IconGift className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-slate-500">
                      Gutschrift nach erfolgreicher Finanzierung/Abschluss gemäß Bedingungen.
                    </div>

                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                      Hinweis: Die Auszahlung erfolgt erst, wenn der Antrag von der Bank bewilligt wurde und eine Auszahlungsgenehmigung vorliegt. Mindestdarlehenssumme: 250.000 €.
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      Tipp: Starten Sie jetzt – dauert wirklich nur kurz.
                    </div>
                  </div>

                  <div className="mt-4 h-px bg-slate-200" />
                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold" style={{ color: PRIMARY }}>
                      350 €
                    </span>{" "}
                    Bonus ist im Prozess dauerhaft sichtbar.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/40 p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Vorhaben">
                <Select value={baufi.purpose} onChange={(v) => setBaufi((s) => ({ ...s, purpose: v }))}>
                  <option value="buy">Kauf Immobilie / Grundstück</option>
                  <option value="build">Eigenes Bauvorhaben</option>
                  <option value="refi">Anschlussfinanzierung / Umschuldung</option>
                  <option value="modernize">Umbau / Modernisierung</option>
                  <option value="equity_release">Kapitalbeschaffung</option>
                </Select>
              </Field>

              <Field label="Immobilienart">
                <Select value={baufi.property_type} onChange={(v) => setBaufi((s) => ({ ...s, property_type: v }))}>
                  <option value="condo">Eigentumswohnung</option>
                  <option value="house">Einfamilienhaus</option>
                  <option value="two_family">Zweifamilienhaus</option>
                  <option value="multi">Mehrfamilienhaus</option>
                  <option value="land">Grundstück</option>
                  <option value="other">Sonstiges</option>
                </Select>
              </Field>

              <Field label="Kaufpreis" hint="ohne Nebenkosten">
                <MoneyInput
                  value={baufi.purchase_price}
                  onChange={(v) => setBaufi((s) => ({ ...s, purchase_price: v }))}
                  placeholder="z. B. 300.000"
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                Sie haben bereits ein Konto?{" "}
                <Link href="/login" className="font-medium underline underline-offset-4" style={{ color: PRIMARY }}>
                  anmelden
                </Link>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                {!purchasePriceOk ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Bitte Kaufpreis eintragen, um zu starten.
                  </div>
                ) : (
                  <div className="text-xs text-slate-700">
                    ✅ <span className="font-semibold" style={{ color: PRIMARY }}>350 € Bonus</span> bei erfolgreichem Abschluss
                  </div>
                )}

                <button
                  type="button"
                  onClick={start}
                  disabled={!purchasePriceOk}
                  className={cn(
                    "h-12 rounded-2xl px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]",
                    !purchasePriceOk && "cursor-not-allowed opacity-60"
                  )}
                  style={{ background: PRIMARY }}
                >
                  Jetzt Vergleich starten
                </button>
              </div>
            </div>

            <div className="mt-4 sm:hidden">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <span className="font-semibold" style={{ color: PRIMARY }}>350 € Bonus</span>{" "}
                <span className="text-slate-700">bei erfolgreichem Abschluss</span>
                <div className="mt-2 text-xs leading-relaxed text-slate-600">
                  Auszahlung erst nach Bankbewilligung und vorliegender Auszahlungsgenehmigung.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {started ? (
        <div ref={wizardRef} className="scroll-mt-24">
          <BaufiWizard baufi={baufi} startNonce={startNonce} />
        </div>
      ) : null}
    </div>
  )
}
