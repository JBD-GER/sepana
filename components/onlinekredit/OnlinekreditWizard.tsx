"use client"

import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { XS2A_SANDBOX_TEST_IBAN_ALIAS, getSandboxIbanDemo, looksLikeIban, normalizeIbanInput } from "@/lib/banking/iban"
import { getCountryOptions } from "@/lib/countries"
import {
  extractEuropaceOfferValidationIssue,
  getAdditionalIdDateValidationIssue,
  getEmploymentSinceValidationIssue,
  getLoanAmountMinimumValidationIssue,
  getMonthlyAmountPlausibilityValidationIssue,
  mapOnlinekreditSaveValidationIssue,
  ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
  ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
  ONLINEKREDIT_MIN_LOAN_AMOUNT,
  type OnlinekreditStepId,
  type OnlinekreditValidationIssue,
} from "@/lib/onlinekredit/validation"

type Applicant = {
  id?: string | null
  salutation?: string | null
  title?: string[] | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  phone_business?: string | null
  birth_date?: string | null
  birth_name?: string | null
  birth_country?: string | null
  birth_place?: string | null
  nationality?: string | null
  marital_status?: string | null
  tax_id?: string | null
  id_document_number?: string | null
  id_issued_place?: string | null
  id_issued_at?: string | null
  id_expires_at?: string | null
  address_street?: string | null
  address_house_no?: string | null
  address_zip?: string | null
  address_city?: string | null
  housing_status?: string | null
  shared_household_with_primary?: boolean | null
  residence_since?: string | null
  previous_address_street?: string | null
  previous_address_house_no?: string | null
  previous_address_zip?: string | null
  previous_address_city?: string | null
  previous_address_since?: string | null
  household_persons?: string | number | null
  vehicle_count?: string | number | null
  employment_type?: string | null
  employment_status?: string | null
  employment_job_title?: string | null
  employment_since?: string | null
  employer_name?: string | null
  employer_industry?: string | null
  employer_address_street?: string | null
  employer_address_house_no?: string | null
  employer_address_zip?: string | null
  employer_address_city?: string | null
  employer_address_country?: string | null
  net_income_monthly?: string | number | null
  other_income_monthly?: string | number | null
  expenses_monthly?: string | number | null
  existing_loans_monthly?: string | number | null
}

type Financing = {
  purpose?: string | null
  loan_amount_requested?: string | number | null
  term_months?: string | number | null
}

type Additional = {
  birth_place?: string | null
  address_since?: string | null
  previous_address_street?: string | null
  previous_address_house_no?: string | null
  previous_address_zip?: string | null
  previous_address_city?: string | null
  previous_address_since?: string | null
  probation?: boolean | null
  probation_months?: string | number | null
  salary_payments_per_year?: string | number | null
  household_persons?: string | number | null
  current_warm_rent?: string | number | null
  current_warm_rent_none?: boolean | null
  vehicle_count?: string | number | null
  vehicle_cost_total?: string | number | null
  maintenance_income_monthly?: string | number | null
  bank_account_holder?: string | null
  bank_iban?: string | null
  bank_bic?: string | null
  returned_debit_window?: "none" | "30_days" | "60_days" | "90_days" | "" | null
  id_document_number?: string | null
  id_issued_place?: string | null
  id_issued_at?: string | null
  id_expires_at?: string | null
  has_children?: boolean | null
}

type ChildRow = {
  id?: string | null
  name?: string | null
  birth_date?: string | null
  child_benefit?: boolean | null
  maintenance_income_present?: boolean | null
  applicant_scope?: "primary" | "co" | "both" | null
  maintenance_income_monthly?: string | number | null
}

type LiabilityType =
  | "ratenkredit"
  | "dispositionskredit"
  | "kreditkarte"
  | "privates_leasing"
  | "sonstige_verbindlichkeit"

type LiabilityRow = {
  id?: string | null
  liability_type: LiabilityType
  applicant_scope?: "primary" | "co" | "both" | null
  creditor?: string | null
  monthly_rate?: string | number | null
  final_installment?: string | number | null
  last_rate_date?: string | null
  current_balance?: string | number | null
  original_amount?: string | number | null
  first_payment_date?: string | null
  utilized_amount?: string | number | null
  credit_limit?: string | number | null
  interest_rate?: string | number | null
  refinance?: boolean | null
  iban?: string | null
  bic?: string | null
}

type RealEstateLoanRow = {
  id?: string | null
  remaining_debt?: string | number | null
  interest_fixed_until?: string | null
  monthly_rate?: string | number | null
}

type RealEstateAssetRow = {
  id?: string | null
  applicant_scope?: "primary" | "co" | "both" | null
  property_type?: "eigentumswohnung" | "einfamilienhaus" | "mehrfamilienhaus" | "buerogebaeude" | "" | null
  description?: string | null
  value_amount?: string | number | null
  living_space_sqm?: string | number | null
  usage_type?: "eigengenutzt" | "vermietet" | "beides" | "" | null
  rented_living_space_sqm?: string | number | null
  rent_income_cold_monthly?: string | number | null
  rent_income_warm_monthly?: string | number | null
  ancillary_costs_monthly?: string | number | null
  loans?: RealEstateLoanRow[]
}

type LoadResponse = {
  ok?: boolean
  primary?: Applicant
  co?: Applicant[]
  baufi?: Financing
  additional?: Additional
  children?: ChildRow[]
  liabilities?: LiabilityRow[]
  real_estate_assets?: RealEstateAssetRow[]
  customer_can_edit?: boolean
}

type SaveResponse = {
  ok?: boolean
  error?: string
  stage?: string
  message?: string
  validation?: OnlinekreditValidationIssue | null
  warnings?: string[]
  europaceSync?: {
    attempted?: boolean
    ok?: boolean
    error?: string | null
  }
}

type OffersValidationResponse = {
  ok?: boolean
  offers?: Array<{
    angebot_id?: string
    machbarkeit_status?: string | null
    vollstaendigkeit_status?: string | null
    accepted_at?: string | null
    superseded_at?: string | null
    angebot_snapshot?: {
      vollstaendigkeit?: {
        messages?: Array<{
          text?: string | null
          property?: string | null
          category?: string | null
          reason?: string | null
        }> | null
      } | null
    } | null
  }>
  error?: string
}

type SaveResult = {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount: boolean
  warnings: string[]
}

type IbanLookupResponse = {
  ok?: boolean
  bic?: string | null
  bankName?: string | null
  error?: string
}

type StepId = OnlinekreditStepId
type FieldHelp = { title?: string; body: string }
type FieldInfoValue = FieldHelp | string

const PURPOSE_OPTIONS = [
  { value: "freie_verwendung", label: "Freie Verwendung" },
  { value: "umschuldung", label: "Umschuldung" },
  { value: "auto", label: "Auto" },
  { value: "pv_anlage", label: "PV-Anlage" },
  { value: "hochzeitskredit", label: "Hochzeitskredit" },
  { value: "modernisierung", label: "Modernisierung" },
  { value: "sonstiges", label: "Sonstiges" },
] as const

const SALUTATION_OPTIONS = [
  { value: "herr", label: "Herr" },
  { value: "frau", label: "Frau" },
] as const

const TITLE_OPTIONS = [
  { value: "PROFESSOR", label: "Prof." },
  { value: "DOKTOR", label: "Dr." },
] as const

const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "Ledig" },
  { value: "married", label: "Verheiratet" },
  { value: "registered", label: "Eingetragene Partnerschaft" },
  { value: "divorced", label: "Geschieden" },
  { value: "widowed", label: "Verwitwet" },
] as const

const HOUSING_OPTIONS = [
  { value: "rent", label: "Miete" },
  { value: "owner", label: "Eigentum" },
  { value: "with_family", label: "Bei Familie" },
  { value: "other", label: "Sonstiges" },
] as const

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "employed", label: "Angestellt" },
  { value: "self_employed", label: "Selbstständig" },
  { value: "civil_servant", label: "Beamter" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Rentner" },
  { value: "unemployed", label: "Arbeitslos" },
  { value: "other", label: "Sonstiges" },
] as const

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "permanent", label: "Unbefristet" },
  { value: "fixed_term", label: "Befristet" },
  { value: "probation", label: "Probezeit" },
  { value: "mini_job", label: "Minijob" },
  { value: "part_time", label: "Teilzeit" },
  { value: "full_time", label: "Vollzeit" },
  { value: "apprentice", label: "Ausbildung" },
  { value: "other", label: "Sonstiges" },
] as const

const RETURNED_DEBIT_OPTIONS = [
  { value: "none", label: "Nein" },
  { value: "30_days", label: "In den letzten 30 Tagen" },
  { value: "60_days", label: "In den letzten 60 Tagen" },
  { value: "90_days", label: "In den letzten 90 Tagen" },
] as const

const EMPLOYER_INDUSTRY_OPTIONS = [
  { value: "LANDWIRTSCHAFT_FORSTWIRTSCHAFT_FISCHEREI", label: "Landwirtschaft / Forstwirtschaft / Fischerei" },
  { value: "ENERGIE_WASSERVERSORGUNG_BERGBAU", label: "Energie / Wasser / Bergbau" },
  { value: "VERARBEITENDES_GEWERBE", label: "Verarbeitendes Gewerbe / Industrie" },
  { value: "BAUGEWERBE", label: "Baugewerbe" },
  { value: "HANDEL", label: "Handel" },
  { value: "VERKEHR_LOGISTIK", label: "Verkehr / Logistik" },
  { value: "INFORMATION_KOMMUNIKATION", label: "IT / Information / Kommunikation" },
  { value: "GEMEINNUETZIGE_ORGANISATION", label: "Gemeinnützige Organisation" },
  { value: "KREDITINSTITUTE_VERSICHERUNGEN", label: "Banken / Versicherungen" },
  { value: "PRIVATE_HAUSHALTE", label: "Private Haushalte" },
  { value: "DIENSTLEISTUNGEN", label: "Dienstleistungen" },
  { value: "OEFFENTLICHER_DIENST", label: "Öffentlicher Dienst" },
  { value: "GEBIETSKOERPERSCHAFTEN", label: "Gebietskörperschaften / Behörden" },
  { value: "HOTEL_GASTRONOMIE", label: "Hotel / Gastronomie" },
  { value: "ERZIEHUNG_UNTERRICHT", label: "Erziehung / Unterricht" },
  { value: "KULTUR_SPORT_UNTERHALTUNG", label: "Kultur / Sport / Unterhaltung" },
  { value: "GESUNDHEIT_SOZIALWESEN", label: "Gesundheit / Sozialwesen" },
] as const

const SALARY_OPTIONS = ["12", "12.5", "13", "13.5", "14", "14.5"] as const
const TERM_MONTH_OPTIONS = ["12", "24", "36", "48", "60", "72", "84", "96", "108", "120"] as const
const LIABILITY_SCOPE_OPTIONS = [
  { value: "primary", label: "1" },
  { value: "co", label: "2" },
  { value: "both", label: "Beide" },
] as const
const LIABILITY_TYPE_META: Record<
  LiabilityType,
  {
    label: string
    addLabel: string
  }
> = {
  ratenkredit: { label: "Ratenkredit", addLabel: "+ Ratenkredit" },
  dispositionskredit: { label: "Dispositionskredit", addLabel: "+ Dispositionskredit" },
  kreditkarte: { label: "Kreditkarte", addLabel: "+ Kreditkarte" },
  privates_leasing: { label: "Privates Leasing", addLabel: "+ Privates Leasing" },
  sonstige_verbindlichkeit: { label: "Sonstige Verbindlichkeit", addLabel: "+ Sonstige Verbindlichkeit" },
} as const
const REAL_ESTATE_PROPERTY_TYPE_OPTIONS = [
  { value: "eigentumswohnung", label: "Eigentumswohnung" },
  { value: "einfamilienhaus", label: "Einfamilienhaus" },
  { value: "mehrfamilienhaus", label: "Mehrfamilienhaus" },
  { value: "buerogebaeude", label: "Bürogebäude" },
] as const
const REAL_ESTATE_USAGE_OPTIONS = [
  { value: "eigengenutzt", label: "Eigengenutzt" },
  { value: "vermietet", label: "Vermietet" },
  { value: "beides", label: "Beides" },
] as const

const STEP_META: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: "basis", title: "Basisdaten", subtitle: "Kreditwunsch und Kontaktdaten." },
  { id: "person", title: "Person", subtitle: "Persönliche Angaben des Hauptantragstellers." },
  { id: "residence", title: "Adresse & Haushalt", subtitle: "Adresse, Wohnen und Haushalt." },
  { id: "employment", title: "Beruf & Einkommen", subtitle: "Beruf, Arbeitgeber und Einnahmen." },
  { id: "details", title: "Legitimation & Konto", subtitle: "Ausweis, Konto und Kinder." },
  { id: "co", title: "Zweiter Kreditnehmer", subtitle: "Angaben zur zweiten Person." },
  { id: "review", title: "Prüfen & Angebote", subtitle: "Alles prüfen und Angebote abrufen." },
] as const

const FIELD_INFO = {
  purpose: {
    title: "Verwendungszweck",
    body: "Der Zweck hilft SEPANA, dir die passende Angebotsstrecke zu zeigen. Bitte den realen Hauptgrund des Kredits wählen.",
  },
  loanAmount: {
    title: "Kreditsumme",
    body: `Trage den Betrag ein, der wirklich ausgezahlt werden soll. Der Onlinekredit startet ab ${ONLINEKREDIT_MIN_LOAN_AMOUNT.toLocaleString("de-DE")} EUR.`,
  },
  termMonths: {
    title: "Laufzeit",
    body: "Die Laufzeit beeinflusst Monatsrate, Gesamtkosten und die passenden SEPANA-Angebote.",
  },
  firstName: "Bitte exakt wie im Ausweisdokument angeben.",
  lastName: "Bitte exakt wie im Ausweisdokument angeben.",
  email: "An diese Adresse geht später die Einladung in den Kundenbereich.",
  phone: "Die Nummer wird für Rückfragen und Anbieterprozesse verwendet.",
  salutation: "SEPANA braucht eine klare Anrede für deine Personendaten.",
  title: "Akademische Titel nur angeben, wenn sie offiziell geführt werden.",
  birthDate: "Das Geburtsdatum wird für Identifikation, Volljährigkeit und Score-Berechnung benötigt.",
  birthPlace: "Bitte den amtlichen Geburtsort eintragen.",
  birthCountry: "Das Geburtsland sollte dem Ausweisdokument entsprechen.",
  nationality: "Die Staatsangehörigkeit wird für Herkunft und Produktprüfung verwendet.",
  maritalStatus: "Der Familienstand beeinflusst Haushalts- und Bonitätsbetrachtung.",
  taxId: "Optional, aber hilfreich für spätere Prüfungen und Anbieterprozesse.",
  street: "Bitte aktuelle Meldeadresse eintragen.",
  houseNo: "Hausnummer separat eintragen, damit deine Anschrift vollständig übernommen wird.",
  zip: "Bitte nur die aktuelle Postleitzahl der Meldeadresse.",
  city: "Bitte den amtlichen Wohnort angeben.",
  housingStatus: "Die Wohnart beeinflusst Haushaltsrechnung und die passende Angebotsprüfung.",
  addressSince: "Wenn der Einzug weniger als 3 Jahre zurückliegt, wird automatisch die Voranschrift erforderlich.",
  householdPersons: "Alle Personen im Haushalt zählen, nicht nur Kreditnehmer.",
  warmRent: "Die aktuelle Warmmiete wird als Haushaltsbelastung berücksichtigt. Bei Eigentum oder keiner Miete kannst du sie deaktivieren.",
  vehicleCount: "Anzahl der Fahrzeuge im Haushalt.",
  vehicleCostTotal: "Gesamte monatliche Fahrzeugkosten im Haushalt, falls vorhanden.",
  employmentType: "Die Art der Beschäftigung entscheidet, welche Arbeitgeber- und Einkommensfelder benötigt werden.",
  employmentStatus: "Bitte das aktuelle Beschäftigungsverhältnis wählen, z. B. unbefristet oder befristet.",
  jobTitle: "Möglichst konkret angeben, z. B. Vertriebsleiterin oder Mechatroniker.",
  employmentSince: "Bitte das tatsächliche Beschäftigungsbeginn-Datum angeben.",
  employerName: "Firmenname des aktuellen Arbeitgebers bzw. Unternehmens.",
  employerIndustry: "Die Branche hilft SEPANA, deinen Antrag vollständig zu prüfen.",
  employerStreet: "Arbeitgeberanschrift gemäß Firmenadresse.",
  employerZip: "Postleitzahl der Arbeitgeberanschrift.",
  employerCity: "Ort der Arbeitgeberanschrift.",
  employerCountry: "Land des Arbeitgebers bzw. Unternehmenssitzes.",
  netIncome: "Bitte das niedrigste monatliche Nettoeinkommen aus den letzten 3 Monaten ohne freiwillige Zusatzeinnahmen angeben.",
  otherIncome: "Regelmäßige weitere Einnahmen, die verlässlich verfügbar sind.",
  expensesMonthly: "Eigene sonstige monatliche Fixkosten außer Miete und separaten Verbindlichkeiten.",
  existingLoansMonthly: "Nur bestehende monatliche Kreditraten, wenn sie nicht bereits unten als einzelne Verbindlichkeit erfasst werden.",
  idNumber: "Die Ausweisnummer wird für Identifikation und Antragsprüfung benötigt.",
  idIssuedPlace: "Der Ausstellungsort steht auf dem Ausweisdokument.",
  idIssuedAt: "Bitte das Ausstellungsdatum aus dem Ausweis übernehmen.",
  idExpiresAt: "Bitte das Ablaufdatum aus dem Ausweis übernehmen.",
  bankAccountHolder: "Name des Kontoinhabers für Auszahlung und ggf. Kontocheck.",
  iban: "IBAN des Auszahlungskontos bzw. Hauptkontos.",
  bic: "BIC gemäß Bankverbindung.",
  returnedDebit: "Die Information wird lokal für den Prozess erfasst. Bitte ehrlich nach dem letzten Zeitraum mit Rücklastschriften beantworten.",
  children: "Kinder können den Haushalt und mögliche Einnahmen beeinflussen.",
  liabilities: "Bestehende Verbindlichkeiten wirken sich direkt auf die Haushaltsrechnung aus.",
  realEstate: "Eigene Immobilien können Vermögen, Nebenkosten und bestehende Darlehen beeinflussen.",
} satisfies Record<string, FieldInfoValue>

const EMPTY_APPLICANT: Applicant = {
  salutation: "",
  title: [],
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  phone_business: "",
  birth_date: "",
  birth_name: "",
  birth_country: "",
  birth_place: "",
  nationality: "",
  marital_status: "",
  tax_id: "",
  id_document_number: "",
  id_issued_place: "",
  id_issued_at: "",
  id_expires_at: "",
  address_street: "",
  address_house_no: "",
  address_zip: "",
  address_city: "",
  housing_status: "",
  shared_household_with_primary: null,
  residence_since: "",
  previous_address_street: "",
  previous_address_house_no: "",
  previous_address_zip: "",
  previous_address_city: "",
  previous_address_since: "",
  household_persons: "",
  vehicle_count: "",
  employment_type: "",
  employment_status: "",
  employment_job_title: "",
  employment_since: "",
  employer_name: "",
  employer_industry: "",
  employer_address_street: "",
  employer_address_house_no: "",
  employer_address_zip: "",
  employer_address_city: "",
  employer_address_country: "DE",
  net_income_monthly: "",
  other_income_monthly: "",
  expenses_monthly: "",
  existing_loans_monthly: "",
}

const EMPTY_FINANCING: Financing = {
  purpose: "freie_verwendung",
  loan_amount_requested: "",
  term_months: "",
}

const EMPTY_ADDITIONAL: Additional = {
  birth_place: "",
  address_since: "",
  previous_address_street: "",
  previous_address_house_no: "",
  previous_address_zip: "",
  previous_address_city: "",
  previous_address_since: "",
  probation: false,
  probation_months: "",
  salary_payments_per_year: "",
  household_persons: "",
  current_warm_rent: "",
  current_warm_rent_none: false,
  vehicle_count: "",
  vehicle_cost_total: "",
  maintenance_income_monthly: "",
  bank_account_holder: "",
  bank_iban: "",
  bank_bic: "",
  returned_debit_window: "",
  id_document_number: "",
  id_issued_place: "",
  id_issued_at: "",
  id_expires_at: "",
  has_children: false,
}

