"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createBrowserSupabaseClientNoAuth } from "@/lib/supabase/browser"
import { getCountryOptions } from "@/lib/countries"

type PrimaryApplicant = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  nationality?: string | null
  marital_status?: string | null
  address_street?: string | null
  address_zip?: string | null
  address_city?: string | null
  housing_status?: string | null
  employment_type?: string | null
  employment_status?: string | null
  employer_name?: string | null
  net_income_monthly?: string | number | null
  other_income_monthly?: string | number | null
  expenses_monthly?: string | number | null
  existing_loans_monthly?: string | number | null
}

type CoApplicant = {
  id?: string | null
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  employment_status?: string | null
  net_income_monthly?: string | number | null
}

type BaufiDetails = {
  purpose?: string | null
  property_type?: string | null
  purchase_price?: string | number | null
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

const PURPOSE_OPTIONS = [
  { value: "buy", label: "Kauf Immobilie / Grundstueck" },
  { value: "build", label: "Eigenes Bauvorhaben" },
  { value: "refi", label: "Anschlussfinanzierung / Umschuldung" },
  { value: "modernize", label: "Umbau / Modernisierung" },
  { value: "equity_release", label: "Kapitalbeschaffung" },
]

const PROPERTY_OPTIONS = [
  { value: "condo", label: "Eigentumswohnung" },
  { value: "house", label: "Einfamilienhaus" },
  { value: "two_family", label: "Zweifamilienhaus" },
  { value: "multi", label: "Mehrfamilienhaus" },
  { value: "land", label: "Grundstueck" },
  { value: "other", label: "Sonstiges" },
]

const PROPERTY_ADDRESS_OPTIONS = [
  { value: "property", label: "Immobilienadresse" },
  { value: "plot", label: "Grundstuecksadresse" },
]

const SALARY_PAYMENTS_OPTIONS = ["12", "12.5", "13", "13.5", "14", "14.5"]

const HOUSING_OPTIONS = [
  { value: "rent", label: "Miete" },
  { value: "owner", label: "Eigentum" },
  { value: "with_family", label: "Bei Familie" },
  { value: "other", label: "Sonstiges" },
]

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "employed", label: "Angestellt" },
  { value: "self_employed", label: "Selbststaendig" },
  { value: "civil_servant", label: "Beamter" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Rentner" },
  { value: "unemployed", label: "Arbeitslos" },
  { value: "other", label: "Sonstiges" },
]

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "permanent", label: "Unbefristet" },
  { value: "fixed_term", label: "Befristet" },
  { value: "probation", label: "Probezeit" },
  { value: "mini_job", label: "Minijob" },
  { value: "part_time", label: "Teilzeit" },
  { value: "full_time", label: "Vollzeit" },
  { value: "apprentice", label: "Ausbildung" },
  { value: "other", label: "Sonstiges" },
]

const LIVE_CASE_TABS = [
  { id: "contact", label: "Kontakt" },
  { id: "household", label: "Haushalt" },
  { id: "finance", label: "Finanzierung" },
  { id: "details", label: "Details" },
] as const

type LiveCaseTabId = (typeof LIVE_CASE_TABS)[number]["id"]

type RequiredFieldCheck = {
  id: string
  tab: LiveCaseTabId
  label: string
  missing: boolean
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

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

function toInput(value: any) {
  if (value === null || value === undefined) return ""
  return String(value)
}

function toDateInput(value: any) {
  if (!value) return ""
  const raw = String(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

function normalizeMoneyString(v?: string) {
  if (!v) return ""
  const raw = String(v).trim()
  if (!raw) return ""
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return ""
  if (cleaned.includes(",")) {
    return cleaned.replace(/\./g, "").replace(",", ".")
  }
  return cleaned.replace(/\./g, "")
}

function parseMoneyToNumber(v?: string | number | null) {
  if (v === null || v === undefined) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const norm = normalizeMoneyString(v)
  if (!norm) return 0
  const n = Number(norm)
  return Number.isFinite(n) ? n : 0
}

function formatMoneyFromNumber(n: number) {
  if (!Number.isFinite(n)) return ""
  return nfCurrency.format(n)
}

function toMoneyInput(value: any) {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value === "number") return formatMoneyFromNumber(value)
  const s = String(value).trim()
  if (!s) return ""
  const hasDigit = /\d/.test(s)
  if (!hasDigit) return s
  const n = parseMoneyToNumber(s)
  return Number.isFinite(n) && n !== 0 ? formatMoneyFromNumber(n) : s
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
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
  required,
  invalid,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <label className={cn("block rounded-2xl p-1.5 transition", invalid && "bg-amber-50/70 ring-1 ring-amber-200/80")}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={cn("text-sm font-medium", invalid ? "text-amber-900" : "text-slate-900")}>{label}</span>
        {required ? (
          <span className={cn("text-[11px] font-semibold uppercase tracking-[0.08em]", invalid ? "text-amber-700" : "text-slate-400")}>
            Pflicht
          </span>
        ) : hint ? (
          <span className="text-xs text-slate-500">{hint}</span>
        ) : null}
      </div>
      {children}
      {invalid ? <div className="mt-1 text-[11px] text-amber-700">Fehlt noch fuer das finale Angebot.</div> : null}
    </label>
  )
}

function CheckboxField({
  label,
  optionLabel,
  checked,
  onChange,
  hint,
  invalid,
}: {
  label: string
  optionLabel: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
  invalid?: boolean
}) {
  return (
    <div className={cn("block rounded-2xl p-1.5 transition", invalid && "bg-amber-50/70 ring-1 ring-amber-200/80")}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={cn("text-sm font-medium", invalid ? "text-amber-900" : "text-slate-900")}>{label}</span>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      <label
        className={cn(
          "flex h-11 items-center gap-2 rounded-2xl border px-3 shadow-sm",
          invalid ? "border-amber-300 bg-amber-50/40" : "border-slate-200/70 bg-white"
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900"
        />
        <span className={cn("text-sm", invalid ? "text-amber-900" : "text-slate-700")}>{optionLabel}</span>
      </label>
      {invalid ? <div className="mt-1 text-[11px] text-amber-700">Fehlt noch fuer das finale Angebot.</div> : null}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
        "placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200",
        props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
        props.className
      )}
    />
  )
}

function Select({
  value,
  onChange,
  children,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
          "focus:border-slate-300 focus:ring-2 focus:ring-slate-200",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
          className
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
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (String(value).trim() === "") return onChange("")
        const n = parseMoneyToNumber(value)
        onChange(formatMoneyFromNumber(n))
      }}
      inputMode="decimal"
      placeholder={placeholder || "z. B. 300.000"}
      disabled={disabled}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition sm:text-[15px]",
        "placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200",
        disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
        className
      )}
    />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-slate-600">{label}</div>
      <div className="font-medium text-slate-900 tabular-nums text-right">{value}</div>
    </div>
  )
}

