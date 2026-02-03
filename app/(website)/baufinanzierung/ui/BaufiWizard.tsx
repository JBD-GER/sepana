// app/(website)/baufinanzierung/ui/BaufiWizard.tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

export type BaufiEckdaten = {
  purpose: string
  property_type: string
  purchase_price: string // formatted
}

type CoApplicant = {
  first_name: string
  last_name: string
  birth_date?: string
  employment_status?: string
  net_income_monthly?: string // formatted
}

type PrimaryApplicant = {
  first_name: string
  last_name: string
  email: string
  phone?: string
  birth_date?: string
  marital_status?: string

  address_street?: string
  address_zip?: string
  address_city?: string
  housing_status?: string

  employment_type?: string
  employment_status?: string
  employer_name?: string

  net_income_monthly?: string // formatted
  other_income_monthly?: string
  expenses_monthly?: string
  existing_loans_monthly?: string
}

type WizardDraft = {
  primary: PrimaryApplicant
  co: CoApplicant[]
}

const DRAFT_KEY = "baufi_wizard_draft_v4"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

const nfCurrency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const nfNumber = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function isPhone(v?: string) {
  const digits = String(v ?? "").replace(/\D/g, "")
  return digits.length >= 6
}

/**
 * ✅ Wichtig: robustes Parsing für de-DE Eingaben
 * - entfernt Währung/Spaces
 * - entfernt Tausenderpunkte
 * - Komma => Punkt
 */
function normalizeMoneyString(v?: string) {
  if (!v) return ""
  const raw = String(v).trim()
  if (!raw) return ""

  // alles außer Ziffern, Punkt, Komma, Minus entfernen
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return ""

  // Wenn Komma vorkommt, ist es sehr wahrscheinlich Dezimaltrennzeichen im DE-Format
  if (cleaned.includes(",")) {
    return cleaned.replace(/\./g, "").replace(",", ".")
  }

  // Kein Komma => Punkte sind sehr wahrscheinlich Tausendertrenner (DE-Format)
  return cleaned.replace(/\./g, "")
}

function parseMoneyToNumber(v?: string) {
  const norm = normalizeMoneyString(v)
  if (!norm) return 0
  const n = Number(norm)
  return Number.isFinite(n) ? n : 0
}

function formatMoneyFromNumber(n: number) {
  if (!Number.isFinite(n)) return ""
  return nfCurrency.format(n)
}

function formatIsoDateForDisplay(value?: string) {
  if (!value) return ""
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  return `${match[3]}.${match[2]}.${match[1]}`
}

