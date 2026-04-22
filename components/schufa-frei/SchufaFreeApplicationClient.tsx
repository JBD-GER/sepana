"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react"
import { looksLikeIban, normalizeIbanInput } from "@/lib/banking/iban"
import { GOOGLE_ADS_SCHUFA_FREI_LEAD_SEND_TO, trackGoogleAdsConversion } from "@/lib/ads/googleAds"
import {
  SCHUFA_FREE_FAMILY_OPTIONS,
  SCHUFA_FREE_PROFESSION_OPTIONS,
  SCHUFA_FREE_RESIDENCE_OPTIONS,
  requiresSchufaFreeEmployerData,
} from "@/lib/schufa-frei/application"
import SchufaFreeDocumentUploadPanel from "@/components/schufa-frei/SchufaFreeDocumentUploadPanel"

type RequestRow = { id: string; title: string; required?: boolean | null }
type DocumentRow = { id: string; file_name: string; created_at: string; request_id?: string | null }
type SkagDocumentRow = { local_document_id?: string | null; upload_status?: string | null; last_error?: string | null }
type InitialForm = Record<string, string | number | boolean | null | undefined>
type StepId = "person" | "residence" | "employment" | "bank"
type FeedbackState = { tone: "error" | "success"; text: string; title?: string }

type FormState = {
  gender: string
  firstName: string
  lastName: string
  birthName: string
  dateOfBirth: string
  placeOfBirth: string
  nationality: string
  familySituation: string
  childrenTaxAllowance: string
  numberOfChildren: string
  childrenAgesCsv: string
  street: string
  houseNumber: string
  zipcode: string
  city: string
  phonePrimary: string
  phoneSecondary: string
  email: string
  residenceType: string
  rentMonthly: string
  residentSince: string
  taxClass: string
  profession: string
  professionBeginDate: string
  employerName: string
  employerStreet: string
  employerHouse: string
  employerZipcode: string
  employerCity: string
  employerPhone: string
  employerEmail: string
  netIncomeMonthly: string
  additionalIncomeMonthly: string
  additionalIncomeBeginDate: string
  employmentRelationshipLimited: boolean
  wageGarnishmentAssignment: boolean
  bankName: string
  iban: string
  spouseFirstName: string
  spouseBirthDate: string
  spouseBirthName: string
  spouseIncomeMonthly: string
  ratenschutzOptIn: boolean
}

const STEP_META: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: "person", title: "Person", subtitle: "Kontaktdaten und Familie" },
  { id: "residence", title: "Wohnen", subtitle: "Adresse und Wohnsituation" },
  { id: "employment", title: "Einkommen", subtitle: "Beruf und Arbeitgeber" },
  { id: "bank", title: "Auszahlung", subtitle: "Bankdaten und Versand" },
]

const SCHUFA_FREE_CONVERSION_PENDING_PREFIX = "sepana:ads-conversion:schufa-frei-final-submit:pending"
const SCHUFA_FREE_CONVERSION_DONE_PREFIX = "sepana:ads-conversion:schufa-frei-final-submit:done"

const CHILD_TAX_ALLOWANCE_OPTIONS = Array.from({ length: 21 }, (_, index) => index * 0.5)
const INPUT_BASE_CLASS =
  "block h-14 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-cyan-100 sm:h-12 sm:text-sm"
const INPUT_CLASS = `mt-1 ${INPUT_BASE_CLASS}`
const DATE_INPUT_CLASS = `${INPUT_BASE_CLASS} date-field appearance-none pr-11 [color-scheme:light]`
const CHECKBOX_CLASS = "mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-slate-900"
const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-14 w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f172a,#0f766e)] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)] transition disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm"
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-14 w-full items-center justify-center rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 shadow-sm transition disabled:opacity-50 sm:min-h-12 sm:w-auto sm:text-sm"