export default function LiveCasePanel({
  caseId,
  caseRef,
  ticketId,
  guestToken,
  defaultCollapsed = false,
  showMissingDataReminderButton = false,
}: {
  caseId: string
  caseRef: string | null
  ticketId?: string
  guestToken?: string
  defaultCollapsed?: boolean
  showMissingDataReminderButton?: boolean
}) {
  const supabase = useMemo(() => createBrowserSupabaseClientNoAuth(), [])
  const [primary, setPrimary] = useState<PrimaryApplicant>({})
  const [co, setCo] = useState<CoApplicant[]>([])
  const [baufi, setBaufi] = useState<BaufiDetails>({})
  const [additional, setAdditional] = useState<AdditionalDetails>({})
  const [children, setChildren] = useState<ChildRow[]>([])
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const [activeTab, setActiveTab] = useState<LiveCaseTabId>("contact")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderMsg, setReminderMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [customerCanEdit, setCustomerCanEdit] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const contentId = `live-case-panel-${caseId}`
  const countryOptions = useMemo(() => getCountryOptions("de-DE"), [])

  useEffect(() => {
    setExpanded(!defaultCollapsed)
    setActiveTab("contact")
    setReminderMsg(null)
    setSaveMsg(null)
  }, [caseId, defaultCollapsed])

  async function load(force = false) {
    if (!caseId || (!force && dirty)) return
    const qs = new URLSearchParams({ caseId })
    if (ticketId) qs.set("ticketId", ticketId)
    if (guestToken) qs.set("guestToken", guestToken)
    const res = await fetch(`/api/live/case?${qs.toString()}`)
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) return

    const nextPrimary: PrimaryApplicant = {
      ...(json.primary ?? {}),
      birth_date: toDateInput(json?.primary?.birth_date),
      net_income_monthly: toMoneyInput(json?.primary?.net_income_monthly),
      other_income_monthly: toMoneyInput(json?.primary?.other_income_monthly),
      expenses_monthly: toMoneyInput(json?.primary?.expenses_monthly),
      existing_loans_monthly: toMoneyInput(json?.primary?.existing_loans_monthly),
    }
    const nextCo: CoApplicant[] = Array.isArray(json?.co)
      ? json.co.map((c: any) => ({
          ...c,
          birth_date: toDateInput(c?.birth_date),
          net_income_monthly: toMoneyInput(c?.net_income_monthly),
        }))
      : []
    const nextBaufi: BaufiDetails = {
      ...(json.baufi ?? {}),
      purchase_price: toMoneyInput(json?.baufi?.purchase_price),
    }
    const nextAdditional: AdditionalDetails = {
      ...(json.additional ?? {}),
      equity_total: toMoneyInput(json?.additional?.equity_total),
      equity_used: toMoneyInput(json?.additional?.equity_used),
      property_plot_size: toInput(json?.additional?.property_plot_size),
      current_warm_rent: toMoneyInput(json?.additional?.current_warm_rent),
      probation_months: toInput(json?.additional?.probation_months),
      salary_payments_per_year: toInput(json?.additional?.salary_payments_per_year),
      household_persons: toInput(json?.additional?.household_persons),
      vehicle_count: toInput(json?.additional?.vehicle_count),
      vehicle_cost_total: toMoneyInput(json?.additional?.vehicle_cost_total),
      maintenance_income_monthly: toMoneyInput(json?.additional?.maintenance_income_monthly),
      current_warm_rent_none: !!json?.additional?.current_warm_rent_none,
      probation: !!json?.additional?.probation,
      has_children: !!json?.additional?.has_children,
      address_since: toDateInput(json?.additional?.address_since),
      id_issued_at: toDateInput(json?.additional?.id_issued_at),
      id_expires_at: toDateInput(json?.additional?.id_expires_at),
    }
    const nextChildren: ChildRow[] = Array.isArray(json?.children)
      ? json.children.map((c: any) => ({
          ...c,
          birth_date: toDateInput(c?.birth_date),
          maintenance_income_monthly: toMoneyInput(c?.maintenance_income_monthly),
        }))
      : []

    setPrimary(nextPrimary)
    setCo(nextCo)
    setBaufi(nextBaufi)
    setAdditional(nextAdditional)
    setChildren(nextChildren)
    setViewerRole(json?.viewer_role ?? null)
    setCustomerCanEdit(!!json?.customer_can_edit)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      await load()
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [caseId])

  useEffect(() => {
    if (!caseId) return
    const channel = supabase
      .channel(`live_case_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_applicants", filter: `case_id=eq.${caseId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_baufi_details", filter: `case_id=eq.${caseId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_additional_details", filter: `case_id=eq.${caseId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_children", filter: `case_id=eq.${caseId}` },
        () => load()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, caseId, guestToken, ticketId, dirty])

  useEffect(() => {
    if (!caseId) return
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(load, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [caseId, guestToken, ticketId, dirty])

  async function save() {
    if (!caseId) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch("/api/live/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, ticketId: ticketId ?? null, guestToken, primary, co, baufi, additional, children }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        const code = String(json?.error ?? "")
        const fallback = "Speichern fehlgeschlagen. Bitte pruefen und erneut versuchen."
        const reason =
          code === "customer_edit_locked"
            ? "Die Falldaten sind bereits gesperrt und koennen nicht mehr bearbeitet werden."
            : typeof json?.message === "string" && json.message.trim()
              ? json.message
              : fallback
        setSaveMsg({ type: "error", text: reason })
        return
      }
      setDirty(false)
      setSaveMsg({ type: "success", text: "Aenderungen gespeichert." })
      await load(true)
    } catch {
      setSaveMsg({ type: "error", text: "Netzwerkfehler beim Speichern. Bitte erneut versuchen." })
    } finally {
      setSaving(false)
    }
  }

  async function sendMissingDataReminder() {
    if (!caseId || missingRequired.length < 1 || reminderBusy) return
    setReminderBusy(true)
    setReminderMsg(null)
    try {
      const res = await fetch("/api/app/cases/remind-missing-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, missingCount: missingRequired.length }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        const code = String(json?.error ?? "")
        const reason =
          code === "mail_not_configured"
            ? "Mailversand ist derzeit nicht konfiguriert."
            : code === "customer_email_missing"
              ? "Beim Kunden ist keine E-Mail-Adresse hinterlegt."
              : "E-Mail konnte nicht gesendet werden."
        throw new Error(reason)
      }
      setReminderMsg({ type: "success", text: "Kunde wurde per E-Mail informiert." })
    } catch (e: any) {
      setReminderMsg({ type: "error", text: e?.message ?? "E-Mail konnte nicht gesendet werden." })
    } finally {
      setReminderBusy(false)
    }
  }

  function updatePrimary(key: keyof PrimaryApplicant, value: string) {
    setDirty(true)
    setPrimary((prev) => ({ ...prev, [key]: value }))
  }

  function updateBaufi(key: keyof BaufiDetails, value: string) {
    setDirty(true)
    setBaufi((prev) => ({ ...prev, [key]: value }))
  }

  function updateAdditional(key: keyof AdditionalDetails, value: any) {
    setDirty(true)
    setAdditional((prev) => ({ ...prev, [key]: value }))
  }

  function addCo() {
    setDirty(true)
    setCo((prev) => [
      ...prev,
      { first_name: "", last_name: "", birth_date: "", employment_status: "", net_income_monthly: "" },
    ])
  }

  function removeCo(idx: number) {
    setDirty(true)
    setCo((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateCo(idx: number, patch: Partial<CoApplicant>) {
    setDirty(true)
    setCo((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function addChild() {
    setDirty(true)
    setChildren((prev) => [...prev, { name: "", birth_date: "", maintenance_income_monthly: "" }])
  }

  function removeChild(idx: number) {
    setDirty(true)
    setChildren((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateChild(idx: number, patch: Partial<ChildRow>) {
    setDirty(true)
    setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  const calc = useMemo(() => {
    const net = parseMoneyToNumber(primary.net_income_monthly)
    const other = parseMoneyToNumber(primary.other_income_monthly)
    const exp = parseMoneyToNumber(primary.expenses_monthly)
    const loans = parseMoneyToNumber(primary.existing_loans_monthly)

    const coIncome = (co || []).reduce((sum, c) => sum + parseMoneyToNumber(c.net_income_monthly), 0)

    const totalIncome = net + other + coIncome
    const totalOut = exp + loans
    const surplus = totalIncome - totalOut
    const base = Math.max(1, totalIncome)
    const surplusRatio = surplus / base

    let score = 0
    if (surplus <= 0) {
      const deficit = Math.abs(surplus)
      const sev = Math.min(1, deficit / Math.max(1, totalIncome))
      score = Math.round(10 + (1 - sev) * 35)
    } else {
      const r = surplus / base
      score = Math.round(Math.min(100, 40 + r * 200))
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
        ? "Die Ausgaben liegen ueber den Einnahmen - pruefen Sie Fixkosten oder ergaenzen Sie Einnahmen."
        : surplusRatio < 0.15
          ? "Kleiner Puffer: Mehr Ueberschuss verbessert i. d. R. die Finanzierbarkeit."
          : "Solider Puffer: In der Regel ein positives Signal fuer Banken."

    return { totalIncome, totalOut, surplus, surplusRatio, score, label, tip, coIncome }
  }, [primary, co])

  const ratioPct = nfNumber.format(calc.surplusRatio * 100)
  const surplusStr = nfCurrency.format(calc.surplus)
  const isCustomerView = viewerRole === "customer" || viewerRole === "guest"
  const canEdit = !isCustomerView || customerCanEdit
  const fieldDisabled = !canEdit
  const requiredChecks = useMemo(() => {
    const checks: RequiredFieldCheck[] = [
      // Kontakt
      { id: "primary.first_name", tab: "contact", label: "Vorname", missing: !hasValue(primary.first_name) },
      { id: "primary.last_name", tab: "contact", label: "Nachname", missing: !hasValue(primary.last_name) },
      { id: "primary.email", tab: "contact", label: "E-Mail", missing: !hasValue(primary.email) },
      { id: "primary.phone", tab: "contact", label: "Telefon", missing: !hasValue(primary.phone) },
      { id: "primary.birth_date", tab: "contact", label: "Geburtsdatum", missing: !hasValue(primary.birth_date) },
      { id: "primary.nationality", tab: "contact", label: "Staatsangehoerigkeit", missing: !hasValue(primary.nationality) },
      { id: "primary.marital_status", tab: "contact", label: "Familienstand", missing: !hasValue(primary.marital_status) },
      { id: "primary.address_street", tab: "contact", label: "Strasse", missing: !hasValue(primary.address_street) },
      { id: "primary.address_zip", tab: "contact", label: "PLZ", missing: !hasValue(primary.address_zip) },
      { id: "primary.address_city", tab: "contact", label: "Ort", missing: !hasValue(primary.address_city) },
      { id: "primary.housing_status", tab: "contact", label: "Wohnstatus", missing: !hasValue(primary.housing_status) },
      { id: "primary.employment_type", tab: "contact", label: "Beschaeftigungsverhaeltnis", missing: !hasValue(primary.employment_type) },
      { id: "primary.employment_status", tab: "contact", label: "Anstellungsstatus", missing: !hasValue(primary.employment_status) },

      // Haushalt
      { id: "primary.net_income_monthly", tab: "household", label: "Nettoeinkommen", missing: !hasValue(primary.net_income_monthly) },
      { id: "primary.expenses_monthly", tab: "household", label: "Fixkosten", missing: !hasValue(primary.expenses_monthly) },
      { id: "primary.existing_loans_monthly", tab: "household", label: "Bestehende Kredite", missing: !hasValue(primary.existing_loans_monthly) },

      // Finanzierung
      { id: "baufi.purpose", tab: "finance", label: "Vorhaben", missing: !hasValue(baufi.purpose) },
      { id: "baufi.property_type", tab: "finance", label: "Immobilienart", missing: !hasValue(baufi.property_type) },
      { id: "baufi.purchase_price", tab: "finance", label: "Kaufpreis", missing: !hasValue(baufi.purchase_price) },
      { id: "additional.equity_total", tab: "finance", label: "Eigenkapital insgesamt", missing: !hasValue(additional.equity_total) },
      { id: "additional.equity_used", tab: "finance", label: "Eingesetztes Eigenkapital", missing: !hasValue(additional.equity_used) },
      { id: "additional.property_address_type", tab: "finance", label: "Adressart", missing: !hasValue(additional.property_address_type) },
      { id: "additional.property_street", tab: "finance", label: "Objektstrasse", missing: !hasValue(additional.property_street) },
      { id: "additional.property_no", tab: "finance", label: "Objektnummer", missing: !hasValue(additional.property_no) },
      { id: "additional.property_zip", tab: "finance", label: "Objekt-PLZ", missing: !hasValue(additional.property_zip) },
      { id: "additional.property_city", tab: "finance", label: "Objekt-Ort", missing: !hasValue(additional.property_city) },

      // Details
      { id: "additional.birth_place", tab: "details", label: "Geburtsort", missing: !hasValue(additional.birth_place) },
      { id: "additional.id_document_number", tab: "details", label: "Ausweisnummer", missing: !hasValue(additional.id_document_number) },
      { id: "additional.id_issued_place", tab: "details", label: "Ausstellungsort", missing: !hasValue(additional.id_issued_place) },
      { id: "additional.id_issued_at", tab: "details", label: "Ausgestellt am", missing: !hasValue(additional.id_issued_at) },
      { id: "additional.id_expires_at", tab: "details", label: "Ablauf am", missing: !hasValue(additional.id_expires_at) },
      { id: "additional.address_since", tab: "details", label: "Wohnhaft seit", missing: !hasValue(additional.address_since) },
      { id: "additional.salary_payments_per_year", tab: "details", label: "Anzahl Gehaelter", missing: !hasValue(additional.salary_payments_per_year) },
      { id: "additional.household_persons", tab: "details", label: "Haushaltsgroesse", missing: !hasValue(additional.household_persons) },
      { id: "additional.bank_account_holder", tab: "details", label: "Kontoinhaber", missing: !hasValue(additional.bank_account_holder) },
      { id: "additional.bank_iban", tab: "details", label: "IBAN", missing: !hasValue(additional.bank_iban) },
      { id: "additional.bank_bic", tab: "details", label: "BIC", missing: !hasValue(additional.bank_bic) },
    ]

    if (!additional.current_warm_rent_none) {
      checks.push({
        id: "additional.current_warm_rent",
        tab: "details",
        label: "Aktuelle Warmmiete",
        missing: !hasValue(additional.current_warm_rent),
      })
    }

    if (additional.probation) {
      checks.push({
        id: "additional.probation_months",
        tab: "details",
        label: "Probezeit (Monate)",
        missing: !hasValue(additional.probation_months),
      })
    }

    if (additional.has_children) {
      checks.push({
        id: "children.required",
        tab: "details",
        label: "Mindestens ein Kind",
        missing: children.length === 0,
      })
      children.forEach((child, index) => {
        const idx = index + 1
        checks.push(
          {
            id: `children.${index}.name`,
            tab: "details",
            label: `Kind ${idx}: Name`,
            missing: !hasValue(child.name),
          },
          {
            id: `children.${index}.birth_date`,
            tab: "details",
            label: `Kind ${idx}: Geburtsdatum`,
            missing: !hasValue(child.birth_date),
          }
        )
      })
    }

    return checks
  }, [primary, baufi, additional, children])
  const missingRequired = useMemo(() => requiredChecks.filter((check) => check.missing), [requiredChecks])
  const missingRequiredIds = useMemo(() => new Set(missingRequired.map((check) => check.id)), [missingRequired])
  const missingRequiredByTab = useMemo(
    () =>
      LIVE_CASE_TABS.map((tab) => ({
        ...tab,
        checks: missingRequired.filter((check) => check.tab === tab.id),
      })),
    [missingRequired]
  )
  const completedForFinalOffer = !loading && missingRequired.length === 0
  const canSendMissingDataReminder =
    showMissingDataReminderButton &&
    !loading &&
    missingRequired.length > 0 &&
    (viewerRole === "advisor" || viewerRole === "admin")
  const isFieldMissing = (id: string) => missingRequiredIds.has(id)
  const missingFieldStyle = (id: string) =>
    isFieldMissing(id) ? "border-amber-300 bg-amber-50/40 focus:border-amber-400 focus:ring-amber-100" : ""

  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="w-full rounded-xl px-2 py-1 text-left transition hover:bg-slate-100/70 sm:w-auto"
        >
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Falldaten</div>
            <svg
              className={cn("h-3 w-3 text-slate-400 transition", expanded && "rotate-180")}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{caseRef || caseId}</div>
        </button>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={contentId}
            className={cn(
              "w-full rounded-xl border px-3 py-2 text-center text-xs font-semibold transition sm:w-auto sm:text-left",
              expanded
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
            )}
          >
            {expanded ? "Falldaten einklappen" : "Falldaten anzeigen"}
          </button>
          {!loading ? (
            canEdit ? (
              <span
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-full border px-3 py-1 text-center text-[11px] font-semibold leading-tight sm:w-auto",
                  completedForFinalOffer
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {completedForFinalOffer ? "Geschafft 🎉 bereit fuer finales Angebot" : `${missingRequired.length} Pflichtfelder offen`}
              </span>
            ) : (
              <span className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-center text-[11px] font-semibold text-slate-600 sm:w-auto">
                Read-only
              </span>
            )
          ) : null}
          <button
            onClick={save}
            disabled={saving || !canEdit}
            className="col-span-2 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60 sm:col-auto sm:w-auto"
          >
            {saving ? "Speichern..." : "Aenderungen speichern"}
          </button>
        </div>
      </div>
      {saveMsg ? (
        <div
          className={cn(
            "mt-3 rounded-2xl border px-4 py-3 text-xs",
            saveMsg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {saveMsg.text}
        </div>
      ) : null}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="mt-3 w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left transition hover:bg-sky-100"
        >
          <div className="text-sm font-semibold text-sky-900">Hier klicken, um alle Falldaten zu sehen</div>
          <div className="mt-1 text-xs text-sky-800">Kontakt, Haushalt, Finanzierung und Details oeffnen</div>
        </button>
      ) : null}

      {expanded && (
        loading ? (
          <div id={contentId} className="mt-4 text-sm text-slate-500">
            Lade Falldaten...
          </div>
        ) : (
          <fieldset id={contentId} disabled={fieldDisabled} className="mt-4 space-y-4">
            {!canEdit ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Die Falldaten sind gesperrt, weil bereits ein finales Angebot erstellt wurde. Der Kunde kann nur
                akzeptieren oder ablehnen.
              </div>
            ) : null}
            {canEdit ? (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs text-slate-700">
                Hinweis: Fuer Aenderungen im Anschluss bitte immer auf{" "}
                <span className="font-semibold text-slate-900">Aenderungen speichern</span> klicken.
              </div>
            ) : null}
            {canEdit && !loading ? (
              completedForFinalOffer ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                  Geschafft 🎉 Alle noetigen Felder fuer ein finales Angebot sind vollstaendig ausgefuellt.
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                  <div className="text-sm font-semibold text-amber-900">
                    Fuer ein finales Angebot werden noch Daten benoetigt.
                  </div>
                  <div className="mt-1 text-xs text-amber-800">
                    Offene Pflichtfelder: {missingRequired.slice(0, 6).map((check) => check.label).join(", ")}
                    {missingRequired.length > 6 ? " ..." : ""}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {missingRequiredByTab
                      .filter((tab) => tab.checks.length > 0)
                      .map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50"
                        >
                          {tab.label} ({tab.checks.length})
                        </button>
                      ))}
                  </div>
                  {canSendMissingDataReminder ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={sendMissingDataReminder}
                        disabled={reminderBusy}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reminderBusy ? "Sende E-Mail..." : `Kunden erinnern (${missingRequired.length} offen)`}
                      </button>
                      {reminderMsg ? (
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            reminderMsg.type === "success" ? "text-emerald-700" : "text-red-700"
                          )}
                        >
                          {reminderMsg.text}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2">
              <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                {LIVE_CASE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      activeTab === tab.id
                        ? "border-slate-300 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {activeTab === "contact" ? (
              <>
            <Card title="Kontakt" subtitle="Hauptantragsteller">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vorname" required invalid={isFieldMissing("primary.first_name")}>
                  <Input
                    value={toInput(primary.first_name)}
                    onChange={(e) => updatePrimary("first_name", e.target.value)}
                    className={missingFieldStyle("primary.first_name")}
                  />
                </Field>
                <Field label="Nachname" required invalid={isFieldMissing("primary.last_name")}>
                  <Input
                    value={toInput(primary.last_name)}
                    onChange={(e) => updatePrimary("last_name", e.target.value)}
                    className={missingFieldStyle("primary.last_name")}
                  />
                </Field>
                <Field label="E-Mail" required invalid={isFieldMissing("primary.email")}>
                  <Input
                    value={toInput(primary.email)}
                    onChange={(e) => updatePrimary("email", e.target.value)}
                    className={missingFieldStyle("primary.email")}
                  />
                </Field>
                <Field label="Telefon" required invalid={isFieldMissing("primary.phone")}>
                  <Input
                    value={toInput(primary.phone)}
                    onChange={(e) => updatePrimary("phone", e.target.value)}
                    className={missingFieldStyle("primary.phone")}
                  />
                </Field>
                <Field label="Geburtsdatum" required invalid={isFieldMissing("primary.birth_date")}>
                  <Input
                    type="date"
                    value={toDateInput(primary.birth_date)}
                    onChange={(e) => updatePrimary("birth_date", e.target.value)}
                    className={missingFieldStyle("primary.birth_date")}
                  />
                </Field>
                <Field label="Staatsangehoerigkeit" required invalid={isFieldMissing("primary.nationality")}>
                  <Select
                    value={toInput(primary.nationality)}
                    onChange={(v) => updatePrimary("nationality", v)}
                    className={missingFieldStyle("primary.nationality")}
                  >
                    <option value="">Bitte waehlen</option>
                    {countryOptions.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Familienstand" required invalid={isFieldMissing("primary.marital_status")}>
                  <Select
                    value={toInput(primary.marital_status)}
                    onChange={(v) => updatePrimary("marital_status", v)}
                    className={missingFieldStyle("primary.marital_status")}
                  >
                    <option value="">Bitte waehlen</option>
                    <option value="single">Ledig</option>
                    <option value="married">Verheiratet</option>
                    <option value="registered">Eingetragene Partnerschaft</option>
                    <option value="divorced">Geschieden</option>
                    <option value="widowed">Verwitwet</option>
                  </Select>
                </Field>
              </div>
            </Card>

          <Card title="Adresse & Wohnsituation">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Strasse" required invalid={isFieldMissing("primary.address_street")}>
                <Input
                  value={toInput(primary.address_street)}
                  onChange={(e) => updatePrimary("address_street", e.target.value)}
                  className={missingFieldStyle("primary.address_street")}
                />
              </Field>
              <Field label="PLZ" required invalid={isFieldMissing("primary.address_zip")}>
                <Input
                  value={toInput(primary.address_zip)}
                  onChange={(e) => updatePrimary("address_zip", e.target.value)}
                  className={missingFieldStyle("primary.address_zip")}
                />
              </Field>
              <Field label="Ort" required invalid={isFieldMissing("primary.address_city")}>
                <Input
                  value={toInput(primary.address_city)}
                  onChange={(e) => updatePrimary("address_city", e.target.value)}
                  className={missingFieldStyle("primary.address_city")}
                />
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Wohnstatus" required invalid={isFieldMissing("primary.housing_status")}>
                <Select
                  value={toInput(primary.housing_status)}
                  onChange={(v) => updatePrimary("housing_status", v)}
                  className={missingFieldStyle("primary.housing_status")}
                >
                  <option value="">Bitte waehlen</option>
                  {HOUSING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Berufliche Angaben" subtitle="Fuer Bank- und Angebotspruefung">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Field label="Beschaeftigungsverhaeltnis" required invalid={isFieldMissing("primary.employment_type")}>
                <Select
                  value={toInput(primary.employment_type)}
                  onChange={(v) => updatePrimary("employment_type", v)}
                  className={missingFieldStyle("primary.employment_type")}
                >
                  <option value="">Bitte waehlen</option>
                  {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status (Anstellungsverhaeltnis)" required invalid={isFieldMissing("primary.employment_status")}>
                <Select
                  value={toInput(primary.employment_status)}
                  onChange={(v) => updatePrimary("employment_status", v)}
                  className={missingFieldStyle("primary.employment_status")}
                >
                  <option value="">Bitte waehlen</option>
                  {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Arbeitgeber (optional)" hint="optional">
                <Input value={toInput(primary.employer_name)} onChange={(e) => updatePrimary("employer_name", e.target.value)} />
              </Field>
            </div>
          </Card>
              </>
            ) : null}

            {activeTab === "household" ? (
              <>
          <Card title="Haushaltsrechnung (Monat)" subtitle="Einnahmen und Ausgaben in EUR">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nettoeinkommen / Monat" required invalid={isFieldMissing("primary.net_income_monthly")}>
                <MoneyInput
                  value={toMoneyInput(primary.net_income_monthly)}
                  onChange={(v) => updatePrimary("net_income_monthly", v)}
                  placeholder="z. B. 3.200"
                  className={missingFieldStyle("primary.net_income_monthly")}
                />
              </Field>
              <Field label="Weitere Einnahmen / Monat" hint="z. B. Kindergeld">
                <MoneyInput
                  value={toMoneyInput(primary.other_income_monthly)}
                  onChange={(v) => updatePrimary("other_income_monthly", v)}
                  placeholder="z. B. 300"
                />
              </Field>
              <Field label="Fixkosten / Monat" required invalid={isFieldMissing("primary.expenses_monthly")}>
                <MoneyInput
                  value={toMoneyInput(primary.expenses_monthly)}
                  onChange={(v) => updatePrimary("expenses_monthly", v)}
                  placeholder="z. B. 1.200"
                  className={missingFieldStyle("primary.expenses_monthly")}
                />
              </Field>
              <Field label="Bestehende Kredite / Monat" required invalid={isFieldMissing("primary.existing_loans_monthly")}>
                <MoneyInput
                  value={toMoneyInput(primary.existing_loans_monthly)}
                  onChange={(v) => updatePrimary("existing_loans_monthly", v)}
                  placeholder="z. B. 150"
                  className={missingFieldStyle("primary.existing_loans_monthly")}
                />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <HouseholdScoreBar score={calc.score} label={calc.label} />

              <Card title="Ergebnis (live)" subtitle="Weitere Kreditnehmer werden addiert.">
                <div className="space-y-2 text-sm">
                  <Row label="Einnahmen gesamt" value={formatMoneyFromNumber(calc.totalIncome)} />
                  {co.length > 0 ? (
                    <Row label={`davon weitere Kreditnehmer (${co.length})`} value={formatMoneyFromNumber(calc.coIncome)} />
                  ) : null}
                  <Row label="Ausgaben gesamt" value={formatMoneyFromNumber(calc.totalOut)} />

                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900 tabular-nums">Ueberschuss/Defizit: {surplusStr}</div>
                      <div className="text-xs text-slate-600 tabular-nums">{ratioPct}% Puffer</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{calc.tip}</div>
                  </div>
                </div>
              </Card>
            </div>
          </Card>

          <Card title="Weitere Kreditnehmer" subtitle="Optional - Einkommen wird beruecksichtigt.">
            <div className="space-y-3">
              {co.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
                  Noch keine weiteren Kreditnehmer hinzugefuegt.
                </div>
              ) : null}

              {co.map((c, i) => (
                <div key={c.id ?? i} className="rounded-3xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">Kreditnehmer {i + 2}</div>
                      <div className="text-xs text-slate-500">Optional, aber hilfreich fuer die Haushaltsrechnung.</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCo(i)}
                      className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white active:scale-[0.99]"
                    >
                      Entfernen
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Vorname">
                      <Input value={toInput(c.first_name)} onChange={(e) => updateCo(i, { first_name: e.target.value })} />
                    </Field>
                    <Field label="Nachname">
                      <Input value={toInput(c.last_name)} onChange={(e) => updateCo(i, { last_name: e.target.value })} />
                    </Field>
                    <Field label="Geburtsdatum">
                      <Input type="date" value={toDateInput(c.birth_date)} onChange={(e) => updateCo(i, { birth_date: e.target.value })} />
                    </Field>
                    <Field label="Beschaeftigungsstatus">
                      <Select value={toInput(c.employment_status)} onChange={(v) => updateCo(i, { employment_status: v })}>
                        <option value="">Bitte waehlen</option>
                        {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Nettoeinkommen / Monat" hint="optional">
                        <MoneyInput
                          value={toMoneyInput(c.net_income_monthly)}
                          onChange={(v) => updateCo(i, { net_income_monthly: v })}
                          placeholder="z. B. 2.800"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addCo}
                className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white hover:shadow-md active:scale-[0.99] sm:w-auto"
              >
                + Kreditnehmer hinzufuegen
              </button>
            </div>
          </Card>
              </>
            ) : null}

            {activeTab === "finance" ? (
              <>
          <Card title="Eckdaten zur Finanzierung">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Vorhaben" required invalid={isFieldMissing("baufi.purpose")}>
                <Select
                  value={toInput(baufi.purpose)}
                  onChange={(v) => updateBaufi("purpose", v)}
                  className={missingFieldStyle("baufi.purpose")}
                >
                  <option value="">Bitte waehlen</option>
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Immobilienart" required invalid={isFieldMissing("baufi.property_type")}>
                <Select
                  value={toInput(baufi.property_type)}
                  onChange={(v) => updateBaufi("property_type", v)}
                  className={missingFieldStyle("baufi.property_type")}
                >
                  <option value="">Bitte waehlen</option>
                  {PROPERTY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Kaufpreis" required invalid={isFieldMissing("baufi.purchase_price")}>
                <MoneyInput
                  value={toMoneyInput(baufi.purchase_price)}
                  onChange={(v) => updateBaufi("purchase_price", v)}
                  placeholder="z. B. 300.000"
                  className={missingFieldStyle("baufi.purchase_price")}
                />
              </Field>
            </div>
          </Card>

          <Card title="Eigenkapital" subtitle="Fuer den digitalen Abschluss erforderlich">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Eigenkapital insgesamt" required invalid={isFieldMissing("additional.equity_total")}>
                <MoneyInput
                  value={toMoneyInput(additional.equity_total)}
                  onChange={(v) => updateAdditional("equity_total", v)}
                  placeholder="z. B. 50.000"
                  className={missingFieldStyle("additional.equity_total")}
                />
              </Field>
              <Field label="Eingesetztes Eigenkapital" required invalid={isFieldMissing("additional.equity_used")}>
                <MoneyInput
                  value={toMoneyInput(additional.equity_used)}
                  onChange={(v) => updateAdditional("equity_used", v)}
                  placeholder="z. B. 25.000"
                  className={missingFieldStyle("additional.equity_used")}
                />
              </Field>
            </div>
          </Card>

          <Card title="Objektadresse">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Adressart" required invalid={isFieldMissing("additional.property_address_type")}>
                <Select
                  value={toInput(additional.property_address_type)}
                  onChange={(v) => updateAdditional("property_address_type", v)}
                  className={missingFieldStyle("additional.property_address_type")}
                >
                  <option value="">Bitte waehlen</option>
                  {PROPERTY_ADDRESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Strasse" required invalid={isFieldMissing("additional.property_street")}>
                <Input
                  value={toInput(additional.property_street)}
                  onChange={(e) => updateAdditional("property_street", e.target.value)}
                  className={missingFieldStyle("additional.property_street")}
                />
              </Field>
              <Field label="Nr." required invalid={isFieldMissing("additional.property_no")}>
                <Input
                  value={toInput(additional.property_no)}
                  onChange={(e) => updateAdditional("property_no", e.target.value)}
                  className={missingFieldStyle("additional.property_no")}
                />
              </Field>
              <Field label="PLZ" required invalid={isFieldMissing("additional.property_zip")}>
                <Input
                  value={toInput(additional.property_zip)}
                  onChange={(e) => updateAdditional("property_zip", e.target.value)}
                  className={missingFieldStyle("additional.property_zip")}
                />
              </Field>
              <Field label="Ort" required invalid={isFieldMissing("additional.property_city")}>
                <Input
                  value={toInput(additional.property_city)}
                  onChange={(e) => updateAdditional("property_city", e.target.value)}
                  className={missingFieldStyle("additional.property_city")}
                />
              </Field>
              <Field label="Grundstuecksgroesse (m²)" hint="optional">
                <Input
                  value={toInput(additional.property_plot_size)}
                  onChange={(e) => updateAdditional("property_plot_size", e.target.value)}
                />
              </Field>
            </div>
          </Card>
              </>
            ) : null}

            {activeTab === "details" ? (
              <>
          <Card title="Legitimation" subtitle="Diese Angaben sind fuer den Abschluss erforderlich.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Geburtsort" required invalid={isFieldMissing("additional.birth_place")}>
                <Input
                  value={toInput(additional.birth_place)}
                  onChange={(e) => updateAdditional("birth_place", e.target.value)}
                  className={missingFieldStyle("additional.birth_place")}
                />
              </Field>
              <Field label="Ausweisnummer" required invalid={isFieldMissing("additional.id_document_number")}>
                <Input
                  value={toInput(additional.id_document_number)}
                  onChange={(e) => updateAdditional("id_document_number", e.target.value)}
                  className={missingFieldStyle("additional.id_document_number")}
                />
              </Field>
              <Field label="Ausstellungsort" required invalid={isFieldMissing("additional.id_issued_place")}>
                <Input
                  value={toInput(additional.id_issued_place)}
                  onChange={(e) => updateAdditional("id_issued_place", e.target.value)}
                  className={missingFieldStyle("additional.id_issued_place")}
                />
              </Field>
              <Field label="Ausgestellt am" required invalid={isFieldMissing("additional.id_issued_at")}>
                <Input
                  type="date"
                  value={toDateInput(additional.id_issued_at)}
                  onChange={(e) => updateAdditional("id_issued_at", e.target.value)}
                  className={missingFieldStyle("additional.id_issued_at")}
                />
              </Field>
              <Field label="Ablauf am" required invalid={isFieldMissing("additional.id_expires_at")}>
                <Input
                  type="date"
                  value={toDateInput(additional.id_expires_at)}
                  onChange={(e) => updateAdditional("id_expires_at", e.target.value)}
                  className={missingFieldStyle("additional.id_expires_at")}
                />
              </Field>
              <Field label="Wohnhaft seit" required invalid={isFieldMissing("additional.address_since")}>
                <Input
                  type="date"
                  value={toDateInput(additional.address_since)}
                  onChange={(e) => updateAdditional("address_since", e.target.value)}
                  className={missingFieldStyle("additional.address_since")}
                />
              </Field>
            </div>
          </Card>

          <Card title="Bankverbindung" subtitle="Wird fuer die weitere Abwicklung benoetigt.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Kontoinhaber" required invalid={isFieldMissing("additional.bank_account_holder")}>
                <Input
                  value={toInput(additional.bank_account_holder)}
                  onChange={(e) => updateAdditional("bank_account_holder", e.target.value)}
                  autoComplete="off"
                  className={missingFieldStyle("additional.bank_account_holder")}
                />
              </Field>
              <Field label="IBAN" required invalid={isFieldMissing("additional.bank_iban")}>
                <Input
                  value={toInput(additional.bank_iban)}
                  onChange={(e) => updateAdditional("bank_iban", e.target.value)}
                  autoComplete="off"
                  className={missingFieldStyle("additional.bank_iban")}
                />
              </Field>
              <Field label="BIC" required invalid={isFieldMissing("additional.bank_bic")}>
                <Input
                  value={toInput(additional.bank_bic)}
                  onChange={(e) => updateAdditional("bank_bic", e.target.value)}
                  autoComplete="off"
                  className={missingFieldStyle("additional.bank_bic")}
                />
              </Field>
            </div>
          </Card>

          <Card title="Wohnkosten & Haushalt">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <Field
                  label="Aktuelle Warmmiete"
                  required={!additional.current_warm_rent_none}
                  invalid={isFieldMissing("additional.current_warm_rent")}
                >
                  <MoneyInput
                    value={toMoneyInput(additional.current_warm_rent)}
                    onChange={(v) => updateAdditional("current_warm_rent", v)}
                    placeholder="z. B. 1.050"
                    disabled={!!additional.current_warm_rent_none}
                    className={missingFieldStyle("additional.current_warm_rent")}
                  />
                </Field>
              </div>
              <div className="xl:col-span-2">
                <CheckboxField
                  label="Warmmiete"
                  optionLabel="Entfaellt (keine Warmmiete)"
                  checked={!!additional.current_warm_rent_none}
                  onChange={(checked) => updateAdditional("current_warm_rent_none", checked)}
                  hint="optional"
                />
              </div>
              <div className="xl:col-span-2">
                <Field label="Haushaltsgroesse (Personen)" required invalid={isFieldMissing("additional.household_persons")}>
                  <Input
                    value={toInput(additional.household_persons)}
                    onChange={(e) => updateAdditional("household_persons", e.target.value)}
                    className={missingFieldStyle("additional.household_persons")}
                  />
                </Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="Anzahl KFZ" hint="optional">
                  <Input value={toInput(additional.vehicle_count)} onChange={(e) => updateAdditional("vehicle_count", e.target.value)} />
                </Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="KFZ Kosten gesamt / Monat" hint="optional">
                  <MoneyInput
                    value={toMoneyInput(additional.vehicle_cost_total)}
                    onChange={(v) => updateAdditional("vehicle_cost_total", v)}
                    placeholder="z. B. 250"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Arbeitsdetails">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <CheckboxField
                  label="Anstellungsverhaeltnis"
                  optionLabel="Probezeit aktiv"
                  checked={!!additional.probation}
                  onChange={(checked) => updateAdditional("probation", checked)}
                />
              </div>
              <div className="xl:col-span-2">
                <Field label="Probezeit (Monate)" required={!!additional.probation} invalid={isFieldMissing("additional.probation_months")}>
                  <Input
                    value={toInput(additional.probation_months)}
                    onChange={(e) => updateAdditional("probation_months", e.target.value)}
                    disabled={!additional.probation}
                    className={missingFieldStyle("additional.probation_months")}
                  />
                </Field>
              </div>
              <div className="xl:col-span-2">
                <Field label="Anzahl Gehaelter / Jahr" required invalid={isFieldMissing("additional.salary_payments_per_year")}>
                  <Select
                    value={toInput(additional.salary_payments_per_year)}
                    onChange={(v) => updateAdditional("salary_payments_per_year", v)}
                    className={missingFieldStyle("additional.salary_payments_per_year")}
                  >
                    <option value="">Bitte waehlen</option>
                    {SALARY_PAYMENTS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Kinder & Unterhalt">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-3">
                <CheckboxField
                  label="Familiensituation"
                  optionLabel="Kinder vorhanden"
                  checked={!!additional.has_children}
                  onChange={(checked) => updateAdditional("has_children", checked)}
                  invalid={!!additional.has_children && isFieldMissing("children.required")}
                />
              </div>
              <div className="xl:col-span-3">
                <Field label="Unterhaltseinnahmen / Monat" hint="optional">
                  <MoneyInput
                    value={toMoneyInput(additional.maintenance_income_monthly)}
                    onChange={(v) => updateAdditional("maintenance_income_monthly", v)}
                    placeholder="z. B. 250"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {children.length === 0 ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    additional.has_children
                      ? "border-amber-200 bg-amber-50/70 text-amber-800"
                      : "border-slate-200 bg-white/60 text-slate-600"
                  )}
                >
                  {additional.has_children
                    ? "Bitte mindestens ein Kind erfassen."
                    : "Noch keine Kinder eingetragen."}
                </div>
              ) : null}

              {children.map((c, i) => (
                <div key={c.id ?? i} className="rounded-3xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">Kind {i + 1}</div>
                      <div className="text-xs text-slate-500">Name und Geburtsdatum</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChild(i)}
                      className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white active:scale-[0.99]"
                    >
                      Entfernen
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Name" required={!!additional.has_children} invalid={isFieldMissing(`children.${i}.name`)}>
                      <Input
                        value={toInput(c.name)}
                        onChange={(e) => updateChild(i, { name: e.target.value })}
                        className={missingFieldStyle(`children.${i}.name`)}
                      />
                    </Field>
                    <Field
                      label="Geburtsdatum"
                      required={!!additional.has_children}
                      invalid={isFieldMissing(`children.${i}.birth_date`)}
                    >
                      <Input
                        type="date"
                        value={toDateInput(c.birth_date)}
                        onChange={(e) => updateChild(i, { birth_date: e.target.value })}
                        className={missingFieldStyle(`children.${i}.birth_date`)}
                      />
                    </Field>
                    <Field label="Unterhalt / Monat" hint="optional">
                      <MoneyInput
                        value={toMoneyInput(c.maintenance_income_monthly)}
                        onChange={(v) => updateChild(i, { maintenance_income_monthly: v })}
                        placeholder="z. B. 200"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addChild}
                className="w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-inset ring-white/40 transition hover:bg-white hover:shadow-md active:scale-[0.99] sm:w-auto"
              >
                + Kind hinzufuegen
              </button>
            </div>
          </Card>
              </>
            ) : null}
        </fieldset>
      ))}
    </div>
  )
}