function createLiabilityRow(liabilityType: LiabilityType, hasCoApplicant: boolean): LiabilityRow {
  return {
    liability_type: liabilityType,
    applicant_scope: hasCoApplicant ? null : "primary",
    creditor: "",
    monthly_rate: "",
    final_installment: "",
    last_rate_date: "",
    current_balance: "",
    original_amount: "",
    first_payment_date: "",
    utilized_amount: "",
    credit_limit: "",
    interest_rate: "",
    refinance: liabilityType === "privates_leasing" ? null : false,
    iban: "",
    bic: "",
  }
}

function createRealEstateAssetRow(hasCoApplicant: boolean): RealEstateAssetRow {
  return {
    applicant_scope: hasCoApplicant ? null : "primary",
    property_type: "",
    description: "",
    value_amount: "",
    living_space_sqm: "",
    usage_type: "",
    rented_living_space_sqm: "",
    rent_income_cold_monthly: "",
    rent_income_warm_monthly: "",
    ancillary_costs_monthly: "",
    loans: [],
  }
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function trimOrEmpty(value: unknown) {
  return String(value ?? "").trim()
}

function stringOrEmpty(value: unknown) {
  return value === null || value === undefined ? "" : String(value)
}

function fullName(firstName: unknown, lastName: unknown) {
  return [String(firstName ?? "").trim(), String(lastName ?? "").trim()].filter(Boolean).join(" ")
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
  }
  const single = String(value ?? "").trim()
  return single ? [single] : []
}

function hasValue(value: unknown) {
  return trimOrEmpty(value).length > 0
}

function requiresEmployerCoreFields(applicant: Applicant) {
  const type = trimOrEmpty(applicant.employment_type).toLowerCase()
  return type === "employed" || type === "civil_servant" || type === "self_employed"
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPhone(value: string) {
  return value.replace(/\D/g, "").length >= 6
}

function normalizeMoneyString(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return ""
  if (cleaned.includes(",")) return cleaned.replace(/\./g, "").replace(",", ".")
  return cleaned.replace(/\./g, "")
}

function customerText(value: unknown) {
  return String(value ?? "").replace(/europace/gi, "SEPANA").trim()
}

function isFinalSelectableOffer(offer: {
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
}) {
  const machbarkeit = String(offer.machbarkeit_status ?? "").trim().toUpperCase()
  const vollstaendigkeit = String(offer.vollstaendigkeit_status ?? "").trim().toUpperCase()
  return (
    !offer.accepted_at &&
    !offer.superseded_at &&
    vollstaendigkeit === "VOLLSTAENDIG" &&
    (machbarkeit === "MACHBAR" || machbarkeit === "MACHBAR_UNTER_VORBEHALT")
  )
}

function parseMoneyToNumber(value: unknown) {
  const parsed = Number(normalizeMoneyString(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function toMoneyInput(value: unknown) {
  if (value === null || value === undefined || value === "") return ""
  const parsed = parseMoneyToNumber(value)
  return parsed ? formatMoney(parsed) : String(value)
}

function toDateInput(value: unknown) {
  if (!value) return ""
  const raw = String(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

function parseIsoDate(value: unknown) {
  const raw = String(value ?? "").trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const parsed = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))
  if (Number.isNaN(parsed.getTime())) return null
  if (
    parsed.getUTCFullYear() !== yearNumber ||
    parsed.getUTCMonth() !== monthNumber - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return null
  }
  return parsed
}

function startOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function getDateFieldValidationMessage({
  value,
  label,
  latest,
}: {
  value: unknown
  label: string
  latest?: "today"
}) {
  const raw = trimOrEmpty(value)
  if (!raw) return null

  const parsed = parseIsoDate(raw)
  if (!parsed) return `${label} ist kein gültiges Datum.`

  if (latest === "today" && parsed.getTime() > startOfTodayUtc().getTime()) {
    return `${label} darf nicht in der Zukunft liegen.`
  }

  return null
}

type BudgetBarTone = "sky" | "amber" | "emerald" | "rose"

function budgetBarToneClasses(tone: BudgetBarTone) {
  if (tone === "amber") {
    return {
      track: "bg-amber-100",
      fill: "bg-gradient-to-r from-amber-400 to-amber-500",
      value: "text-amber-900",
    }
  }
  if (tone === "emerald") {
    return {
      track: "bg-emerald-100",
      fill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
      value: "text-emerald-900",
    }
  }
  if (tone === "rose") {
    return {
      track: "bg-rose-100",
      fill: "bg-gradient-to-r from-rose-500 to-rose-600",
      value: "text-rose-900",
    }
  }
  return {
    track: "bg-sky-100",
    fill: "bg-gradient-to-r from-sky-500 to-sky-600",
    value: "text-sky-900",
  }
}

function requiresPreviousAddress(value: unknown) {
  const residenceSince = parseIsoDate(value)
  if (!residenceSince) return false

  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setFullYear(threshold.getFullYear() - 3)
  return residenceSince.getTime() > threshold.getTime()
}

function liabilityHasData(row: LiabilityRow) {
  const values = [
    row.creditor,
    row.monthly_rate,
    row.final_installment,
    row.last_rate_date,
    row.current_balance,
    row.original_amount,
    row.first_payment_date,
    row.utilized_amount,
    row.credit_limit,
    row.interest_rate,
    row.iban,
    row.bic,
  ]
  return values.some((value) => hasValue(value)) || row.refinance === true
}

function liabilityLabel(liabilityType: LiabilityType) {
  return LIABILITY_TYPE_META[liabilityType].label
}

function realEstateHasData(row: RealEstateAssetRow) {
  const values = [
    row.property_type,
    row.description,
    row.value_amount,
    row.living_space_sqm,
    row.usage_type,
    row.rented_living_space_sqm,
    row.rent_income_cold_monthly,
    row.rent_income_warm_monthly,
    row.ancillary_costs_monthly,
  ]
  return values.some((value) => hasValue(value)) || Array.isArray(row.loans) && row.loans.some((loan) => hasValue(loan.remaining_debt) || hasValue(loan.interest_fixed_until) || hasValue(loan.monthly_rate))
}

function buildSteps(hasCoApplicant: boolean) {
  return STEP_META.filter((step) => (step.id === "co" ? hasCoApplicant : true))
}

function createCoApplicant(): Applicant {
  return { ...EMPTY_APPLICANT }
}

function InfoBadge({ info }: { info: FieldInfoValue }) {
  const content = typeof info === "string" ? { body: info } : info
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
    placement: "top" | "bottom"
    arrowLeft: number
  } | null>(null)

  useEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel || typeof window === "undefined") return

      const viewportPadding = 12
      const gap = 14
      const rect = trigger.getBoundingClientRect()
      const desiredWidth = Math.min(320, window.innerWidth - viewportPadding * 2)

      panel.style.width = `${desiredWidth}px`
      const panelHeight = panel.offsetHeight

      let left = rect.left + rect.width / 2 - desiredWidth / 2
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - desiredWidth - viewportPadding))

      let top = rect.bottom + gap
      let placement: "top" | "bottom" = "bottom"
      if (top + panelHeight > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, rect.top - panelHeight - gap)
        placement = "top"
      }

      const triggerCenter = rect.left + rect.width / 2
      const arrowLeft = Math.max(20, Math.min(triggerCenter - left, desiredWidth - 20))

      setPosition({
        top,
        left,
        width: desiredWidth,
        placement,
        arrowLeft,
      })
    }

    function handleOutside(event: MouseEvent) {
      const target = event.target as Node | null
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label={content.title ? `Info zu ${content.title}` : "Info"}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-200",
          open
            ? "border-sky-300 bg-sky-100 text-sky-800 shadow-sm"
            : "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100"
        )}
      >
        i
      </button>
      {typeof document !== "undefined" && open
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="dialog"
              aria-modal="false"
              className="fixed z-[80] rounded-[1.25rem] border border-sky-100 bg-white/98 p-4 text-left shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur"
              style={{
                top: `${position?.top ?? 12}px`,
                left: `${position?.left ?? 12}px`,
                width: `${position?.width ?? 280}px`,
                visibility: position ? "visible" : "hidden",
              }}
            >
              <div
                className={cn(
                  "absolute h-3 w-3 rotate-45 border border-sky-100 bg-white",
                  position?.placement === "top" ? "-bottom-1.5" : "-top-1.5"
                )}
                style={{ left: `${position?.arrowLeft ?? 24}px`, marginLeft: "-6px" }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Hinweis</div>
                  {content.title ? <div className="mt-1 text-sm font-semibold text-slate-900">{content.title}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  aria-label="Hinweis schließen"
                >
                  ×
                </button>
              </div>
              <div className={cn("text-sm leading-6 text-slate-700", content.title ? "mt-2" : "mt-3")}>{content.body}</div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function Field({
  label,
  required,
  children,
  hint,
  info,
  error,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
  info?: FieldInfoValue
  error?: string | null
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          {info ? <InfoBadge info={info} /> : null}
        </div>
        {required ? (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            Pflicht
          </span>
        ) : hint ? (
          <span className="shrink-0 pt-0.5 text-xs text-slate-500">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? <div className="mt-1.5 text-xs font-medium text-rose-700">{error}</div> : null}
    </label>
  )
}

function Card({
  title,
  subtitle,
  children,
  errorMessages,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  errorMessages?: string[]
}) {
  const visibleErrors = Array.from(new Set((errorMessages ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border bg-white/95 p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] backdrop-blur sm:rounded-[1.75rem] sm:p-5",
        visibleErrors.length ? "border-rose-200/90" : "border-slate-200/80"
      )}
    >
      <div className="mb-4">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {visibleErrors.length ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="font-semibold">Hier gibt es noch einen Fehler</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {visibleErrors.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {children}
    </div>
  )
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition",
        "placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        props.className
      )}
    />
  )
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition",
        "focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        props.className
      )}
    />
  )
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onChange(trimOrEmpty(value) ? formatMoney(parseMoneyToNumber(value)) : "")}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      inputMode="decimal"
      placeholder={placeholder}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition",
        "placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100",
        disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
        className
      )}
    />
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-[420px]:flex-row min-[420px]:items-baseline min-[420px]:justify-between min-[420px]:gap-3">
      <div className="text-slate-600">{label}</div>
      <div className="text-left font-medium tabular-nums text-slate-900 min-[420px]:text-right">{value}</div>
    </div>
  )
}

function BudgetBar({
  label,
  value,
  max,
  tone,
  hint,
}: {
  label: string
  value: number
  max: number
  tone: BudgetBarTone
  hint?: string
}) {
  const palette = budgetBarToneClasses(tone)
  const ratio = max > 0 ? Math.min(100, Math.max(0, (Math.abs(value) / max) * 100)) : 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className={cn("text-sm font-semibold tabular-nums min-[420px]:shrink-0", palette.value)}>{formatMoney(value)}</div>
      </div>
      <div className={cn("mt-3 h-2.5 overflow-hidden rounded-full", palette.track)}>
        <div className={cn("h-full rounded-full transition-[width] duration-300", palette.fill)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="leading-5">{label}</span>
    </label>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyStepChip({
  index,
  title,
  subtitle,
  active,
  done,
  onClick,
}: {
  index: number
  title: string
  subtitle?: string
  active: boolean
  done: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-[160px] rounded-2xl border px-3 py-2 text-left transition sm:min-w-[180px]",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            active
              ? "bg-white/15 text-white"
              : done
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
          )}
        >
          {done ? "✓" : index + 1}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em]">Schritt</div>
          <div className="mt-0.5 text-sm font-semibold">{title}</div>
          {subtitle ? <div className={cn("mt-1 text-xs leading-5", active ? "text-slate-200" : "text-slate-500")}>{subtitle}</div> : null}
        </div>
      </div>
    </button>
  )
}