function fieldValue(initialForm: InitialForm, key: string, fallback = "") {
  const value = initialForm[key]
  if (value === null || value === undefined) return fallback
  return String(value)
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function moneyValue(value: unknown) {
  return digitsOnly(value)
}

function decimalValue(value: unknown) {
  return String(value ?? "").replace(/[^0-9,.\s]/g, "").trim()
}

function numberValue(value: unknown) {
  const raw = decimalValue(value)
  if (!raw) return null
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeTaxAllowanceValue(value: unknown) {
  const numeric = numberValue(value)
  if (numeric === null) return ""
  return String(numeric)
}

function formatMoney(value: string) {
  const digits = digitsOnly(value)
  if (!digits) return ""
  return `${new Intl.NumberFormat("de-DE").format(Number(digits))} EUR`
}

function formatIban(value: string) {
  const iban = normalizeIbanInput(value)
  if (!iban) return ""
  return iban.match(/.{1,4}/g)?.join(" ") ?? iban
}

function formatDateLabel(value: string) {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return value
  }
}

function parseChildAges(value: string, count: number) {
  return String(value ?? "")
    .split(/[;,]+/g)
    .map((entry) => digitsOnly(entry))
    .filter(Boolean)
    .slice(0, Math.max(0, count))
}

function joinChildAges(values: string[]) {
  return values.map((entry) => digitsOnly(entry)).filter(Boolean).join(",")
}

function buildInitialForm(initialForm: InitialForm): FormState {
  return {
    gender: fieldValue(initialForm, "gender", "1"),
    firstName: fieldValue(initialForm, "firstName"),
    lastName: fieldValue(initialForm, "lastName"),
    birthName: fieldValue(initialForm, "birthName"),
    dateOfBirth: fieldValue(initialForm, "dateOfBirth"),
    placeOfBirth: fieldValue(initialForm, "placeOfBirth"),
    nationality: fieldValue(initialForm, "nationality", "DE").toUpperCase(),
    familySituation: fieldValue(initialForm, "familySituation", "1"),
    childrenTaxAllowance: normalizeTaxAllowanceValue(initialForm.childrenTaxAllowance),
    numberOfChildren: fieldValue(initialForm, "numberOfChildren", "0"),
    childrenAgesCsv: fieldValue(initialForm, "childrenAgesCsv"),
    street: fieldValue(initialForm, "street"),
    houseNumber: fieldValue(initialForm, "houseNumber"),
    zipcode: digitsOnly(fieldValue(initialForm, "zipcode")),
    city: fieldValue(initialForm, "city"),
    phonePrimary: fieldValue(initialForm, "phonePrimary"),
    phoneSecondary: fieldValue(initialForm, "phoneSecondary"),
    email: fieldValue(initialForm, "email"),
    residenceType: fieldValue(initialForm, "residenceType", "1"),
    rentMonthly: moneyValue(fieldValue(initialForm, "rentMonthly")),
    residentSince: fieldValue(initialForm, "residentSince"),
    taxClass: fieldValue(initialForm, "taxClass", "1"),
    profession: fieldValue(initialForm, "profession"),
    professionBeginDate: fieldValue(initialForm, "professionBeginDate"),
    employerName: fieldValue(initialForm, "employerName"),
    employerStreet: fieldValue(initialForm, "employerStreet"),
    employerHouse: fieldValue(initialForm, "employerHouse"),
    employerZipcode: digitsOnly(fieldValue(initialForm, "employerZipcode")),
    employerCity: fieldValue(initialForm, "employerCity"),
    employerPhone: fieldValue(initialForm, "employerPhone"),
    employerEmail: fieldValue(initialForm, "employerEmail"),
    netIncomeMonthly: moneyValue(fieldValue(initialForm, "netIncomeMonthly")),
    additionalIncomeMonthly: moneyValue(fieldValue(initialForm, "additionalIncomeMonthly")),
    additionalIncomeBeginDate: fieldValue(initialForm, "additionalIncomeBeginDate"),
    employmentRelationshipLimited: Boolean(initialForm.employmentRelationshipLimited),
    wageGarnishmentAssignment: Boolean(initialForm.wageGarnishmentAssignment),
    bankName: fieldValue(initialForm, "bankName"),
    iban: normalizeIbanInput(fieldValue(initialForm, "iban")),
    spouseFirstName: fieldValue(initialForm, "spouseFirstName"),
    spouseBirthDate: fieldValue(initialForm, "spouseBirthDate"),
    spouseBirthName: fieldValue(initialForm, "spouseBirthName"),
    spouseIncomeMonthly: moneyValue(fieldValue(initialForm, "spouseIncomeMonthly")),
    ratenschutzOptIn: Boolean(initialForm.ratenschutzOptIn),
  }
}

function validate(form: FormState, allowTaxClassSix: boolean) {
  const person: string[] = []
  const residence: string[] = []
  const employment: string[] = []
  const bank: string[] = []
  const childrenCount = Number(form.numberOfChildren || 0)
  const childrenTaxAllowance = numberValue(form.childrenTaxAllowance)
  const childAges = parseChildAges(form.childrenAgesCsv, childrenCount)
  const employerRequired = requiresSchufaFreeEmployerData(form.profession)
  const spouseRequired = form.familySituation === "2"

  if (!form.gender) person.push("Anrede")
  if (!form.firstName.trim()) person.push("Vorname")
  if (!form.lastName.trim()) person.push("Nachname")
  if (!form.dateOfBirth) person.push("Geburtsdatum")
  if (!form.placeOfBirth.trim()) person.push("Geburtsort")
  if (!/^[A-Z]{2}$/.test(form.nationality.trim())) person.push("Staatsangehörigkeit")
  if (!form.phonePrimary.trim()) person.push("Telefon")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase())) person.push("E-Mail")
  if (!form.familySituation) person.push("Familienstand")
  if (form.numberOfChildren === "" || childrenCount > 10) person.push("Unterhaltspflichtige Kinder")
  if (childrenCount > 0 && childrenTaxAllowance === null) person.push("Kinderfreibetrag")
  if (childrenTaxAllowance !== null && (childrenTaxAllowance < 0 || childrenTaxAllowance > 10)) person.push("Kinderfreibetrag")
  if (childrenCount > 0 && childAges.length < childrenCount) person.push("Kinderalter")
  if (spouseRequired && !form.spouseFirstName.trim()) person.push("Vorname Ehepartner")
  if (spouseRequired && !form.spouseBirthDate) person.push("Geburtsdatum Ehepartner")
  if (spouseRequired && !form.spouseBirthName.trim()) person.push("Geburtsname Ehepartner")
  if (spouseRequired && !form.spouseIncomeMonthly) person.push("Einkommen Ehepartner")

  if (!form.street.trim()) residence.push("Straße")
  if (!form.houseNumber.trim()) residence.push("Hausnummer")
  if (!/^\d{5}$/.test(form.zipcode)) residence.push("PLZ")
  if (!form.city.trim()) residence.push("Ort")
  if (!form.residenceType) residence.push("Wohnsituation")
  if (!form.rentMonthly) residence.push("Warmmiete / Belastung")

  if (!new RegExp(`^[1-${allowTaxClassSix ? 6 : 5}]$`).test(form.taxClass)) employment.push("Steuerklasse")
  if (!/^[1-8]$/.test(form.profession)) employment.push("Beschäftigungsverhältnis")
  if (!form.professionBeginDate) employment.push("Im Beruf seit")
  if (!form.netIncomeMonthly) employment.push("Nettoeinkommen")
  if (employerRequired && !form.employerName.trim()) employment.push("Arbeitgeber")
  if (employerRequired && !/^\d{5}$/.test(form.employerZipcode)) employment.push("Arbeitgeber PLZ")
  if (employerRequired && !form.employerCity.trim()) employment.push("Arbeitgeber Ort")

  if (!form.bankName.trim()) bank.push("Name der Bank")
  if (!looksLikeIban(form.iban)) bank.push("IBAN")

  return { person, residence, employment, bank }
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block min-w-0 text-sm text-slate-700 ${className}`}><span className="block leading-6">{label}</span>{children}</label>
}

function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", lang, value, ...rest } = props
  const hasValue = String(value ?? "").trim().length > 0

  return (
    <div className="relative mt-1">
      {!hasValue ? (
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-slate-400 sm:text-sm">
          TT.MM.JJJJ
        </span>
      ) : null}
      <input
        {...rest}
        type="date"
        value={value}
        lang={lang ?? "de-DE"}
        className={`${DATE_INPUT_CLASS} ${!hasValue ? "date-field-empty text-transparent" : ""} ${className}`.trim()}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
    </div>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", type, lang, ...rest } = props
  const isDateField = type === "date"

  if (isDateField) {
    return <DateInput {...rest} type="date" lang={lang} className={className} />
  }

  return <input {...rest} type={type} lang={lang} className={`${INPUT_CLASS} ${className}`.trim()} />
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props
  return <select {...rest} className={`${INPUT_CLASS} ${className}`.trim()}>{children}</select>
}

export default function SchufaFreeApplicationClient({
  caseId,
  caseRef,
  accessToken,
  initialForm,
  requests,
  documents,
  skagDocuments,
  hasSubmittedToSkag,
  allowTaxClassSix = true,
}: {
  caseId: string
  caseRef: string
  accessToken: string
  initialForm: InitialForm
  requests: RequestRow[]
  documents: DocumentRow[]
  skagDocuments: SkagDocumentRow[]
  hasSubmittedToSkag: boolean
  allowTaxClassSix?: boolean
}) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(initialForm))
  const [step, setStep] = useState<StepId>("person")
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const lockedEmail = fieldValue(initialForm, "email").trim()
  const conversionSentRef = useRef(false)

  const storageKey = `schufa_free_application_draft_${caseId}`
  const conversionPendingKey = `${SCHUFA_FREE_CONVERSION_PENDING_PREFIX}:${caseId}`
  const conversionDoneKey = `${SCHUFA_FREE_CONVERSION_DONE_PREFIX}:${caseId}`
  const issues = validate(form, allowTaxClassSix)
  const stepIndex = Math.max(0, STEP_META.findIndex((entry) => entry.id === step))
  const stepIssues = issues[step]
  const childrenCount = Math.max(0, Number(form.numberOfChildren || 0))
  const childAges = parseChildAges(form.childrenAgesCsv, childrenCount)
  const spouseVisible = ["2", "6"].includes(form.familySituation)
  const spouseRequired = form.familySituation === "2"
  const hasSpouseFormData = Boolean(
    form.spouseFirstName.trim() || form.spouseBirthName.trim() || form.spouseBirthDate || form.spouseIncomeMonthly
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>
        setForm((current) => ({
          ...current,
          ...parsed,
          nationality: String(parsed.nationality ?? current.nationality).toUpperCase(),
          iban: normalizeIbanInput(parsed.iban ?? current.iban),
          childrenTaxAllowance: normalizeTaxAllowanceValue(parsed.childrenTaxAllowance ?? current.childrenTaxAllowance),
          email: current.email,
        }))
      }
    } catch {
      // Keep server-backed data when local draft is broken.
    } finally {
      setDraftReady(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!draftReady || hasSubmittedToSkag) return
    const draftForm = Object.fromEntries(Object.entries(form).filter(([key]) => key !== "email"))
    window.localStorage.setItem(storageKey, JSON.stringify(draftForm))
  }, [draftReady, form, hasSubmittedToSkag, storageKey])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasSubmittedToSkag) return
    if (conversionSentRef.current) return

    let pending: string | null = null
    let done: string | null = null
    try {
      pending = window.sessionStorage.getItem(conversionPendingKey)
      done = window.sessionStorage.getItem(conversionDoneKey)
    } catch {
      return
    }
    if (pending !== "1" || done === "1") return

    let cancelled = false
    let attempts = 0

    const tryTrack = () => {
      if (cancelled || conversionSentRef.current) return
      const tracked = trackGoogleAdsConversion(GOOGLE_ADS_SCHUFA_FREI_LEAD_SEND_TO)
      if (tracked) {
        conversionSentRef.current = true
        try {
          window.sessionStorage.setItem(conversionDoneKey, "1")
          window.sessionStorage.removeItem(conversionPendingKey)
        } catch {
          // ignore storage edge cases after successful tracking
        }
        return
      }

      attempts += 1
      if (attempts < 10) {
        window.setTimeout(tryTrack, 400)
      }
    }

    tryTrack()

    return () => {
      cancelled = true
    }
  }, [conversionDoneKey, conversionPendingKey, hasSubmittedToSkag])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function next() {
    if (stepIssues.length) {
      setFeedback({ tone: "error", text: `Bitte vervollständigen Sie zuerst: ${stepIssues.join(", ")}.` })
      return
    }
    setFeedback(null)
    setStep(STEP_META[Math.min(stepIndex + 1, STEP_META.length - 1)].id)
  }

  function prev() {
    setFeedback(null)
    setStep(STEP_META[Math.max(stepIndex - 1, 0)].id)
  }

  function setChildAge(index: number, value: string) {
    const nextAges = [...childAges]
    nextAges[index] = digitsOnly(value)
    update("childrenAgesCsv", joinChildAges(nextAges))
  }

  async function submit() {
    const firstInvalid = STEP_META.find((entry) => issues[entry.id].length)
    if (firstInvalid) {
      setStep(firstInvalid.id)
      setFeedback({ tone: "error", text: `Bitte vervollständigen Sie noch: ${issues[firstInvalid.id].join(", ")}.` })
      return
    }

    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/schufa-frei/application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          accessToken,
          form: {
            ...form,
            nationality: form.nationality.trim().toUpperCase(),
            zipcode: digitsOnly(form.zipcode),
            employerZipcode: digitsOnly(form.employerZipcode),
            iban: normalizeIbanInput(form.iban),
            childrenAgesCsv: joinChildAges(childAges),
            ratenschutzOptIn: form.ratenschutzOptIn,
          },
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) throw new Error(String(json?.error ?? "Antrag konnte nicht übermittelt werden."))
      window.localStorage.removeItem(storageKey)
      const uploadedDocumentCount = Number(json?.uploadedDocumentCount ?? 0)
      const successParts = ["Ihr Antrag ist sicher bei SEPANA eingegangen."]
      if (form.ratenschutzOptIn) {
        successParts.push("Der Wunsch nach Ratenschutz wurde fuer den Fall vorgemerkt.")
      }
      if (uploadedDocumentCount > 0) {
        successParts.push(
          `${uploadedDocumentCount} Dokument${uploadedDocumentCount === 1 ? "" : "e"} wurde${uploadedDocumentCount === 1 ? "" : "n"} direkt weitergeleitet.`
        )
      }
      successParts.push("Status und Upload-Bereich werden jetzt fuer Sie geladen.")
      const successText = successParts.join(" ")
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(conversionPendingKey, "1")
        } catch {
          // ignore storage edge cases
        }
      }
      setFeedback({ tone: "success", title: "Antrag erfolgreich uebermittelt", text: successText })
      window.setTimeout(() => window.location.reload(), 2200)
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Serverfehler" })
    } finally {
      setBusy(false)
    }
  }

  if (hasSubmittedToSkag) {
    return (
      <SchufaFreeDocumentUploadPanel
        caseId={caseId}
        caseRef={caseRef}
        accessToken={accessToken}
        requests={requests}
        documents={documents}
        skagDocuments={skagDocuments}
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm sm:rounded-[32px]">
      <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Finale Prüfung</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Antrag in vier klaren Schritten</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Die Vorprüfungsdaten sind übernommen. Ergänzen Sie jetzt nur noch die wichtigen Angaben und senden Sie den Antrag dann direkt an SEPANA.</p>
          </div>
          <div className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm lg:w-[250px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Schritt {stepIndex + 1} von {STEP_META.length}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#0f766e)]" style={{ width: `${Math.round(((stepIndex + 1) / STEP_META.length) * 100)}%` }} /></div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEP_META.map((entry, index) => (
            <button key={entry.id} type="button" onClick={() => { setFeedback(null); setStep(entry.id) }} className={`min-w-0 rounded-[22px] border px-4 py-4 text-left shadow-sm transition ${entry.id === step ? "border-slate-900 bg-slate-900 text-white" : issues[entry.id].length && index < stepIndex ? "border-amber-200 bg-amber-50 text-amber-900" : index < stepIndex ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">Schritt {index + 1}</div>
              <div className="mt-1 text-sm font-semibold">{entry.title}</div>
              <div className="mt-1 text-xs opacity-80">{entry.subtitle}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        {feedback ? feedback.tone === "success" ? (
          <div className="mb-5 overflow-hidden rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-900 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-sm">
                OK
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Status aktualisiert</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{feedback.title ?? "Antrag erfolgreich uebermittelt"}</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-700">{feedback.text}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{feedback.text}</div>
        ) : null}
        {stepIssues.length ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">In diesem Schritt fehlen noch: {stepIssues.join(", ")}.</div> : null}

        {step === "person" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anrede"><Select value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="1">Herr</option><option value="2">Frau</option></Select></Field>
            <Field label="Staatsangehörigkeit (ISO2)"><Input value={form.nationality} onChange={(e) => update("nationality", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="DE" /></Field>
            <Field label="Vorname"><Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></Field>
            <Field label="Nachname"><Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></Field>
            <Field label="Geburtsdatum"><Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} /></Field>
            <Field label="Telefon"><Input value={form.phonePrimary} onChange={(e) => update("phonePrimary", e.target.value)} /></Field>
            <Field label="Alternative Telefon-Nr."><Input value={form.phoneSecondary} onChange={(e) => update("phoneSecondary", e.target.value)} placeholder="optional" /></Field>
            <Field label="E-Mail" className="sm:col-span-2">
              <Input
                type="email"
                value={form.email}
                readOnly
                aria-readonly="true"
                className="cursor-not-allowed bg-slate-50 text-slate-500"
              />
              {lockedEmail ? (
                <div className="mt-2 text-xs text-slate-500">
                  Diese E-Mail-Adresse wurde aus Ihrer Vorprüfung übernommen und kann hier nicht mehr geändert werden.
                </div>
              ) : null}
            </Field>
            <Field label="Familienstand"><Select value={form.familySituation} onChange={(e) => update("familySituation", e.target.value)}>{SCHUFA_FREE_FAMILY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Field label="Unterhaltspflichtige Kinder"><Select value={form.numberOfChildren} onChange={(e) => { const count = Number(e.target.value); update("numberOfChildren", e.target.value); update("childrenAgesCsv", joinChildAges(parseChildAges(form.childrenAgesCsv, count))) }}>{[0,1,2,3,4,5,6,7,8,9,10].map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
            <Field label="Geburtsname" className="sm:col-span-2"><Input value={form.birthName} onChange={(e) => update("birthName", e.target.value)} placeholder="optional" /></Field>
            <Field label="Geburtsort" className="sm:col-span-2"><Input value={form.placeOfBirth} onChange={(e) => update("placeOfBirth", e.target.value)} /></Field>
            {childrenCount > 0 ? <div className="sm:col-span-2 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Kinderfreibetrag"><Select value={form.childrenTaxAllowance} onChange={(e) => update("childrenTaxAllowance", e.target.value)}><option value="">Bitte wählen</option>{CHILD_TAX_ALLOWANCE_OPTIONS.map((option) => <option key={option} value={String(option)}>{Number.isInteger(option) ? String(option) : String(option).replace(".", ",")}</option>)}</Select></Field></div><div className="mt-4 text-sm font-semibold text-slate-900">Alter der unterhaltspflichtigen Kinder</div><div className="mt-3 grid gap-3 sm:grid-cols-3">{Array.from({ length: childrenCount }).map((_, index) => <Field key={index} label={`Kind ${index + 1}`}><Input value={childAges[index] ?? ""} onChange={(e) => setChildAge(index, e.target.value)} inputMode="numeric" placeholder="Alter" /></Field>)}</div></div> : null}
            {spouseVisible ? (
              <div className="sm:col-span-2 rounded-[24px] border border-cyan-200 bg-cyan-50/60 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">
                  {spouseRequired ? "Angaben zum Ehegatten" : "Angaben zum Partner"}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-600">
                  Vorname, Geburtsname und Geburtsdatum werden zusammen mit den restlichen Antragsdaten an SEPANA übermittelt.
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Vorname Ehegatte">
                    <Input value={form.spouseFirstName} onChange={(e) => update("spouseFirstName", e.target.value)} />
                  </Field>
                  <Field label="Geburtsdatum Ehegatte"><Input type="date" value={form.spouseBirthDate} onChange={(e) => update("spouseBirthDate", e.target.value)} /></Field>
                  <Field label="Geburtsname Ehegatte">
                    <Input value={form.spouseBirthName} onChange={(e) => update("spouseBirthName", e.target.value)} />
                  </Field>
                  <Field label="Einkommen Ehegatte pro Monat">
                    <Input
                      value={formatMoney(form.spouseIncomeMonthly)}
                      onChange={(e) => update("spouseIncomeMonthly", moneyValue(e.target.value))}
                      inputMode="numeric"
                    />
                  </Field>
                </div>
                {spouseRequired ? (
                  <div className="mt-3 text-xs text-slate-500">
                    Diese Angaben sind bei verheirateten Antragstellern Pflicht und bleiben bis zum Versand im Review sichtbar.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "residence" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Straße"><Input value={form.street} onChange={(e) => update("street", e.target.value)} /></Field>
            <Field label="Hausnummer"><Input value={form.houseNumber} onChange={(e) => update("houseNumber", e.target.value)} /></Field>
            <Field label="PLZ"><Input value={form.zipcode} onChange={(e) => update("zipcode", digitsOnly(e.target.value).slice(0, 5))} inputMode="numeric" /></Field>
            <Field label="Ort"><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
            <Field label="Wohnsituation"><Select value={form.residenceType} onChange={(e) => update("residenceType", e.target.value)}>{SCHUFA_FREE_RESIDENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Field label="Warmmiete / Belastung pro Monat"><Input value={formatMoney(form.rentMonthly)} onChange={(e) => update("rentMonthly", moneyValue(e.target.value))} inputMode="numeric" /></Field>
            <Field label="Wohnhaft seit" className="sm:col-span-2"><Input type="date" value={form.residentSince} onChange={(e) => update("residentSince", e.target.value)} placeholder="optional" /></Field>
          </div>
        ) : null}

        {step === "employment" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Steuerklasse"><Select value={form.taxClass} onChange={(e) => update("taxClass", e.target.value)}>{(allowTaxClassSix ? [1,2,3,4,5,6] : [1,2,3,4,5]).map((option) => <option key={option} value={option}>{`Steuerklasse ${option}`}</option>)}</Select></Field>
            <Field label="Beschäftigungsverhältnis"><Select value={form.profession} onChange={(e) => update("profession", e.target.value)}><option value="">bitte wählen...</option>{SCHUFA_FREE_PROFESSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Field label="Im Beruf seit"><Input type="date" value={form.professionBeginDate} onChange={(e) => update("professionBeginDate", e.target.value)} /></Field>
            <Field label="Nettoeinkommen monatlich"><Input value={formatMoney(form.netIncomeMonthly)} onChange={(e) => update("netIncomeMonthly", moneyValue(e.target.value))} inputMode="numeric" /></Field>
            {!allowTaxClassSix ? <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Hinweis: In der aktuell angebundenen SEPANA-Standardstrecke sind nur Steuerklassen 1 bis 5 möglich.</div> : null}
            <Field label="Arbeitgeber"><Input value={form.employerName} onChange={(e) => update("employerName", e.target.value)} placeholder={requiresSchufaFreeEmployerData(form.profession) ? "" : "optional"} /></Field>
            <Field label="Arbeitgeber PLZ"><Input value={form.employerZipcode} onChange={(e) => update("employerZipcode", digitsOnly(e.target.value).slice(0, 5))} inputMode="numeric" placeholder={requiresSchufaFreeEmployerData(form.profession) ? "" : "optional"} /></Field>
            <Field label="Arbeitgeber Ort" className="sm:col-span-2"><Input value={form.employerCity} onChange={(e) => update("employerCity", e.target.value)} placeholder={requiresSchufaFreeEmployerData(form.profession) ? "" : "optional"} /></Field>
            <Field label="Arbeitgeber Straße"><Input value={form.employerStreet} onChange={(e) => update("employerStreet", e.target.value)} placeholder="optional" /></Field>
            <Field label="Arbeitgeber Hausnummer"><Input value={form.employerHouse} onChange={(e) => update("employerHouse", e.target.value)} placeholder="optional" /></Field>
            <Field label="Telefon Arbeitgeber"><Input value={form.employerPhone} onChange={(e) => update("employerPhone", e.target.value)} placeholder="optional" /></Field>
            <Field label="Zusätzliches Einkommen pro Monat"><Input value={formatMoney(form.additionalIncomeMonthly)} onChange={(e) => update("additionalIncomeMonthly", moneyValue(e.target.value))} inputMode="numeric" placeholder="optional" /></Field>
            <Field label="Zusatzeinkommen seit"><Input type="date" value={form.additionalIncomeBeginDate} onChange={(e) => update("additionalIncomeBeginDate", e.target.value)} placeholder="optional" /></Field>
          </div>
        ) : null}

        {step === "bank" ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name der Bank"><Input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} /></Field>
              <Field label="IBAN"><Input value={formatIban(form.iban)} onChange={(e) => update("iban", normalizeIbanInput(e.target.value))} className="uppercase tracking-[0.08em]" /></Field>
            </div>
            <div className="grid gap-3">
              <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"><input type="checkbox" checked={form.employmentRelationshipLimited} onChange={(e) => update("employmentRelationshipLimited", e.target.checked)} className={CHECKBOX_CLASS} /><span className="min-w-0 leading-relaxed">Arbeitsverhältnis ist befristet oder gekündigt</span></label>
              <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"><input type="checkbox" checked={form.wageGarnishmentAssignment} onChange={(e) => update("wageGarnishmentAssignment", e.target.checked)} className={CHECKBOX_CLASS} /><span className="min-w-0 leading-relaxed">Lohnpfändung / Abtretung vorhanden</span></label>
            </div>
            <div className="space-y-3">
              <div className="rounded-[24px] border border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,0.95),rgba(255,255,255,0.98))] px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Ratenschutz</div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">dringend empfohlen</span>
                </div>
                <div className="mt-2 text-base font-semibold text-slate-900">Optionalen Ratenschutz direkt mit vormerken</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Der Ratenschutz ist optional, kann aber bei unerwarteten Ausfällen zusätzliche Sicherheit geben.
                </p>
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
                  <div className="rounded-2xl border border-cyan-100 bg-white px-3 py-3">Absicherung bei Arbeitsunfähigkeit.</div>
                  <div className="rounded-2xl border border-cyan-100 bg-white px-3 py-3">Unterstützung bei Arbeitslosigkeit.</div>
                  <div className="rounded-2xl border border-cyan-100 bg-white px-3 py-3">Schutz bei schweren Unfallfolgen bzw. Unfalltod.</div>
                  <div className="rounded-2xl border border-cyan-100 bg-white px-3 py-3">
                    Optionaler Wunsch, keine Pflicht. Hinweise zur Datenverarbeitung stehen in unserer{" "}
                    <Link href="/datenschutz" target="_blank" rel="noreferrer" className="font-semibold text-slate-900 underline underline-offset-2">
                      Datenschutzerklärung
                    </Link>
                    .
                  </div>
                </div>
              </div>

              <label className={`block rounded-[24px] border px-4 py-4 shadow-sm transition ${form.ratenschutzOptIn ? "border-emerald-300 bg-emerald-50/80" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.ratenschutzOptIn}
                    onChange={(e) => update("ratenschutzOptIn", e.target.checked)}
                    className={CHECKBOX_CLASS}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">Ratenschutz im Antrag vormerken</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">dringend empfohlen</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Optional. Ohne Haken läuft der Antrag ganz normal weiter. Mit Haken wird der Ratenschutz-Wunsch für den Fall vermerkt.
                    </p>
                    <div className={`mt-3 rounded-2xl border px-3 py-3 text-sm ${form.ratenschutzOptIn ? "border-emerald-200 bg-white text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                      {form.ratenschutzOptIn
                        ? "Aktiv: Ratenschutz wurde für diesen Antrag als Wunsch vorgemerkt."
                        : "Nicht aktiv: Es wird kein Ratenschutz-Wunsch mitgegeben."}
                    </div>
                  </div>
                </div>
              </label>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-4 py-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Prüfung vor dem Versand</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">Antragsteller</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {[form.firstName, form.lastName].filter(Boolean).join(" ").trim() || "-"}
                  </div>
                  <div className="mt-1">{form.email || "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs text-slate-500">Einkommen / Konto</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatMoney(form.netIncomeMonthly) || "-"}</div>
                  <div className="mt-1">{form.bankName || "-"} / {formatIban(form.iban) || "-"}</div>
                </div>
                {hasSpouseFormData ? (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 px-4 py-3 sm:col-span-2">
                    <div className="text-xs text-cyan-700">Ehegatte im Versand</div>
                    <div className="mt-1 grid gap-2 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] text-slate-500">Vorname</div>
                        <div className="font-semibold text-slate-900">{form.spouseFirstName || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Geburtsname</div>
                        <div className="font-semibold text-slate-900">{form.spouseBirthName || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Geburtsdatum</div>
                        <div className="font-semibold text-slate-900">{formatDateLabel(form.spouseBirthDate)}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className={`rounded-2xl border px-4 py-3 ${form.ratenschutzOptIn ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"} sm:col-span-2`}>
                  <div className="text-xs text-slate-500">Ratenschutz / Insurance</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {form.ratenschutzOptIn ? "Ja, im SEPANA-Export markiert" : "Nein"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Der Ratenschutz-Wunsch wird mit dem Antrag als Insurance-Flag übergeben.
                  </div>
                </div>
              </div>
              {STEP_META.some((entry) => issues[entry.id].length) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  Vor dem Versand fehlen noch Angaben in: {STEP_META.filter((entry) => issues[entry.id].length).map((entry) => entry.title).join(", ")}.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  Alle wichtigen Angaben sind erfasst. Der Antrag kann jetzt direkt an SEPANA übermittelt werden.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={prev} disabled={stepIndex === 0 || busy} className={SECONDARY_BUTTON_CLASS}>Zurück</button>
          {step !== "bank" ? <button type="button" onClick={next} disabled={busy} className={PRIMARY_BUTTON_CLASS}>Weiter</button> : <button type="button" onClick={submit} disabled={busy} className={PRIMARY_BUTTON_CLASS}>{busy ? "Wird übermittelt..." : "Antrag jetzt an SEPANA übermitteln"}</button>}
        </div>
      </div>
    </section>
  )
}