function parseDisplayDateToIso(value: string): string | null {
  const raw = value.trim()
  if (!raw) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

type SubmitResponse = {
  ok?: boolean
  caseId?: string
  caseRef?: string
  existingAccount?: boolean
  nextUrl?: string
}

/**
 * ✅ FINAL: deine URL-Struktur laut Screenshot
 * - Bankenauswahl: /baufinanzierung/auswahl
 */
function buildNextUrl(opts: {
  caseId: string
  caseRef?: string
  existingAccount?: boolean
  loanAmount?: number
  years?: number
}) {
  const base = "/baufinanzierung/auswahl"

  const params = new URLSearchParams()
  params.set("caseId", opts.caseId)
  if (opts.caseRef) params.set("caseRef", opts.caseRef)
  if (opts.existingAccount) params.set("existing", "1")

  // ✅ Damit Auswahlseite nicht auf Default 300k/30 fällt
  if (opts.loanAmount && Number.isFinite(opts.loanAmount)) params.set("loanAmount", String(Math.round(opts.loanAmount)))
  if (opts.years && Number.isFinite(opts.years)) params.set("years", String(Math.round(opts.years)))

  return `${base}?${params.toString()}`
}

const steps = [
  { id: "contact", title: "Kontakt" },
  { id: "residence", title: "Wohnsituation" },
  { id: "household", title: "Haushaltsrechnung" },
  { id: "co", title: "Weitere Kreditnehmer" },
  { id: "review", title: "Übersicht" },
] as const

type StepId = (typeof steps)[number]["id"]

export default function BaufiWizard({
  baufi,
  startNonce,
}: {
  baufi: BaufiEckdaten
  startNonce: number
}) {
  const router = useRouter()

  const [step, setStep] = useState<StepId>("contact")
  const stepIndex = useMemo(() => steps.findIndex((s) => s.id === step), [step])
  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / steps.length) * 100),
    [stepIndex]
  )

  const [draft, setDraft] = useState<WizardDraft>({
    primary: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      birth_date: "",
      marital_status: "",
      address_street: "",
      address_zip: "",
      address_city: "",
      housing_status: "",
      employment_type: "",
      employment_status: "",
      employer_name: "",
      net_income_monthly: "",
      other_income_monthly: "",
      expenses_monthly: "",
      existing_loans_monthly: "",
    },
    co: [],
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [emailExists, setEmailExists] = useState<boolean | null>(null)
  const [emailCheckBusy, setEmailCheckBusy] = useState(false)
  const emailTimer = useRef<number | null>(null)

  useEffect(() => {
    setStep("contact")
    setError(null)
    setSuccessMsg(null)
  }, [startNonce])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as WizardDraft
      if (parsed?.primary?.email) setDraft(parsed)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // ignore
    }
  }, [draft])

  useEffect(() => {
    if (emailTimer.current) window.clearTimeout(emailTimer.current)
    const email = draft.primary.email.trim().toLowerCase()

    if (!isEmail(email)) {
      setEmailExists(null)
      return
    }

    emailTimer.current = window.setTimeout(async () => {
      try {
        setEmailCheckBusy(true)
        const res = await fetch(`/api/baufi/check-email?email=${encodeURIComponent(email)}`)
        const json = await res.json().catch(() => ({}))
        setEmailExists(!!json?.exists)
      } catch {
        setEmailExists(null)
      } finally {
        setEmailCheckBusy(false)
      }
    }, 600)

    return () => {
      if (emailTimer.current) window.clearTimeout(emailTimer.current)
    }
  }, [draft.primary.email])

  const primaryValid =
    draft.primary.first_name.trim().length > 0 &&
    draft.primary.last_name.trim().length > 0 &&
    isEmail(draft.primary.email) &&
    isPhone(draft.primary.phone) &&
    Boolean(draft.primary.birth_date) &&
    Boolean(draft.primary.marital_status)

  const calc = useMemo(() => {
    const net = parseMoneyToNumber(draft.primary.net_income_monthly)
    const other = parseMoneyToNumber(draft.primary.other_income_monthly)
    const exp = parseMoneyToNumber(draft.primary.expenses_monthly)
    const loans = parseMoneyToNumber(draft.primary.existing_loans_monthly)

    const coIncome = (draft.co || []).reduce(
      (sum, c) => sum + parseMoneyToNumber(c.net_income_monthly),
      0
    )

    const totalIncome = net + other + coIncome
    const totalOut = exp + loans
    const surplus = totalIncome - totalOut
    const base = Math.max(1, totalIncome)
    const surplusRatio = surplus / base

    let score = 0
    if (surplus <= 0) {
      const deficit = Math.abs(surplus)
      const sev = Math.min(1, deficit / Math.max(1, totalIncome))
      score = Math.round(10 + (1 - sev) * 35) // 10..45
    } else {
      const r = surplus / base
      score = Math.round(Math.min(100, 40 + r * 200)) // 0.15->70, 0.30->100
    }

    const label =
      surplus < 0
        ? "Schlecht"
        : surplusRatio < 0.05
          ? "Schwach"
          : surplusRatio < 0.15
            ? "Okay"
            : surplusRatio < 0.3
              ? "Gut"
              : "Perfekt"

    const tip =
      surplus < 0
        ? "Die Ausgaben liegen über den Einnahmen – prüfen Sie Fixkosten/Verpflichtungen oder ergänzen Sie Einnahmen (falls zutreffend)."
        : surplusRatio < 0.15
          ? "Kleiner Puffer: Mehr Überschuss verbessert i. d. R. die Finanzierbarkeit und Konditionen."
          : "Solider Puffer: In der Regel ein positives Signal für Banken."

    return { totalIncome, totalOut, surplus, surplusRatio, score, label, tip, coIncome }
  }, [
    draft.primary.net_income_monthly,
    draft.primary.other_income_monthly,
    draft.primary.expenses_monthly,
    draft.primary.existing_loans_monthly,
    draft.co,
  ])

  function goNext() {
    setError(null)
    setSuccessMsg(null)
    const next = steps[Math.min(stepIndex + 1, steps.length - 1)]?.id
    if (next) setStep(next)
  }

  function goPrev() {
    setError(null)
    setSuccessMsg(null)
    const prev = steps[Math.max(stepIndex - 1, 0)]?.id
    if (prev) setStep(prev)
  }

  async function submitFinal() {
    setBusy(true)
    setError(null)
    setSuccessMsg(null)

    try {
      // ✅ Für Auswahl-Seite: loanAmount als Beispiel = purchase_price (kannst du später ersetzen)
      const loanAmountExample = parseMoneyToNumber(baufi.purchase_price || "")
      const yearsExample = 30

      const payload = {
        baufi: {
          ...baufi,
          // ✅ wichtig: keine Tausenderpunkte, Komma -> Punkt
          purchase_price: normalizeMoneyString(baufi.purchase_price ?? ""),
        },
        primary: {
          ...draft.primary,
          net_income_monthly: normalizeMoneyString(draft.primary.net_income_monthly ?? ""),
          other_income_monthly: normalizeMoneyString(draft.primary.other_income_monthly ?? ""),
          expenses_monthly: normalizeMoneyString(draft.primary.expenses_monthly ?? ""),
          existing_loans_monthly: normalizeMoneyString(draft.primary.existing_loans_monthly ?? ""),
        },
        co: draft.co.map((c) => ({
          ...c,
          net_income_monthly: normalizeMoneyString(c.net_income_monthly ?? ""),
        })),
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/set-password`,
        language: "de",
      }

      const res = await fetch("/api/baufi/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as SubmitResponse
      if (!res.ok) {
        const failure = json as SubmitResponse & { error?: string }
        throw new Error(failure.error || "Abschluss fehlgeschlagen.")
      }

      if (json?.nextUrl) {
        localStorage.removeItem(DRAFT_KEY)
        router.push(json.nextUrl)
        return
      }

      const caseId = json?.caseId
      const caseRef = json?.caseRef
      const existingAccount = !!json?.existingAccount

      if (!caseId) {
        setSuccessMsg(
          existingAccount
            ? "Es gibt bereits ein Konto zu dieser E-Mail. Wir haben Ihren Vergleich im Portal hinterlegt – bitte melden Sie sich an."
            : "Geschafft! Sie erhalten jetzt eine E-Mail mit dem Einladungslink. Dort legen Sie nur noch Ihr Passwort fest."
        )
        localStorage.removeItem(DRAFT_KEY)
        return
      }

      const nextUrl = buildNextUrl({
        caseId,
        caseRef,
        existingAccount,
        loanAmount: loanAmountExample > 0 ? loanAmountExample : undefined,
        years: yearsExample,
      })

      localStorage.removeItem(DRAFT_KEY)
      router.push(nextUrl)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unbekannter Fehler.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* Header / Progress */}
      <div className="z-10 rounded-3xl border-b border-white/60 bg-white/85 px-4 py-4 backdrop-blur-xl md:sticky md:top-[72px] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-600">
              Schritt {stepIndex + 1} von {steps.length}
            </p>
            <p className="truncate text-base font-medium text-slate-900">
              {steps[stepIndex]?.title}
            </p>
          </div>
          <div className="shrink-0 text-sm text-slate-700 tabular-nums">{progress}%</div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((s, idx) => {
            const active = s.id === step
            const done = idx < stepIndex
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition sm:text-sm",
                  active
                    ? "border-slate-300 bg-white text-slate-900"
                    : done
                      ? "border-slate-200 bg-white/70 text-slate-700 hover:bg-white"
                      : "border-slate-200 bg-white/50 text-slate-600 hover:bg-white/70"
                )}
              >
                {idx + 1}. {s.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 sm:px-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <div>{successMsg}</div>
            {emailExists ? (
              <div className="mt-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
                >
                  Zum Login
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {step === "contact" && (
          <ContactStep
            value={draft.primary}
            onChange={(v) => setDraft((d) => ({ ...d, primary: v }))}
            emailExists={emailExists}
            emailCheckBusy={emailCheckBusy}
          />
        )}

        {step === "residence" && (
          <ResidenceStep
            value={draft.primary}
            onChange={(v) => setDraft((d) => ({ ...d, primary: v }))}
          />
        )}

        {step === "household" && (
          <HouseholdStep
            value={draft.primary}
            onChange={(v) => setDraft((d) => ({ ...d, primary: v }))}
            calc={calc}
            coCount={(draft.co || []).length}
          />
        )}

        {step === "co" && (
          <CoApplicantsStep
            items={draft.co}
            onChange={(items) => setDraft((d) => ({ ...d, co: items }))}
          />
        )}

        {step === "review" && <ReviewStep draft={draft} calc={calc} />}

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={stepIndex === 0 || busy}
            className={cn(
              "w-full rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white hover:shadow-md active:scale-[0.99] sm:w-auto",
              (stepIndex === 0 || busy) && "cursor-not-allowed opacity-50"
            )}
          >
            Zurück
          </button>

          {step !== "review" ? (
            <button
              type="button"
              onClick={() => {
                if (step === "contact" && !primaryValid) {
                  setError("Bitte füllen Sie im Schritt Kontakt alle Pflichtfelder vollständig aus.")
                  return
                }
                goNext()
              }}
              disabled={busy}
              className={cn(
                "w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto",
                busy && "cursor-not-allowed opacity-70"
              )}
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!primaryValid) {
                  setError("Bitte prüfen Sie Ihre Pflichtangaben in Kontakt & Basisdaten.")
                  return
                }
                submitFinal()
              }}
              disabled={busy}
              className={cn(
                "w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto",
                busy && "cursor-not-allowed opacity-70"
              )}
            >
              {busy
                ? "Bankenvergleich wird gestartet…"
                : "Bankenvergleich starten"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   UI building blocks
──────────────────────────────────────────────────────────────── */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="mb-3">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
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

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-xs text-slate-600">
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
        <input
          {...props}
          className={cn(
        "h-12 w-full rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 sm:text-[15px]",
        "focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100",
        props.className
      )}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props
  return (
    <div className="relative">
        <select
          {...rest}
          className={cn(
          "h-12 w-full appearance-none rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 pr-10 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
          "focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100",
          className
        )}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = parseMoneyToNumber(value)
          if (String(value).trim() === "") return onChange("")
          onChange(formatMoneyFromNumber(n))
        }}
        inputMode="decimal"
        className="pr-12"
        placeholder={placeholder || "z. B. 3.200"}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center text-sm font-semibold text-slate-500">
        €
      </div>
    </div>
  )
}

function DateInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    value: string
    onChange: (next: string) => void
  }
) {
  const { className, onBlur, value, onChange, ...rest } = props
  const [displayValue, setDisplayValue] = useState(formatIsoDateForDisplay(value))

  useEffect(() => {
    setDisplayValue(formatIsoDateForDisplay(value))
  }, [value])

  return (
    <div className="relative">
      <Input
        {...rest}
        type="text"
        inputMode="numeric"
        placeholder="TT.MM.JJJJ"
        value={displayValue}
        className={cn("date-field pr-11 [color-scheme:light]", className)}
        onChange={(event) => {
          const raw = event.target.value
          setDisplayValue(raw)
          const parsed = parseDisplayDateToIso(raw)
          if (parsed !== null) onChange(parsed)
        }}
        onBlur={(event) => {
          const parsed = parseDisplayDateToIso(event.target.value)
          if (parsed === null) {
            setDisplayValue(formatIsoDateForDisplay(value))
          } else {
            setDisplayValue(formatIsoDateForDisplay(parsed))
          }
          onBlur?.(event)
        }}
      />
      <input
        type="date"
        value={value || ""}
        lang="de-DE"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const next = event.target.value
          onChange(next)
          setDisplayValue(formatIsoDateForDisplay(next))
        }}
        className="absolute inset-y-0 right-0 w-11 cursor-pointer opacity-0"
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <rect x="3.2" y="4.6" width="13.6" height="12" rx="2.4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.2 2.8v3.1M13.8 2.8v3.1M3.2 8h13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   Steps
──────────────────────────────────────────────────────────────── */

function ContactStep({
  value,
  onChange,
  emailExists,
  emailCheckBusy,
}: {
  value: PrimaryApplicant
  onChange: (v: PrimaryApplicant) => void
  emailExists: boolean | null
  emailCheckBusy: boolean
}) {
  return (
    <div className="space-y-4">
      <Card title="Kontakt & Basisdaten" subtitle="Alle Felder in diesem Schritt sind Pflichtfelder.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Vorname *" hint="wie im Ausweis">
            <Input
              value={value.first_name}
              onChange={(e) => onChange({ ...value, first_name: e.target.value })}
              autoComplete="given-name"
              placeholder="Max"
              required
            />
          </Field>

          <Field label="Nachname *" hint="wie im Ausweis">
            <Input
              value={value.last_name}
              onChange={(e) => onChange({ ...value, last_name: e.target.value })}
              autoComplete="family-name"
              placeholder="Mustermann"
              required
            />
          </Field>

          <div className="sm:col-span-1">
            <Field label="E-Mail *" hint="Portalzugang / Status-Updates">
              <Input
                value={value.email}
                onChange={(e) => onChange({ ...value, email: e.target.value })}
                autoComplete="email"
                inputMode="email"
                placeholder="max@mail.de"
                required
              />
            </Field>

            {emailCheckBusy ? (
              <div className="mt-2 text-xs text-slate-500">Prüfe Konto...</div>
            ) : emailExists ? (
              <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Zu dieser E-Mail existiert bereits ein Konto. Nach dem Abschluss wird der Vergleich im Portal hinterlegt.
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500">
                Tipp: Nutzen Sie eine E-Mail, auf die Sie sicher Zugriff haben.
              </div>
            )}
          </div>

          <Field label="Telefon *" hint="für Rückfragen und Terminbestätigung">
            <Input
              value={value.phone ?? ""}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+49 ..."
              required
            />
          </Field>

          <Field label="Geburtsdatum *" hint="für Konditionen relevant">
            <DateInput
              value={value.birth_date ?? ""}
              onChange={(next) => onChange({ ...value, birth_date: next })}
              autoComplete="bday"
              required
            />
          </Field>

          <Field label="Familienstand *">
            <Select
              value={value.marital_status ?? ""}
              onChange={(e) => onChange({ ...value, marital_status: e.target.value })}
              required
            >
              <option value="">Bitte wählen</option>
              <option value="single">Ledig</option>
              <option value="married">Verheiratet</option>
              <option value="registered">Eingetragene Partnerschaft</option>
              <option value="divorced">Geschieden</option>
              <option value="widowed">Verwitwet</option>
            </Select>
          </Field>
        </div>

        <div className="mt-3">
          <Tip>Hinweis: Vollständige Kontaktdaten beschleunigen Rückfragen und die Terminierung.</Tip>
        </div>
      </Card>
    </div>
  )
}

function ResidenceStep({
  value,
  onChange,
}: {
  value: PrimaryApplicant
  onChange: (v: PrimaryApplicant) => void
}) {
  return (
    <div className="space-y-4">
      <Card title="Adresse & Wohnsituation" subtitle="Optional – aber sehr hilfreich für eine saubere Einordnung.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Straße / Nr.">
            <Input
              value={value.address_street ?? ""}
              onChange={(e) => onChange({ ...value, address_street: e.target.value })}
              placeholder="Musterstraße 12"
            />
          </Field>

          <Field label="PLZ">
            <Input
              value={value.address_zip ?? ""}
              onChange={(e) => onChange({ ...value, address_zip: e.target.value })}
              inputMode="numeric"
              placeholder="12345"
            />
          </Field>

          <Field label="Ort">
            <Input
              value={value.address_city ?? ""}
              onChange={(e) => onChange({ ...value, address_city: e.target.value })}
              placeholder="Berlin"
            />
          </Field>

          <Field label="Wohnstatus">
            <Select
              value={value.housing_status ?? ""}
              onChange={(e) => onChange({ ...value, housing_status: e.target.value })}
            >
              <option value="">Bitte wählen</option>
              <option value="rent">Miete</option>
              <option value="owner">Eigentum</option>
              <option value="with_family">Bei Familie</option>
              <option value="other">Sonstiges</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card title="Beschäftigung" subtitle="Bitte als Dropdown – schnell & eindeutig.">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Beschäftigungsverhältnis">
                <Select
                  value={value.employment_type ?? ""}
                  onChange={(e) => onChange({ ...value, employment_type: e.target.value })}
                >
                  <option value="">Bitte wählen</option>
                  <option value="employed">Angestellt</option>
                  <option value="self_employed">Selbstständig</option>
                  <option value="civil_servant">Beamter</option>
                  <option value="student">Student</option>
                  <option value="retired">Rentner</option>
                  <option value="unemployed">Arbeitslos</option>
                  <option value="other">Sonstiges</option>
                </Select>
              </Field>

              <Field label="Status (Anstellungsverhältnis)">
                <Select
                  value={value.employment_status ?? ""}
                  onChange={(e) => onChange({ ...value, employment_status: e.target.value })}
                >
                  <option value="">Bitte wählen</option>
                  <option value="permanent">Unbefristet</option>
                  <option value="fixed_term">Befristet</option>
                  <option value="probation">Probezeit</option>
                  <option value="mini_job">Minijob</option>
                  <option value="part_time">Teilzeit</option>
                  <option value="full_time">Vollzeit</option>
                  <option value="apprentice">Ausbildung</option>
                  <option value="other">Sonstiges</option>
                </Select>
              </Field>

              <Field label="Arbeitgeber (optional)" hint="Firma / Branche">
                <Input
                  value={value.employer_name ?? ""}
                  onChange={(e) => onChange({ ...value, employer_name: e.target.value })}
                  placeholder="z. B. Muster GmbH"
                />
              </Field>
            </div>
          </Card>

          <Card title="Mini-Tipps" subtitle="Warum diese Infos helfen">
            <div className="space-y-2 text-xs text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                • Beschäftigung + Status sind Standardfragen bei Banken – Dropdowns verhindern Missverständnisse.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                • Optional bleibt optional – aber weniger Rückfragen = schnellerer Vergleich.
              </div>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  )
}

function HouseholdScoreBar({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Haushaltsrechnung</div>
          <div className="mt-1 text-xs text-slate-600">
            Bewertung: <span className="font-medium text-slate-900">{label}</span>
          </div>
        </div>
        <div className="text-sm font-medium text-slate-900 tabular-nums">{clamped}/100</div>
      </div>

      <div className="mt-3">
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-[width] duration-300"
            style={{ width: `${clamped}%` }}
          />
          <div className="absolute top-1/2 h-5 w-0 -translate-y-1/2 border-l border-slate-900/40" style={{ left: "33%" }} />
          <div className="absolute top-1/2 h-5 w-0 -translate-y-1/2 border-l border-slate-900/40" style={{ left: "66%" }} />
        </div>

        <div className="mt-2 flex justify-between text-[11px] text-slate-600">
          <span>Schlecht</span>
          <span>Gut</span>
          <span>Perfekt</span>
        </div>
      </div>
    </div>
  )
}

function HouseholdStep({
  value,
  onChange,
  calc,
  coCount,
}: {
  value: PrimaryApplicant
  onChange: (v: PrimaryApplicant) => void
  calc: {
    totalIncome: number
    totalOut: number
    surplus: number
    surplusRatio: number
    score: number
    label: string
    tip: string
    coIncome: number
  }
  coCount: number
}) {
  const ratioPct = nfNumber.format(calc.surplusRatio * 100)
  const surplusStr = nfCurrency.format(calc.surplus)

  return (
    <div className="space-y-4">
      <Card title="Einnahmen & Ausgaben" subtitle="Monatswerte – wird automatisch als Euro formatiert.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Field label="Nettoeinkommen / Monat">
              <MoneyInput
                value={value.net_income_monthly ?? ""}
                onChange={(v) => onChange({ ...value, net_income_monthly: v })}
                placeholder="z. B. 3.200"
              />
            </Field>
            <Tip>Wenn schwankend: Durchschnitt der letzten 3–6 Monate.</Tip>
          </div>

          <div className="space-y-2">
            <Field label="Weitere Einnahmen / Monat" hint="z. B. Kindergeld">
              <MoneyInput
                value={value.other_income_monthly ?? ""}
                onChange={(v) => onChange({ ...value, other_income_monthly: v })}
                placeholder="z. B. 300"
              />
            </Field>
            <Tip>Nur regelmäßige Einnahmen eintragen.</Tip>
          </div>

          <div className="space-y-2">
            <Field label="Fixkosten / Monat" hint="inkl. Miete, Versicherungen">
              <MoneyInput
                value={value.expenses_monthly ?? ""}
                onChange={(v) => onChange({ ...value, expenses_monthly: v })}
                placeholder="z. B. 1.200"
              />
            </Field>
            <Tip>Konservativ schätzen spart später Rückfragen.</Tip>
          </div>

          <div className="space-y-2">
            <Field label="Bestehende Kredite / Monat" hint="Raten / Leasing">
              <MoneyInput
                value={value.existing_loans_monthly ?? ""}
                onChange={(v) => onChange({ ...value, existing_loans_monthly: v })}
                placeholder="z. B. 150"
              />
            </Field>
            <Tip>Nur feste monatliche Verpflichtungen.</Tip>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <HouseholdScoreBar score={calc.score} label={calc.label} />

          <Card title="Ergebnis (live)" subtitle="Weitere Kreditnehmer werden automatisch addiert.">
            <div className="space-y-2 text-sm">
              <Row label="Einnahmen gesamt" value={formatMoneyFromNumber(calc.totalIncome)} />
              {coCount > 0 ? (
                <Row
                  label={`davon weitere Kreditnehmer (${coCount})`}
                  value={formatMoneyFromNumber(calc.coIncome)}
                />
              ) : null}
              <Row label="Ausgaben gesamt" value={formatMoneyFromNumber(calc.totalOut)} />

              <div className="mt-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900 tabular-nums">
                    Überschuss/Defizit: {surplusStr}
                  </div>
                  <div className="text-xs text-slate-600 tabular-nums">{ratioPct}% Puffer</div>
                </div>
                <div className="mt-2 text-xs text-slate-600">{calc.tip}</div>
              </div>

              <Tip>Tipp: Schon kleine Optimierungen (Abos, Versicherungen) können den Puffer verbessern.</Tip>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-slate-600">{label}</div>
      <div className="font-medium text-slate-900 tabular-nums text-right">{value}</div>
    </div>
  )
}

function CoApplicantsStep({
  items,
  onChange,
}: {
  items: CoApplicant[]
  onChange: (items: CoApplicant[]) => void
}) {
  function add() {
    onChange([...items, { first_name: "", last_name: "", birth_date: "", employment_status: "", net_income_monthly: "" }])
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function update(i: number, patch: Partial<CoApplicant>) {
    onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }

  return (
    <div className="space-y-4">
      <Card title="Weitere Kreditnehmer" subtitle="Optional – Einkommen wird automatisch in der Haushaltsrechnung berücksichtigt.">
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
              Noch keine weiteren Kreditnehmer hinzugefügt.
            </div>
          ) : null}

          {items.map((c, i) => (
            <div key={i} className="rounded-3xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">Kreditnehmer {i + 2}</div>
                  <div className="text-xs text-slate-500">Tipp: Einkommen hilft am meisten für die Haushaltsrechnung.</div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white active:scale-[0.99]"
                >
                  Entfernen
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vorname">
                  <Input value={c.first_name} onChange={(e) => update(i, { first_name: e.target.value })} />
                </Field>
                <Field label="Nachname">
                  <Input value={c.last_name} onChange={(e) => update(i, { last_name: e.target.value })} />
                </Field>
                <Field label="Geburtsdatum">
                  <DateInput
                    value={c.birth_date ?? ""}
                    onChange={(next) => update(i, { birth_date: next })}
                  />
                </Field>

                <Field label="Beschäftigungsstatus" hint="Dropdown ist optional">
                  <Select
                    value={c.employment_status ?? ""}
                    onChange={(e) => update(i, { employment_status: e.target.value })}
                  >
                    <option value="">Bitte wählen</option>
                    <option value="employed">Angestellt</option>
                    <option value="self_employed">Selbstständig</option>
                    <option value="civil_servant">Beamter</option>
                    <option value="student">Student</option>
                    <option value="retired">Rentner</option>
                    <option value="unemployed">Arbeitslos</option>
                    <option value="other">Sonstiges</option>
                  </Select>
                </Field>

                <div className="sm:col-span-2 space-y-2">
                  <Field label="Nettoeinkommen / Monat" hint="optional">
                    <MoneyInput
                      value={c.net_income_monthly ?? ""}
                      onChange={(v) => update(i, { net_income_monthly: v })}
                      placeholder="z. B. 2.800"
                    />
                  </Field>
                  <Tip>Tipp: Wenn jemand nicht mitfinanziert, bitte nicht hinzufügen.</Tip>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={add}
            className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white hover:shadow-md active:scale-[0.99] sm:w-auto"
          >
            + Kreditnehmer hinzufügen
          </button>
        </div>
      </Card>
    </div>
  )
}

function ReviewStep({
  draft,
  calc,
}: {
  draft: WizardDraft
  calc: {
    totalIncome: number
    totalOut: number
    surplus: number
    score: number
    label: string
    coIncome: number
  }
}) {
  const p = draft.primary

  return (
    <div className="space-y-4">
      <Card
        title="Übersicht"
        subtitle="Bitte prüfen Sie alles kurz. Nach dem Abschluss wird der Vergleich im Portal angelegt (und ggf. ein Invite-Link per E-Mail versendet)."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Section title="Hauptantragsteller">
              <KV k="Name" v={`${p.first_name} ${p.last_name}`.trim() || "—"} />
              <KV k="E-Mail" v={p.email || "—"} />
              <KV k="Telefon" v={p.phone || "—"} />
              <KV k="Geburtsdatum" v={p.birth_date || "—"} />
              <KV k="Familienstand" v={p.marital_status || "—"} />
            </Section>

            <Section title="Adresse & Situation">
              <KV
                k="Adresse"
                v={[p.address_street, p.address_zip, p.address_city].filter(Boolean).join(", ") || "—"}
              />
              <KV k="Wohnstatus" v={p.housing_status || "—"} />
              <KV k="Beschäftigungsverhältnis" v={labelEmploymentType(p.employment_type)} />
              <KV k="Status" v={labelEmploymentStatus(p.employment_status)} />
              <KV k="Arbeitgeber" v={p.employer_name || "—"} />
            </Section>
          </div>

          <div className="space-y-3">
            <Section title="Haushaltsrechnung (Monat)">
              <KV k="Einnahmen gesamt" v={formatMoneyFromNumber(calc.totalIncome)} />
              {draft.co.length > 0 ? (
                <KV k={`davon weitere Kreditnehmer (${draft.co.length})`} v={formatMoneyFromNumber(calc.coIncome)} />
              ) : null}
              <KV k="Ausgaben gesamt" v={formatMoneyFromNumber(calc.totalOut)} />
              <KV k="Überschuss/Defizit" v={nfCurrency.format(calc.surplus)} />
              <KV k="Bewertung" v={`${calc.label} (${Math.max(0, Math.min(100, calc.score))}/100)`} />
              <div className="mt-2">
                <HouseholdScoreBar score={calc.score} label={calc.label} />
              </div>
            </Section>

            <Section title="Weitere Kreditnehmer">
              {draft.co.length === 0 ? (
                <div className="text-sm text-slate-600">Keine hinzugefügt.</div>
              ) : (
                <ul className="space-y-2">
                  {draft.co.map((c, i) => {
                    const name =
                      c.first_name || c.last_name
                        ? `${c.first_name} ${c.last_name}`.trim()
                        : `Kreditnehmer ${i + 2}`
                    const income = c.net_income_monthly ? c.net_income_monthly : "—"
                    return (
                      <li key={i} className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="min-w-0 truncate text-sm font-medium text-slate-900">
                            Kreditnehmer {i + 2}: {name}
                          </div>
                          <div className="shrink-0 text-sm font-medium text-slate-900 tabular-nums">{income}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {c.birth_date ? `Geb.: ${c.birth_date}` : "Geb.: —"} ·{" "}
                          {c.employment_status
                            ? `Status: ${labelEmploymentStatus(c.employment_status)}`
                            : "Status: —"}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Was passiert als Nächstes?</div>
          <div className="mt-1 text-slate-600">
            Nach dem Abschluss wird der Vergleich in Ihrem Portal gespeichert. Wenn noch kein Konto existiert, erhalten Sie zusätzlich einen
            Einladungslink per E-Mail, um Ihr Passwort festzulegen.
          </div>
        </div>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/60 p-4">
      <div className="mb-2 text-sm font-medium text-slate-900">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="text-slate-600">{k}</div>
      <div className="font-medium text-slate-900 tabular-nums text-right">{v || "—"}</div>
    </div>
  )
}

function labelEmploymentType(v?: string) {
  switch (v) {
    case "employed":
      return "Angestellt"
    case "self_employed":
      return "Selbstständig"
    case "civil_servant":
      return "Beamter"
    case "student":
      return "Student"
    case "retired":
      return "Rentner"
    case "unemployed":
      return "Arbeitslos"
    case "other":
      return "Sonstiges"
    default:
      return "—"
  }
}

function labelEmploymentStatus(v?: string) {
  switch (v) {
    case "permanent":
      return "Unbefristet"
    case "fixed_term":
      return "Befristet"
    case "probation":
      return "Probezeit"
    case "mini_job":
      return "Minijob"
    case "part_time":
      return "Teilzeit"
    case "full_time":
      return "Vollzeit"
    case "apprentice":
      return "Ausbildung"
    case "other":
      return "Sonstiges"
    default:
      return "—"
  }
}