function StepChip({
  index,
  title,
  subtitle,
  status,
  onClick,
}: {
  index: number
  title: string
  subtitle?: string
  status: "active" | "active_missing" | "done" | "missing" | "pending"
  onClick: () => void
}) {
  const active = status === "active" || status === "active_missing"
  const done = status === "done"
  const missing = status === "missing" || status === "active_missing"
  const eyebrow = active ? (missing ? "Unvollständig" : "Aktuell") : done ? "Fertig" : missing ? "Unvollständig" : "Offen"
  const iconLabel = done ? "OK" : missing ? "!" : index + 1

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      title={subtitle ?? title}
      className={cn(
        "h-full rounded-[1.35rem] border px-3 py-3 text-left transition",
        active && !missing
          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
          : active && missing
            ? "border-amber-300 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : missing
              ? "border-amber-200 bg-amber-50 text-amber-950 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-sm"
            : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            active && !missing
              ? "bg-white/12 text-white"
              : active && missing
                ? "bg-amber-200 text-amber-950"
              : done
                ? "bg-emerald-100 text-emerald-700"
                : missing
                  ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600"
          )}
        >
          {iconLabel}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              active && !missing
                ? "text-slate-300"
                : active && missing
                  ? "text-amber-200"
                  : done
                    ? "text-emerald-700"
                    : missing
                      ? "text-amber-800"
                      : "text-slate-500"
            )}
          >
            {eyebrow}
          </div>
          <div className="mt-1 text-sm font-semibold leading-5">{title}</div>
          {subtitle ? (
            <div
              className={cn(
                "mt-1 text-xs leading-5",
                active && !missing
                  ? "text-slate-200"
                  : active && missing
                    ? "text-slate-200"
                    : done
                      ? "text-emerald-800/80"
                      : missing
                        ? "text-amber-900/80"
                        : "text-slate-500"
              )}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export default function OnlinekreditWizard({
  caseId,
  caseRef,
  accessToken,
  existingAccount = false,
}: {
  caseId?: string | null
  caseRef?: string | null
  accessToken?: string | null
  existingAccount?: boolean
}) {
  const router = useRouter()
  const countryOptions = useMemo(() => getCountryOptions("de-DE"), [])
  const routeCaseId = trimOrEmpty(caseId)
  const routeCaseRef = trimOrEmpty(caseRef)
  const routeAccessToken = trimOrEmpty(accessToken)
  const hasRouteCase = Boolean(routeCaseId && routeCaseRef && routeAccessToken)
  const [publicCase, setPublicCase] = useState(() => ({
    caseId: routeCaseId,
    caseRef: routeCaseRef,
    accessToken: routeAccessToken,
    existingAccount,
  }))
  const activeCaseId = trimOrEmpty(publicCase.caseId)
  const activeCaseRef = trimOrEmpty(publicCase.caseRef)
  const activeAccessToken = trimOrEmpty(publicCase.accessToken)
  const activeExistingAccount = Boolean(publicCase.existingAccount)
  const existingCase = Boolean(activeCaseId && activeCaseRef && activeAccessToken)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offersTransitionOverlayOpen, setOffersTransitionOverlayOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [serverValidationIssue, setServerValidationIssue] = useState<OnlinekreditValidationIssue | null>(null)
  const lastSaveValidationIssueRef = useRef<OnlinekreditValidationIssue | null>(null)
  const wizardRef = useRef<HTMLDivElement | null>(null)
  const [customerCanEdit, setCustomerCanEdit] = useState(true)
  const [primary, setPrimary] = useState<Applicant>(EMPTY_APPLICANT)
  const [financing, setFinancing] = useState<Financing>(EMPTY_FINANCING)
  const [additional, setAdditional] = useState<Additional>(EMPTY_ADDITIONAL)
  const [autofilledBankBic, setAutofilledBankBic] = useState<string | null>(null)
  const [bankBicLookupLoading, setBankBicLookupLoading] = useState(false)
  const [bankBicLookupError, setBankBicLookupError] = useState<string | null>(null)
  const [children, setChildren] = useState<ChildRow[]>([])
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([])
  const [realEstateAssets, setRealEstateAssets] = useState<RealEstateAssetRow[]>([])
  const [coApplicants, setCoApplicants] = useState<Applicant[]>([])
  const [hasCoApplicant, setHasCoApplicant] = useState(false)
  const [step, setStep] = useState<StepId>("basis")
  const [interactedFields, setInteractedFields] = useState<Record<string, boolean>>({})

  function markFieldInteracted(fieldId: string) {
    setInteractedFields((current) => (current[fieldId] ? current : { ...current, [fieldId]: true }))
  }

  function visibleFieldError(fieldId: string, message: string | null) {
    return interactedFields[fieldId] ? message : null
  }

  const steps = useMemo(() => buildSteps(hasCoApplicant), [hasCoApplicant])
  const stepIndex = useMemo(() => steps.findIndex((entry) => entry.id === step), [step, steps])
  const currentStep = steps[Math.max(stepIndex, 0)] ?? steps[0]
  const progress = useMemo(() => Math.round(((Math.max(stepIndex, 0) + 1) / steps.length) * 100), [stepIndex, steps.length])
  const stepTitleById = useMemo(
    () => Object.fromEntries(steps.map((entry) => [entry.id, entry.title])) as Record<StepId, string>,
    [steps]
  )
  const needsPreviousResidence = useMemo(() => requiresPreviousAddress(additional.address_since), [additional.address_since])
  const coNeedsPreviousResidence = useMemo(
    () => coApplicants[0]?.shared_household_with_primary === false && requiresPreviousAddress(coApplicants[0]?.residence_since),
    [coApplicants]
  )
  const additionalDateValidationIssue = useMemo(
    () =>
      getAdditionalIdDateValidationIssue({
        id_issued_at: additional.id_issued_at,
        id_expires_at: additional.id_expires_at,
      }),
    [additional.id_expires_at, additional.id_issued_at]
  )
  const coAdditionalDateValidationIssue = useMemo(
    () =>
      hasCoApplicant
        ? getAdditionalIdDateValidationIssue({
            id_issued_at: coApplicants[0]?.id_issued_at,
            id_expires_at: coApplicants[0]?.id_expires_at,
          })
        : null,
    [coApplicants, hasCoApplicant]
  )
  const primaryEmploymentValidationIssue = useMemo(
    () =>
      getEmploymentSinceValidationIssue({
        birth_date: primary.birth_date,
        employment_since: primary.employment_since,
        step: "employment",
        section: "beruf",
      }),
    [primary.birth_date, primary.employment_since]
  )
  const coEmploymentValidationIssue = useMemo(
    () =>
      hasCoApplicant
        ? getEmploymentSinceValidationIssue({
            birth_date: coApplicants[0]?.birth_date,
            employment_since: coApplicants[0]?.employment_since,
            step: "co",
            section: "beruf",
            label: "Beschäftigt seit des zweiten Kreditnehmers",
          })
        : null,
    [coApplicants, hasCoApplicant]
  )
  const suggestedBankAccountHolder = useMemo(() => fullName(primary.first_name, primary.last_name), [primary.first_name, primary.last_name])
  const canApplySuggestedBankAccountHolder =
    Boolean(suggestedBankAccountHolder) && trimOrEmpty(additional.bank_account_holder) !== suggestedBankAccountHolder
  const currentBankBic = trimOrEmpty(additional.bank_bic)
  const sandboxBankIbanDemo = getSandboxIbanDemo(additional.bank_iban)
  const canAutofillBankBic =
    looksLikeIban(additional.bank_iban) && (!currentBankBic || currentBankBic === trimOrEmpty(autofilledBankBic))
  const contactCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "basis" || serverValidationIssue.section !== "kontakt") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const creditRequestCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "basis" || serverValidationIssue.section !== "kreditwunsch") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const personCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "person" || serverValidationIssue.section !== "person") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const residenceCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "residence" || serverValidationIssue.section !== "wohnen") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const previousResidenceCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "residence" || serverValidationIssue.section !== "voranschrift") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const employmentCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "employment" || serverValidationIssue.section !== "beruf") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const legitimationCardErrors = useMemo(() => {
    const items = [additionalDateValidationIssue?.message]
    if (serverValidationIssue?.step === "details" && serverValidationIssue.section === "legitimation") {
      items.push(...serverValidationIssue.messages)
    }
    return Array.from(new Set(items.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [additionalDateValidationIssue?.message, serverValidationIssue])
  const coLegitimationCardErrors = useMemo(() => {
    const items = [coAdditionalDateValidationIssue?.message]
    if (serverValidationIssue?.step === "co" && serverValidationIssue.section === "legitimation") {
      items.push(...serverValidationIssue.messages)
    }
    return Array.from(new Set(items.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [coAdditionalDateValidationIssue?.message, serverValidationIssue])
  const bankCardErrors = useMemo(() => {
    if (serverValidationIssue?.step !== "details" || serverValidationIssue.section !== "konto") return [] as string[]
    return Array.from(new Set(serverValidationIssue.messages.map((entry) => String(entry ?? "").trim()).filter(Boolean)))
  }, [serverValidationIssue])
  const localValidationIssues = useMemo(
    () =>
      [
        primaryEmploymentValidationIssue,
        coEmploymentValidationIssue,
        additionalDateValidationIssue,
        coAdditionalDateValidationIssue
          ? {
              ...coAdditionalDateValidationIssue,
              step: "co",
              section: "legitimation",
              fields: ["id_issued_at", "id_expires_at"],
            }
          : null,
      ].filter(Boolean) as OnlinekreditValidationIssue[],
    [additionalDateValidationIssue, coAdditionalDateValidationIssue, coEmploymentValidationIssue, primaryEmploymentValidationIssue]
  )
  const primaryEmailFormatIssue = (() => {
    const email = trimOrEmpty(primary.email)
    if (!email) return null
    return isEmail(email) ? null : "Bitte eine gültige E-Mail-Adresse eingeben."
  })()
  const primaryPhoneFormatIssue = (() => {
    const phone = trimOrEmpty(primary.phone)
    if (!phone) return null
    return isPhone(phone) ? null : "Bitte eine gültige Telefonnummer eingeben."
  })()
  const primaryBirthDateFormatIssue = getDateFieldValidationMessage({
    value: primary.birth_date,
    label: "Geburtsdatum",
    latest: "today",
  })
  const addressSinceFormatIssue = getDateFieldValidationMessage({
    value: additional.address_since,
    label: "Wohnhaft seit",
    latest: "today",
  })
  const previousAddressSinceFormatIssue = getDateFieldValidationMessage({
    value: additional.previous_address_since,
    label: "Voranschrift wohnhaft seit",
    latest: "today",
  })
  const issuedAtFormatIssue = getDateFieldValidationMessage({
    value: additional.id_issued_at,
    label: "Ausgestellt am",
    latest: "today",
  })
  const expiresAtFormatIssue = getDateFieldValidationMessage({
    value: additional.id_expires_at,
    label: "Ablauf am",
  })
  const coBirthDateFormatIssue = getDateFieldValidationMessage({
    value: coApplicants[0]?.birth_date,
    label: "Geburtsdatum des zweiten Kreditnehmers",
    latest: "today",
  })
  const coResidenceSinceFormatIssue = getDateFieldValidationMessage({
    value: coApplicants[0]?.residence_since,
    label: "Wohnhaft seit des zweiten Kreditnehmers",
    latest: "today",
  })
  const coPreviousAddressSinceFormatIssue = getDateFieldValidationMessage({
    value: coApplicants[0]?.previous_address_since,
    label: "Voranschrift wohnhaft seit des zweiten Kreditnehmers",
    latest: "today",
  })
  const coIssuedAtFormatIssue = getDateFieldValidationMessage({
    value: coApplicants[0]?.id_issued_at,
    label: "Ausgestellt am des zweiten Kreditnehmers",
    latest: "today",
  })
  const coExpiresAtFormatIssue = getDateFieldValidationMessage({
    value: coApplicants[0]?.id_expires_at,
    label: "Ablauf am des zweiten Kreditnehmers",
  })
  const coEmailFormatIssue = (() => {
    const email = trimOrEmpty(coApplicants[0]?.email)
    if (!email) return null
    return isEmail(email) ? null : "Bitte eine gültige E-Mail-Adresse für den zweiten Kreditnehmer eingeben."
  })()
  const loanAmountValidationIssue = getLoanAmountMinimumValidationIssue({
    loan_amount_requested: financing.loan_amount_requested,
    minimum: ONLINEKREDIT_MIN_LOAN_AMOUNT,
  })
  const primaryNetIncomePlausibilityIssue = getMonthlyAmountPlausibilityValidationIssue({
    value: primary.net_income_monthly,
    max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
    step: "employment",
    section: "beruf",
    fields: ["net_income_monthly"],
    label: "Nettoeinkommen / Monat",
  })
  const warmRentPlausibilityIssue = additional.current_warm_rent_none
    ? null
    : getMonthlyAmountPlausibilityValidationIssue({
        value: additional.current_warm_rent,
        max: ONLINEKREDIT_MAX_WARM_RENT_MONTHLY,
        step: "residence",
        section: "wohnen",
        fields: ["current_warm_rent"],
        label: "Aktuelle Warmmiete",
      })
  const coNetIncomePlausibilityIssue = hasCoApplicant
    ? getMonthlyAmountPlausibilityValidationIssue({
        value: coApplicants[0]?.net_income_monthly,
        max: ONLINEKREDIT_MAX_NET_INCOME_MONTHLY,
        step: "co",
        section: "beruf",
        fields: ["net_income_monthly"],
        label: "Nettoeinkommen / Monat des zweiten Kreditnehmers",
      })
    : null
  const coPhoneFormatIssue = (() => {
    const phone = trimOrEmpty(coApplicants[0]?.phone)
    if (!phone) return null
    return isPhone(phone) ? null : "Bitte eine gültige Telefonnummer für den zweiten Kreditnehmer eingeben."
  })()
  const loanAmountFieldError = visibleFieldError("financing.loan_amount_requested", loanAmountValidationIssue?.message ?? null)
  const primaryNetIncomeFieldError = visibleFieldError(
    "primary.net_income_monthly",
    primaryNetIncomePlausibilityIssue?.message ?? null
  )
  const currentWarmRentFieldError = visibleFieldError(
    "additional.current_warm_rent",
    warmRentPlausibilityIssue?.message ?? null
  )
  const primaryEmailFieldError = visibleFieldError("primary.email", primaryEmailFormatIssue)
  const primaryPhoneFieldError = visibleFieldError("primary.phone", primaryPhoneFormatIssue)
  const primaryBirthDateFieldError = visibleFieldError("primary.birth_date", primaryBirthDateFormatIssue)
  const addressSinceFieldError = visibleFieldError("additional.address_since", addressSinceFormatIssue)
  const previousAddressSinceFieldError = visibleFieldError("additional.previous_address_since", previousAddressSinceFormatIssue)
  const primaryEmploymentSinceFieldError = visibleFieldError(
    "primary.employment_since",
    primaryEmploymentValidationIssue?.message ?? null
  )
  const issuedAtFieldError = visibleFieldError(
    "additional.id_issued_at",
    issuedAtFormatIssue ?? additionalDateValidationIssue?.message ?? null
  )
  const expiresAtFieldError = visibleFieldError(
    "additional.id_expires_at",
    expiresAtFormatIssue ?? additionalDateValidationIssue?.message ?? null
  )
  const coBirthDateFieldError = visibleFieldError("co.birth_date", coBirthDateFormatIssue)
  const coResidenceSinceFieldError = visibleFieldError("co.residence_since", coResidenceSinceFormatIssue)
  const coPreviousAddressSinceFieldError = visibleFieldError("co.previous_address_since", coPreviousAddressSinceFormatIssue)
  const coIssuedAtFieldError = visibleFieldError(
    "co.id_issued_at",
    coIssuedAtFormatIssue ?? coAdditionalDateValidationIssue?.message ?? null
  )
  const coExpiresAtFieldError = visibleFieldError(
    "co.id_expires_at",
    coExpiresAtFormatIssue ?? coAdditionalDateValidationIssue?.message ?? null
  )
  const coEmploymentSinceFieldError = visibleFieldError("co.employment_since", coEmploymentValidationIssue?.message ?? null)
  const coEmailFieldError = visibleFieldError("co.email", coEmailFormatIssue)
  const coPhoneFieldError = visibleFieldError("co.phone", coPhoneFormatIssue)
  const coNetIncomeFieldError = visibleFieldError("co.net_income_monthly", coNetIncomePlausibilityIssue?.message ?? null)
  const hasPhoneFieldError =
    Boolean(primaryPhoneFieldError) ||
    (serverValidationIssue?.step === "basis" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("phone"))
  const hasLoanAmountFieldError =
    Boolean(loanAmountFieldError) ||
    (serverValidationIssue?.step === "basis" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("loan_amount_requested"))
  const hasBirthDateFieldError =
    Boolean(primaryBirthDateFieldError) ||
    (serverValidationIssue?.step === "person" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("birth_date"))
  const hasAddressSinceFieldError =
    Boolean(addressSinceFieldError) ||
    (serverValidationIssue?.step === "residence" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("address_since"))
  const hasPreviousAddressSinceFieldError =
    Boolean(previousAddressSinceFieldError) ||
    (serverValidationIssue?.step === "residence" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("previous_address_since"))
  const hasEmploymentSinceFieldError =
    Boolean(primaryEmploymentSinceFieldError) ||
    (serverValidationIssue?.step === "employment" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("employment_since"))
  const hasPrimaryNetIncomeFieldError =
    Boolean(primaryNetIncomeFieldError) ||
    (serverValidationIssue?.step === "employment" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("net_income_monthly"))
  const hasCurrentWarmRentFieldError =
    Boolean(currentWarmRentFieldError) ||
    (serverValidationIssue?.step === "residence" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("current_warm_rent"))
  const hasCoNetIncomeFieldError =
    Boolean(coNetIncomeFieldError) ||
    (serverValidationIssue?.step === "co" &&
      Array.isArray(serverValidationIssue.fields) &&
      serverValidationIssue.fields.includes("net_income_monthly"))
  const hasCoLegitimationDateFieldError =
    Boolean(coIssuedAtFieldError) || Boolean(coExpiresAtFieldError) || coLegitimationCardErrors.length > 0
  const hasLegitimationDateFieldError = Boolean(issuedAtFieldError) || Boolean(expiresAtFieldError) || legitimationCardErrors.length > 0
  const hasBankAccountHolderFieldError =
    serverValidationIssue?.step === "details" &&
    Array.isArray(serverValidationIssue.fields) &&
    serverValidationIssue.fields.includes("bank_account_holder")
  const hasBankIbanFieldError =
    serverValidationIssue?.step === "details" &&
    Array.isArray(serverValidationIssue.fields) &&
    serverValidationIssue.fields.includes("bank_iban")
  const hasBankBicFieldError =
    serverValidationIssue?.step === "details" &&
    Array.isArray(serverValidationIssue.fields) &&
    serverValidationIssue.fields.includes("bank_bic")
  const reviewFocusIssue = useMemo(
    () => (serverValidationIssue?.step === "review" ? serverValidationIssue : serverValidationIssue ?? localValidationIssues[0] ?? null),
    [localValidationIssues, serverValidationIssue]
  )
  const reviewFocusStepTitle = reviewFocusIssue?.step ? stepTitleById[reviewFocusIssue.step] ?? reviewFocusIssue.step : ""
  const shouldHideGlobalErrorBannerForCurrentStep =
    Boolean(serverValidationIssue) &&
    ((step === "basis" && (contactCardErrors.length > 0 || creditRequestCardErrors.length > 0)) ||
      (step === "person" && personCardErrors.length > 0) ||
      (step === "residence" && (residenceCardErrors.length > 0 || previousResidenceCardErrors.length > 0)) ||
      (step === "employment" && employmentCardErrors.length > 0) ||
      (step === "details" && (legitimationCardErrors.length > 0 || bankCardErrors.length > 0)) ||
      (step === "co" && coLegitimationCardErrors.length > 0) ||
      (step === "review" && Boolean(reviewFocusIssue)))
  const serverIssueJumpStep = serverValidationIssue?.step && serverValidationIssue.step !== step ? serverValidationIssue.step : null
  const serverIssueJumpTitle = serverIssueJumpStep ? stepTitleById[serverIssueJumpStep] ?? serverIssueJumpStep : ""
  const basisValidationResetKey = `${trimOrEmpty(financing.loan_amount_requested)}|${trimOrEmpty(primary.email)}|${trimOrEmpty(primary.phone)}`
  const householdSummary = useMemo(() => {
    const primaryIncome =
      parseMoneyToNumber(primary.net_income_monthly) +
      parseMoneyToNumber(primary.other_income_monthly) +
      parseMoneyToNumber(additional.maintenance_income_monthly)
    const coIncome = hasCoApplicant
      ? parseMoneyToNumber(coApplicants[0]?.net_income_monthly) + parseMoneyToNumber(coApplicants[0]?.other_income_monthly)
      : 0
    const childIncome = children.reduce((sum, child) => sum + parseMoneyToNumber(child.maintenance_income_monthly), 0)
    const rentalIncome = realEstateAssets.reduce((sum, asset) => {
      const coldRent = parseMoneyToNumber(asset.rent_income_cold_monthly)
      const warmRent = parseMoneyToNumber(asset.rent_income_warm_monthly)
      return sum + (coldRent || warmRent)
    }, 0)
    const totalIncome = primaryIncome + coIncome + childIncome + rentalIncome

    const housingCosts = additional.current_warm_rent_none ? 0 : parseMoneyToNumber(additional.current_warm_rent)
    const vehicleCosts = parseMoneyToNumber(additional.vehicle_cost_total)
    const primaryFixedCosts =
      parseMoneyToNumber(primary.expenses_monthly) + parseMoneyToNumber(primary.existing_loans_monthly)
    const coFixedCosts = hasCoApplicant
      ? parseMoneyToNumber(coApplicants[0]?.expenses_monthly) + parseMoneyToNumber(coApplicants[0]?.existing_loans_monthly)
      : 0
    const liabilityCosts = liabilities.reduce((sum, row) => sum + parseMoneyToNumber(row.monthly_rate), 0)
    const realEstateCosts = realEstateAssets.reduce(
      (sum, asset) =>
        sum +
        parseMoneyToNumber(asset.ancillary_costs_monthly) +
        (Array.isArray(asset.loans) ? asset.loans.reduce((loanSum, loan) => loanSum + parseMoneyToNumber(loan.monthly_rate), 0) : 0),
      0
    )
    const fixedCosts = housingCosts + vehicleCosts + primaryFixedCosts + coFixedCosts + liabilityCosts + realEstateCosts
    const householdAllowance = 1000
    const totalOut = fixedCosts + householdAllowance
    const surplus = totalIncome - totalOut
    const base = Math.max(totalIncome, 1)
    const surplusRatio = surplus / base
    const maxBarValue = Math.max(totalIncome, fixedCosts, householdAllowance, Math.abs(surplus), 1)

    const statusLabel =
      surplus < 0
        ? "Negativ"
        : surplusRatio < 0.08
          ? "Knapp"
          : surplusRatio < 0.18
            ? "Stabil"
            : "Solide"
    const statusTone: BudgetBarTone = surplus < 0 ? "rose" : surplusRatio < 0.08 ? "amber" : "emerald"
    const tip =
      surplus < 0
        ? "Aktuell liegen die laufenden Ausgaben über den Einnahmen."
        : surplusRatio < 0.08
          ? "Der Puffer ist vorhanden, aber noch eher knapp."
          : "Die Haushaltsrechnung zeigt aktuell einen brauchbaren monatlichen Puffer."

    return {
      primaryIncome,
      coIncome,
      childIncome,
      rentalIncome,
      totalIncome,
      housingCosts,
      vehicleCosts,
      primaryFixedCosts,
      coFixedCosts,
      liabilityCosts,
      realEstateCosts,
      fixedCosts,
      householdAllowance,
      totalOut,
      surplus,
      maxBarValue,
      statusLabel,
      statusTone,
      tip,
    }
  }, [additional, children, coApplicants, hasCoApplicant, liabilities, primary, realEstateAssets])

  useEffect(() => {
    if (!canAutofillBankBic) {
      setBankBicLookupLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      void lookupBankBic(stringOrEmpty(additional.bank_iban))
    }, 450)

    return () => window.clearTimeout(timer)
  }, [additional.bank_iban, canAutofillBankBic])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "details" || current.section !== "legitimation") return current
      return null
    })
  }, [additional.id_expires_at, additional.id_issued_at])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "employment" || current.section !== "beruf") return current
      return null
    })
  }, [primary.birth_date, primary.employment_since])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "basis" || (current.section !== "kontakt" && current.section !== "kreditwunsch")) return current
      return null
    })
  }, [basisValidationResetKey])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "person" || current.section !== "person") return current
      return null
    })
  }, [primary.birth_date])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "residence" || (current.section !== "wohnen" && current.section !== "voranschrift")) return current
      return null
    })
  }, [additional.address_since, additional.previous_address_since])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "details" || current.section !== "konto") return current
      return null
    })
  }, [additional.bank_account_holder, additional.bank_bic, additional.bank_iban])

  useEffect(() => {
    setServerValidationIssue((current) => {
      if (!current) return null
      if (current.step !== "co" || current.section !== "beruf") return current
      return null
    })
  }, [coApplicants])

  useEffect(() => {
    const nextCaseId = routeCaseId
    const nextCaseRef = routeCaseRef
    const nextAccessToken = routeAccessToken
    if (!nextCaseId || !nextCaseRef || !nextAccessToken) return

    setPublicCase({
      caseId: nextCaseId,
      caseRef: nextCaseRef,
      accessToken: nextAccessToken,
      existingAccount,
    })
  }, [existingAccount, routeAccessToken, routeCaseId, routeCaseRef])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      setServerValidationIssue(null)
      if (!hasRouteCase) {
        if (active) setLoading(false)
        return
      }

      const query = new URLSearchParams({
        caseId: String(routeCaseId),
        caseRef: String(routeCaseRef),
        access: String(routeAccessToken),
      })
      const response = await fetch(`/api/live/case?${query.toString()}`)
      const json = (await response.json().catch(() => ({}))) as LoadResponse
      if (!response.ok || !json?.ok) {
        if (active) {
          setError("Der Onlinekredit-Antrag konnte nicht geladen werden.")
          setLoading(false)
        }
        return
      }

      if (!active) return

      setPrimary({
        ...EMPTY_APPLICANT,
        ...(json.primary ?? {}),
        title: stringArray(json.primary?.title),
        birth_date: toDateInput(json.primary?.birth_date),
        residence_since: toDateInput(json.primary?.residence_since),
        previous_address_since: toDateInput(json.primary?.previous_address_since),
        household_persons: stringOrEmpty(json.primary?.household_persons),
        vehicle_count: stringOrEmpty(json.primary?.vehicle_count),
        employment_since: toDateInput(json.primary?.employment_since),
        net_income_monthly: toMoneyInput(json.primary?.net_income_monthly),
        other_income_monthly: toMoneyInput(json.primary?.other_income_monthly),
        expenses_monthly: toMoneyInput(json.primary?.expenses_monthly),
        existing_loans_monthly: toMoneyInput(json.primary?.existing_loans_monthly),
      })
      setFinancing({
        ...EMPTY_FINANCING,
        ...(json.baufi ?? {}),
        loan_amount_requested: toMoneyInput(json.baufi?.loan_amount_requested),
        term_months: trimOrEmpty(json.baufi?.term_months),
      })
      setAdditional({
        ...EMPTY_ADDITIONAL,
        ...(json.additional ?? {}),
        address_since: toDateInput(json.additional?.address_since),
        previous_address_since: toDateInput(json.additional?.previous_address_since),
        id_issued_at: toDateInput(json.additional?.id_issued_at),
        id_expires_at: toDateInput(json.additional?.id_expires_at),
        probation: Boolean(json.additional?.probation),
        current_warm_rent_none: Boolean(json.additional?.current_warm_rent_none),
        has_children: Boolean(json.additional?.has_children),
        current_warm_rent: toMoneyInput(json.additional?.current_warm_rent),
        vehicle_cost_total: toMoneyInput(json.additional?.vehicle_cost_total),
        maintenance_income_monthly: toMoneyInput(json.additional?.maintenance_income_monthly),
      })
      setChildren(
        Array.isArray(json.children)
          ? json.children.map((child) => ({
              ...child,
              birth_date: toDateInput(child.birth_date),
              child_benefit: child.child_benefit === null || child.child_benefit === undefined ? null : Boolean(child.child_benefit),
              maintenance_income_present:
                child.maintenance_income_present === null || child.maintenance_income_present === undefined
                  ? null
                  : Boolean(child.maintenance_income_present),
              maintenance_income_monthly: toMoneyInput(child.maintenance_income_monthly),
            }))
          : []
      )
      setLiabilities(
        Array.isArray(json.liabilities)
          ? json.liabilities.map((row) => ({
              ...createLiabilityRow(
                (trimOrEmpty(row.liability_type) as LiabilityType) || "ratenkredit",
                Array.isArray(json.co) && json.co.length > 0
              ),
              ...row,
              last_rate_date: toDateInput(row.last_rate_date),
              first_payment_date: toDateInput(row.first_payment_date),
              monthly_rate: toMoneyInput(row.monthly_rate),
              final_installment: toMoneyInput(row.final_installment),
              current_balance: toMoneyInput(row.current_balance),
              original_amount: toMoneyInput(row.original_amount),
              utilized_amount: toMoneyInput(row.utilized_amount),
              credit_limit: toMoneyInput(row.credit_limit),
              interest_rate: stringOrEmpty(row.interest_rate),
              refinance: row.refinance === null || row.refinance === undefined ? null : Boolean(row.refinance),
            }))
          : []
      )
      setRealEstateAssets(
        Array.isArray(json.real_estate_assets)
          ? json.real_estate_assets.map((row) => ({
              ...createRealEstateAssetRow(Array.isArray(json.co) && json.co.length > 0),
              ...row,
              value_amount: toMoneyInput(row.value_amount),
              living_space_sqm: stringOrEmpty(row.living_space_sqm),
              rented_living_space_sqm: stringOrEmpty(row.rented_living_space_sqm),
              rent_income_cold_monthly: toMoneyInput(row.rent_income_cold_monthly),
              rent_income_warm_monthly: toMoneyInput(row.rent_income_warm_monthly),
              ancillary_costs_monthly: toMoneyInput(row.ancillary_costs_monthly),
              loans: Array.isArray(row.loans)
                ? row.loans.map((loan) => ({
                    ...loan,
                    remaining_debt: toMoneyInput(loan.remaining_debt),
                    interest_fixed_until: toDateInput(loan.interest_fixed_until),
                    monthly_rate: toMoneyInput(loan.monthly_rate),
                  }))
                : [],
            }))
          : []
      )
      const nextCo =
        Array.isArray(json.co) && json.co.length
          ? json.co.map((applicant) => ({
              ...EMPTY_APPLICANT,
              ...applicant,
              title: stringArray(applicant.title),
              birth_date: toDateInput(applicant.birth_date),
              id_issued_at: toDateInput(applicant.id_issued_at),
              id_expires_at: toDateInput(applicant.id_expires_at),
              residence_since: toDateInput(applicant.residence_since),
              previous_address_since: toDateInput(applicant.previous_address_since),
              household_persons: stringOrEmpty(applicant.household_persons),
              vehicle_count: stringOrEmpty(applicant.vehicle_count),
              employment_since: toDateInput(applicant.employment_since),
              net_income_monthly: toMoneyInput(applicant.net_income_monthly),
              other_income_monthly: toMoneyInput(applicant.other_income_monthly),
              expenses_monthly: toMoneyInput(applicant.expenses_monthly),
              existing_loans_monthly: toMoneyInput(applicant.existing_loans_monthly),
            }))
          : []
      setCoApplicants(nextCo)
      setHasCoApplicant(nextCo.length > 0)
      setCustomerCanEdit(Boolean(json.customer_can_edit ?? true))
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [hasRouteCase, routeAccessToken, routeCaseId, routeCaseRef])

  useEffect(() => {
    if (!hasCoApplicant && step === "co") {
      setStep("review")
    }
  }, [hasCoApplicant, step])

  useEffect(() => {
    if (!hasCoApplicant) {
      setChildren((current) =>
        current.map((child) => ({
          ...child,
          applicant_scope: "primary",
        }))
      )
      setLiabilities((current) =>
        current.map((row) => ({
          ...row,
          applicant_scope: "primary",
        }))
      )
      setRealEstateAssets((current) =>
        current.map((row) => ({
          ...row,
          applicant_scope: "primary",
        }))
      )
    }
  }, [hasCoApplicant])

  function updatePrimary<K extends keyof Applicant>(key: K, value: Applicant[K]) {
    setPrimary((current) => ({ ...current, [key]: value }))
  }

  function togglePrimaryTitle(title: string, checked: boolean) {
    setPrimary((current) => {
      const titles = new Set(stringArray(current.title))
      if (checked) titles.add(title)
      else titles.delete(title)
      return { ...current, title: Array.from(titles) }
    })
  }

  function updateFinancing<K extends keyof Financing>(key: K, value: Financing[K]) {
    setFinancing((current) => ({ ...current, [key]: value }))
  }

  function updateAdditional<K extends keyof Additional>(key: K, value: Additional[K]) {
    if (key === "bank_bic") {
      setAutofilledBankBic(null)
      setBankBicLookupError(null)
    }
    if (key === "bank_iban") {
      setBankBicLookupError(null)
    }
    setAdditional((current) => ({ ...current, [key]: value }))
  }

  async function lookupBankBic(rawIban: string) {
    const iban = normalizeIbanInput(rawIban)
    if (!looksLikeIban(iban)) {
      setBankBicLookupLoading(false)
      setBankBicLookupError(null)
      return
    }

    const sandboxDemo = getSandboxIbanDemo(iban)
    if (sandboxDemo) {
      setAdditional((current) => ({ ...current, bank_iban: iban, bank_bic: sandboxDemo.bic }))
      setAutofilledBankBic(sandboxDemo.bic)
      setBankBicLookupError(null)
      setBankBicLookupLoading(false)
      return
    }

    setBankBicLookupLoading(true)
    setBankBicLookupError(null)

    try {
      const response = await fetch(`/api/banking/iban?iban=${encodeURIComponent(iban)}`, { cache: "no-store" })
      const json = (await response.json().catch(() => ({}))) as IbanLookupResponse
      if (!response.ok || !json?.ok || !trimOrEmpty(json.bic)) {
        throw new Error(String(json?.error ?? "BIC konnte nicht automatisch ermittelt werden."))
      }

      const bic = trimOrEmpty(json.bic).toUpperCase()
      setAdditional((current) => ({ ...current, bank_iban: iban, bank_bic: bic }))
      setAutofilledBankBic(bic)
      setBankBicLookupError(null)
    } catch (lookupError) {
      setBankBicLookupError(
        lookupError instanceof Error ? lookupError.message : "BIC konnte nicht automatisch ermittelt werden."
      )
    } finally {
      setBankBicLookupLoading(false)
    }
  }

  function ensureCoApplicant() {
    setHasCoApplicant(true)
    setCoApplicants((current) => (current.length ? current : [createCoApplicant()]))
  }

  function disableCoApplicant() {
    setHasCoApplicant(false)
    setCoApplicants([])
  }

  function updateCoApplicant<K extends keyof Applicant>(key: K, value: Applicant[K]) {
    setCoApplicants((current) => {
      const next = current.length ? [...current] : [createCoApplicant()]
      next[0] = { ...next[0], [key]: value }
      return next
    })
  }

  function toggleCoApplicantTitle(title: string, checked: boolean) {
    setCoApplicants((current) => {
      const next = current.length ? [...current] : [createCoApplicant()]
      const titles = new Set(stringArray(next[0]?.title))
      if (checked) titles.add(title)
      else titles.delete(title)
      next[0] = { ...next[0], title: Array.from(titles) }
      return next
    })
  }

  function addChild() {
    setChildren((current) => [
      ...current,
      { name: "", birth_date: "", child_benefit: null, maintenance_income_present: null, applicant_scope: hasCoApplicant ? null : "primary", maintenance_income_monthly: "" },
    ])
  }

  function updateChild(index: number, patch: Partial<ChildRow>) {
    setChildren((current) => current.map((child, idx) => (idx === index ? { ...child, ...patch } : child)))
  }

  function removeChild(index: number) {
    setChildren((current) => current.filter((_, idx) => idx !== index))
  }

  function addLiability(liabilityType: LiabilityType) {
    setLiabilities((current) => [...current, createLiabilityRow(liabilityType, hasCoApplicant)])
  }

  function updateLiability(index: number, patch: Partial<LiabilityRow>) {
    setLiabilities((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)))
  }

  function removeLiability(index: number) {
    setLiabilities((current) => current.filter((_, idx) => idx !== index))
  }

  function addRealEstateAsset() {
    setRealEstateAssets((current) => [...current, createRealEstateAssetRow(hasCoApplicant)])
  }

  function updateRealEstateAsset(index: number, patch: Partial<RealEstateAssetRow>) {
    setRealEstateAssets((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)))
  }

  function removeRealEstateAsset(index: number) {
    setRealEstateAssets((current) => current.filter((_, idx) => idx !== index))
  }

  function addRealEstateLoan(assetIndex: number) {
    setRealEstateAssets((current) =>
      current.map((row, idx) =>
        idx === assetIndex
          ? {
              ...row,
              loans: [...(Array.isArray(row.loans) ? row.loans : []), { remaining_debt: "", interest_fixed_until: "", monthly_rate: "" }],
            }
          : row
      )
    )
  }

  function updateRealEstateLoan(assetIndex: number, loanIndex: number, patch: Partial<RealEstateLoanRow>) {
    setRealEstateAssets((current) =>
      current.map((row, idx) =>
        idx === assetIndex
          ? {
              ...row,
              loans: (Array.isArray(row.loans) ? row.loans : []).map((loan, currentLoanIndex) =>
                currentLoanIndex === loanIndex ? { ...loan, ...patch } : loan
              ),
            }
          : row
      )
    )
  }

  function removeRealEstateLoan(assetIndex: number, loanIndex: number) {
    setRealEstateAssets((current) =>
      current.map((row, idx) =>
        idx === assetIndex
          ? {
              ...row,
              loans: (Array.isArray(row.loans) ? row.loans : []).filter((_, currentLoanIndex) => currentLoanIndex !== loanIndex),
            }
          : row
      )
    )
  }

  function applicantValidation(applicant: Applicant, label: string) {
    const errors: string[] = []
    if (!hasValue(applicant.salutation)) errors.push(`${label}: Anrede fehlt.`)
    if (!hasValue(applicant.first_name)) errors.push(`${label}: Vorname fehlt.`)
    if (!hasValue(applicant.last_name)) errors.push(`${label}: Nachname fehlt.`)
    if (!hasValue(applicant.birth_date)) errors.push(`${label}: Geburtsdatum fehlt.`)
    if (!hasValue(applicant.birth_country)) errors.push(`${label}: Geburtsland fehlt.`)
    if (!hasValue(applicant.nationality)) errors.push(`${label}: Staatsangehörigkeit fehlt.`)
    if (!hasValue(applicant.marital_status)) errors.push(`${label}: Familienstand fehlt.`)
    if (!hasValue(applicant.address_street)) errors.push(`${label}: Straße fehlt.`)
    if (!hasValue(applicant.address_house_no)) errors.push(`${label}: Hausnummer fehlt.`)
    if (!hasValue(applicant.address_zip)) errors.push(`${label}: PLZ fehlt.`)
    if (!hasValue(applicant.address_city)) errors.push(`${label}: Ort fehlt.`)
    if (!hasValue(applicant.housing_status)) errors.push(`${label}: Wohnstatus fehlt.`)
    if (!hasValue(applicant.employment_type)) errors.push(`${label}: Beschäftigungsverhältnis fehlt.`)
    if (!hasValue(applicant.employment_status)) errors.push(`${label}: Anstellungsstatus fehlt.`)
    if (!hasValue(applicant.employment_job_title)) errors.push(`${label}: Berufsbezeichnung fehlt.`)
    if (!hasValue(applicant.employment_since)) errors.push(`${label}: Beschäftigt seit fehlt.`)
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_name)) {
      errors.push(`${label}: Arbeitgeber fehlt.`)
    }
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_industry)) {
      errors.push(`${label}: Branche fehlt.`)
    }
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_address_street)) {
      errors.push(`${label}: Arbeitgeber-Straße fehlt.`)
    }
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_address_zip)) {
      errors.push(`${label}: Arbeitgeber-PLZ fehlt.`)
    }
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_address_city)) {
      errors.push(`${label}: Arbeitgeber-Ort fehlt.`)
    }
    if (requiresEmployerCoreFields(applicant) && !hasValue(applicant.employer_address_country)) {
      errors.push(`${label}: Arbeitgeber-Land fehlt.`)
    }
    if (!hasValue(applicant.net_income_monthly)) errors.push(`${label}: Nettoeinkommen fehlt.`)
    return errors
  }

  function coApplicantValidation(applicant: Applicant) {
    const errors = applicantValidation(applicant, "Zweiter Kreditnehmer").filter(
      (entry) =>
        !entry.includes(": Straße fehlt.") &&
        !entry.includes(": Hausnummer fehlt.") &&
        !entry.includes(": PLZ fehlt.") &&
        !entry.includes(": Ort fehlt.") &&
        !entry.includes(": Wohnstatus fehlt.")
    )

    if (!hasValue(applicant.birth_place)) errors.push("Zweiter Kreditnehmer: Geburtsort fehlt.")
    if (!hasValue(applicant.id_document_number)) errors.push("Zweiter Kreditnehmer: Ausweisnummer fehlt.")
    if (!hasValue(applicant.id_issued_place)) errors.push("Zweiter Kreditnehmer: Ausstellungsort fehlt.")
    if (!hasValue(applicant.id_issued_at)) errors.push("Zweiter Kreditnehmer: Ausstellungsdatum fehlt.")
    if (!hasValue(applicant.id_expires_at)) errors.push("Zweiter Kreditnehmer: Ablaufdatum des Ausweises fehlt.")

    if (applicant.shared_household_with_primary === null || applicant.shared_household_with_primary === undefined) {
      errors.push("Zweiter Kreditnehmer: Gleiche Wohnsituation mit Hauptantragsteller fehlt.")
      return errors
    }

    if (!applicant.shared_household_with_primary) {
      if (!hasValue(applicant.address_street)) errors.push("Zweiter Kreditnehmer: Straße fehlt.")
      if (!hasValue(applicant.address_house_no)) errors.push("Zweiter Kreditnehmer: Hausnummer fehlt.")
      if (!hasValue(applicant.address_zip)) errors.push("Zweiter Kreditnehmer: PLZ fehlt.")
      if (!hasValue(applicant.address_city)) errors.push("Zweiter Kreditnehmer: Ort fehlt.")
      if (!hasValue(applicant.housing_status)) errors.push("Zweiter Kreditnehmer: Wohnstatus fehlt.")
      if (!hasValue(applicant.residence_since)) errors.push("Zweiter Kreditnehmer: Wohnhaft seit fehlt.")
      if (!hasValue(applicant.household_persons)) errors.push("Zweiter Kreditnehmer: Haushaltsgröße fehlt.")
      if (coNeedsPreviousResidence) {
        if (!hasValue(applicant.previous_address_street)) errors.push("Zweiter Kreditnehmer: Voranschrift Straße fehlt.")
        if (!hasValue(applicant.previous_address_house_no)) errors.push("Zweiter Kreditnehmer: Voranschrift Hausnummer fehlt.")
        if (!hasValue(applicant.previous_address_zip)) errors.push("Zweiter Kreditnehmer: Voranschrift PLZ fehlt.")
        if (!hasValue(applicant.previous_address_city)) errors.push("Zweiter Kreditnehmer: Voranschrift Ort fehlt.")
        if (!hasValue(applicant.previous_address_since)) errors.push("Zweiter Kreditnehmer: Voranschrift Wohnhaft seit fehlt.")
      }
    }

    return errors
  }

  function liabilityValidation(row: LiabilityRow, index: number) {
    if (!liabilityHasData(row)) return [] as string[]

    const label = `${liabilityLabel(row.liability_type)} ${index + 1}`
    const errors: string[] = []
    if (!hasValue(row.creditor)) errors.push(`${label}: Gläubiger fehlt.`)
    if (hasCoApplicant && !hasValue(row.applicant_scope)) {
      errors.push(`${label}: Antragsteller-Zuordnung fehlt.`)
    }
    return errors
  }

  function realEstateValidation(row: RealEstateAssetRow, index: number) {
    if (!realEstateHasData(row)) return [] as string[]

    const label = `Immobilie ${index + 1}`
    const errors: string[] = []
    if (!hasValue(row.property_type)) errors.push(`${label}: Immobilienart fehlt.`)
    if (!hasValue(row.usage_type)) errors.push(`${label}: Nutzungsart fehlt.`)
    if (hasCoApplicant && !hasValue(row.applicant_scope)) errors.push(`${label}: Antragsteller-Zuordnung fehlt.`)

    const requiresRentalFields = row.usage_type === "vermietet" || row.usage_type === "beides"
    if (requiresRentalFields && !hasValue(row.rented_living_space_sqm)) {
      errors.push(`${label}: Vermietete Wohnfläche fehlt.`)
    }

    return errors
  }

  const finalMissing = (() => {
    const errors: string[] = []

    if (!hasValue(financing.purpose)) errors.push("Verwendungszweck fehlt.")
    if (!hasValue(financing.loan_amount_requested)) errors.push("Kreditsumme fehlt.")
    if (loanAmountValidationIssue) errors.push(loanAmountValidationIssue.message)
    if (!hasValue(financing.term_months)) errors.push("Laufzeit fehlt.")
    if (primaryEmailFormatIssue) errors.push(primaryEmailFormatIssue)
    if (primaryPhoneFormatIssue) errors.push(primaryPhoneFormatIssue)
    errors.push(...applicantValidation(primary, "Hauptantragsteller"))
    if (primaryBirthDateFormatIssue) errors.push(primaryBirthDateFormatIssue)
    if (primaryEmploymentValidationIssue) errors.push(primaryEmploymentValidationIssue.message)

    if (!hasValue(additional.birth_place)) errors.push("Geburtsort fehlt.")
    if (!hasValue(additional.address_since)) errors.push("Wohnhaft seit fehlt.")
    if (addressSinceFormatIssue) errors.push(addressSinceFormatIssue)
    if (needsPreviousResidence) {
      if (!hasValue(additional.previous_address_street)) errors.push("Voranschrift: Straße fehlt.")
      if (!hasValue(additional.previous_address_house_no)) errors.push("Voranschrift: Hausnummer fehlt.")
      if (!hasValue(additional.previous_address_zip)) errors.push("Voranschrift: PLZ fehlt.")
      if (!hasValue(additional.previous_address_city)) errors.push("Voranschrift: Ort fehlt.")
      if (!hasValue(additional.previous_address_since)) errors.push("Voranschrift: Wohnhaft seit fehlt.")
      if (previousAddressSinceFormatIssue) errors.push(previousAddressSinceFormatIssue)
    }
    if (!hasValue(additional.household_persons)) errors.push("Haushaltsgröße fehlt.")
    if (!additional.current_warm_rent_none && !hasValue(additional.current_warm_rent)) errors.push("Warmmiete fehlt.")
    if (!hasValue(additional.salary_payments_per_year)) errors.push("Anzahl Gehälter pro Jahr fehlt.")
    if (additional.probation && !hasValue(additional.probation_months)) errors.push("Probezeit in Monaten fehlt.")
    if (!hasValue(additional.id_document_number)) errors.push("Ausweisnummer fehlt.")
    if (!hasValue(additional.id_issued_place)) errors.push("Ausstellungsort fehlt.")
    if (!hasValue(additional.id_issued_at)) errors.push("Ausstellungsdatum fehlt.")
    if (!hasValue(additional.id_expires_at)) errors.push("Ablaufdatum des Ausweises fehlt.")
    if (issuedAtFormatIssue) errors.push(issuedAtFormatIssue)
    if (expiresAtFormatIssue) errors.push(expiresAtFormatIssue)
    if (additionalDateValidationIssue) errors.push(additionalDateValidationIssue.message)
    if (!hasValue(additional.bank_account_holder)) errors.push("Kontoinhaber fehlt.")
    if (!hasValue(additional.bank_iban)) errors.push("IBAN fehlt.")
    if (!hasValue(additional.bank_bic)) errors.push("BIC fehlt.")
    if (!hasValue(additional.returned_debit_window)) errors.push("Rücklastschriften fehlen.")

    if (additional.has_children) {
      if (!children.length) errors.push("Mindestens ein Kind muss erfasst werden.")
      children.forEach((child, index) => {
        if (!hasValue(child.name)) errors.push(`Kind ${index + 1}: Name fehlt.`)
        if (child.child_benefit === null || child.child_benefit === undefined) errors.push(`Kind ${index + 1}: Kindergeld fehlt.`)
        if (child.maintenance_income_present === null || child.maintenance_income_present === undefined) {
          errors.push(`Kind ${index + 1}: Unterhaltseinnahmen fehlen.`)
        }
        if (hasCoApplicant && !hasValue(child.applicant_scope)) {
          errors.push(`Kind ${index + 1}: Antragsteller-Zuordnung fehlt.`)
        }
      })
    }

    liabilities.forEach((row, index) => {
      errors.push(...liabilityValidation(row, index))
    })

    realEstateAssets.forEach((row, index) => {
      errors.push(...realEstateValidation(row, index))
    })

    if (hasCoApplicant) {
      errors.push(...coApplicantValidation(coApplicants[0] ?? createCoApplicant()))
      if (coBirthDateFormatIssue) errors.push(coBirthDateFormatIssue)
      if (coIssuedAtFormatIssue) errors.push(coIssuedAtFormatIssue)
      if (coExpiresAtFormatIssue) errors.push(coExpiresAtFormatIssue)
      if (coAdditionalDateValidationIssue) errors.push(coAdditionalDateValidationIssue.message)
      if (coApplicants[0]?.shared_household_with_primary === false && coResidenceSinceFormatIssue) {
        errors.push(coResidenceSinceFormatIssue)
      }
      if (coApplicants[0]?.shared_household_with_primary === false && coNeedsPreviousResidence && coPreviousAddressSinceFormatIssue) {
        errors.push(coPreviousAddressSinceFormatIssue)
      }
      if (coEmploymentValidationIssue) errors.push(coEmploymentValidationIssue.message)
    }

    return errors
  })()

  function validateStep(targetStep: StepId) {
    if (targetStep === "basis") {
      if (!hasValue(financing.purpose)) return "Bitte den Verwendungszweck auswählen."
      if (!hasValue(financing.loan_amount_requested)) return "Bitte die Kreditsumme angeben."
      if (loanAmountValidationIssue) return loanAmountValidationIssue.message
      if (!hasValue(financing.term_months)) return "Bitte die Laufzeit in Monaten angeben."
      if (!hasValue(primary.first_name) || !hasValue(primary.last_name)) return "Bitte Vor- und Nachname eintragen."
      if (primaryEmailFormatIssue) return primaryEmailFormatIssue
      if (primaryPhoneFormatIssue) return primaryPhoneFormatIssue
      return null
    }

    if (targetStep === "person") {
      if (!hasValue(primary.salutation)) return "Bitte die Anrede auswählen."
      if (!hasValue(primary.birth_date)) return "Bitte das Geburtsdatum eintragen."
      if (primaryBirthDateFormatIssue) return primaryBirthDateFormatIssue
      if (!hasValue(additional.birth_place)) return "Bitte den Geburtsort eintragen."
      if (!hasValue(primary.birth_country)) return "Bitte das Geburtsland auswählen."
      if (!hasValue(primary.nationality)) return "Bitte die Staatsangehörigkeit auswählen."
      if (!hasValue(primary.marital_status)) return "Bitte den Familienstand auswählen."
      return null
    }

    if (targetStep === "residence") {
      if (!hasValue(primary.address_street)) return "Bitte die Straße eintragen."
      if (!hasValue(primary.address_house_no)) return "Bitte die Hausnummer eintragen."
      if (!hasValue(primary.address_zip)) return "Bitte die PLZ eintragen."
      if (!hasValue(primary.address_city)) return "Bitte den Ort eintragen."
      if (!hasValue(primary.housing_status)) return "Bitte den Wohnstatus auswählen."
      if (!hasValue(additional.address_since)) return "Bitte angeben, seit wann du dort wohnst."
      if (addressSinceFormatIssue) return addressSinceFormatIssue
      if (needsPreviousResidence && !hasValue(additional.previous_address_street)) return "Bitte die Straße der Voranschrift eintragen."
      if (needsPreviousResidence && !hasValue(additional.previous_address_house_no)) return "Bitte die Hausnummer der Voranschrift eintragen."
      if (needsPreviousResidence && !hasValue(additional.previous_address_zip)) return "Bitte die PLZ der Voranschrift eintragen."
      if (needsPreviousResidence && !hasValue(additional.previous_address_city)) return "Bitte den Ort der Voranschrift eintragen."
      if (needsPreviousResidence && !hasValue(additional.previous_address_since)) return "Bitte angeben, seit wann du an der Voranschrift gewohnt hast."
      if (needsPreviousResidence && previousAddressSinceFormatIssue) return previousAddressSinceFormatIssue
      if (!hasValue(additional.household_persons)) return "Bitte die Haushaltsgröße eintragen."
      if (!additional.current_warm_rent_none && !hasValue(additional.current_warm_rent)) {
        return "Bitte die aktuelle Warmmiete angeben oder als nicht relevant markieren."
      }
      if (warmRentPlausibilityIssue) return warmRentPlausibilityIssue.message
      return null
    }

    if (targetStep === "employment") {
      if (!hasValue(primary.employment_type)) return "Bitte das Beschäftigungsverhältnis auswählen."
      if (!hasValue(primary.employment_status)) return "Bitte den Anstellungsstatus auswählen."
      if (!hasValue(primary.employment_job_title)) return "Bitte die Berufsbezeichnung eintragen."
      if (!hasValue(primary.employment_since)) return "Bitte angeben, seit wann du dort beschäftigt bist."
      if (primaryEmploymentValidationIssue) return primaryEmploymentValidationIssue.message
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_name)) return "Bitte den Arbeitgeber eintragen."
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_industry)) return "Bitte die Branche des Arbeitgebers auswählen."
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_address_street)) return "Bitte die Arbeitgeber-Straße eintragen."
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_address_zip)) return "Bitte die Arbeitgeber-PLZ eintragen."
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_address_city)) return "Bitte den Arbeitgeber-Ort eintragen."
      if (requiresEmployerCoreFields(primary) && !hasValue(primary.employer_address_country)) return "Bitte das Arbeitgeber-Land auswählen."
      if (!hasValue(primary.net_income_monthly)) return "Bitte das Nettoeinkommen eintragen."
      if (primaryNetIncomePlausibilityIssue) return primaryNetIncomePlausibilityIssue.message
      if (!hasValue(additional.salary_payments_per_year)) return "Bitte die Anzahl Gehälter pro Jahr auswählen."
      if (additional.probation && !hasValue(additional.probation_months)) return "Bitte die Probezeit in Monaten eintragen."
      return null
    }

    if (targetStep === "details") {
      if (!hasValue(additional.id_document_number)) return "Bitte die Ausweisnummer eintragen."
      if (!hasValue(additional.id_issued_place)) return "Bitte den Ausstellungsort eintragen."
      if (!hasValue(additional.id_issued_at)) return "Bitte das Ausstellungsdatum eintragen."
      if (issuedAtFormatIssue) return issuedAtFormatIssue
      if (!hasValue(additional.id_expires_at)) return "Bitte das Ablaufdatum eintragen."
      if (expiresAtFormatIssue) return expiresAtFormatIssue
      if (additionalDateValidationIssue) return additionalDateValidationIssue.message
      if (!hasValue(additional.bank_account_holder)) return "Bitte den Kontoinhaber eintragen."
      if (!hasValue(additional.bank_iban)) return "Bitte die IBAN eintragen."
      if (!hasValue(additional.bank_bic)) return "Bitte die BIC eintragen."
      if (!hasValue(additional.returned_debit_window)) return "Bitte die Frage zu Rücklastschriften beantworten."
      if (additional.has_children) {
        if (!children.length) return "Bitte mindestens ein Kind erfassen."
        const missingChild = children.find(
          (child) =>
            !hasValue(child.name) ||
            child.child_benefit === null ||
            child.child_benefit === undefined ||
            child.maintenance_income_present === null ||
            child.maintenance_income_present === undefined ||
            (hasCoApplicant && !hasValue(child.applicant_scope))
        )
        if (missingChild) return "Bitte alle Kinderdaten vervollständigen."
      }
      const liabilityError = liabilities
        .flatMap((row, index) => liabilityValidation(row, index))
        .find(Boolean)
      if (liabilityError) return liabilityError
      const realEstateError = realEstateAssets
        .flatMap((row, index) => realEstateValidation(row, index))
        .find(Boolean)
      if (realEstateError) return realEstateError
      return null
    }

    if (targetStep === "co" && hasCoApplicant) {
      if (!hasValue(coApplicants[0]?.birth_date)) return "Bitte das Geburtsdatum des zweiten Kreditnehmers eintragen."
      if (coBirthDateFormatIssue) return coBirthDateFormatIssue
      if (!hasValue(coApplicants[0]?.birth_place)) return "Bitte den Geburtsort des zweiten Kreditnehmers eintragen."
      if (!hasValue(coApplicants[0]?.id_document_number)) return "Bitte die Ausweisnummer des zweiten Kreditnehmers eintragen."
      if (!hasValue(coApplicants[0]?.id_issued_place)) return "Bitte den Ausstellungsort des zweiten Kreditnehmers eintragen."
      if (!hasValue(coApplicants[0]?.id_issued_at)) return "Bitte das Ausstellungsdatum des zweiten Kreditnehmers eintragen."
      if (coIssuedAtFormatIssue) return coIssuedAtFormatIssue
      if (!hasValue(coApplicants[0]?.id_expires_at)) return "Bitte das Ablaufdatum des Ausweises des zweiten Kreditnehmers eintragen."
      if (coExpiresAtFormatIssue) return coExpiresAtFormatIssue
      if (coAdditionalDateValidationIssue) return coAdditionalDateValidationIssue.message
      if (coApplicants[0]?.shared_household_with_primary === false && !hasValue(coApplicants[0]?.residence_since)) {
        return "Bitte angeben, seit wann der zweite Kreditnehmer dort wohnt."
      }
      if (coApplicants[0]?.shared_household_with_primary === false && coResidenceSinceFormatIssue) {
        return coResidenceSinceFormatIssue
      }
      if (coApplicants[0]?.shared_household_with_primary === false && coNeedsPreviousResidence && !hasValue(coApplicants[0]?.previous_address_since)) {
        return "Bitte angeben, seit wann der zweite Kreditnehmer an der Voranschrift gewohnt hat."
      }
      if (coApplicants[0]?.shared_household_with_primary === false && coNeedsPreviousResidence && coPreviousAddressSinceFormatIssue) {
        return coPreviousAddressSinceFormatIssue
      }
      if (coEmploymentValidationIssue) return coEmploymentValidationIssue.message
      if (coNetIncomePlausibilityIssue) return coNetIncomePlausibilityIssue.message
      return coApplicantValidation(coApplicants[0] ?? createCoApplicant())[0] ?? null
    }

    if (targetStep === "review" && finalMissing.length) {
      return finalMissing[0]
    }

    return null
  }

  function getStepStatus(targetStep: StepId, index: number) {
    const hasError = Boolean(validateStep(targetStep)) || serverValidationIssue?.step === targetStep
    if (targetStep === step) return hasError ? "active_missing" : "active"
    if (index < stepIndex) return hasError ? "missing" : "done"
    return "pending"
  }

  function validateCurrentStep() {
    return validateStep(step)
  }

  function scrollWizardIntoView(behavior: ScrollBehavior = "smooth") {
    if (typeof window === "undefined") return
    window.requestAnimationFrame(() => {
      const element = wizardRef.current
      if (!element) {
        window.scrollTo({ top: 0, behavior })
        return
      }
      const top = window.scrollY + element.getBoundingClientRect().top - 24
      window.scrollTo({ top: Math.max(0, top), behavior })
    })
  }

  async function createCaseFromDraft() {
    const response = await fetch("/api/privatkredit/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestType: "contact",
        firstName: trimOrEmpty(primary.first_name),
        lastName: trimOrEmpty(primary.last_name),
        email: trimOrEmpty(primary.email).toLowerCase(),
        phone: trimOrEmpty(primary.phone),
        loanAmount: financing.loan_amount_requested,
        termMonths: financing.term_months,
        purpose: financing.purpose,
        pagePath: "/onlinekredit",
        deferCustomerInvite: true,
        requirePublicCaseAccess: true,
      }),
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      throw new Error(String(json?.error ?? "Onlinekredit-Fall konnte nicht angelegt werden."))
    }

    const nextCaseId = trimOrEmpty(json?.linkedCaseId)
    const nextCaseRef = trimOrEmpty(json?.linkedCaseRef)
    const nextAccessToken = trimOrEmpty(json?.publicAccessToken)
    if (!nextCaseId || !nextCaseRef || !nextAccessToken) {
      throw new Error("Der Privatkredit-Fall wurde angelegt, aber der öffentliche Zugriff fehlt.")
    }

    return {
      caseId: nextCaseId,
      caseRef: nextCaseRef,
      accessToken: nextAccessToken,
      existingAccount: Boolean(json?.existingAccount),
    }
  }

  async function save(options?: { showMessage?: boolean; triggerEuropaceSync?: boolean }): Promise<SaveResult | null> {
    const showMessage = options?.showMessage ?? true
    const triggerEuropaceSync = options?.triggerEuropaceSync ?? false
    setSaving(true)
    setError(null)
    setServerValidationIssue(null)
    lastSaveValidationIssueRef.current = null
    if (showMessage) setMessage(null)

    try {
      const resolved = existingCase
        ? {
            caseId: String(activeCaseId),
            caseRef: String(activeCaseRef),
            accessToken: String(activeAccessToken),
            existingAccount: activeExistingAccount,
          }
        : await createCaseFromDraft()

      const response = await fetch("/api/live/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: resolved.caseId,
          caseRef: resolved.caseRef,
          access: resolved.accessToken,
          primary,
          baufi: {
            purpose: financing.purpose,
            loan_amount_requested: financing.loan_amount_requested,
            term_months: financing.term_months,
          },
          triggerEuropaceSync,
          additional,
          co: hasCoApplicant ? coApplicants : [],
          children: additional.has_children ? children : [],
          liabilities,
          realEstateAssets,
        }),
      })

      const json = (await response.json().catch(() => ({}))) as SaveResponse
      if (!response.ok || !json?.ok) {
        const validationIssue = mapOnlinekreditSaveValidationIssue({
          stage: json?.stage,
          message: json?.message,
          validation: json?.validation,
        })
        if (validationIssue) {
          lastSaveValidationIssueRef.current = validationIssue
          setServerValidationIssue(validationIssue)
          throw new Error(validationIssue.message)
        }

        const detail = [json?.error, json?.stage, json?.message]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .join(": ")
        throw new Error(detail || "Speichern fehlgeschlagen.")
      }

      if (showMessage) {
        const sync = json.europaceSync
        if (Array.isArray(json?.warnings) && json.warnings.includes("term_months_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Die Laufzeit-Spalte fehlt aktuell noch in der Datenbank und muss per SQL-Migration nachgezogen werden.")
        } else if (Array.isArray(json?.warnings) && json.warnings.includes("case_applicants_columns_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Erweiterte Privatkredit-Felder fehlen noch in der Datenbank und muessen per SQL-Migration nachgezogen werden.")
        } else if (Array.isArray(json?.warnings) && json.warnings.includes("case_additional_details_columns_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Erweiterte Wohn-/Voranschrift-Felder fehlen noch in der Datenbank und muessen per SQL-Migration nachgezogen werden.")
        } else if (Array.isArray(json?.warnings) && json.warnings.includes("case_children_columns_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Erweiterte Kinder-Felder fehlen noch in der Datenbank und muessen per SQL-Migration nachgezogen werden.")
        } else if (Array.isArray(json?.warnings) && json.warnings.includes("case_liabilities_table_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Die Verbindlichkeiten-Tabelle fehlt noch in der Datenbank und muss per SQL-Migration nachgezogen werden.")
        } else if (Array.isArray(json?.warnings) && json.warnings.includes("case_liabilities_columns_missing_in_db")) {
          setMessage("Daten gespeichert. Hinweis: Erweiterte Verbindlichkeiten-Felder fehlen noch in der Datenbank und muessen per SQL-Migration nachgezogen werden.")
        } else if (
          Array.isArray(json?.warnings) &&
          (json.warnings.includes("case_real_estate_assets_table_missing_in_db") ||
            json.warnings.includes("case_real_estate_loans_table_missing_in_db"))
        ) {
          setMessage("Daten gespeichert. Hinweis: Die Immobilien-Tabellen fehlen noch in der Datenbank und muessen per SQL-Migration nachgezogen werden.")
        } else if (sync?.attempted && sync?.ok) {
          setMessage("Daten gespeichert und dein Antrag wurde direkt aktualisiert.")
        } else if (sync?.attempted && sync?.error) {
          setMessage(`Daten gespeichert. Im Hintergrund gibt es noch einen Hinweis: ${customerText(sync.error)}`)
        } else {
          setMessage("Daten gespeichert.")
        }
      }

      setServerValidationIssue(null)
      lastSaveValidationIssueRef.current = null
      setPublicCase(resolved)

      if (
        resolved.caseId !== routeCaseId ||
        resolved.caseRef !== routeCaseRef ||
        resolved.accessToken !== routeAccessToken ||
        resolved.existingAccount !== existingAccount
      ) {
        const params = new URLSearchParams(window.location.search)
        params.set("caseId", resolved.caseId)
        params.set("caseRef", resolved.caseRef)
        params.set("access", resolved.accessToken)
        if (resolved.existingAccount) params.set("existing", "1")
        else params.delete("existing")
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
      }

      return {
        ...resolved,
        warnings: Array.isArray(json?.warnings) ? json.warnings : [],
      }
    } catch (saveError) {
      const nextError = saveError instanceof Error ? customerText(saveError.message) : ""
      setError(nextError || "Speichern fehlgeschlagen.")
      return null
    } finally {
      setSaving(false)
    }
  }

  async function goNext() {
    const validationError = validateCurrentStep()
    if (validationError) {
      setError(validationError)
      return
    }

    if (existingCase) {
      const resolved = await save({ showMessage: false, triggerEuropaceSync: false })
      if (!resolved && !lastSaveValidationIssueRef.current) return
    }

    const next = steps[Math.min(stepIndex + 1, steps.length - 1)]?.id
    if (next) {
      if (!lastSaveValidationIssueRef.current) setError(null)
      setStep(next)
      scrollWizardIntoView()
    }
  }

  async function goPrev() {
    const previous = steps[Math.max(stepIndex - 1, 0)]?.id
    if (!previous) return
    setError(null)
    setStep(previous)
    scrollWizardIntoView()
  }

  async function jumpTo(target: StepId) {
    if (target === step) return
    if (existingCase) {
      const resolved = await save({ showMessage: false, triggerEuropaceSync: false })
      if (!resolved && !lastSaveValidationIssueRef.current) return
    }
    if (!lastSaveValidationIssueRef.current) setError(null)
    setStep(target)
    scrollWizardIntoView()
  }

  async function finishAndScrollToOffers() {
    const validationError = validateCurrentStep()
    if (validationError) {
      setError(validationError)
      return
    }

    setOffersTransitionOverlayOpen(true)
    const resolved = await save({ showMessage: false, triggerEuropaceSync: false })
    if (!resolved) {
      setOffersTransitionOverlayOpen(false)
      return
    }
    if (resolved.warnings.includes("term_months_missing_in_db")) {
      setOffersTransitionOverlayOpen(false)
      setError("Die Laufzeit konnte lokal noch nicht gespeichert werden, weil die Datenbank-Spalte `term_months` fehlt. Bitte zuerst die SQL-Migration ausfuehren.")
      return
    }
    if (resolved.warnings.includes("case_applicants_columns_missing_in_db")) {
      setOffersTransitionOverlayOpen(false)
      setError("Erweiterte Privatkredit-Felder konnten lokal noch nicht vollständig gespeichert werden, weil die neuen Applicant-Spalten in der Datenbank fehlen. Bitte zuerst die neue SQL-Migration ausfuehren.")
      return
    }
    if (resolved.warnings.includes("case_children_columns_missing_in_db")) {
      setOffersTransitionOverlayOpen(false)
      setError("Die Kinderdaten konnten lokal noch nicht vollständig gespeichert werden, weil neue Kinder-Spalten in der Datenbank fehlen. Bitte zuerst die neue SQL-Migration ausfuehren.")
      return
    }
    if (
      (resolved.warnings.includes("case_liabilities_table_missing_in_db") ||
        resolved.warnings.includes("case_liabilities_columns_missing_in_db")) &&
      liabilities.some((row) => liabilityHasData(row))
    ) {
      setOffersTransitionOverlayOpen(false)
      setError("Die Verbindlichkeiten konnten lokal noch nicht vollständig gespeichert werden, weil die neue Datenbank-Migration fehlt. Bitte zuerst die neue SQL-Migration ausfuehren.")
      return
    }
    if (
      (resolved.warnings.includes("case_real_estate_assets_table_missing_in_db") ||
        resolved.warnings.includes("case_real_estate_loans_table_missing_in_db")) &&
      realEstateAssets.some((row) => realEstateHasData(row))
    ) {
      setOffersTransitionOverlayOpen(false)
      setError("Das Immobilienvermoegen konnte lokal noch nicht vollständig gespeichert werden, weil die neue Datenbank-Migration fehlt. Bitte zuerst die neue SQL-Migration ausfuehren.")
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch("/api/onlinekredit/europace/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: resolved.caseId,
          caseRef: resolved.caseRef,
          access: resolved.accessToken,
          existing: resolved.existingAccount ? "1" : "",
        }),
      })

      const json = (await response.json().catch(() => ({}))) as OffersValidationResponse
      if (!response.ok || !json?.ok) {
        throw new Error(customerText(json?.error) || "Live-Angebote konnten nicht geladen werden.")
      }

      const nextOffers = Array.isArray(json?.offers) ? json.offers : []
      const hasSelectableOffers = nextOffers.some((offer) => isFinalSelectableOffer(offer))
      const offerValidationIssue = !hasSelectableOffers ? extractEuropaceOfferValidationIssue(nextOffers) : null

      if (offerValidationIssue) {
        setOffersTransitionOverlayOpen(false)
        setServerValidationIssue(offerValidationIssue)
        setError(customerText(offerValidationIssue.message))
        setStep(offerValidationIssue.step)
        scrollWizardIntoView()
        return
      }
    } catch (nextError) {
      setOffersTransitionOverlayOpen(false)
      setError(nextError instanceof Error ? customerText(nextError.message) : "Live-Angebote konnten nicht geladen werden.")
      return
    } finally {
      setSaving(false)
    }

    const params = new URLSearchParams({
      caseId: resolved.caseId,
      caseRef: resolved.caseRef,
      access: resolved.accessToken,
      prefetched: "1",
    })
    if (resolved.existingAccount) params.set("existing", "1")
    router.push(`/onlinekredit/angebote?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="text-sm text-slate-600">Onlinekredit-Antrag wird geladen...</div>
      </div>
    )
  }

  if (!customerCanEdit) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Bearbeitung ist in dieser Phase gesperrt</h2>
        <p className="mt-2 text-sm text-slate-600">
          Dieser Vorgang ist bereits in einer weiterführenden Angebots- oder Antragsphase. Bitte nutze jetzt den
          Angebots- und Abschlussbereich des Onlinekredit-Prozesses.
        </p>
      </div>
    )
  }

  const coApplicant = coApplicants[0] ?? createCoApplicant()

  return (
    <div ref={wizardRef} className="relative overflow-hidden rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] shadow-[0_28px_80px_-44px_rgba(15,23,42,0.35)] sm:rounded-[2rem]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 top-1/3 h-48 w-48 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">SEPANA Onlinekredit</div>
            <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Schritt {Math.max(stepIndex, 0) + 1} von {steps.length}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950 sm:text-xl">{currentStep.title}</div>
            <div className="mt-1 text-sm text-slate-600">{currentStep.subtitle}</div>
            <div className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
              Deine Angaben werden beim Wechsel automatisch gespeichert.
            </div>
          </div>
          <div className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm sm:w-auto sm:text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Fortschritt</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{progress}%</div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#0369a1,#059669)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {steps.map((entry, index) => (
            <StepChip
              key={entry.id}
              index={index}
              title={entry.title}
              subtitle={entry.subtitle}
              status={getStepStatus(entry.id, index)}
              onClick={() => void jumpTo(entry.id)}
            />
          ))}
        </div>
      </div>

      <div className="relative px-4 py-5 sm:px-6 sm:py-6">
        {error && !shouldHideGlobalErrorBannerForCurrentStep ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div>{error}</div>
                {serverIssueJumpTitle ? <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-rose-500">Betroffener Bereich: {serverIssueJumpTitle}</div> : null}
              </div>
              {serverIssueJumpStep ? (
                <button
                  type="button"
                  onClick={() => void jumpTo(serverIssueJumpStep)}
                  className="inline-flex w-full items-center justify-center rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 sm:w-auto"
                >
                  Zum betroffenen Bereich
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {message ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        {step === "basis" ? (
          <div className="space-y-4">
            <Card title="Kreditwunsch" subtitle="Diese Angaben braucht SEPANA für deine passende Kreditanfrage." errorMessages={creditRequestCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Verwendungszweck" required info={FIELD_INFO.purpose}>
                  <Select value={trimOrEmpty(financing.purpose)} onChange={(event) => updateFinancing("purpose", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {PURPOSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kreditsumme" required info={FIELD_INFO.loanAmount} error={loanAmountFieldError}>
                  <MoneyInput
                    value={toMoneyInput(financing.loan_amount_requested)}
                    onChange={(value) => {
                      markFieldInteracted("financing.loan_amount_requested")
                      updateFinancing("loan_amount_requested", value)
                    }}
                    placeholder={`ab ${ONLINEKREDIT_MIN_LOAN_AMOUNT.toLocaleString("de-DE")}`}
                    className={hasLoanAmountFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasLoanAmountFieldError}
                  />
                </Field>
                <Field label="Laufzeit in Monaten" required info={FIELD_INFO.termMonths}>
                  <Select value={trimOrEmpty(financing.term_months)} onChange={(event) => updateFinancing("term_months", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {TERM_MONTH_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option} Monate
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card title="Hauptantragsteller" subtitle="Kontakt und Einladungsadresse für deinen weiteren SEPANA-Prozess." errorMessages={contactCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vorname" required info={FIELD_INFO.firstName}>
                  <Input value={stringOrEmpty(primary.first_name)} onChange={(event) => updatePrimary("first_name", event.target.value)} />
                </Field>
                <Field label="Nachname" required info={FIELD_INFO.lastName}>
                  <Input value={stringOrEmpty(primary.last_name)} onChange={(event) => updatePrimary("last_name", event.target.value)} />
                </Field>
                <Field label="E-Mail" required info={FIELD_INFO.email} error={primaryEmailFieldError}>
                  <Input
                    type="email"
                    value={stringOrEmpty(primary.email)}
                    onChange={(event) => updatePrimary("email", event.target.value)}
                    onBlur={() => markFieldInteracted("primary.email")}
                    autoComplete="email"
                    className={primaryEmailFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={Boolean(primaryEmailFieldError)}
                  />
                </Field>
                <Field label="Telefon" required info={FIELD_INFO.phone} error={primaryPhoneFieldError}>
                  <Input
                    type="tel"
                    value={stringOrEmpty(primary.phone)}
                    onChange={(event) => updatePrimary("phone", event.target.value)}
                    onBlur={() => markFieldInteracted("primary.phone")}
                    autoComplete="tel"
                    className={hasPhoneFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasPhoneFieldError}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Antragskonstellation">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={disableCoApplicant}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    !hasCoApplicant ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  <div className="text-sm font-semibold">Ein Kreditnehmer</div>
                  <div className={cn("mt-1 text-xs", !hasCoApplicant ? "text-slate-200" : "text-slate-500")}>
                    Der Antrag läuft nur auf den Hauptantragsteller.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={ensureCoApplicant}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    hasCoApplicant ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  <div className="text-sm font-semibold">Zwei Kreditnehmer</div>
                  <div className={cn("mt-1 text-xs", hasCoApplicant ? "text-slate-200" : "text-slate-500")}>
                    Die Daten des zweiten Kreditnehmers folgen in einem separaten Schritt.
                  </div>
                </button>
              </div>
            </Card>
          </div>
        ) : null}

        {step === "person" ? (
          <Card title="Persönliche Daten des Hauptantragstellers" errorMessages={personCardErrors}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Anrede" required info={FIELD_INFO.salutation}>
                <Select value={trimOrEmpty(primary.salutation)} onChange={(event) => updatePrimary("salutation", event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {SALUTATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Titel" hint="optional" info={FIELD_INFO.title}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TITLE_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      checked={stringArray(primary.title).includes(option.value)}
                      onChange={(checked) => togglePrimaryTitle(option.value, checked)}
                      label={option.label}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Geburtsdatum" required info={FIELD_INFO.birthDate} error={primaryBirthDateFieldError}>
                <Input
                  type="date"
                  value={toDateInput(primary.birth_date)}
                  onChange={(event) => updatePrimary("birth_date", event.target.value)}
                  onBlur={() => markFieldInteracted("primary.birth_date")}
                  className={hasBirthDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                  aria-invalid={hasBirthDateFieldError}
                />
              </Field>
              <Field label="Geburtsort" required info={FIELD_INFO.birthPlace}>
                <Input value={stringOrEmpty(additional.birth_place)} onChange={(event) => updateAdditional("birth_place", event.target.value)} />
              </Field>
              <Field label="Geburtsland" required info={FIELD_INFO.birthCountry}>
                <Select value={trimOrEmpty(primary.birth_country)} onChange={(event) => updatePrimary("birth_country", event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Staatsangehörigkeit" required info={FIELD_INFO.nationality}>
                <Select value={trimOrEmpty(primary.nationality)} onChange={(event) => updatePrimary("nationality", event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Familienstand" required info={FIELD_INFO.maritalStatus}>
                <Select value={trimOrEmpty(primary.marital_status)} onChange={(event) => updatePrimary("marital_status", event.target.value)}>
                  <option value="">Bitte wählen</option>
                  {MARITAL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                    ))}
                  </Select>
              </Field>
              <Field label="Geburtsname" hint="optional">
                <Input value={stringOrEmpty(primary.birth_name)} onChange={(event) => updatePrimary("birth_name", event.target.value)} />
              </Field>
              <Field label="Telefon geschäftlich" hint="optional">
                <Input value={stringOrEmpty(primary.phone_business)} onChange={(event) => updatePrimary("phone_business", event.target.value)} />
              </Field>
              <Field label="Steuer-ID" hint="optional" info={FIELD_INFO.taxId}>
                <Input value={stringOrEmpty(primary.tax_id)} onChange={(event) => updatePrimary("tax_id", event.target.value)} />
              </Field>
            </div>
          </Card>
        ) : null}

        {step === "residence" ? (
          <div className="space-y-4">
            <Card title="Adresse & Wohnsituation" errorMessages={residenceCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Straße" required info={FIELD_INFO.street}>
                  <Input value={stringOrEmpty(primary.address_street)} onChange={(event) => updatePrimary("address_street", event.target.value)} />
                </Field>
                <Field label="Hausnummer" required info={FIELD_INFO.houseNo}>
                  <Input value={stringOrEmpty(primary.address_house_no)} onChange={(event) => updatePrimary("address_house_no", event.target.value)} />
                </Field>
                <Field label="PLZ" required info={FIELD_INFO.zip}>
                  <Input value={stringOrEmpty(primary.address_zip)} onChange={(event) => updatePrimary("address_zip", event.target.value)} />
                </Field>
                <Field label="Ort" required info={FIELD_INFO.city}>
                  <Input value={stringOrEmpty(primary.address_city)} onChange={(event) => updatePrimary("address_city", event.target.value)} />
                </Field>
                <Field label="Wohnstatus" required info={FIELD_INFO.housingStatus}>
                  <Select value={trimOrEmpty(primary.housing_status)} onChange={(event) => updatePrimary("housing_status", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {HOUSING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Wohnhaft seit" required info={FIELD_INFO.addressSince} error={addressSinceFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(additional.address_since)}
                    onChange={(event) => updateAdditional("address_since", event.target.value)}
                    onBlur={() => markFieldInteracted("additional.address_since")}
                    className={hasAddressSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasAddressSinceFieldError}
                  />
                </Field>
                <Field label="Haushaltsgröße" required info={FIELD_INFO.householdPersons}>
                  <Input value={stringOrEmpty(additional.household_persons)} onChange={(event) => updateAdditional("household_persons", event.target.value)} />
                </Field>
              </div>
            </Card>

            {needsPreviousResidence ? (
              <Card title="Voranschrift" subtitle="Wenn du noch keine 3 Jahre an der aktuellen Adresse wohnst, braucht SEPANA zusätzlich deine vorherige Anschrift." errorMessages={previousResidenceCardErrors}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Straße" required info={FIELD_INFO.street}>
                    <Input value={stringOrEmpty(additional.previous_address_street)} onChange={(event) => updateAdditional("previous_address_street", event.target.value)} />
                  </Field>
                  <Field label="Hausnummer" required info={FIELD_INFO.houseNo}>
                    <Input value={stringOrEmpty(additional.previous_address_house_no)} onChange={(event) => updateAdditional("previous_address_house_no", event.target.value)} />
                  </Field>
                  <Field label="PLZ" required info={FIELD_INFO.zip}>
                    <Input value={stringOrEmpty(additional.previous_address_zip)} onChange={(event) => updateAdditional("previous_address_zip", event.target.value)} />
                  </Field>
                  <Field label="Ort" required info={FIELD_INFO.city}>
                    <Input value={stringOrEmpty(additional.previous_address_city)} onChange={(event) => updateAdditional("previous_address_city", event.target.value)} />
                  </Field>
                  <Field label="Wohnhaft seit" required info={FIELD_INFO.addressSince} error={previousAddressSinceFieldError}>
                    <Input
                      type="date"
                      value={toDateInput(additional.previous_address_since)}
                      onChange={(event) => updateAdditional("previous_address_since", event.target.value)}
                      onBlur={() => markFieldInteracted("additional.previous_address_since")}
                      className={hasPreviousAddressSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                      aria-invalid={hasPreviousAddressSinceFieldError}
                    />
                  </Field>
                </div>
              </Card>
            ) : null}

            <Card title="Wohnkosten & Fahrzeuge">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Aktuelle Warmmiete"
                  required={!additional.current_warm_rent_none}
                  info={FIELD_INFO.warmRent}
                  error={currentWarmRentFieldError}
                >
                  <MoneyInput
                    value={toMoneyInput(additional.current_warm_rent)}
                    onChange={(value) => {
                      markFieldInteracted("additional.current_warm_rent")
                      updateAdditional("current_warm_rent", value)
                    }}
                    placeholder="z. B. 1.050"
                    disabled={Boolean(additional.current_warm_rent_none)}
                    className={hasCurrentWarmRentFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasCurrentWarmRentFieldError}
                  />
                </Field>
                <Field label="Warmmiete nicht relevant">
                  <Checkbox checked={Boolean(additional.current_warm_rent_none)} onChange={(checked) => updateAdditional("current_warm_rent_none", checked)} label="Keine laufende Warmmiete" />
                </Field>
                <Field label="Anzahl KFZ" hint="optional" info={FIELD_INFO.vehicleCount}>
                  <Input value={stringOrEmpty(additional.vehicle_count)} onChange={(event) => updateAdditional("vehicle_count", event.target.value)} />
                </Field>
                <Field label="KFZ-Kosten / Monat" hint="optional" info={FIELD_INFO.vehicleCostTotal}>
                  <MoneyInput
                    value={toMoneyInput(additional.vehicle_cost_total)}
                    onChange={(value) => updateAdditional("vehicle_cost_total", value)}
                    placeholder="z. B. 250"
                  />
                </Field>
              </div>
            </Card>
          </div>
        ) : null}

        {step === "employment" ? (
          <div className="space-y-4">
            <Card title="Beruf" errorMessages={employmentCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Beschäftigungsverhältnis" required info={FIELD_INFO.employmentType}>
                  <Select value={trimOrEmpty(primary.employment_type)} onChange={(event) => updatePrimary("employment_type", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Anstellungsstatus" required info={FIELD_INFO.employmentStatus}>
                  <Select value={trimOrEmpty(primary.employment_status)} onChange={(event) => updatePrimary("employment_status", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Berufsbezeichnung" required info={FIELD_INFO.jobTitle}>
                  <Input value={stringOrEmpty(primary.employment_job_title)} onChange={(event) => updatePrimary("employment_job_title", event.target.value)} />
                </Field>
                <Field label="Beschäftigt seit" required info={FIELD_INFO.employmentSince} error={primaryEmploymentSinceFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(primary.employment_since)}
                    onChange={(event) => updatePrimary("employment_since", event.target.value)}
                    onBlur={() => markFieldInteracted("primary.employment_since")}
                    className={hasEmploymentSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasEmploymentSinceFieldError}
                  />
                </Field>
                <Field label="Arbeitgeber" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerName}>
                  <Input value={stringOrEmpty(primary.employer_name)} onChange={(event) => updatePrimary("employer_name", event.target.value)} />
                </Field>
                <Field label="Branche" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerIndustry}>
                  <Select value={trimOrEmpty(primary.employer_industry)} onChange={(event) => updatePrimary("employer_industry", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYER_INDUSTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Anzahl Gehälter / Jahr" required>
                  <Select value={trimOrEmpty(additional.salary_payments_per_year)} onChange={(event) => updateAdditional("salary_payments_per_year", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {SALARY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Probezeit aktiv">
                  <Checkbox checked={Boolean(additional.probation)} onChange={(checked) => updateAdditional("probation", checked)} label="Ja, aktuell in Probezeit" />
                </Field>
                <Field label="Probezeit (Monate)" required={Boolean(additional.probation)}>
                  <Input value={stringOrEmpty(additional.probation_months)} onChange={(event) => updateAdditional("probation_months", event.target.value)} disabled={!additional.probation} />
                </Field>
              </div>
            </Card>

            <Card title="Arbeitgeberdetails" subtitle="Diese Angaben helfen SEPANA bei einer vollständigen Prüfung.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Straße" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerStreet}>
                  <Input value={stringOrEmpty(primary.employer_address_street)} onChange={(event) => updatePrimary("employer_address_street", event.target.value)} />
                </Field>
                <Field label="Hausnummer" hint="optional">
                  <Input value={stringOrEmpty(primary.employer_address_house_no)} onChange={(event) => updatePrimary("employer_address_house_no", event.target.value)} />
                </Field>
                <Field label="PLZ" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerZip}>
                  <Input value={stringOrEmpty(primary.employer_address_zip)} onChange={(event) => updatePrimary("employer_address_zip", event.target.value)} />
                </Field>
                <Field label="Ort" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerCity}>
                  <Input value={stringOrEmpty(primary.employer_address_city)} onChange={(event) => updatePrimary("employer_address_city", event.target.value)} />
                </Field>
                <Field label="Land" required={requiresEmployerCoreFields(primary)} info={FIELD_INFO.employerCountry}>
                  <Select value={trimOrEmpty(primary.employer_address_country)} onChange={(event) => updatePrimary("employer_address_country", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card title="Einkommen & Verpflichtungen">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nettoeinkommen / Monat" required info={FIELD_INFO.netIncome} error={primaryNetIncomeFieldError}>
                  <MoneyInput
                    value={toMoneyInput(primary.net_income_monthly)}
                    onChange={(value) => {
                      markFieldInteracted("primary.net_income_monthly")
                      updatePrimary("net_income_monthly", value)
                    }}
                    placeholder="Niedrigstes Netto aus den letzten 3 Monaten"
                    className={hasPrimaryNetIncomeFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasPrimaryNetIncomeFieldError}
                  />
                </Field>
                <Field label="Weitere Einnahmen / Monat" hint="optional" info={FIELD_INFO.otherIncome}>
                  <MoneyInput value={toMoneyInput(primary.other_income_monthly)} onChange={(value) => updatePrimary("other_income_monthly", value)} placeholder="z. B. 300" />
                </Field>
                <Field label="Fixkosten gesamt / Monat" hint="optional" info={FIELD_INFO.expensesMonthly}>
                  <MoneyInput value={toMoneyInput(primary.expenses_monthly)} onChange={(value) => updatePrimary("expenses_monthly", value)} placeholder="optional, z. B. 1.200" />
                </Field>
                <Field label="Bestehende Kreditraten / Monat" hint="optional" info={FIELD_INFO.existingLoansMonthly}>
                  <MoneyInput value={toMoneyInput(primary.existing_loans_monthly)} onChange={(value) => updatePrimary("existing_loans_monthly", value)} placeholder="optional, z. B. 150" />
                </Field>
                <Field label="Unterhalt / Zuschuesse" hint="optional">
                  <MoneyInput value={toMoneyInput(additional.maintenance_income_monthly)} onChange={(value) => updateAdditional("maintenance_income_monthly", value)} placeholder="z. B. 250" />
                </Field>
              </div>
            </Card>
          </div>
        ) : null}

        {step === "details" ? (
          <div className="space-y-4">
            <Card title="Legitimation" errorMessages={legitimationCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ausweisnummer" required info={FIELD_INFO.idNumber}>
                  <Input value={stringOrEmpty(additional.id_document_number)} onChange={(event) => updateAdditional("id_document_number", event.target.value)} />
                </Field>
                <Field label="Ausstellungsort" required info={FIELD_INFO.idIssuedPlace}>
                  <Input value={stringOrEmpty(additional.id_issued_place)} onChange={(event) => updateAdditional("id_issued_place", event.target.value)} />
                </Field>
                <Field label="Ausgestellt am" required info={FIELD_INFO.idIssuedAt} error={issuedAtFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(additional.id_issued_at)}
                    onChange={(event) => updateAdditional("id_issued_at", event.target.value)}
                    onBlur={() => markFieldInteracted("additional.id_issued_at")}
                    className={hasLegitimationDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasLegitimationDateFieldError}
                  />
                </Field>
                <Field label="Ablauf am" required info={FIELD_INFO.idExpiresAt} error={expiresAtFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(additional.id_expires_at)}
                    onChange={(event) => updateAdditional("id_expires_at", event.target.value)}
                    onBlur={() => markFieldInteracted("additional.id_expires_at")}
                    className={hasLegitimationDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasLegitimationDateFieldError}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Bankverbindung" errorMessages={bankCardErrors}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kontoinhaber" required info={FIELD_INFO.bankAccountHolder}>
                  <div className="space-y-2">
                    <Input
                      value={stringOrEmpty(additional.bank_account_holder)}
                      onChange={(event) => updateAdditional("bank_account_holder", event.target.value)}
                      className={hasBankAccountHolderFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                      aria-invalid={hasBankAccountHolderFieldError}
                    />
                    {canApplySuggestedBankAccountHolder ? (
                      <button
                        type="button"
                        onClick={() => updateAdditional("bank_account_holder", suggestedBankAccountHolder)}
                        className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900"
                      >
                        Antragsteller übernehmen: {suggestedBankAccountHolder}
                      </button>
                    ) : null}
                  </div>
                </Field>
                <Field label="IBAN" required info={FIELD_INFO.iban}>
                  <div className="space-y-2">
                    <Input
                      value={stringOrEmpty(additional.bank_iban)}
                      onChange={(event) => updateAdditional("bank_iban", event.target.value.toUpperCase())}
                      autoComplete="off"
                      className={hasBankIbanFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                      aria-invalid={hasBankIbanFieldError}
                    />
                    <div className="text-xs text-slate-500">
                      {bankBicLookupLoading
                        ? "BIC wird automatisch aus der IBAN geladen..."
                        : "Sobald die IBAN vollständig ist, wird die BIC automatisch ergänzt."}
                    </div>
                    {sandboxBankIbanDemo ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Testmodus erkannt: <span className="font-semibold">{XS2A_SANDBOX_TEST_IBAN_ALIAS}</span> wird
                        nur im Hintergrund für den Sandbox-Check verwendet und mit
                        <span className="font-semibold"> {sandboxBankIbanDemo.bic}</span> vorbelegt.
                      </div>
                    ) : null}
                    {looksLikeIban(additional.bank_iban) ? (
                      <button
                        type="button"
                        onClick={() => void lookupBankBic(stringOrEmpty(additional.bank_iban))}
                        disabled={bankBicLookupLoading}
                        className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900 disabled:opacity-60"
                      >
                        {bankBicLookupLoading ? "Lädt BIC..." : "BIC aus IBAN laden"}
                      </button>
                    ) : null}
                  </div>
                </Field>
                <Field label="BIC" required info={FIELD_INFO.bic}>
                  <div className="space-y-2">
                    <Input
                      value={stringOrEmpty(additional.bank_bic)}
                      onChange={(event) => updateAdditional("bank_bic", event.target.value.toUpperCase())}
                      autoComplete="off"
                      className={hasBankBicFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                      aria-invalid={hasBankBicFieldError}
                    />
                    {bankBicLookupError ? <div className="text-xs text-amber-700">{bankBicLookupError}</div> : null}
                  </div>
                </Field>
              </div>
            </Card>

            <Card title="Rücklastschriften">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Gab es bei einem der Antragsteller in letzter Zeit Rücklastschriften?" required info={FIELD_INFO.returnedDebit}>
                  <Select value={trimOrEmpty(additional.returned_debit_window)} onChange={(event) => updateAdditional("returned_debit_window", event.target.value as Additional["returned_debit_window"])}>
                    <option value="">Bitte wählen</option>
                    {RETURNED_DEBIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>

            <Card title="Kinder">
              <div className="space-y-4">
                <Checkbox checked={Boolean(additional.has_children)} onChange={(checked) => updateAdditional("has_children", checked)} label="Kinder vorhanden" />

                {additional.has_children ? (
                  <div className="space-y-3">
                    {children.map((child, index) => (
                        <div key={child.id ?? index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                         <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-semibold text-slate-900">Kind {index + 1}</div>
                          <button
                            type="button"
                            onClick={() => removeChild(index)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto"
                          >
                            Entfernen
                          </button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Name" required>
                            <Input value={stringOrEmpty(child.name)} onChange={(event) => updateChild(index, { name: event.target.value })} />
                          </Field>
                          <Field label="Kindergeld?" required>
                            <div className="flex flex-wrap gap-3">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={`child-benefit-${index}`}
                                  checked={child.child_benefit === true}
                                  onChange={() => updateChild(index, { child_benefit: true })}
                                />
                                <span>Ja</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={`child-benefit-${index}`}
                                  checked={child.child_benefit === false}
                                  onChange={() => updateChild(index, { child_benefit: false })}
                                />
                                <span>Nein</span>
                              </label>
                            </div>
                          </Field>
                          <Field label="Unterhaltseinnahmen?" required>
                            <div className="flex flex-wrap gap-3">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={`child-maintenance-${index}`}
                                  checked={child.maintenance_income_present === true}
                                  onChange={() => updateChild(index, { maintenance_income_present: true })}
                                />
                                <span>Ja</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={`child-maintenance-${index}`}
                                  checked={child.maintenance_income_present === false}
                                  onChange={() => updateChild(index, { maintenance_income_present: false, maintenance_income_monthly: "" })}
                                />
                                <span>Nein</span>
                              </label>
                            </div>
                          </Field>
                          {hasCoApplicant ? (
                            <Field label="Antragsteller" required>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { value: "primary", label: "1" },
                                  { value: "co", label: "2" },
                                  { value: "both", label: "Beide" },
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => updateChild(index, { applicant_scope: option.value as ChildRow["applicant_scope"] })}
                                    className={cn(
                                      "rounded-full border px-3 py-1.5 text-sm transition",
                                      child.applicant_scope === option.value
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-white text-slate-700"
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </Field>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addChild}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                    >
                      + Kind hinzufuegen
                    </button>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card title="Verbindlichkeiten" subtitle="Bestehende Raten, Karten, Dispo oder Leasing können hier einzeln erfasst werden.">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(LIABILITY_TYPE_META) as Array<[LiabilityType, (typeof LIABILITY_TYPE_META)[LiabilityType]]>).map(
                    ([type, meta]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addLiability(type)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                      >
                        {meta.addLabel}
                      </button>
                    )
                  )}
                </div>

                {liabilities.length ? (
                  <div className="space-y-3">
                    {liabilities.map((row, index) => {
                      const isRateLiability =
                        row.liability_type === "ratenkredit" ||
                        row.liability_type === "privates_leasing" ||
                        row.liability_type === "sonstige_verbindlichkeit"
                      const isRefinanceLiability =
                        row.liability_type === "ratenkredit" ||
                        row.liability_type === "dispositionskredit" ||
                        row.liability_type === "kreditkarte" ||
                        row.liability_type === "sonstige_verbindlichkeit"
                      const isCardOrDispo = row.liability_type === "kreditkarte" || row.liability_type === "dispositionskredit"
                      const needsResidual =
                        row.liability_type === "ratenkredit" || row.liability_type === "sonstige_verbindlichkeit"

                      return (
                        <div key={row.id ?? `${row.liability_type}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              {liabilityLabel(row.liability_type)} {index + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLiability(index)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto"
                            >
                              Entfernen
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="Gläubiger" required={liabilityHasData(row)}>
                              <Input value={stringOrEmpty(row.creditor)} onChange={(event) => updateLiability(index, { creditor: event.target.value })} />
                            </Field>

                            {hasCoApplicant ? (
                              <Field label="Antragsteller" required={liabilityHasData(row)}>
                                <div className="flex flex-wrap gap-2">
                                  {LIABILITY_SCOPE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => updateLiability(index, { applicant_scope: option.value as LiabilityRow["applicant_scope"] })}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-sm transition",
                                        row.applicant_scope === option.value
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : "border-slate-200 bg-white text-slate-700"
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </Field>
                            ) : null}

                            {isRefinanceLiability ? (
                              <div className="self-end sm:col-span-2">
                                <Checkbox
                                  checked={Boolean(row.refinance)}
                                  onChange={(checked) => updateLiability(index, { refinance: checked })}
                                  label="Umschulden"
                                />
                              </div>
                            ) : null}

                            {(isRateLiability || row.liability_type === "kreditkarte") ? (
                              <Field label="Rate monatlich" hint="optional">
                                <MoneyInput value={toMoneyInput(row.monthly_rate)} onChange={(value) => updateLiability(index, { monthly_rate: value })} placeholder="z. B. 150" />
                              </Field>
                            ) : null}

                            {isRateLiability ? (
                              <Field label="Schlussrate" hint="optional">
                                <MoneyInput
                                  value={toMoneyInput(row.final_installment)}
                                  onChange={(value) => updateLiability(index, { final_installment: value })}
                                  placeholder="optional"
                                />
                              </Field>
                            ) : null}

                            {isRateLiability ? (
                              <Field label="Datum letzte Rate" hint="optional">
                                <Input type="date" value={toDateInput(row.last_rate_date)} onChange={(event) => updateLiability(index, { last_rate_date: event.target.value })} />
                              </Field>
                            ) : null}

                            {needsResidual ? (
                              <Field label="Aktuelle Restschuld" hint="optional">
                                <MoneyInput
                                  value={toMoneyInput(row.current_balance)}
                                  onChange={(value) => updateLiability(index, { current_balance: value })}
                                  placeholder="z. B. 6.500"
                                />
                              </Field>
                            ) : null}

                            {needsResidual ? (
                              <Field label="Urspr. Kreditbetrag" hint="optional">
                                <MoneyInput
                                  value={toMoneyInput(row.original_amount)}
                                  onChange={(value) => updateLiability(index, { original_amount: value })}
                                  placeholder="optional"
                                />
                              </Field>
                            ) : null}

                            {needsResidual ? (
                              <Field label="Datum erste Zahlung" hint="optional">
                                <Input type="date" value={toDateInput(row.first_payment_date)} onChange={(event) => updateLiability(index, { first_payment_date: event.target.value })} />
                              </Field>
                            ) : null}

                            {isCardOrDispo ? (
                              <Field label="Beanspruchter Betrag" hint="optional">
                                <MoneyInput
                                  value={toMoneyInput(row.utilized_amount)}
                                  onChange={(value) => updateLiability(index, { utilized_amount: value })}
                                  placeholder="z. B. 800"
                                />
                              </Field>
                            ) : null}

                            {isCardOrDispo ? (
                              <Field label="Verfuegungsrahmen" hint="optional">
                                <MoneyInput
                                  value={toMoneyInput(row.credit_limit)}
                                  onChange={(value) => updateLiability(index, { credit_limit: value })}
                                  placeholder="z. B. 2.000"
                                />
                              </Field>
                            ) : null}

                            {isCardOrDispo ? (
                              <Field label="Zinssatz %" hint="optional">
                                <Input
                                  inputMode="decimal"
                                  value={stringOrEmpty(row.interest_rate)}
                                  onChange={(event) => updateLiability(index, { interest_rate: event.target.value })}
                                  placeholder="z. B. 14,9"
                                />
                              </Field>
                            ) : null}

                            {isRefinanceLiability && row.refinance ? (
                              <Field label="IBAN" hint="optional">
                                <Input value={stringOrEmpty(row.iban)} onChange={(event) => updateLiability(index, { iban: event.target.value })} />
                              </Field>
                            ) : null}

                            {isRefinanceLiability && row.refinance ? (
                              <Field label="BIC" hint="optional">
                                <Input value={stringOrEmpty(row.bic)} onChange={(event) => updateLiability(index, { bic: event.target.value })} />
                              </Field>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Keine Verbindlichkeiten erfasst.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Immobilienvermoegen" subtitle="Eigene Immobilien und bestehende Darlehen können hier optional erfasst werden.">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={addRealEstateAsset}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                >
                  + Immobilie erfassen
                </button>

                {realEstateAssets.length ? (
                  <div className="space-y-3">
                    {realEstateAssets.map((asset, assetIndex) => {
                      const isRented = asset.usage_type === "vermietet" || asset.usage_type === "beides"

                      return (
                        <div key={asset.id ?? `asset-${assetIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm font-semibold text-slate-900">Immobilie {assetIndex + 1}</div>
                            <button
                              type="button"
                              onClick={() => removeRealEstateAsset(assetIndex)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto"
                            >
                              Entfernen
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Art der Immobilie" required={realEstateHasData(asset)}>
                              <Select value={trimOrEmpty(asset.property_type)} onChange={(event) => updateRealEstateAsset(assetIndex, { property_type: event.target.value as RealEstateAssetRow["property_type"] })}>
                                <option value="">Bitte wählen</option>
                                {REAL_ESTATE_PROPERTY_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <div className="xl:col-span-2">
                              <Field label="Bezeichnung zur Identifikation" hint="optional, z. B. Straße">
                                <Input value={stringOrEmpty(asset.description)} onChange={(event) => updateRealEstateAsset(assetIndex, { description: event.target.value })} />
                              </Field>
                            </div>
                            <Field label="Wert der Immobilie" hint="optional">
                              <MoneyInput value={toMoneyInput(asset.value_amount)} onChange={(value) => updateRealEstateAsset(assetIndex, { value_amount: value })} placeholder="z. B. 250.000" />
                            </Field>
                            <Field label="Gesamte Wohnfläche" hint="optional">
                              <Input inputMode="numeric" value={stringOrEmpty(asset.living_space_sqm)} onChange={(event) => updateRealEstateAsset(assetIndex, { living_space_sqm: event.target.value })} />
                            </Field>
                            <Field label="Wie wird die Immobilie genutzt?" required={realEstateHasData(asset)}>
                              <div className="flex flex-wrap gap-3">
                                {REAL_ESTATE_USAGE_OPTIONS.map((option) => (
                                  <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="radio"
                                      name={`asset-usage-${assetIndex}`}
                                      checked={asset.usage_type === option.value}
                                      onChange={() => updateRealEstateAsset(assetIndex, { usage_type: option.value })}
                                    />
                                    <span>{option.label}</span>
                                  </label>
                                ))}
                              </div>
                            </Field>
                            {hasCoApplicant ? (
                              <Field label="Antragsteller" required={realEstateHasData(asset)}>
                                <div className="flex flex-wrap gap-2">
                                  {LIABILITY_SCOPE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => updateRealEstateAsset(assetIndex, { applicant_scope: option.value as RealEstateAssetRow["applicant_scope"] })}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-sm transition",
                                        asset.applicant_scope === option.value
                                          ? "border-slate-900 bg-slate-900 text-white"
                                          : "border-slate-200 bg-white text-slate-700"
                                      )}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </Field>
                            ) : null}

                            <Field label="Nebenkosten" hint="optional">
                              <MoneyInput value={toMoneyInput(asset.ancillary_costs_monthly)} onChange={(value) => updateRealEstateAsset(assetIndex, { ancillary_costs_monthly: value })} />
                            </Field>

                            {isRented ? (
                              <>
                                <Field label="Vermietete Wohnfläche" required>
                                  <Input inputMode="numeric" value={stringOrEmpty(asset.rented_living_space_sqm)} onChange={(event) => updateRealEstateAsset(assetIndex, { rented_living_space_sqm: event.target.value })} />
                                </Field>
                                <Field label="Mieteinnahmen kalt / Monat" hint="optional">
                                  <MoneyInput value={toMoneyInput(asset.rent_income_cold_monthly)} onChange={(value) => updateRealEstateAsset(assetIndex, { rent_income_cold_monthly: value })} />
                                </Field>
                                <Field label="Mieteinnahmen warm / Monat" hint="optional">
                                  <MoneyInput value={toMoneyInput(asset.rent_income_warm_monthly)} onChange={(value) => updateRealEstateAsset(assetIndex, { rent_income_warm_monthly: value })} />
                                </Field>
                              </>
                            ) : null}
                          </div>

                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-sm font-semibold text-slate-900">Darlehen</div>
                              <button
                                type="button"
                                onClick={() => addRealEstateLoan(assetIndex)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                              >
                                + Darlehen
                              </button>
                            </div>

                            {Array.isArray(asset.loans) && asset.loans.length ? (
                              <div className="space-y-3">
                                {asset.loans.map((loan, loanIndex) => (
                                  <div key={loan.id ?? `loan-${assetIndex}-${loanIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="text-sm font-semibold text-slate-900">Darlehen {loanIndex + 1}</div>
                                      <button
                                        type="button"
                                        onClick={() => removeRealEstateLoan(assetIndex, loanIndex)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto"
                                      >
                                        Entfernen
                                      </button>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                      <Field label="Restschuld" hint="optional">
                                        <MoneyInput value={toMoneyInput(loan.remaining_debt)} onChange={(value) => updateRealEstateLoan(assetIndex, loanIndex, { remaining_debt: value })} />
                                      </Field>
                                      <Field label="Zinsbindung bis" hint="optional">
                                        <Input type="date" value={toDateInput(loan.interest_fixed_until)} onChange={(event) => updateRealEstateLoan(assetIndex, loanIndex, { interest_fixed_until: event.target.value })} />
                                      </Field>
                                      <Field label="Rate / Monat" hint="optional">
                                        <MoneyInput value={toMoneyInput(loan.monthly_rate)} onChange={(value) => updateRealEstateLoan(assetIndex, loanIndex, { monthly_rate: value })} />
                                      </Field>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                Keine Darlehen erfasst.
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Keine Immobilien erfasst.
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {step === "co" ? (
          <Card title="Zweiter Kreditnehmer" subtitle="Falls der Antrag mit zwei Personen gestellt wird, hier alle Daten vervollständigen.">
            <div className="mb-4">
              <Checkbox checked={hasCoApplicant} onChange={(checked) => (checked ? ensureCoApplicant() : disableCoApplicant())} label="Zweiten Kreditnehmer erfassen" />
            </div>

            {hasCoApplicant ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Anrede" required>
                  <Select value={trimOrEmpty(coApplicant.salutation)} onChange={(event) => updateCoApplicant("salutation", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {SALUTATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Titel" hint="optional">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TITLE_OPTIONS.map((option) => (
                      <Checkbox
                        key={option.value}
                        checked={stringArray(coApplicant.title).includes(option.value)}
                        onChange={(checked) => toggleCoApplicantTitle(option.value, checked)}
                        label={option.label}
                      />
                    ))}
                  </div>
                </Field>
                <Field label="Vorname" required>
                  <Input value={stringOrEmpty(coApplicant.first_name)} onChange={(event) => updateCoApplicant("first_name", event.target.value)} />
                </Field>
                <Field label="Nachname" required>
                  <Input value={stringOrEmpty(coApplicant.last_name)} onChange={(event) => updateCoApplicant("last_name", event.target.value)} />
                </Field>
                <Field label="Geburtsdatum" required error={coBirthDateFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(coApplicant.birth_date)}
                    onChange={(event) => updateCoApplicant("birth_date", event.target.value)}
                    onBlur={() => markFieldInteracted("co.birth_date")}
                    className={coBirthDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={Boolean(coBirthDateFieldError)}
                  />
                </Field>
                <Field label="Geburtsland" required>
                  <Select value={trimOrEmpty(coApplicant.birth_country)} onChange={(event) => updateCoApplicant("birth_country", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Staatsangehörigkeit" required>
                  <Select value={trimOrEmpty(coApplicant.nationality)} onChange={(event) => updateCoApplicant("nationality", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Familienstand" required>
                  <Select value={trimOrEmpty(coApplicant.marital_status)} onChange={(event) => updateCoApplicant("marital_status", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {MARITAL_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="E-Mail" hint="optional" error={coEmailFieldError}>
                  <Input
                    type="email"
                    value={stringOrEmpty(coApplicant.email)}
                    onChange={(event) => updateCoApplicant("email", event.target.value)}
                    onBlur={() => markFieldInteracted("co.email")}
                    autoComplete="email"
                    className={coEmailFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={Boolean(coEmailFieldError)}
                  />
                </Field>
                <Field label="Telefon" hint="optional" error={coPhoneFieldError}>
                  <Input
                    type="tel"
                    value={stringOrEmpty(coApplicant.phone)}
                    onChange={(event) => updateCoApplicant("phone", event.target.value)}
                    onBlur={() => markFieldInteracted("co.phone")}
                    autoComplete="tel"
                    className={coPhoneFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={Boolean(coPhoneFieldError)}
                  />
                </Field>
                <Field label="Telefon geschäftlich" hint="optional">
                  <Input value={stringOrEmpty(coApplicant.phone_business)} onChange={(event) => updateCoApplicant("phone_business", event.target.value)} />
                </Field>
                <Field label="Steuer-ID" hint="optional">
                  <Input value={stringOrEmpty(coApplicant.tax_id)} onChange={(event) => updateCoApplicant("tax_id", event.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Card title="Legitimation" errorMessages={coLegitimationCardErrors}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Geburtsort" required>
                        <Input value={stringOrEmpty(coApplicant.birth_place)} onChange={(event) => updateCoApplicant("birth_place", event.target.value)} />
                      </Field>
                      <Field label="Ausweisnummer" required>
                        <Input
                          value={stringOrEmpty(coApplicant.id_document_number)}
                          onChange={(event) => updateCoApplicant("id_document_number", event.target.value)}
                        />
                      </Field>
                      <Field label="Ausstellungsort" required>
                        <Input
                          value={stringOrEmpty(coApplicant.id_issued_place)}
                          onChange={(event) => updateCoApplicant("id_issued_place", event.target.value)}
                        />
                      </Field>
                      <Field label="Ausgestellt am" required error={coIssuedAtFieldError}>
                        <Input
                          type="date"
                          value={toDateInput(coApplicant.id_issued_at)}
                          onChange={(event) => updateCoApplicant("id_issued_at", event.target.value)}
                          onBlur={() => markFieldInteracted("co.id_issued_at")}
                          className={hasCoLegitimationDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                          aria-invalid={Boolean(coIssuedAtFieldError)}
                        />
                      </Field>
                      <Field label="Ablauf am" required error={coExpiresAtFieldError}>
                        <Input
                          type="date"
                          value={toDateInput(coApplicant.id_expires_at)}
                          onChange={(event) => updateCoApplicant("id_expires_at", event.target.value)}
                          onBlur={() => markFieldInteracted("co.id_expires_at")}
                          className={hasCoLegitimationDateFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                          aria-invalid={Boolean(coExpiresAtFieldError)}
                        />
                      </Field>
                    </div>
                  </Card>
                </div>
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900">Wohnsituation</div>
                  <div className="text-sm text-slate-600">Gleiche Wohnsituation wie Hauptantragsteller?</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="co-shared-household"
                        checked={coApplicant.shared_household_with_primary === true}
                        onChange={() => updateCoApplicant("shared_household_with_primary", true)}
                      />
                      <span>Ja</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="co-shared-household"
                        checked={coApplicant.shared_household_with_primary === false}
                        onChange={() => updateCoApplicant("shared_household_with_primary", false)}
                      />
                      <span>Nein</span>
                    </label>
                  </div>
                </div>
                {coApplicant.shared_household_with_primary === false ? (
                  <>
                    <Field label="Straße" required>
                      <Input value={stringOrEmpty(coApplicant.address_street)} onChange={(event) => updateCoApplicant("address_street", event.target.value)} />
                    </Field>
                    <Field label="Hausnummer" required>
                      <Input value={stringOrEmpty(coApplicant.address_house_no)} onChange={(event) => updateCoApplicant("address_house_no", event.target.value)} />
                    </Field>
                    <Field label="PLZ" required>
                      <Input value={stringOrEmpty(coApplicant.address_zip)} onChange={(event) => updateCoApplicant("address_zip", event.target.value)} />
                    </Field>
                    <Field label="Ort" required>
                      <Input value={stringOrEmpty(coApplicant.address_city)} onChange={(event) => updateCoApplicant("address_city", event.target.value)} />
                    </Field>
                    <Field label="Wohnstatus" required>
                      <Select value={trimOrEmpty(coApplicant.housing_status)} onChange={(event) => updateCoApplicant("housing_status", event.target.value)}>
                        <option value="">Bitte wählen</option>
                        {HOUSING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Wohnhaft seit" required error={coResidenceSinceFieldError}>
                      <Input
                        type="date"
                        value={toDateInput(coApplicant.residence_since)}
                        onChange={(event) => updateCoApplicant("residence_since", event.target.value)}
                        onBlur={() => markFieldInteracted("co.residence_since")}
                        className={coResidenceSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                        aria-invalid={Boolean(coResidenceSinceFieldError)}
                      />
                    </Field>
                    <Field label="Haushaltsgröße" required>
                      <Input value={stringOrEmpty(coApplicant.household_persons)} onChange={(event) => updateCoApplicant("household_persons", event.target.value)} />
                    </Field>
                    <Field label="Anzahl KFZ" hint="optional">
                      <Input value={stringOrEmpty(coApplicant.vehicle_count)} onChange={(event) => updateCoApplicant("vehicle_count", event.target.value)} />
                    </Field>
                    {coNeedsPreviousResidence ? (
                      <>
                        <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-slate-900">Voranschrift</div>
                          <div className="mt-1 text-sm text-slate-600">Da Antragsteller 2 noch keine 3 Jahre an der aktuellen Adresse wohnt, wird die vorherige Anschrift benötigt.</div>
                        </div>
                        <Field label="Voranschrift Straße" required>
                          <Input value={stringOrEmpty(coApplicant.previous_address_street)} onChange={(event) => updateCoApplicant("previous_address_street", event.target.value)} />
                        </Field>
                        <Field label="Voranschrift Hausnummer" required>
                          <Input value={stringOrEmpty(coApplicant.previous_address_house_no)} onChange={(event) => updateCoApplicant("previous_address_house_no", event.target.value)} />
                        </Field>
                        <Field label="Voranschrift PLZ" required>
                          <Input value={stringOrEmpty(coApplicant.previous_address_zip)} onChange={(event) => updateCoApplicant("previous_address_zip", event.target.value)} />
                        </Field>
                        <Field label="Voranschrift Ort" required>
                          <Input value={stringOrEmpty(coApplicant.previous_address_city)} onChange={(event) => updateCoApplicant("previous_address_city", event.target.value)} />
                        </Field>
                        <Field label="Voranschrift wohnhaft seit" required error={coPreviousAddressSinceFieldError}>
                          <Input
                            type="date"
                            value={toDateInput(coApplicant.previous_address_since)}
                            onChange={(event) => updateCoApplicant("previous_address_since", event.target.value)}
                            onBlur={() => markFieldInteracted("co.previous_address_since")}
                            className={coPreviousAddressSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                            aria-invalid={Boolean(coPreviousAddressSinceFieldError)}
                          />
                        </Field>
                      </>
                    ) : null}
                  </>
                ) : null}
                <Field label="Beschäftigungsverhältnis" required>
                  <Select value={trimOrEmpty(coApplicant.employment_type)} onChange={(event) => updateCoApplicant("employment_type", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Anstellungsstatus" required>
                  <Select value={trimOrEmpty(coApplicant.employment_status)} onChange={(event) => updateCoApplicant("employment_status", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Berufsbezeichnung" required>
                  <Input value={stringOrEmpty(coApplicant.employment_job_title)} onChange={(event) => updateCoApplicant("employment_job_title", event.target.value)} />
                </Field>
                <Field label="Beschäftigt seit" required error={coEmploymentSinceFieldError}>
                  <Input
                    type="date"
                    value={toDateInput(coApplicant.employment_since)}
                    onChange={(event) => updateCoApplicant("employment_since", event.target.value)}
                    onBlur={() => markFieldInteracted("co.employment_since")}
                    className={coEmploymentSinceFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={Boolean(coEmploymentSinceFieldError)}
                  />
                </Field>
                <Field label="Arbeitgeber" required={requiresEmployerCoreFields(coApplicant)}>
                  <Input value={stringOrEmpty(coApplicant.employer_name)} onChange={(event) => updateCoApplicant("employer_name", event.target.value)} />
                </Field>
                <Field label="Branche" required={requiresEmployerCoreFields(coApplicant)}>
                  <Select value={trimOrEmpty(coApplicant.employer_industry)} onChange={(event) => updateCoApplicant("employer_industry", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {EMPLOYER_INDUSTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nettoeinkommen / Monat" required error={coNetIncomeFieldError}>
                  <MoneyInput
                    value={toMoneyInput(coApplicant.net_income_monthly)}
                    onChange={(value) => {
                      markFieldInteracted("co.net_income_monthly")
                      updateCoApplicant("net_income_monthly", value)
                    }}
                    placeholder="Niedrigstes Netto aus den letzten 3 Monaten"
                    className={hasCoNetIncomeFieldError ? "border-rose-300 focus:border-rose-300 focus:ring-rose-100" : undefined}
                    aria-invalid={hasCoNetIncomeFieldError}
                  />
                </Field>
                <Field label="Weitere Einnahmen / Monat" hint="optional">
                  <MoneyInput value={toMoneyInput(coApplicant.other_income_monthly)} onChange={(value) => updateCoApplicant("other_income_monthly", value)} placeholder="z. B. 200" />
                </Field>
                <Field label="Fixkosten / Monat" hint="optional">
                  <MoneyInput value={toMoneyInput(coApplicant.expenses_monthly)} onChange={(value) => updateCoApplicant("expenses_monthly", value)} placeholder="z. B. 600" />
                </Field>
                <Field label="Bestehende Kredite / Monat" hint="optional">
                  <MoneyInput value={toMoneyInput(coApplicant.existing_loans_monthly)} onChange={(value) => updateCoApplicant("existing_loans_monthly", value)} placeholder="z. B. 90" />
                </Field>
                <Field label="Arbeitgeber-Straße" required={requiresEmployerCoreFields(coApplicant)}>
                  <Input value={stringOrEmpty(coApplicant.employer_address_street)} onChange={(event) => updateCoApplicant("employer_address_street", event.target.value)} />
                </Field>
                <Field label="Arbeitgeber-Hausnummer" hint="optional">
                  <Input value={stringOrEmpty(coApplicant.employer_address_house_no)} onChange={(event) => updateCoApplicant("employer_address_house_no", event.target.value)} />
                </Field>
                <Field label="Arbeitgeber-PLZ" required={requiresEmployerCoreFields(coApplicant)}>
                  <Input value={stringOrEmpty(coApplicant.employer_address_zip)} onChange={(event) => updateCoApplicant("employer_address_zip", event.target.value)} />
                </Field>
                <Field label="Arbeitgeber-Ort" required={requiresEmployerCoreFields(coApplicant)}>
                  <Input value={stringOrEmpty(coApplicant.employer_address_city)} onChange={(event) => updateCoApplicant("employer_address_city", event.target.value)} />
                </Field>
                <Field label="Arbeitgeber-Land" required={requiresEmployerCoreFields(coApplicant)}>
                  <Select value={trimOrEmpty(coApplicant.employer_address_country)} onChange={(event) => updateCoApplicant("employer_address_country", event.target.value)}>
                    <option value="">Bitte wählen</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
          </Card>
        ) : null}

        {step === "review" ? (
          <div className="space-y-4">
            <Card
              title="Haushaltsrechnung"
              subtitle="Grober Monatsüberblick vor den Live-Angeboten. Die Haushaltspauschale von 1.000 EUR ist hier bewusst als Durchschnitt fest eingerechnet."
            >
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  <BudgetBar
                    label="Einnahmen gesamt"
                    value={householdSummary.totalIncome}
                    max={householdSummary.maxBarValue}
                    tone="sky"
                    hint={
                      hasCoApplicant
                        ? `inkl. ${formatMoney(householdSummary.coIncome)} vom 2. Kreditnehmer`
                        : "inkl. regelmäßiger Zusatz- und Nebeneinnahmen"
                    }
                  />
                  <BudgetBar
                    label="Fixkosten gesamt"
                    value={householdSummary.fixedCosts}
                    max={householdSummary.maxBarValue}
                    tone="amber"
                    hint="inkl. Wohnen, laufender Kredite, Verbindlichkeiten, Fahrzeuge und Immobilienkosten"
                  />
                  <BudgetBar
                    label="Haushaltspauschale"
                    value={householdSummary.householdAllowance}
                    max={householdSummary.maxBarValue}
                    tone="amber"
                    hint="Fester Durchschnittswert für die Haushaltsbetrachtung"
                  />
                  <BudgetBar
                    label={householdSummary.surplus >= 0 ? "Verfügbar vor neuer Rate" : "Monatliche Lücke"}
                    value={Math.abs(householdSummary.surplus)}
                    max={householdSummary.maxBarValue}
                    tone={householdSummary.surplus >= 0 ? householdSummary.statusTone : "rose"}
                    hint={householdSummary.tip}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Haushaltspuffer</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{householdSummary.statusLabel}</div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        householdSummary.statusTone === "rose"
                          ? "bg-rose-100 text-rose-800"
                          : householdSummary.statusTone === "amber"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {householdSummary.surplus >= 0 ? "positiv" : "negativ"}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <SummaryRow label="Einnahmen gesamt" value={formatMoney(householdSummary.totalIncome)} />
                    {hasCoApplicant ? (
                      <SummaryRow label="davon 2. Kreditnehmer" value={formatMoney(householdSummary.coIncome)} />
                    ) : null}
                    {householdSummary.childIncome > 0 ? (
                      <SummaryRow label="davon Unterhalt Kinder" value={formatMoney(householdSummary.childIncome)} />
                    ) : null}
                    {householdSummary.rentalIncome > 0 ? (
                      <SummaryRow label="davon Mieteinnahmen" value={formatMoney(householdSummary.rentalIncome)} />
                    ) : null}
                    <SummaryRow label="Fixkosten gesamt" value={formatMoney(householdSummary.fixedCosts)} />
                    <SummaryRow label="Haushaltspauschale" value={formatMoney(householdSummary.householdAllowance)} />
                    <div className="my-3 border-t border-slate-200" />
                    <SummaryRow label="Gesamtausgaben inkl. Pauschale" value={formatMoney(householdSummary.totalOut)} />
                    <SummaryRow
                      label={householdSummary.surplus >= 0 ? "Verfügbar vor neuer Rate" : "Monatliche Lücke"}
                      value={formatMoney(householdSummary.surplus)}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    Diese Auswertung ist bewusst einfach gehalten und dient als schnelle Orientierung im Wizard.
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Prüfen" subtitle="Wenn alle Pflichtfelder vollständig sind, kann SEPANA deine Live-Angebote berechnen.">
              {reviewFocusIssue ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <div className="font-semibold">Fehler im Bereich {reviewFocusStepTitle || "Antrag"}</div>
                  <div className="mt-1">{reviewFocusIssue.message}</div>
                  {reviewFocusIssue.step && reviewFocusIssue.step !== "review" ? (
                    <button
                      type="button"
                      onClick={() => void jumpTo(reviewFocusIssue.step)}
                      className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800"
                    >
                      Zum betroffenen Bereich
                    </button>
                  ) : null}
                </div>
              ) : null}
              {finalMissing.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-semibold">Unvollständig oder fehlerhaft</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {finalMissing.slice(0, 12).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {finalMissing.length > 12 ? <div className="mt-2">Weitere offene Punkte: {finalMissing.length - 12}</div> : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Alle aktuell benötigten Pflichtfelder sind erfasst. Du kannst jetzt direkt die Live-Angebote berechnen.
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kredit</div>
                  <div className="mt-2">{PURPOSE_OPTIONS.find((option) => option.value === financing.purpose)?.label ?? "-"}</div>
                  <div className="mt-1 font-semibold text-slate-900">{toMoneyInput(financing.loan_amount_requested) || "-"}</div>
                  <div className="mt-1">Laufzeit: {trimOrEmpty(financing.term_months) ? `${trimOrEmpty(financing.term_months)} Monate` : "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Antragsteller</div>
                  <div className="mt-2 font-semibold text-slate-900">{[primary.first_name, primary.last_name].filter(Boolean).join(" ") || "-"}</div>
                  <div className="mt-1">{hasCoApplicant ? "Mit zweitem Kreditnehmer" : "Ein Kreditnehmer"}</div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void goPrev()}
            disabled={stepIndex <= 0 || saving || offersTransitionOverlayOpen}
            className={cn(
              "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 sm:w-auto",
              (stepIndex <= 0 || saving || offersTransitionOverlayOpen) && "cursor-not-allowed opacity-50"
            )}
          >
            Zurück
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void save({ showMessage: true, triggerEuropaceSync: false })}
              disabled={saving || offersTransitionOverlayOpen}
              className={cn(
                "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 sm:w-auto",
                (saving || offersTransitionOverlayOpen) && "cursor-not-allowed opacity-60"
              )}
            >
              {saving ? "Speichert..." : "Zwischenspeichern"}
            </button>

            {step !== "review" ? (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={saving || offersTransitionOverlayOpen}
                className={cn(
                  "w-full rounded-2xl bg-[linear-gradient(90deg,#0f172a,#0369a1)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/15 transition hover:-translate-y-0.5 sm:w-auto",
                  (saving || offersTransitionOverlayOpen) && "cursor-not-allowed opacity-60"
                )}
              >
                Weiter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void finishAndScrollToOffers()}
                disabled={saving || offersTransitionOverlayOpen}
                className={cn(
                  "w-full rounded-2xl bg-[linear-gradient(90deg,#0f172a,#0369a1)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/15 transition hover:-translate-y-0.5 sm:w-auto",
                  (saving || offersTransitionOverlayOpen) && "cursor-not-allowed opacity-60"
                )}
              >
                {offersTransitionOverlayOpen ? "Banken werden angefragt..." : saving ? "Speichert..." : "Zu Live-Angeboten"}
              </button>
            )}
          </div>
        </div>
      </div>

      {offersTransitionOverlayOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-cyan-200/80 bg-white p-6 text-center shadow-[0_28px_90px_rgba(15,23,42,0.20)] sm:p-7">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-50">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute inline-flex h-10 w-10 rounded-full bg-emerald-300/35 animate-ping" />
                <span className="absolute inline-flex h-10 w-10 rounded-full border-2 border-cyan-500/25" />
                <span className="absolute h-5 w-5 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </div>
            </div>
            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">
              Banken werden angefragt
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Wir suchen jetzt die besten Live-Angebote für dich
            </div>
            <div className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              SEPANA fragt gerade passende Banken an, prüft die aktuellen Konditionen und sortiert die stärksten
              Varianten nach Zins und Machbarkeit. Das dauert nur einen kurzen Moment.
            </div>
            <div className="mt-6 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-500" />
                <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500 [animation-delay:180ms]" />
                <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-500 [animation-delay:360ms]" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

