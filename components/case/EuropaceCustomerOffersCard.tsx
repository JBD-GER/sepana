"use client"

import Image from "next/image"
import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AccountCheckInfoDialog from "@/components/onlinekredit/AccountCheckInfoDialog"
import { XS2A_SANDBOX_TEST_IBAN_ALIAS, getSandboxIbanDemo, looksLikeIban, normalizeIbanInput } from "@/lib/banking/iban"
import { toPublicOfferAcceptanceMessage } from "@/lib/europace/offerAcceptance"
import { compareEuropaceOfferRevisionsDesc } from "@/lib/europace/offerToken"

type OfferSnapshot = {
  ratenkredit?: {
    produktanbieter?: {
      name?: string | null
      logo?: {
        svg?: string | null
      } | null
    } | null
    produktbezeichnung?: string | null
  } | null
  gesamtkonditionen?: {
    rateMonatlich?: number | null
    effektivzins?: number | null
    sollzins?: number | null
    nettokreditbetrag?: number | null
    gesamtkreditbetrag?: number | null
    auszahlungsbetrag?: number | null
    laufzeitInMonaten?: number | null
  } | null
  sofortkredit?: boolean | null
  digitalisierungsmerkmale?: {
    accountCheck?: {
      modus?: string | null
    } | null
  } | null
  vorhersage?: {
    machbarkeit?: {
      score?: number | null
    } | null
  } | null
  vollstaendigkeit?: {
    messages?:
      | Array<{
          text?: string | null
          property?: string | null
          category?: string | null
          reason?: string | null
          identifier?: {
            type?: string | null
            ids?: string[] | null
          } | null
        }>
      | null
  } | null
  machbarkeit?: {
    messages?: Array<{ text?: string | null }> | null
  } | null
} | null

type EuropaceOfferRow = {
  angebot_id: string
  angebot_snapshot?: OfferSnapshot
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  calculated_at?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
  created_at?: string | null
}

type EuropaceMeta = {
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  selected_angebot_id?: string | null
  sync_status?: string | null
  last_sync_at?: string | null
  last_error?: string | null
  last_export_snapshot?: unknown
} | null

type EuropaceApplicationReference = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
}

type JobState = {
  jobId: string | null
  status: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  hasApplication: boolean
}

type ProviderRecord = {
  id: string
  name: string
  slug?: string | null
  logo_horizontal_path?: string | null
  logo_icon_path?: string | null
  preferred_logo_variant?: string | null
}

type ProviderApiResponse = {
  ok?: boolean
  items?: Array<{
    provider?: ProviderRecord | null
  }>
}

type ProviderBrand = {
  id: string
  name: string
  src: string
  variant: "icon" | "horizontal"
  source: "provider" | "europace"
  scale?: number
}

type ProviderLogoProps = {
  brand: ProviderBrand | null
  providerName: string
  lookupLoading: boolean
}

type QuickEditField =
  | "phone"
  | "birth_date"
  | "employment_since"
  | "address_since"
  | "previous_address_since"
  | "bank_account_holder"
  | "bank_iban"
  | "bank_bic"

type QuickEditState = Record<QuickEditField, string>

type LiveCaseLoadResponse = {
  ok?: boolean
  primary?: {
    phone?: string | null
    first_name?: string | null
    last_name?: string | null
    birth_date?: string | null
    employment_since?: string | null
  } | null
  additional?: {
    address_since?: string | null
    previous_address_since?: string | null
    bank_account_holder?: string | null
    bank_iban?: string | null
    bank_bic?: string | null
  } | null
  error?: string
  stage?: string
  message?: string
}

type LiveCaseSaveResponse = {
  ok?: boolean
  error?: string
  stage?: string
  message?: string
}

type IbanLookupResponse = {
  ok?: boolean
  bic?: string | null
  bankName?: string | null
  error?: string
}

type OfferRequirement = {
  key: string
  text: string
  kind: "blocking" | "post_selection"
  editableFields: QuickEditField[]
}

type OfferDiagnostics = {
  blocking: OfferRequirement[]
  postSelection: OfferRequirement[]
  editableFields: QuickEditField[]
}

type OfferView = {
  offer: EuropaceOfferRow
  snapshot: OfferSnapshot
  providerName: string
  productName: string | null
  missingMessages: Array<{ text?: string | null; property?: string | null; category?: string | null; reason?: string | null }>
  machbarkeitMessages: Array<{ text?: string | null }>
  diagnostics: OfferDiagnostics
  accountCheckRequired: boolean
  accountCheckCompleted: boolean
  accountCheck: {
    label: string
    className: string
    note: string
  } | null
  accountCheckRestricted: boolean
  accountCheckRestrictedReason: string | null
  technicalAcceptanceFailed: boolean
  providerBrand: ProviderBrand | null
}

type OfferMessage = {
  text?: string | null
  property?: string | null
  category?: string | null
  reason?: string | null
  identifier?: {
    type?: string | null
    ids?: string[] | null
  } | null
}

const EMPTY_QUICK_EDIT: QuickEditState = {
  phone: "",
  birth_date: "",
  employment_since: "",
  address_since: "",
  previous_address_since: "",
  bank_account_holder: "",
  bank_iban: "",
  bank_bic: "",
}

const DEFAULT_CUSTOMER_CONTACT_PHONE = "+49 5761 8429660"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function toTelHref(value: string | null) {
  const normalized = String(value ?? "").replace(/[^\d+]/g, "")
  return normalized ? `tel:${normalized}` : null
}

function extractEuropaceStatusValue(value: string | { status?: string | null } | null | undefined) {
  if (typeof value === "string") return trimOrNull(value)
  return trimOrNull(value?.status)
}

function isRejectedEuropaceStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (!normalized) return false
  return (
    normalized === "ABGELEHNT" ||
    normalized === "AUTOMATISCH_ABGELEHNT" ||
    normalized === "REJECTED" ||
    normalized === "DECLINED" ||
    normalized.includes("ABGELEHNT") ||
    normalized.includes("DECLIN") ||
    normalized.includes("REJECT")
  )
}

function findRelevantApplicationInSnapshot(snapshot: unknown, reference?: EuropaceApplicationReference | null) {
  const rows = Array.isArray((snapshot as { antraege?: unknown[] } | null | undefined)?.antraege)
    ? ((snapshot as { antraege?: unknown[] }).antraege ?? [])
    : []

  const applications = rows.map((row) => row as {
    antragsnummer?: string | null
    produktanbieterantragsnummer?: string | null
    antragstellerstatus?: string | { status?: string | null } | null
    produktanbieterstatus?: string | { status?: string | null } | null
  })
  const firstNonRejected =
    applications.find((application) => {
      const antragstellerstatus = extractEuropaceStatusValue(application.antragstellerstatus)
      const produktanbieterstatus = extractEuropaceStatusValue(application.produktanbieterstatus)
      return !isRejectedEuropaceStatus(antragstellerstatus) && !isRejectedEuropaceStatus(produktanbieterstatus)
    }) ?? null
  const hasReference =
    Boolean(trimOrNull(reference?.antragsnummer)) || Boolean(trimOrNull(reference?.produktanbieterantragsnummer))

  const antragsnummer = trimOrNull(reference?.antragsnummer)
  if (antragsnummer) {
    const byAntragsnummer =
      applications.find((application) => trimOrNull(application.antragsnummer) === antragsnummer) ?? null
    if (byAntragsnummer) {
      const antragstellerstatus = extractEuropaceStatusValue(byAntragsnummer.antragstellerstatus)
      const produktanbieterstatus = extractEuropaceStatusValue(byAntragsnummer.produktanbieterstatus)
      if (!isRejectedEuropaceStatus(antragstellerstatus) && !isRejectedEuropaceStatus(produktanbieterstatus)) {
        return byAntragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byAntragsnummer
    }
  }

  const produktanbieterantragsnummer = trimOrNull(reference?.produktanbieterantragsnummer)
  if (produktanbieterantragsnummer) {
    const byProduktanbieterantragsnummer =
      applications.find(
        (application) =>
          trimOrNull(application.produktanbieterantragsnummer) === produktanbieterantragsnummer
      ) ?? null
    if (byProduktanbieterantragsnummer) {
      const antragstellerstatus = extractEuropaceStatusValue(byProduktanbieterantragsnummer.antragstellerstatus)
      const produktanbieterstatus = extractEuropaceStatusValue(byProduktanbieterantragsnummer.produktanbieterstatus)
      if (!isRejectedEuropaceStatus(antragstellerstatus) && !isRejectedEuropaceStatus(produktanbieterstatus)) {
        return byProduktanbieterantragsnummer
      }
      if (firstNonRejected) return firstNonRejected
      return byProduktanbieterantragsnummer
    }
  }

  if (hasReference) {
    return firstNonRejected ?? null
  }

  return firstNonRejected ?? applications[0] ?? null
}

function hasRejectedApplicationInSnapshot(snapshot: unknown, reference?: EuropaceApplicationReference | null) {
  const application = findRelevantApplicationInSnapshot(snapshot, reference)
  if (!application) return false

  return (
    isRejectedEuropaceStatus(extractEuropaceStatusValue(application.antragstellerstatus)) ||
    isRejectedEuropaceStatus(extractEuropaceStatusValue(application.produktanbieterstatus))
  )
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function fullName(firstName: unknown, lastName: unknown) {
  return [String(firstName ?? "").trim(), String(lastName ?? "").trim()].filter(Boolean).join(" ")
}

function customerText(value: unknown) {
  return String(value ?? "").replace(/europace/gi, "SEPANA").trim()
}

function isInternalCommercialMessage(value: unknown) {
  const normalized = normalizeProviderKey(value)
  return (
    normalized.includes("provision") ||
    normalized.includes("courtage") ||
    normalized.includes("vergutung") ||
    normalized.includes("verguetung")
  )
}

function customerFacingMessage(value: unknown) {
  const text = customerText(value)
  if (!text || isInternalCommercialMessage(text)) return null
  return text
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function formatEUR(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(value))} %`
}

function formatScore(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-"
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."))
  if (!Number.isFinite(numeric)) {
    const text = String(value ?? "").trim()
    return text || "-"
  }
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(numeric)
}

function labelStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "-"
  if (raw === "GRUEN") return "Grün"
  if (raw === "GELB") return "Gelb"
  if (raw === "ROT") return "Rot"
  if (raw === "VOLLSTAENDIG") return "Vollständig"
  if (raw === "UNVOLLSTAENDIG") return "Unvollständig"
  if (raw === "MACHBAR") return "Machbar"
  if (raw === "MACHBAR_UNTER_VORBEHALT") return "Machbar unter Vorbehalt"
  if (raw === "NICHT_MACHBAR") return "Nicht machbar"
  if (raw === "PENDING") return "Läuft"
  if (raw === "SUCCESS") return "Erfolgreich"
  if (raw === "FAILURE") return "Fehlgeschlagen"
  if (raw === "OPTIONAL") return "Optional"
  if (raw === "REQUIRED") return "Erforderlich"
  if (raw === "NONE") return "Nicht nötig"
  return raw.toLowerCase()
}

function normalizeDiagnosticText(input: {
  property?: string | null
  text?: string | null
  category?: string | null
}) {
  const property = String(input.property ?? "").trim()
  const text = String(input.text ?? "").trim()
  const category = String(input.category ?? "").trim()
  if (property && text) return customerText(`${property}: ${text}`)
  if (text) return customerText(text)
  if (property && category) return customerText(`${category}: ${property}`)
  return customerText(property || category || "")
}

function isPhone(value: string) {
  return value.replace(/\D/g, "").length >= 6
}

function isValidLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (year < 1900 || year > 9999) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function toDateInputValue(value: unknown) {
  const trimmed = trimOrNull(value)
  if (!trimmed) return ""
  const candidate = trimmed.slice(0, 10)
  return isValidLocalDate(candidate) ? candidate : ""
}

function logoSrc(provider: ProviderRecord) {
  const prefer = provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const preferredFile = prefer === "icon" ? provider.logo_icon_path : provider.logo_horizontal_path
  const fallbackFile = prefer === "icon" ? provider.logo_horizontal_path : provider.logo_icon_path
  const file = preferredFile || fallbackFile
  if (!file) return null
  const variant =
    file === provider.logo_icon_path ? "icon" : file === provider.logo_horizontal_path ? "horizontal" : prefer

  return {
    src: `/api/baufi/logo?bucket=logo_banken&width=320&height=112&resize=contain&path=${encodeURIComponent(String(file))}`,
    variant: variant === "icon" ? ("icon" as const) : ("horizontal" as const),
  }
}

function normalizeProviderKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function providerLogoScaleHint(
  providerName: string,
  assetRef?: string | null,
  source: "provider" | "europace" = "provider"
) {
  const name = normalizeProviderKey(providerName)
  const asset = normalizeProviderKey(assetRef)

  if (source === "europace") {
    return 1
  }

  if (name === "ing" || asset.includes("ing group n v")) return 1.16
  if (name.includes("consors") || asset.includes("consors finanz")) return 1.22
  if (name === "dkb" || name.includes("deutsche kreditbank") || asset.includes("deutsche kreditbank")) return 1.14
  if (name.includes("deutsche bank") || asset.includes("deutsche bank")) return 1.1
  if (name.includes("santander") || asset.includes("santander")) return 1.1
  if (name.includes("targobank") || asset.includes("targobank")) return 1.1

  return 1
}

function providerLookupKeys(value: unknown) {
  const normalized = normalizeProviderKey(value)
  if (!normalized) return [] as string[]

  const withoutBrandOwner = normalized
    .replace(/\b(?:eine|ein)\s+marke\s+der\b.*$/g, "")
    .replace(/\bmarke\s+der\b.*$/g, "")
    .replace(/\bbrand\s+of\b.*$/g, "")
    .trim()

  const baseValues = Array.from(new Set([normalized, withoutBrandOwner].filter(Boolean)))
  const strippedValues = baseValues
    .map((entry) =>
      entry
        .replace(/\b(ag|gmbh|mbh|kg|eg|se|bank|consumer|gruppe|holding|deutschland|niederlassung|zweigniederlassung)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)

  const aliases = new Set<string>()
  const aliasSource = `${baseValues.join(" ")} ${strippedValues.join(" ")}`.trim()
  if (aliasSource.includes("deutsche kreditbank") || aliasSource === "dkb") {
    aliases.add("dkb")
    aliases.add("deutsche kreditbank")
    aliases.add("deutsche kreditbank ag")
  }

  const leadTokens = Array.from(
    new Set(
      [...baseValues, ...strippedValues]
        .flatMap((entry) => {
          const tokens = entry.split(" ").filter(Boolean)
          const first = tokens[0] ?? ""
          const firstTwo = tokens.slice(0, 2).join(" ").trim()
          return [first.length > 0 && first.length <= 4 ? first : "", firstTwo]
        })
        .filter(Boolean)
    )
  )

  return Array.from(new Set([...baseValues, ...strippedValues, ...leadTokens, ...aliases].filter(Boolean)))
}

function buildProviderLookup(items: ProviderApiResponse["items"]) {
  const lookup: Record<string, ProviderBrand> = {}

  for (const row of items ?? []) {
    const provider = row?.provider
    if (!provider) continue
    const image = logoSrc(provider)
    if (!image) continue

    const brand: ProviderBrand = {
      id: provider.id,
      name: provider.name,
      src: image.src,
      variant: image.variant,
      source: "provider",
      scale: providerLogoScaleHint(provider.name, `${provider.logo_horizontal_path ?? ""} ${provider.logo_icon_path ?? ""}`, "provider"),
    }

    for (const key of [
      ...providerLookupKeys(provider.name),
      ...providerLookupKeys(provider.slug),
      ...providerLookupKeys(provider.logo_horizontal_path),
      ...providerLookupKeys(provider.logo_icon_path),
    ]) {
      if (!lookup[key]) lookup[key] = brand
    }
  }

  return lookup
}

function findProviderBrand(lookup: Record<string, ProviderBrand>, providerName: string) {
  const keys = providerLookupKeys(providerName)
  for (const key of keys) {
    if (lookup[key]) return lookup[key]
  }

  return null
}

function europaceProviderBrand(snapshot: OfferSnapshot, providerName: string) {
  const remoteUrl = trimOrNull(snapshot?.ratenkredit?.produktanbieter?.logo?.svg)
  if (!remoteUrl) return null

  return {
    id: `europace:${providerName}`,
    name: providerName,
    src: `/api/baufi/provider-logo?url=${encodeURIComponent(remoteUrl)}`,
    variant: "horizontal" as const,
    source: "europace" as const,
    scale: providerLogoScaleHint(providerName, remoteUrl, "europace"),
  }
}

function resolveProviderBrand(
  lookup: Record<string, ProviderBrand>,
  providerName: string,
  snapshot: OfferSnapshot,
  allowSnapshotFallback: boolean
) {
  const snapshotBrand = europaceProviderBrand(snapshot, providerName)
  if (snapshotBrand) return snapshotBrand

  const providerBrand = findProviderBrand(lookup, providerName)
  if (providerBrand || !allowSnapshotFallback) return providerBrand
  return null
}

function ProviderLogo({ brand, providerName, lookupLoading }: ProviderLogoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!brand) {
    if (lookupLoading) {
      return <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
    }

    return <span className="text-lg font-semibold text-slate-400">{providerName.slice(0, 1).toUpperCase()}</span>
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {!loaded && !failed ? <div className="absolute inset-0 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" /> : null}
      {!failed ? (
        <Image
          src={brand.src}
          alt={brand.name}
          width={brand.variant === "icon" ? 40 : 160}
          height={40}
          className={`${brand.variant === "icon" ? "h-11 w-11 object-contain object-center" : "h-10 w-full object-contain object-center"} ${
            loaded ? "opacity-100" : "opacity-0"
          } transition-opacity duration-200`}
          unoptimized
          loading="lazy"
          style={
            brand.scale && brand.scale !== 1
              ? {
                  transform: `scale(${brand.scale})`,
                  transformOrigin: "center center",
                }
              : undefined
          }
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true)
            setLoaded(true)
          }}
        />
      ) : (
        <span className="text-lg font-semibold text-slate-400">{providerName.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  )
}

function isAccountCheckRequirement(entry: OfferMessage | null | undefined) {
  const haystack = [
    String(entry?.property ?? ""),
    String(entry?.text ?? ""),
    String(entry?.category ?? ""),
    String(entry?.reason ?? ""),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes("kontocheck") || haystack.includes("accountcheck") || haystack.includes("account check")
}

function editableFieldsForRequirement(entry: OfferMessage | null | undefined) {
  if (isAccountCheckRequirement(entry)) return [] as QuickEditField[]

  const haystack = [String(entry?.property ?? ""), String(entry?.text ?? ""), String(entry?.reason ?? "")]
    .join(" ")
    .toLowerCase()

  return editableFieldsForText(haystack)
}

function editableFieldsForText(input: string | null | undefined) {
  const haystack = String(input ?? "").toLowerCase()
  const fields = new Set<QuickEditField>()

  if (
    haystack.includes("telefonprivat") ||
    haystack.includes("telefon privat") ||
    haystack.includes("telefonnummer") ||
    haystack.includes("mobile telefonnummer")
  ) {
    fields.add("phone")
  }

  if (
    haystack.includes("geburtsdatum") ||
    haystack.includes("birth_date") ||
    haystack.includes("personendaten.geburtsdatum")
  ) {
    fields.add("birth_date")
  }

  if (
    haystack.includes("indeutschlandseit") ||
    haystack.includes("in deutschland seit") ||
    haystack.includes("herkunft.indeutschlandseit") ||
    haystack.includes("wohnhaft seit") ||
    haystack.includes("residence_since") ||
    haystack.includes("address_since")
  ) {
    fields.add("address_since")
  }

  if (
    haystack.includes("voranschrift") ||
    haystack.includes("previous_address_since") ||
    haystack.includes("voranschrift wohnhaft seit")
  ) {
    fields.add("previous_address_since")
  }

  if (
    haystack.includes("beschäftigt seit") ||
    haystack.includes("beschaeftigt seit") ||
    haystack.includes("employment_since") ||
    haystack.includes("beschäftigung seit") ||
    haystack.includes("beschaeftigung seit")
  ) {
    fields.add("employment_since")
  }

  if (
    haystack.includes("kontoverbindung") ||
    haystack.includes("auszahlungskonto") ||
    haystack.includes(" iban") ||
    haystack.startsWith("iban") ||
    haystack.includes(" bic") ||
    haystack.startsWith("bic")
  ) {
    fields.add("bank_account_holder")
    fields.add("bank_iban")
    fields.add("bank_bic")
  }

  return Array.from(fields)
}

function collectOfferDiagnostics(offer: EuropaceOfferRow): OfferDiagnostics {
  const messages = Array.isArray(offer.angebot_snapshot?.vollstaendigkeit?.messages)
    ? offer.angebot_snapshot.vollstaendigkeit.messages
    : []

  const requirements = new Map<string, OfferRequirement>()

  for (const entry of messages) {
    const text = normalizeDiagnosticText({
      property: entry?.property,
      text: entry?.text,
      category: entry?.category,
    })
    if (!text) continue

    const kind = isAccountCheckRequirement(entry) ? "post_selection" : "blocking"
    const editableFields = kind === "blocking" ? editableFieldsForRequirement(entry) : []
    const key = `${kind}|${String(entry?.property ?? "").trim()}|${text}`

    if (!requirements.has(key)) {
      requirements.set(key, {
        key,
        text,
        kind,
        editableFields,
      })
    }
  }

  const rows = Array.from(requirements.values())
  const blocking = rows.filter((row) => row.kind === "blocking")
  const postSelection = rows.filter((row) => row.kind === "post_selection")

  return {
    blocking,
    postSelection,
    editableFields: Array.from(new Set(blocking.flatMap((row) => row.editableFields))),
  }
}


function accountCheckInfoForStatus(
  mode: string | null | undefined,
  hasPostSelectionRequirement: boolean,
  isComplete: boolean,
  accountCheckCompleted: boolean
) {
  const raw = normalizeStatus(mode)
  const required = raw === "REQUIRED" || hasPostSelectionRequirement

  if (required && isComplete && accountCheckCompleted) {
    return {
      label: "Kontocheck erledigt",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      note: "Der Kontocheck wurde bereits übernommen. Diese finalen Konditionen sind jetzt freigegeben.",
    }
  }

  if (required) {
    return {
      label: "Kontocheck zuerst nötig",
      className: "border-cyan-200 bg-cyan-50 text-cyan-800",
      note: "Vor der finalen Auswahl ist für dieses Angebot zuerst ein Kontocheck nötig.",
    }
  }

  if (raw === "OPTIONAL") {
    return {
      label: "Kontocheck optional",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      note: "Falls der Anbieter einen Kontocheck nutzt, startest du ihn nach deiner Auswahl direkt online im Browser.",
    }
  }

  if (raw === "NONE") {
    return {
      label: "Ohne Kontocheck",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      note: "Für dieses Angebot ist aktuell kein separater Kontocheck nötig.",
    }
  }

  return null
}

function offerMetricValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  return Number(value)
}

function productFamilyKey(productName: string | null | undefined) {
  const normalized = normalizeProviderKey(productName)
  if (!normalized) return "standard"

  const family = normalized
    .replace(/\b(?:konto\s*check|kontocheck|account\s*check|accountcheck)\b/g, " ")
    .replace(/\b(?:kredit|ratenkredit|raten|darlehen|mit|ohne|der|die|das|und)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return family || "standard"
}

function offerViewGroupKey(view: OfferView) {
  const snapshot = view.snapshot

  return JSON.stringify({
    providerName: normalizeProviderKey(view.providerName),
    productFamily: productFamilyKey(view.productName),
    digital: Boolean(snapshot?.sofortkredit),
    monthlyRate: offerMetricValue(snapshot?.gesamtkonditionen?.rateMonatlich),
    effectiveRate: offerMetricValue(snapshot?.gesamtkonditionen?.effektivzins),
    nominalRate: offerMetricValue(snapshot?.gesamtkonditionen?.sollzins),
    netAmount: offerMetricValue(
      snapshot?.gesamtkonditionen?.nettokreditbetrag ?? snapshot?.gesamtkonditionen?.gesamtkreditbetrag
    ),
    payoutAmount: offerMetricValue(snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    termMonths: offerMetricValue(snapshot?.gesamtkonditionen?.laufzeitInMonaten),
  })
}

function accountCheckModeRank(view: OfferView) {
  const mode = normalizeStatus(view.snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)
  if (mode === "NONE") return 0
  if (mode === "OPTIONAL") return 1
  if (mode === "REQUIRED") return 2
  return 3
}

function offerNamePenalty(view: OfferView) {
  const normalized = normalizeProviderKey(view.productName)
  if (!normalized) return 0
  let penalty = 0
  if (normalized.includes("kontocheck") || normalized.includes("accountcheck") || normalized.includes("account check")) {
    penalty += 2
  }
  return penalty
}

function compareOfferTimestamps(left: string | null | undefined, right: string | null | undefined) {
  const leftTs = trimOrNull(left) ? new Date(String(left)).getTime() : 0
  const rightTs = trimOrNull(right) ? new Date(String(right)).getTime() : 0
  return rightTs - leftTs
}

function compareOfferGroupCandidates(a: OfferView, b: OfferView) {
  const priorityDiff = offerPriority(a) - offerPriority(b)
  if (priorityDiff !== 0) return priorityDiff

  const accountCheckDiff = accountCheckModeRank(a) - accountCheckModeRank(b)
  if (accountCheckDiff !== 0) return accountCheckDiff

  const namePenaltyDiff = offerNamePenalty(a) - offerNamePenalty(b)
  if (namePenaltyDiff !== 0) return namePenaltyDiff

  const revisionDiff = compareEuropaceOfferRevisionsDesc(a.offer.angebot_id, b.offer.angebot_id)
  if (revisionDiff !== 0) return revisionDiff

  const scoreDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.vorhersage?.machbarkeit?.score),
    offerMetricValue(b.snapshot?.vorhersage?.machbarkeit?.score),
    "desc"
  )
  if (scoreDiff !== 0) return scoreDiff

  const acceptedDiff = compareOfferTimestamps(a.offer.accepted_at, b.offer.accepted_at)
  if (acceptedDiff !== 0) return acceptedDiff

  const calculatedDiff = compareOfferTimestamps(a.offer.calculated_at, b.offer.calculated_at)
  if (calculatedDiff !== 0) return calculatedDiff

  return sortOfferViews(a, b)
}

function dedupeOfferViews(views: OfferView[]) {
  const groups = new Map<string, { best: OfferView; count: number }>()

  for (const view of views) {
    const key = offerViewGroupKey(view)
    const current = groups.get(key)
    if (!current) {
      groups.set(key, { best: view, count: 1 })
      continue
    }

    current.count += 1
    if (compareOfferGroupCandidates(view, current.best) < 0) {
      current.best = view
    }
  }

  const deduped = Array.from(groups.values())
    .map((entry) => entry.best)
    .sort(sortOfferViews)

  return {
    items: deduped,
    hiddenCount: views.length - deduped.length,
  }
}

function createCaseQuery(caseId: string, requestContext?: Record<string, unknown>) {
  const params = new URLSearchParams({ caseId })
  for (const [key, value] of Object.entries(requestContext ?? {})) {
    if (value === null || value === undefined) continue
    const normalized = String(value).trim()
    if (!normalized) continue
    params.set(key, normalized)
  }
  return `/api/live/case?${params.toString()}`
}

function createCasePayload(caseId: string, requestContext: Record<string, unknown> | undefined, payload: Record<string, unknown>) {
  return {
    caseId,
    ...(requestContext ?? {}),
    ...payload,
  }
}

function isOfferAcceptable(offer: EuropaceOfferRow) {
  const vollstaendig = normalizeStatus(offer.vollstaendigkeit_status) === "VOLLSTAENDIG"
  const machbarkeit = normalizeStatus(offer.machbarkeit_status)
  const machbar = machbarkeit === "MACHBAR" || machbarkeit === "MACHBAR_UNTER_VORBEHALT"
  return vollstaendig && machbar && !offer.accepted_at && !offer.superseded_at
}

function isOfferGreen(view: OfferView) {
  const vollstaendig = normalizeStatus(view.offer.vollstaendigkeit_status) === "VOLLSTAENDIG"
  const machbarkeit = normalizeStatus(view.offer.machbarkeit_status)
  return (
    !view.offer.superseded_at &&
    !view.offer.accepted_at &&
    machbarkeit === "MACHBAR" &&
    vollstaendig &&
    (!view.accountCheckRequired || view.accountCheckCompleted)
  )
}

function isDirectOnlineOffer(view: OfferView) {
  return Boolean(view.snapshot?.sofortkredit) && !view.accountCheckRestricted
}

function isDeclinedOffer(view: OfferView) {
  const machbarkeit = normalizeStatus(view.offer.machbarkeit_status)
  return !view.offer.accepted_at && !view.offer.superseded_at && machbarkeit === "NICHT_MACHBAR"
}

function isTechnicalFailureOffer(view: OfferView) {
  return !view.offer.accepted_at && !view.offer.superseded_at && view.technicalAcceptanceFailed
}

function isRejectedAcceptedOffer(view: OfferView, hasRejectedApplication: boolean) {
  return hasRejectedApplication && Boolean(view.offer.accepted_at) && !Boolean(view.offer.superseded_at)
}

function isPendingFeedbackOffer(view: OfferView, hasRejectedApplication = false) {
  if (isTechnicalFailureOffer(view)) return true
  return (
    !view.offer.accepted_at &&
    !view.offer.superseded_at &&
    !isOfferGreen(view) &&
    !requiresAccountCheckBeforeSelection(view) &&
    !isDeclinedOffer(view) &&
    !isRejectedAcceptedOffer(view, hasRejectedApplication)
  )
}

function feedbackTextForOffer(
  view: OfferView,
  options?: {
    hasRejectedApplication?: boolean
    rejectedApplicationMessage?: string | null
  }
) {
  if (isRejectedAcceptedOffer(view, Boolean(options?.hasRejectedApplication))) {
    return (
      trimOrNull(options?.rejectedApplicationMessage) ??
      "Der Produktanbieter hat den Antrag im Rahmen interner Vergaberichtlinien abgelehnt."
    )
  }

  if (isTechnicalFailureOffer(view)) {
    return "Diese Variante konnte technisch nicht final bestätigt werden. Bitte lade die Angebote neu oder wähle eine andere Bank."
  }

  if (view.accountCheckRestricted && view.diagnostics.postSelection.length > 0 && view.diagnostics.blocking.length === 0) {
    return view.accountCheckRestrictedReason ?? "Dieser Fall läuft aktuell nur mit SEPANA-Begleitung weiter."
  }

  const messages = [
    ...view.machbarkeitMessages.map((entry) => customerFacingMessage(entry?.text)),
    ...view.diagnostics.blocking.map((entry) => customerFacingMessage(entry.text)),
    ...(view.accountCheckRestricted ? [] : view.diagnostics.postSelection.map((entry) => customerFacingMessage(entry.text))),
  ]
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)

  const unique = Array.from(new Set(messages))
  if (unique.length) return unique[0]

  if (isDeclinedOffer(view)) {
    return "Der Anbieter hat unter den aktuellen Angaben kein freigegebenes Angebot bereitgestellt."
  }

  const machbarkeit = normalizeStatus(view.offer.machbarkeit_status)
  if (machbarkeit === "MACHBAR_UNTER_VORBEHALT") {
    return "Dieses Angebot ist aktuell nur unter Vorbehalt verfügbar und noch nicht final freigegeben."
  }

  if (normalizeStatus(view.offer.vollstaendigkeit_status) === "UNVOLLSTAENDIG") {
    return "Dieses Angebot ist aktuell noch nicht vollständig freigegeben."
  }

  return "Dieses Angebot ist aktuell noch nicht final auswählbar."
}

function requiresAccountCheckBeforeSelection(view: OfferView) {
  if (!belongsToAccountCheckSection(view)) return false
  return !view.accountCheckCompleted
}

function belongsToAccountCheckSection(view: OfferView) {
  if (view.accountCheckRestricted) return false
  return !view.offer.accepted_at && !view.offer.superseded_at && view.accountCheckRequired && !view.technicalAcceptanceFailed
}

function compareNullableNumbers(a: number | null, b: number | null, direction: "asc" | "desc" = "asc") {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return direction === "asc" ? a - b : b - a
}

function offerPriority(view: OfferView) {
  const accepted = Boolean(view.offer.accepted_at)
  const superseded = Boolean(view.offer.superseded_at)
  const blockingCount = view.diagnostics.blocking.length
  const machbarkeit = normalizeStatus(view.offer.machbarkeit_status)

  if (accepted && !superseded) return 0
  if (!superseded && isOfferGreen(view)) return 1
  if (!superseded && requiresAccountCheckBeforeSelection(view)) return 2
  if (!superseded && blockingCount === 0 && machbarkeit === "MACHBAR_UNTER_VORBEHALT") return 3
  if (!superseded && blockingCount > 0) return 4
  if (!superseded && view.technicalAcceptanceFailed) return 5
  if (!superseded && machbarkeit === "NICHT_MACHBAR") return 6
  if (!superseded) return 7
  return 7
}

function buildOfferViewPreviewWithPolicy(
  offer: EuropaceOfferRow,
  options?: {
    accountCheckRestrictedReason?: string | null
    accountCheckCompleted?: boolean
    technicallyBlockedOfferIds?: Set<string>
  }
) {
  const snapshot = offer.angebot_snapshot ?? null
  const diagnostics = collectOfferDiagnostics(offer)
  const isComplete = normalizeStatus(offer.vollstaendigkeit_status) === "VOLLSTAENDIG"
  const accountCheckRestrictedReason = trimOrNull(options?.accountCheckRestrictedReason)
  const accountCheckRestricted = Boolean(accountCheckRestrictedReason)
  const accountCheckCompleted = Boolean(options?.accountCheckCompleted)
  const technicalAcceptanceFailed = Boolean(options?.technicallyBlockedOfferIds?.has(offer.angebot_id))
  const accountCheckRequired =
    !accountCheckRestricted &&
    (normalizeStatus(snapshot?.digitalisierungsmerkmale?.accountCheck?.modus) === "REQUIRED" ||
      diagnostics.postSelection.length > 0)
  return {
    offer,
    snapshot,
    providerName: snapshot?.ratenkredit?.produktanbieter?.name ?? "-",
    productName: trimOrNull(snapshot?.ratenkredit?.produktbezeichnung),
    missingMessages: Array.isArray(snapshot?.vollstaendigkeit?.messages) ? snapshot.vollstaendigkeit.messages : [],
    machbarkeitMessages: Array.isArray(snapshot?.machbarkeit?.messages) ? snapshot.machbarkeit.messages : [],
    diagnostics,
    accountCheckRequired,
    accountCheckCompleted,
    accountCheck: accountCheckRestricted
      ? null
      : accountCheckInfoForStatus(
          snapshot?.digitalisierungsmerkmale?.accountCheck?.modus,
          diagnostics.postSelection.length > 0,
          isComplete,
          accountCheckCompleted
        ),
    accountCheckRestricted,
    accountCheckRestrictedReason,
    technicalAcceptanceFailed,
    providerBrand: null,
  }
}

function summarizeOfferSelection(
  nextOffers: EuropaceOfferRow[],
  options?: { accountCheckRestrictedReason?: string | null; accountCheckCompleted?: boolean }
) {
  const views = dedupeOfferViews(nextOffers.map((offer) => buildOfferViewPreviewWithPolicy(offer, options)).sort(sortOfferViews)).items
  const selectable = views.filter((view) => isOfferGreen(view))
  const accountCheckPending = views.filter((view) => requiresAccountCheckBeforeSelection(view))
  const directOnlineSelectable = selectable.filter((view) => isDirectOnlineOffer(view))
  const guidedSelectable = selectable.filter((view) => !isDirectOnlineOffer(view))
  const declined = views.filter((view) => isDeclinedOffer(view))
  const pendingFeedback = views.filter((view) => isPendingFeedbackOffer(view))
  return {
    selectable,
    accountCheckPending,
    directOnlineSelectable,
    guidedSelectable,
    declined,
    pendingFeedback,
    bestSelectable: directOnlineSelectable[0] ?? selectable[0] ?? null,
  }
}

function sortOfferViews(a: OfferView, b: OfferView) {
  const priorityDiff = offerPriority(a) - offerPriority(b)
  if (priorityDiff !== 0) return priorityDiff

  const rateDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.rateMonatlich),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.rateMonatlich),
    "asc"
  )
  if (rateDiff !== 0) return rateDiff

  const effectiveDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.effektivzins),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.effektivzins),
    "asc"
  )
  if (effectiveDiff !== 0) return effectiveDiff

  const payoutDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    "desc"
  )
  if (payoutDiff !== 0) return payoutDiff

  const digitalDiff = Number(Boolean(b.snapshot?.sofortkredit)) - Number(Boolean(a.snapshot?.sofortkredit))
  if (digitalDiff !== 0) return digitalDiff

  const providerDiff = a.providerName.localeCompare(b.providerName, "de", { sensitivity: "base" })
  if (providerDiff !== 0) return providerDiff

  const productDiff = String(a.productName ?? "").localeCompare(String(b.productName ?? ""), "de", { sensitivity: "base" })
  if (productDiff !== 0) return productDiff

  const revisionDiff = compareEuropaceOfferRevisionsDesc(a.offer.angebot_id, b.offer.angebot_id)
  if (revisionDiff !== 0) return revisionDiff

  return String(a.offer.angebot_id ?? "").localeCompare(String(b.offer.angebot_id ?? ""), "de", { sensitivity: "base" })
}

function compareOfferViewsForRecommendation(a: OfferView, b: OfferView) {
  const effectiveDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.effektivzins),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.effektivzins),
    "asc"
  )
  if (effectiveDiff !== 0) return effectiveDiff

  const nominalDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.sollzins),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.sollzins),
    "asc"
  )
  if (nominalDiff !== 0) return nominalDiff

  const rateDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.rateMonatlich),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.rateMonatlich),
    "asc"
  )
  if (rateDiff !== 0) return rateDiff

  const payoutDiff = compareNullableNumbers(
    offerMetricValue(a.snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    offerMetricValue(b.snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    "desc"
  )
  if (payoutDiff !== 0) return payoutDiff

  const digitalDiff = Number(Boolean(b.snapshot?.sofortkredit)) - Number(Boolean(a.snapshot?.sofortkredit))
  if (digitalDiff !== 0) return digitalDiff

  return sortOfferViews(a, b)
}

function editorFieldLabel(field: QuickEditField) {
  if (field === "phone") return "Telefon privat"
  if (field === "birth_date") return "Geburtsdatum"
  if (field === "employment_since") return "Beschäftigt seit"
  if (field === "address_since") return "Wohnhaft seit"
  if (field === "previous_address_since") return "Voranschrift wohnhaft seit"
  if (field === "bank_account_holder") return "Kontoinhaber"
  if (field === "bank_iban") return "IBAN"
  return "BIC"
}

export default function EuropaceCustomerOffersCard({
  caseId,
  initialOffers,
  initialMeta,
  offersEndpoint = "/api/app/privatkredit/europace/offers",
  acceptEndpoint = "/api/app/privatkredit/europace/offers/accept",
  jobEndpoint = "/api/app/privatkredit/europace/offers/job",
  requestContext,
  applicationSuccessMessage,
  mode = "accept",
  selectionPath,
  autoRereshOnMount = false,
  autoRefreshOnMount,
  emptyStateMessage,
  accountCheckStartEndpoint,
  hasRejectedApplication = false,
  rejectedApplicationMessage = null,
  accountCheckRestrictedReason = null,
  initialAccountCheckCompleted = false,
  initialTechnicallyBlockedOfferIds = [],
  lockPublicOffers = false,
  contactPhone = null,
  surface = "customer_case",
}: {
  caseId: string
  initialOffers: EuropaceOfferRow[]
  initialMeta: EuropaceMeta
  offersEndpoint?: string
  acceptEndpoint?: string
  jobEndpoint?: string
  requestContext?: Record<string, unknown>
  applicationSuccessMessage?: string
  mode?: "accept" | "select"
  selectionPath?: string
  autoRereshOnMount?: boolean
  autoRefreshOnMount?: boolean
  emptyStateMessage?: string
  accountCheckStartEndpoint?: string
  hasRejectedApplication?: boolean
  rejectedApplicationMessage?: string | null
  accountCheckRestrictedReason?: string | null
  initialAccountCheckCompleted?: boolean
  initialTechnicallyBlockedOfferIds?: string[]
  lockPublicOffers?: boolean
  contactPhone?: string | null
  surface?: "customer_case" | "public_onlinekredit"
}) {
  const router = useRouter()
  const [offers, setOffers] = useState<EuropaceOfferRow[]>(initialOffers ?? [])
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(() => {
    const acceptedOffer =
      (initialOffers ?? []).find((offer) => Boolean(offer.accepted_at) && !Boolean(offer.superseded_at)) ?? null
    return acceptedOffer?.angebot_id ?? trimOrNull(initialMeta?.selected_angebot_id) ?? null
  })
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null)
  const [refreshingOffers, setRefreshingOffers] = useState(false)
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(trimOrNull(initialMeta?.last_error))
  const [providerLookup, setProviderLookup] = useState<Record<string, ProviderBrand>>({})
  const [providerLookupLoading, setProviderLookupLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorFields, setEditorFields] = useState<QuickEditField[]>([])
  const [editorReasons, setEditorReasons] = useState<string[]>([])
  const [editorState, setEditorState] = useState<QuickEditState>(EMPTY_QUICK_EDIT)
  const [editorSuggestedAccountHolder, setEditorSuggestedAccountHolder] = useState<string>("")
  const [editorAutofilledBic, setEditorAutofilledBic] = useState<string | null>(null)
  const [editorBicLookupLoading, setEditorBicLookupLoading] = useState(false)
  const [editorBicLookupError, setEditorBicLookupError] = useState<string | null>(null)
  const [accountCheckDialogView, setAccountCheckDialogView] = useState<OfferView | null>(null)
  const [accountCheckStatus, setAccountCheckStatus] = useState<"idle" | "starting" | "activated">("idle")
  const [accountCheckCompleted, setAccountCheckCompleted] = useState(initialAccountCheckCompleted)
  const [accountCheckDialogError, setAccountCheckDialogError] = useState<string | null>(null)
  const [accountCheckWizardSessionKey, setAccountCheckWizardSessionKey] = useState<string | null>(null)
  const [accountCheckRereshOverlay, setAccountCheckRereshOverlay] = useState(false)
  const [job, setJob] = useState<JobState>({
    jobId: trimOrNull(initialMeta?.annahme_job_id),
    status: trimOrNull(initialMeta?.annahme_job_id) ? "PENDING" : null,
    antragsnummer: trimOrNull(initialMeta?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(initialMeta?.produktanbieterantragsnummer),
    hasApplication: Boolean(trimOrNull(initialMeta?.antragsnummer)),
  })

  const selectionMode = mode === "select"
  const isPublicOnlinekredit = surface === "public_onlinekredit"
  const isCustomerCase = surface === "customer_case"
  const shouldAutoRefreshOnMount = autoRefreshOnMount ?? autoRereshOnMount
  const accountCheckStorageKey = `sepana:account-check-finished:v2:${caseId}`
  const hasRunningJob = !selectionMode && Boolean(job.jobId) && (job.status === null || job.status === "PENDING")
  const normalizedAccountCheckRestrictedReason = trimOrNull(accountCheckRestrictedReason)
  const normalizedRejectedApplicationMessage = trimOrNull(rejectedApplicationMessage)
  const hasRejectedApplicationFromMeta = useMemo(
    () =>
      hasRejectedApplicationInSnapshot(initialMeta?.last_export_snapshot, {
        antragsnummer: initialMeta?.antragsnummer,
        produktanbieterantragsnummer: initialMeta?.produktanbieterantragsnummer,
      }),
    [initialMeta?.last_export_snapshot, initialMeta?.antragsnummer, initialMeta?.produktanbieterantragsnummer]
  )
  const resolvedHasRejectedApplication = hasRejectedApplication || hasRejectedApplicationFromMeta
  const publicMetaError = useMemo(
    () =>
      trimOrNull(metaError)
        ? customerText(toPublicOfferAcceptanceMessage(metaError, { hasRejectedApplication: resolvedHasRejectedApplication }))
        : null,
    [metaError, resolvedHasRejectedApplication]
  )
  const technicallyBlockedOfferIds = useMemo(
    () => new Set((initialTechnicallyBlockedOfferIds ?? []).map((value) => trimOrNull(value)).filter(Boolean) as string[]),
    [initialTechnicallyBlockedOfferIds]
  )
  const offerViews = useMemo<OfferView[]>(() => {
    return offers
      .map((offer) => {
      const snapshot = offer.angebot_snapshot ?? null
      const providerName = snapshot?.ratenkredit?.produktanbieter?.name ?? "-"
      const productName = trimOrNull(snapshot?.ratenkredit?.produktbezeichnung)
      const missingMessages = Array.isArray(snapshot?.vollstaendigkeit?.messages) ? snapshot.vollstaendigkeit.messages : []
      const machbarkeitMessages = Array.isArray(snapshot?.machbarkeit?.messages) ? snapshot.machbarkeit.messages : []
      const diagnostics = collectOfferDiagnostics(offer)
      const isComplete = normalizeStatus(offer.vollstaendigkeit_status) === "VOLLSTAENDIG"
      const accountCheckRequired =
        !normalizedAccountCheckRestrictedReason &&
        (normalizeStatus(snapshot?.digitalisierungsmerkmale?.accountCheck?.modus) === "REQUIRED" ||
          diagnostics.postSelection.length > 0)
      const technicalAcceptanceFailed = technicallyBlockedOfferIds.has(offer.angebot_id)

        return {
          offer,
          snapshot,
          providerName,
          productName,
          missingMessages,
          machbarkeitMessages,
          diagnostics,
        accountCheckRequired,
        accountCheckCompleted,
        accountCheck: normalizedAccountCheckRestrictedReason
          ? null
          : accountCheckInfoForStatus(
              snapshot?.digitalisierungsmerkmale?.accountCheck?.modus,
              diagnostics.postSelection.length > 0,
              isComplete,
              accountCheckCompleted
            ),
        accountCheckRestricted: Boolean(normalizedAccountCheckRestrictedReason),
        accountCheckRestrictedReason: normalizedAccountCheckRestrictedReason,
        technicalAcceptanceFailed,
        providerBrand: resolveProviderBrand(providerLookup, providerName, snapshot, !providerLookupLoading),
      }
      })
      .sort(sortOfferViews)
  }, [offers, providerLookup, providerLookupLoading, normalizedAccountCheckRestrictedReason, accountCheckCompleted, technicallyBlockedOfferIds])

  const dedupedOfferViews = useMemo(() => dedupeOfferViews(offerViews), [offerViews])
  const finalSelectableOfferViews = useMemo(
    () => dedupedOfferViews.items.filter((view) => isOfferGreen(view)),
    [dedupedOfferViews]
  )
  const regularFinalSelectableOfferViews = useMemo(
    () => finalSelectableOfferViews.filter((view) => !belongsToAccountCheckSection(view)),
    [finalSelectableOfferViews]
  )
  const visibleOfferViews = useMemo(
    () =>
      dedupedOfferViews.items.filter((view) => {
        if (isRejectedAcceptedOffer(view, resolvedHasRejectedApplication)) return false
        if (view.technicalAcceptanceFailed) return false
        return (view.offer.accepted_at && !view.offer.superseded_at) || isOfferGreen(view)
      }),
    [dedupedOfferViews, resolvedHasRejectedApplication]
  )
  const acceptedOfferViews = useMemo(
    () => visibleOfferViews.filter((view) => Boolean(view.offer.accepted_at) && !Boolean(view.offer.superseded_at)),
    [visibleOfferViews]
  )
  const currentApplicationNo = trimOrNull(job.antragsnummer) ?? trimOrNull(initialMeta?.antragsnummer)
  const currentProviderReference =
    trimOrNull(job.produktanbieterantragsnummer) ?? trimOrNull(initialMeta?.produktanbieterantragsnummer)
  const shouldHideCustomerLiveOfferSections =
    isCustomerCase &&
    !resolvedHasRejectedApplication &&
    (acceptedOfferViews.length > 0 ||
      Boolean(selectedOfferId) ||
      Boolean(currentApplicationNo) ||
      Boolean(currentProviderReference) ||
      Boolean(job.jobId) ||
      job.hasApplication)
  const shouldHidePublicLiveOfferSections = isPublicOnlinekredit && lockPublicOffers && !resolvedHasRejectedApplication
  const shouldHideLiveOfferSections = shouldHideCustomerLiveOfferSections || shouldHidePublicLiveOfferSections
  const lockedOfferViews = useMemo(() => {
    if (!shouldHideLiveOfferSections) return [] as OfferView[]
    if (acceptedOfferViews.length > 0) return acceptedOfferViews.slice(0, 1)
    if (selectedOfferId) {
      const selectedView = dedupedOfferViews.items.find((view) => view.offer.angebot_id === selectedOfferId) ?? null
      if (selectedView) return [selectedView]
    }
    if (currentApplicationNo && dedupedOfferViews.items.length === 1) {
      return [dedupedOfferViews.items[0]]
    }
    return [] as OfferView[]
  }, [
    acceptedOfferViews,
    currentApplicationNo,
    dedupedOfferViews,
    selectedOfferId,
    shouldHideLiveOfferSections,
  ])
  const selectableVisibleOfferViews = useMemo(
    () => visibleOfferViews.filter((view) => !Boolean(view.offer.accepted_at)),
    [visibleOfferViews]
  )
  const directOnlineOfferViews = useMemo(
    () => selectableVisibleOfferViews.filter((view) => !belongsToAccountCheckSection(view) && isDirectOnlineOffer(view)),
    [selectableVisibleOfferViews]
  )
  const guidedOfferViews = useMemo(
    () => selectableVisibleOfferViews.filter((view) => !belongsToAccountCheckSection(view) && !isDirectOnlineOffer(view)),
    [selectableVisibleOfferViews]
  )
  const accountCheckOfferViews = useMemo(
    () => dedupedOfferViews.items.filter((view) => belongsToAccountCheckSection(view)),
    [dedupedOfferViews]
  )
  const publicSelectableOrAccountCheckOfferViews = useMemo(
    () =>
      dedupedOfferViews.items.filter((view) => {
        if (isRejectedAcceptedOffer(view, resolvedHasRejectedApplication)) return false
        if (view.technicalAcceptanceFailed) return false
        if (view.offer.superseded_at || view.offer.accepted_at) return false
        return isOfferGreen(view) || requiresAccountCheckBeforeSelection(view)
      }),
    [dedupedOfferViews, resolvedHasRejectedApplication]
  )
  const pendingAccountCheckOfferViews = useMemo(
    () => accountCheckOfferViews.filter((view) => requiresAccountCheckBeforeSelection(view)),
    [accountCheckOfferViews]
  )
  const completedAccountCheckOfferViews = useMemo(
    () => accountCheckOfferViews.filter((view) => !requiresAccountCheckBeforeSelection(view)),
    [accountCheckOfferViews]
  )
  const feedbackOfferViews = useMemo(
    () =>
      dedupedOfferViews.items.filter(
        (view) => !visibleOfferViews.includes(view) && !accountCheckOfferViews.includes(view) && !view.offer.superseded_at
      ),
    [dedupedOfferViews, visibleOfferViews, accountCheckOfferViews]
  )
  const technicalFailureOfferViews = useMemo(
    () => feedbackOfferViews.filter((view) => isTechnicalFailureOffer(view)),
    [feedbackOfferViews]
  )
  const declinedOfferViews = useMemo(
    () =>
      feedbackOfferViews.filter(
        (view) =>
          !isTechnicalFailureOffer(view) &&
          (isDeclinedOffer(view) || isRejectedAcceptedOffer(view, resolvedHasRejectedApplication))
      ),
    [feedbackOfferViews, resolvedHasRejectedApplication]
  )
  const pendingFeedbackOfferViews = useMemo(
    () =>
      feedbackOfferViews.filter(
        (view) => !isTechnicalFailureOffer(view) && isPendingFeedbackOffer(view, resolvedHasRejectedApplication)
      ),
    [feedbackOfferViews, resolvedHasRejectedApplication]
  )
  const hiddenNonGreenOfferCount = useMemo(
    () => feedbackOfferViews.length,
    [feedbackOfferViews]
  )
  const renderedDirectSectionOfferViews = useMemo(
    () =>
      isPublicOnlinekredit
        ? publicSelectableOrAccountCheckOfferViews.filter((view) => isDirectOnlineOffer(view))
        : directOnlineOfferViews,
    [directOnlineOfferViews, isPublicOnlinekredit, publicSelectableOrAccountCheckOfferViews]
  )
  const renderedGuidedSectionOfferViews = useMemo(
    () =>
      isPublicOnlinekredit
        ? publicSelectableOrAccountCheckOfferViews.filter((view) => !isDirectOnlineOffer(view))
        : guidedOfferViews,
    [guidedOfferViews, isPublicOnlinekredit, publicSelectableOrAccountCheckOfferViews]
  )
  const directOnlinePendingCount = useMemo(
    () => renderedDirectSectionOfferViews.filter((view) => requiresAccountCheckBeforeSelection(view)).length,
    [renderedDirectSectionOfferViews]
  )
  const guidedPendingCount = useMemo(
    () => renderedGuidedSectionOfferViews.filter((view) => requiresAccountCheckBeforeSelection(view)).length,
    [renderedGuidedSectionOfferViews]
  )
  const hasAnyAccountCheckRequirement = useMemo(
    () => dedupedOfferViews.items.some((view) => view.accountCheckRequired),
    [dedupedOfferViews]
  )
  const resolvedContactPhone = trimOrNull(contactPhone) ?? DEFAULT_CUSTOMER_CONTACT_PHONE
  const resolvedContactPhoneHref = toTelHref(resolvedContactPhone)
  const noOfferLeadMessage =
    technicalFailureOfferViews.length > 0
      ? "Mindestens eine Bankvariante konnte technisch nicht final bestätigt werden. Lade die Angebote neu oder wähle eine andere freigegebene Bank."
      : declinedOfferViews.length > 0
      ? "Aktuell hat unter deinen Angaben noch keine Bank ein direkt auswählbares Angebot freigegeben."
      : hiddenNonGreenOfferCount > 0
        ? "Aktuell ist noch kein Angebot final freigegeben. Häufig helfen kleine Anpassungen bei Angaben wie Beschäftigung, Einkommen oder Haushaltsdaten."
        : (emptyStateMessage ??
            "Aktuell liegt noch kein auswählbares SEPANA-Angebot vor. Prüfe deine Angaben noch einmal und starte danach die Berechnung erneut.")
  const currentSyncStatus = trimOrNull(initialMeta?.sync_status)
  const currentLastSyncAt = trimOrNull(initialMeta?.last_sync_at)
  const refreshButtonLabel = refreshingOffers
    ? isPublicOnlinekredit
      ? "Status wird aktualisiert..."
      : "Berechne..."
    : isPublicOnlinekredit
      ? offers.length || currentSyncStatus || currentApplicationNo || currentProviderReference
        ? "Status aktualisieren"
        : "Live-Angebote abrufen"
      : "Live-Angebote abrufen"
  const publicStatusSummary = useMemo(() => {
    if (!isPublicOnlinekredit) return null

    if (resolvedHasRejectedApplication) {
      const hasAlternativeOffers = selectableVisibleOfferViews.length > 0 || pendingAccountCheckOfferViews.length > 0
      return {
        tone: hasAlternativeOffers ? ("amber" as const) : ("rose" as const),
        label: "Aktueller Stand",
        title: hasAlternativeOffers
          ? "Die letzte finale Anfrage wurde abgelehnt, andere Angebote bleiben aber weiter verfügbar."
          : "Die letzte Bankrückmeldung war eine Ablehnung.",
        description:
          hasAlternativeOffers
            ? "Du kannst direkt unten eine andere Bankvariante auswählen oder einen noch offenen Kontocheck fortsetzen."
            : normalizedRejectedApplicationMessage ??
              publicMetaError ??
              "Die Bank hat die finale Anfrage nicht angenommen. Prüfe bitte die übrigen freigegebenen Angebote oder aktualisiere den Status erneut.",
      }
    }

    if (job.jobId && (job.status === null || job.status === "PENDING")) {
      return {
        tone: "cyan" as const,
        label: "Anfrage läuft",
        title: "Die finale Anfrage wird gerade geprüft.",
        description: "Wir warten auf die aktuelle Rückmeldung des Produktanbieters. Du kannst den Status jederzeit neu abrufen.",
      }
    }

    if (shouldHidePublicLiveOfferSections) {
      return {
        tone: "emerald" as const,
        label: "Aktueller Stand",
        title: "Dieses Angebot ist bereits final bestätigt.",
        description:
          "Wir zeigen dir hier nur noch dein angenommenes Angebot. Weitere Varianten prüfen wir bei Bedarf gemeinsam mit deinem Berater.",
      }
    }

    if (acceptedOfferViews.length > 0) {
      return {
        tone: "emerald" as const,
        label: "Aktueller Stand",
        title: "Mindestens ein Angebot wurde bereits ausgewählt.",
        description: "Hier siehst du die aktuell freigegebenen Varianten. Mit „Status aktualisieren“ ziehst du neue Bankrückmeldungen nach.",
      }
    }

    if (publicMetaError) {
      return {
        tone: "amber" as const,
        label: "Aktueller Stand",
        title: "Es gibt eine Rückmeldung, die geprüft werden sollte.",
        description: publicMetaError,
      }
    }

    if (technicalFailureOfferViews.length > 0) {
      return {
        tone: "amber" as const,
        label: "Aktueller Stand",
        title: "Einige Varianten sind technisch blockiert.",
        description: "Diese Angebote wurden bereits nachgeladen, sind aktuell aber nicht stabil final auswählbar.",
      }
    }

    if (selectableVisibleOfferViews.length > 0) {
      return {
        tone: "emerald" as const,
        label: "Aktueller Stand",
        title: "Es liegen auswählbare Angebote vor.",
        description: "Du kannst direkt unten weitermachen oder den Status erneut aktualisieren, falls sich Bankrückmeldungen geändert haben.",
      }
    }

    if (pendingAccountCheckOfferViews.length > 0) {
      return {
        tone: "cyan" as const,
        label: "Aktueller Stand",
        title: "Für einige Varianten fehlt noch der Kontocheck.",
        description: "Sobald der Kontocheck vollständig abgeschlossen ist, können diese Angebote erneut freigegeben werden.",
      }
    }

    return {
      tone: "slate" as const,
      label: "Aktueller Stand",
      title: "Aktuell liegt noch keine finale Freigabe vor.",
      description: "Mit „Status aktualisieren“ lädst du die aktuelle Angebots- und Rückmeldelage der Banken erneut nach.",
    }
  }, [
    acceptedOfferViews.length,
    isPublicOnlinekredit,
    job.jobId,
    job.status,
    normalizedRejectedApplicationMessage,
    pendingAccountCheckOfferViews.length,
    publicMetaError,
    resolvedHasRejectedApplication,
    selectableVisibleOfferViews.length,
    shouldHidePublicLiveOfferSections,
    technicalFailureOfferViews.length,
  ])

  useEffect(() => {
    if (initialAccountCheckCompleted) {
      setAccountCheckCompleted(true)
      setAccountCheckStatus("activated")
    }
  }, [initialAccountCheckCompleted])

  useEffect(() => {
    if (!accountCheckStartEndpoint) return
    try {
      if (initialAccountCheckCompleted || window.localStorage.getItem(accountCheckStorageKey)) {
        setAccountCheckCompleted(true)
        setAccountCheckStatus("activated")
      }
    } catch {
      // ignore storage issues
    }
  }, [accountCheckStartEndpoint, accountCheckStorageKey, initialAccountCheckCompleted])

  useEffect(() => {
    if (hasAnyAccountCheckRequirement) return
    setAccountCheckStatus((current) => (current === "starting" ? current : "idle"))
    setAccountCheckCompleted(false)
    setAccountCheckDialogError(null)
    setAccountCheckWizardSessionKey(null)
    try {
      window.localStorage.removeItem(accountCheckStorageKey)
    } catch {
      // ignore storage issues
    }
  }, [hasAnyAccountCheckRequirement, accountCheckStorageKey])

  async function markAccountCheckCompleted() {
    const response = await fetch("/api/onlinekredit/account-check/finished", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createCasePayload(caseId, requestContext, {})),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      throw new Error(customerText(json?.error) || "Kontocheck konnte noch nicht als abgeschlossen gespeichert werden.")
    }
  }

  async function startAccountCheck() {
    if (!accountCheckStartEndpoint) return

    setAccountCheckStatus("starting")
    setAccountCheckCompleted(false)
    setAccountCheckDialogError(null)
    setAccountCheckWizardSessionKey(null)
    setError(null)
    setMessage(null)
    try {
      window.localStorage.removeItem(accountCheckStorageKey)
    } catch {
      // ignore storage issues
    }

    try {
      const response = await fetch(accountCheckStartEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createCasePayload(caseId, requestContext, {})),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(customerText(json?.error) || "Kontocheck konnte nicht gestartet werden.")
      }

      const wizardSessionKey = trimOrNull(json?.wizardSessionKey)
      if (!wizardSessionKey) {
        throw new Error("Kontocheck konnte nicht vorbereitet werden. Das Browser-Fenster fehlt.")
      }

      setAccountCheckWizardSessionKey(wizardSessionKey)
      setAccountCheckStatus("activated")
      setMessage("Kontocheck gestartet. Führe ihn jetzt direkt im Browser vollständig durch und rufe danach die Live-Angebote erneut ab.")
    } catch (accountCheckError) {
      setAccountCheckStatus("idle")
      setAccountCheckWizardSessionKey(null)
      setAccountCheckDialogError(
        accountCheckError instanceof Error
          ? customerText(accountCheckError.message) || "Kontocheck konnte nicht gestartet werden."
          : "Kontocheck konnte nicht gestartet werden."
      )
    }
  }

  function reopenAccountCheck(view?: OfferView | null) {
    const nextView = view ?? accountCheckDialogView ?? accountCheckOfferViews[0] ?? null
    if (nextView) {
      setAccountCheckDialogView(nextView)
    }
    void startAccountCheck()
  }
  const activeOfferViews = useMemo(() => visibleOfferViews.filter((entry) => !entry.offer.superseded_at), [visibleOfferViews])
  const summarySelectableOfferViews = useMemo(
    () => (isPublicOnlinekredit ? selectableVisibleOfferViews : regularFinalSelectableOfferViews),
    [isPublicOnlinekredit, regularFinalSelectableOfferViews, selectableVisibleOfferViews]
  )
  const summaryDirectOnlineOfferViews = useMemo(
    () => summarySelectableOfferViews.filter((view) => isDirectOnlineOffer(view)),
    [summarySelectableOfferViews]
  )
  const summaryGuidedOfferViews = useMemo(
    () => summarySelectableOfferViews.filter((view) => !isDirectOnlineOffer(view)),
    [summarySelectableOfferViews]
  )
  const recommendedFinalSelectableOffer = useMemo(
    () => [...summarySelectableOfferViews].sort(compareOfferViewsForRecommendation)[0] ?? null,
    [summarySelectableOfferViews]
  )

  const acceptableOfferCount = useMemo(
    () => activeOfferViews.filter((entry) => isOfferAcceptable(entry.offer)).length,
    [activeOfferViews]
  )

  const diagnostics = useMemo(() => {
    const blocking = new Map<string, OfferRequirement>()
    const editableReasons = new Map<string, OfferRequirement>()
    const editableFields = new Set<QuickEditField>()
    const feasibility = new Map<string, string>()
    let postSelectionOfferCount = 0

    for (const entry of activeOfferViews) {
      if (entry.diagnostics.postSelection.length) {
        postSelectionOfferCount += 1
      }

      for (const requirement of entry.diagnostics.blocking) {
        if (!blocking.has(requirement.text)) {
          blocking.set(requirement.text, requirement)
        }

        if (requirement.editableFields.length) {
          editableReasons.set(requirement.text, requirement)
          requirement.editableFields.forEach((field) => editableFields.add(field))
        }
      }

      for (const message of entry.machbarkeitMessages) {
        const text = customerFacingMessage(message?.text)
        if (text) feasibility.set(text, text)
      }
    }

    return {
      blocking: Array.from(blocking.values()),
      editableReasons: Array.from(editableReasons.values()),
      editableFields: Array.from(editableFields),
      feasibility: Array.from(feasibility.values()),
      postSelectionOfferCount,
    }
  }, [activeOfferViews])

  useEffect(() => {
    setOffers(initialOffers ?? [])
  }, [initialOffers])

  useEffect(() => {
    const acceptedOffer =
      (initialOffers ?? []).find((offer) => Boolean(offer.accepted_at) && !Boolean(offer.superseded_at)) ?? null
    if (acceptedOffer?.angebot_id) {
      setSelectedOfferId(acceptedOffer.angebot_id)
      return
    }
    const selectedOffer = trimOrNull(initialMeta?.selected_angebot_id)
    if (selectedOffer) {
      setSelectedOfferId(selectedOffer)
    }
  }, [initialMeta?.selected_angebot_id, initialOffers])

  useEffect(() => {
    setMetaError(trimOrNull(initialMeta?.last_error))
  }, [initialMeta?.last_error])

  useEffect(() => {
    let active = true

    async function loadProviders() {
      try {
        const res = await fetch("/api/baufi/providers?product=konsum", { cache: "no-store" })
        if (!res.ok) return

        const json = (await res.json().catch(() => null)) as ProviderApiResponse | null
        if (!json?.ok || !Array.isArray(json.items)) return
        if (active) setProviderLookup(buildProviderLookup(json.items))
      } catch {
        // Logos are optional. Provider names remain visible as fallback.
      } finally {
        if (active) setProviderLookupLoading(false)
      }
    }

    void loadProviders()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!editorOpen) return

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editorSaving) {
        setEditorOpen(false)
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [editorOpen, editorSaving])

  useEffect(() => {
    if (!shouldAutoRefreshOnMount || shouldHidePublicLiveOfferSections) return
    void rereshOffers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoRefreshOnMount, shouldHidePublicLiveOfferSections])

  async function rereshOffers(options?: { afterAccountCheck?: boolean }) {
    const afterAccountCheck = Boolean(options?.afterAccountCheck)
    setRefreshingOffers(true)
    setMessage(
      afterAccountCheck
        ? "Kontocheck abgeschlossen. Wir prüfen jetzt direkt, welche Angebote du final auswählen kannst."
        : null
    )
    setError(null)
    setMetaError(null)
    try {
      const res = await fetch(offersEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, ...(requestContext ?? {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(customerText(json?.error) || "Live-Angebote konnten nicht geladen werden.")
        return false
      }

      const nextOffers = (Array.isArray(json?.offers) ? json.offers : []) as EuropaceOfferRow[]
      const selectionSummary = summarizeOfferSelection(nextOffers, {
        accountCheckRestrictedReason: normalizedAccountCheckRestrictedReason,
        accountCheckCompleted: afterAccountCheck || accountCheckCompleted,
      })
      setOffers(nextOffers)
      if (afterAccountCheck) {
        if (selectionSummary.directOnlineSelectable.length === 1 && selectionSummary.bestSelectable) {
          setMessage(
            `${selectionSummary.bestSelectable.providerName} ist jetzt direkt online in wenigen Minuten abschließbar. Du kannst das Angebot unten sofort final auswählen.`
          )
        } else if (selectionSummary.directOnlineSelectable.length > 1 && selectionSummary.bestSelectable) {
          setMessage(
            `${selectionSummary.directOnlineSelectable.length} Angebote sind jetzt direkt online abschließbar. Beste Rate aktuell: ${selectionSummary.bestSelectable.providerName} mit ${formatEUR(selectionSummary.bestSelectable.snapshot?.gesamtkonditionen?.rateMonatlich)}.`
          )
        } else if (selectionSummary.guidedSelectable.length > 0 && selectionSummary.bestSelectable) {
          setMessage(
            `Der Kontocheck wurde übernommen. Aktuell gibt es aber nur Angebote mit SEPANA-Begleitung, noch kein sofort digital abschließbares Angebot.`
          )
        } else if (selectionSummary.declined.length > 0 && selectionSummary.selectable.length === 0) {
          setMessage(
            "Der Kontocheck wurde übernommen, aber aktuell hat kein Anbieter ein final auswählbares Angebot freigegeben."
          )
        } else if (selectionSummary.pendingFeedback.length > 0 && selectionSummary.selectable.length === 0) {
          setMessage(
            "Der Kontocheck wurde übernommen. Aktuell ist aber noch kein Angebot final freigegeben. Unten siehst du die Gründe."
          )
        } else if (selectionSummary.accountCheckPending.length > 0) {
          setMessage(
            "Kontocheck wurde übernommen. Aktuell ist aber noch kein Angebot final freigegeben. Unten siehst du weiter, welche Varianten noch auf Freigabe warten."
          )
        } else {
          setMessage("Kontocheck wurde übernommen. Aktuell liegt noch kein direkt final auswählbares Angebot vor.")
        }
      } else {
        setMessage(
          nextOffers.length
            ? `SEPANA hat ${nextOffers.length} Angebote aktualisiert.`
            : "Es liegen aktuell noch keine live berechneten Angebote vor."
        )
      }
      startTransition(() => router.refresh())
      return true
    } finally {
      setRefreshingOffers(false)
    }
  }

  async function handleAccountCheckFinished() {
    const startedAt = Date.now()
    setAccountCheckDialogView(null)
    setAccountCheckWizardSessionKey(null)
    setAccountCheckDialogError(null)
    setAccountCheckRereshOverlay(true)

    try {
      await markAccountCheckCompleted()
      setAccountCheckCompleted(true)
      try {
        window.localStorage.setItem(accountCheckStorageKey, new Date().toISOString())
      } catch {
        // ignore storage issues
      }
      await rereshOffers({ afterAccountCheck: true })
    } catch (accountCheckFinishError) {
      setAccountCheckCompleted(false)
      setError(
        accountCheckFinishError instanceof Error
          ? customerText(accountCheckFinishError.message) || "Kontocheck konnte noch nicht als abgeschlossen gespeichert werden."
          : "Kontocheck konnte noch nicht als abgeschlossen gespeichert werden."
      )
    } finally {
      const remaining = Math.max(0, 900 - (Date.now() - startedAt))
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining))
      }
      setAccountCheckRereshOverlay(false)
    }
  }

  async function acceptOffer(angebotId: string) {
    setBusyOfferId(angebotId)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(acceptEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, angebotId, ...(requestContext ?? {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(customerText(json?.error) || "Das Angebot konnte nicht angenommen werden.")
        return
      }

      const jobId = trimOrNull(json?.jobId)
      setSelectedOfferId(angebotId)
      setJob({
        jobId,
        status: "PENDING",
        antragsnummer: null,
        produktanbieterantragsnummer: null,
        hasApplication: false,
      })
      setMessage(jobId ? `Dein Antrag wird erstellt. Job ${jobId} läuft.` : "Dein Antrag wird erstellt.")
      startTransition(() => router.refresh())
    } finally {
      setBusyOfferId(null)
    }
  }

  function buildSelectionHref(angebotId: string) {
    const params = new URLSearchParams({ caseId, angebotId })
    for (const [key, value] of Object.entries(requestContext ?? {})) {
      if (value === null || value === undefined) continue
      const normalized = String(value).trim()
      if (!normalized) continue
      params.set(key, normalized)
    }
    return `${selectionPath ?? "/onlinekredit/abschluss"}?${params.toString()}`
  }

  async function pollJob(manual = false) {
    if (!job.jobId) return
    if (manual) {
      setMessage(null)
      setError(null)
    }

    setPolling(true)
    try {
      const res = await fetch(jobEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, ...(requestContext ?? {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        if (manual) setError(customerText(json?.error) || "Der Status konnte nicht geladen werden.")
        return
      }

	      const nextStatus = trimOrNull(json?.status)
	      const nextAntragsnummer = trimOrNull(json?.antragsnummer)
	      const nextProviderApplicationNo = trimOrNull(json?.produktanbieterantragsnummer)
	      const hasApplication = Boolean(json?.hasApplication)
        const hasRejectedApplication = Boolean(json?.hasRejectedApplication)
        const terminalMessage = trimOrNull(json?.terminalMessage)

      setJob({
        jobId: nextStatus === "PENDING" ? (trimOrNull(json?.jobId) ?? job.jobId) : null,
        status: nextStatus,
        antragsnummer: nextAntragsnummer,
        produktanbieterantragsnummer: nextProviderApplicationNo,
        hasApplication,
      })

	      if (nextStatus === "SUCCESS" && hasApplication && nextAntragsnummer) {
	        setMessage(`Dein Antrag ${nextAntragsnummer} wurde erfolgreich erstellt. Als Nächstes kannst du deine Unterlagen hochladen.`)
	        if (applicationSuccessMessage) {
	          setMessage(customerText(applicationSuccessMessage))
	        }
	        startTransition(() => router.refresh())
	      } else if (nextStatus === "SUCCESS" && !hasApplication) {
	        setSelectedOfferId(null)
	        setError(
            customerText(
              toPublicOfferAcceptanceMessage(terminalMessage || "Europace meldet SUCCESS, aber ohne erzeugten Antrag.", {
                hasRejectedApplication,
              })
            )
          )
	        startTransition(() => router.refresh())
	      } else if (nextStatus === "FAILURE") {
	        setSelectedOfferId(null)
	        setError(customerText(toPublicOfferAcceptanceMessage(terminalMessage, { hasRejectedApplication })))
	        startTransition(() => router.refresh())
	      } else if (manual) {
	        setMessage(`Dein Antrag wird noch bearbeitet.`)
	      }
    } finally {
      setPolling(false)
    }
  }

  const pollJobEvent = useEffectEvent(() => {
    void pollJob(false)
  })

  useEffect(() => {
    if (!job.jobId) return
    if (job.status && job.status !== "PENDING") return

    const interval = window.setInterval(() => {
      pollJobEvent()
    }, 7000)

    pollJobEvent()

    return () => window.clearInterval(interval)
  }, [job.jobId, job.status])

  async function openQuickEdit(fields: QuickEditField[], reasons: string[]) {
    if (!fields.length) return

    setEditorFields(Array.from(new Set(fields)))
    setEditorReasons(reasons.slice(0, 5))
    setEditorState(EMPTY_QUICK_EDIT)
    setEditorError(null)
    setEditorSuggestedAccountHolder("")
    setEditorAutofilledBic(null)
    setEditorBicLookupError(null)
    setEditorOpen(true)
    setEditorLoading(true)

    try {
      const res = await fetch(createCaseQuery(caseId, requestContext), { cache: "no-store" })
      const json = (await res.json().catch(() => ({}))) as LiveCaseLoadResponse

      if (!res.ok || !json?.ok) {
        const detail = [json?.error, json?.stage, json?.message]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .join(": ")
        throw new Error(detail || "Die aktuellen Angaben konnten nicht geladen werden.")
      }

      const suggestedAccountHolder = fullName(json?.primary?.first_name, json?.primary?.last_name)
      setEditorSuggestedAccountHolder(suggestedAccountHolder)

      setEditorState({
        phone: trimOrNull(json?.primary?.phone) ?? "",
        birth_date: toDateInputValue(json?.primary?.birth_date),
        employment_since: toDateInputValue(json?.primary?.employment_since),
        address_since: toDateInputValue(json?.additional?.address_since),
        previous_address_since: toDateInputValue(json?.additional?.previous_address_since),
        bank_account_holder: trimOrNull(json?.additional?.bank_account_holder) ?? suggestedAccountHolder,
        bank_iban: trimOrNull(json?.additional?.bank_iban) ?? "",
        bank_bic: trimOrNull(json?.additional?.bank_bic) ?? "",
      })
    } catch (loadError) {
      setEditorError(loadError instanceof Error ? customerText(loadError.message) : "Die aktuellen Angaben konnten nicht geladen werden.")
    } finally {
      setEditorLoading(false)
    }
  }

  function updateEditorField(field: QuickEditField, value: string) {
    if (field === "bank_bic") {
      setEditorAutofilledBic(null)
      setEditorBicLookupError(null)
    }
    if (field === "bank_iban") {
      setEditorBicLookupError(null)
    }
    setEditorState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const lookupEditorBic = useCallback(async (rawIban: string) => {
    const iban = normalizeIbanInput(rawIban)
    if (!looksLikeIban(iban)) {
      setEditorBicLookupLoading(false)
      setEditorBicLookupError(null)
      return
    }

    const sandboxDemo = getSandboxIbanDemo(iban)
    if (sandboxDemo) {
      setEditorState((current) => ({ ...current, bank_iban: iban, bank_bic: sandboxDemo.bic }))
      setEditorAutofilledBic(sandboxDemo.bic)
      setEditorBicLookupError(null)
      setEditorBicLookupLoading(false)
      return
    }

    setEditorBicLookupLoading(true)
    setEditorBicLookupError(null)

    try {
      const response = await fetch(`/api/banking/iban?iban=${encodeURIComponent(iban)}`, { cache: "no-store" })
      const json = (await response.json().catch(() => ({}))) as IbanLookupResponse
      if (!response.ok || !json?.ok || !trimOrNull(json.bic)) {
        throw new Error(String(json?.error ?? "BIC konnte nicht automatisch ermittelt werden."))
      }

      const bic = String(json.bic).trim().toUpperCase()
      setEditorState((current) => ({ ...current, bank_iban: iban, bank_bic: bic }))
      setEditorAutofilledBic(bic)
      setEditorBicLookupError(null)
    } catch (lookupError) {
      setEditorBicLookupError(
        lookupError instanceof Error ? customerText(lookupError.message) : "BIC konnte nicht automatisch ermittelt werden."
      )
    } finally {
      setEditorBicLookupLoading(false)
    }
  }, [])

  function closeQuickEdit() {
    if (editorSaving) return
    setEditorOpen(false)
    setEditorError(null)
  }

  function validateQuickEdit() {
    const visibleFields = new Set(editorFields)
    const needsPhone = visibleFields.has("phone")
    const dateFields = (["birth_date", "employment_since", "address_since", "previous_address_since"] as const).filter((field) =>
      visibleFields.has(field)
    )
    const needsBankDetails =
      visibleFields.has("bank_account_holder") || visibleFields.has("bank_iban") || visibleFields.has("bank_bic")

    if (needsPhone && !isPhone(editorState.phone)) {
      return "Bitte eine gültige Telefonnummer eintragen."
    }

    for (const field of dateFields) {
      const value = String(editorState[field] ?? "").trim()
      if (!value) return `Bitte ${editorFieldLabel(field)} eintragen.`
      if (!isValidLocalDate(value)) return `Bitte ${editorFieldLabel(field)} als gültiges Datum eintragen.`
    }

    if (needsBankDetails) {
      if (!editorState.bank_account_holder.trim()) {
        return "Bitte den Kontoinhaber eintragen."
      }

      const iban = editorState.bank_iban.replace(/\s+/g, "")
      const bic = editorState.bank_bic.replace(/\s+/g, "")

      if (!iban) return "Bitte eine IBAN eintragen."
      if (iban.length < 15) return "Bitte eine gültige IBAN eintragen."
      if (!bic) return "Bitte eine BIC eintragen."
      if (bic.length < 8) return "Bitte eine gültige BIC eintragen."
    }

    return null
  }

  async function saveQuickEdit() {
    const validationError = validateQuickEdit()
    if (validationError) {
      setEditorError(validationError)
      return
    }

    setEditorSaving(true)
    setEditorError(null)

    try {
      const primaryPatch: Record<string, unknown> = {}
      const additionalPatch: Record<string, unknown> = {}

      if (editorFields.includes("phone")) {
        primaryPatch.phone = editorState.phone.trim()
      }
      if (editorFields.includes("birth_date")) {
        primaryPatch.birth_date = editorState.birth_date.trim()
      }
      if (editorFields.includes("employment_since")) {
        primaryPatch.employment_since = editorState.employment_since.trim()
      }
      if (editorFields.includes("address_since")) {
        additionalPatch.address_since = editorState.address_since.trim()
      }
      if (editorFields.includes("previous_address_since")) {
        additionalPatch.previous_address_since = editorState.previous_address_since.trim()
      }

      if (editorFields.some((field) => field.startsWith("bank_"))) {
        additionalPatch.bank_account_holder = editorState.bank_account_holder.trim()
        additionalPatch.bank_iban = editorState.bank_iban.replace(/\s+/g, "").toUpperCase()
        additionalPatch.bank_bic = editorState.bank_bic.replace(/\s+/g, "").toUpperCase()
      }

      const res = await fetch("/api/live/case", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          createCasePayload(caseId, requestContext, {
            primary: primaryPatch,
            additional: additionalPatch,
            triggerEuropaceSync: false,
          })
        ),
      })

      const json = (await res.json().catch(() => ({}))) as LiveCaseSaveResponse
      if (!res.ok || !json?.ok) {
        const detail = [json?.error, json?.stage, json?.message]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .join(": ")
        throw new Error(detail || "Die Angaben konnten nicht gespeichert werden.")
      }

      const rereshed = await rereshOffers()
      if (rereshed) {
        setEditorOpen(false)
      }
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? customerText(saveError.message) : "Die Angaben konnten nicht gespeichert werden.")
    } finally {
      setEditorSaving(false)
    }
  }

  const hasQuickEdit = diagnostics.editableFields.length > 0
  const editorFieldSet = new Set(editorFields)
  const showPhoneField = editorFieldSet.has("phone")
  const showBirthDateField = editorFieldSet.has("birth_date")
  const showEmploymentSinceField = editorFieldSet.has("employment_since")
  const showAddressSinceField = editorFieldSet.has("address_since")
  const showPreviousAddressSinceField = editorFieldSet.has("previous_address_since")
  const showBankFields =
    editorFieldSet.has("bank_account_holder") || editorFieldSet.has("bank_iban") || editorFieldSet.has("bank_bic")
  const metaErrorQuickEditFields = useMemo(() => editableFieldsForText(publicMetaError), [publicMetaError])
  const canApplySuggestedAccountHolder =
    Boolean(editorSuggestedAccountHolder) && editorState.bank_account_holder.trim() !== editorSuggestedAccountHolder.trim()
  const canAutofillEditorBic =
    showBankFields &&
    looksLikeIban(editorState.bank_iban) &&
    (!editorState.bank_bic.trim() || editorState.bank_bic.trim() === String(editorAutofilledBic ?? "").trim())
  const sandboxEditorIbanDemo = getSandboxIbanDemo(editorState.bank_iban)

  useEffect(() => {
    if (!editorOpen || !canAutofillEditorBic) {
      setEditorBicLookupLoading(false)
      return
    }

    const timer = window.setTimeout(() => {
      lookupEditorBic(editorState.bank_iban)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [canAutofillEditorBic, editorOpen, editorState.bank_iban, lookupEditorBic])

  function renderOfferMetaSummary(input: {
    calculatedAt?: string | null
    acceptedAt?: string | null
    score?: number | string | null
    isAccepted?: boolean
  }) {
    const metaItems = [
      {
        key: "calculated",
        label: "Berechnet am",
        value: dt(input.calculatedAt),
        className: "border-slate-200/80 bg-slate-50/80 text-slate-900",
        labelClassName: "text-slate-500",
      },
      {
        key: "score",
        label: "Score",
        value: formatScore(input.score),
        className: "border-cyan-200/80 bg-cyan-50/70 text-cyan-950",
        labelClassName: "text-cyan-700",
      },
      input.acceptedAt
        ? {
            key: "accepted",
            label: "Angenommen am",
            value: dt(input.acceptedAt),
            className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950",
            labelClassName: "text-emerald-700",
          }
        : input.isAccepted
          ? {
              key: "accepted",
              label: "Status",
              value: "Final bestätigt",
              className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950",
              labelClassName: "text-emerald-700",
            }
          : null,
    ].filter(
      (
        item
      ): item is {
        key: string
        label: string
        value: string
        className: string
        labelClassName: string
      } => Boolean(item)
    )

    return (
      <div className="w-full lg:max-w-[360px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stand dieser Karte</div>
        <div className="mt-3 grid gap-2 min-[360px]:grid-cols-2">
          {metaItems.map((item, index) => (
            <div
              key={item.key}
              className={`rounded-2xl border px-3 py-3 shadow-sm ${item.className} ${
                metaItems.length % 2 === 1 && index === metaItems.length - 1 ? "sm:col-span-2" : ""
              }`}
            >
              <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${item.labelClassName}`}>{item.label}</div>
              <div className="mt-1 text-sm font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderPendingAccountCheckCard(view: OfferView) {
    const isDirectOnline = isDirectOnlineOffer(view)
    const actionLabel =
      accountCheckStatus === "starting"
        ? "Kontocheck wird aktiviert..."
        : accountCheckStatus === "activated"
          ? accountCheckWizardSessionKey
            ? "Kontocheck läuft"
            : "Kontocheck erneut starten"
          : "Kontocheck durchführen"
    const nextStepLabel = isDirectOnline ? "Danach direkt online" : "Danach mit SEPANA"
    const nextStepClass = isDirectOnline
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800"

    return (
      <div
        key={`account-check-${view.offer.angebot_id}`}
        className="relative overflow-hidden rounded-[24px] border border-cyan-200/80 bg-[linear-gradient(180deg,rgba(248,253,255,0.98),rgba(255,255,255,1))] p-4 shadow-[0_18px_50px_rgba(14,165,233,0.08)] sm:rounded-[30px] sm:p-5"
      >
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),transparent_40%,rgba(14,165,233,0.08))]" />

        <div className="relative flex h-full flex-col">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-[4.25rem] w-full max-w-[9rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-3 shadow-sm sm:w-36">
                  <ProviderLogo
                    key={view.providerBrand?.src ?? view.providerName}
                    brand={view.providerBrand}
                    providerName={view.providerName}
                    lookupLoading={providerLookupLoading}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 font-semibold text-cyan-900 shadow-sm">
                      Kontocheck zuerst
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 font-semibold shadow-sm ${nextStepClass}`}>{nextStepLabel}</span>
                  </div>

                  <div className="mt-3 text-lg font-semibold text-slate-900">{view.providerName}</div>
                  {view.productName ? <div className="mt-1 text-sm text-slate-600">{view.productName}</div> : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full border px-3 py-1 font-semibold ${
                        view.diagnostics.blocking.length
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {view.diagnostics.blocking.length ? "Noch Angaben offen" : labelStatus(view.offer.vollstaendigkeit_status)}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 font-semibold ${
                        normalizeStatus(view.offer.machbarkeit_status) === "MACHBAR"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : normalizeStatus(view.offer.machbarkeit_status) === "MACHBAR_UNTER_VORBEHALT"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {labelStatus(view.offer.machbarkeit_status)}
                    </span>
                    <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 font-semibold text-cyan-900">
                      Vor Auswahl nötig
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 xl:items-end">
              <button
                type="button"
                onClick={() =>
                  accountCheckStatus === "activated" && !accountCheckWizardSessionKey
                    ? reopenAccountCheck(view)
                    : setAccountCheckDialogView(view)
                }
                className={`inline-flex h-11 w-full items-center justify-center rounded-2xl px-5 text-center text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.14)] sm:w-auto sm:min-w-[230px] ${
                  accountCheckStatus === "activated"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "bg-slate-900 text-white"
                }`}
              >
                {actionLabel}
              </button>
              <div className="max-w-full text-xs leading-relaxed text-slate-600 xl:max-w-[230px] xl:text-right">
                Der Kontocheck läuft direkt im Browser und dauert in der Regel nur wenige Minuten.
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monatsrate</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatEUR(view.snapshot?.gesamtkonditionen?.rateMonatlich)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Effektivzins</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatPct(view.snapshot?.gesamtkonditionen?.effektivzins)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kreditbetrag</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {formatEUR(view.snapshot?.gesamtkonditionen?.nettokreditbetrag ?? view.snapshot?.gesamtkonditionen?.gesamtkreditbetrag)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Laufzeit</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {view.snapshot?.gesamtkonditionen?.laufzeitInMonaten ? `${view.snapshot.gesamtkonditionen.laufzeitInMonaten} Monate` : "-"}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm text-cyan-950">
            <div className="font-semibold text-slate-900">{isDirectOnline ? "Nach dem Kontocheck geht es direkt digital weiter." : "Nach dem Kontocheck übernimmt SEPANA den weiteren Abschluss."}</div>
            <div className="mt-1 leading-relaxed">
              {isDirectOnline
                ? "Melde dich mit deinem Online-Banking-Zugang an und schließe den Kontocheck vollständig ab. Danach kannst du diese Variante direkt online weiterführen."
                : "Melde dich mit deinem Online-Banking-Zugang an und schließe den Kontocheck vollständig ab. Danach läuft der weitere Abschluss mit SEPANA-Begleitung weiter."}
            </div>
          </div>

          <div className="mt-4">
            {renderOfferMetaSummary({
              calculatedAt: view.offer.calculated_at ?? view.offer.created_at,
              acceptedAt: view.offer.accepted_at,
              score: view.snapshot?.vorhersage?.machbarkeit?.score,
              isAccepted: Boolean(view.offer.accepted_at),
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderOfferCard(view: OfferView) {
    const offer = view.offer
    const snapshot = view.snapshot
    const isSuperseded = Boolean(offer.superseded_at)
    const isLockedPublicOffer =
      shouldHidePublicLiveOfferSections && trimOrNull(selectedOfferId) === trimOrNull(offer.angebot_id)
    const isAccepted = Boolean(offer.accepted_at) || isLockedPublicOffer
    const inAccountCheckCluster = belongsToAccountCheckSection(view)
    const accountCheckReady = inAccountCheckCluster && !requiresAccountCheckBeforeSelection(view)
    const canAccept = isOfferAcceptable(offer) && !view.technicalAcceptanceFailed && !hasRunningJob
    const canSelect = !view.technicalAcceptanceFailed && !isSuperseded && (isAccepted || isOfferAcceptable(offer))
    const isDirectOnline = isDirectOnlineOffer(view)
    const completenessStatus = normalizeStatus(offer.vollstaendigkeit_status)
    const completenessLabel = view.diagnostics.blocking.length
      ? "Noch Angaben offen"
      : completenessStatus !== "VOLLSTAENDIG" && view.diagnostics.postSelection.length
        ? "Kontocheck nötig"
        : labelStatus(offer.vollstaendigkeit_status)
    const flowBadgeLabel = inAccountCheckCluster
      ? isDirectOnline
        ? accountCheckReady
          ? "Online nach Kontocheck"
          : "Kontocheck online"
        : accountCheckReady
          ? "Mit SEPANA nach Kontocheck"
          : "Kontocheck mit SEPANA"
      : isDirectOnline
        ? "Direkt online in wenigen Minuten"
        : "Mit SEPANA-Begleitung"
    const flowBadgeClass = inAccountCheckCluster
      ? "border-cyan-200 bg-cyan-50 text-cyan-900"
      : isDirectOnline
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-800"
    const selectionButtonLabel = isAccepted
      ? "Zum finalen Abschluss"
      : view.technicalAcceptanceFailed
        ? "Technisch derzeit nicht verfügbar"
      : canSelect
          ? inAccountCheckCluster
            ? isDirectOnline
              ? "Online fortsetzen"
              : "Mit SEPANA weiter"
          : isDirectOnline
            ? "Jetzt direkt online auswählen"
            : "Mit SEPANA auswählen"
        : "Noch nicht final auswählbar"
    const cardShellClass =
      inAccountCheckCluster && !isAccepted && !isSuperseded
        ? "border-cyan-200/80 bg-[linear-gradient(180deg,rgba(248,253,255,0.98),rgba(255,255,255,1))]"
        : isAccepted
          ? "border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.98))]"
          : isSuperseded
            ? "border-slate-200 bg-slate-50/80"
            : "border-slate-200/80 bg-white"
    const glowClass =
      inAccountCheckCluster && !isAccepted && !isSuperseded
        ? "absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),transparent_38%,rgba(14,165,233,0.08))]"
        : "absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(14,165,233,0.08),transparent_40%,rgba(16,185,129,0.08))]"
    const isRecommendedSelection =
      !isAccepted &&
      !isSuperseded &&
      !inAccountCheckCluster &&
      recommendedFinalSelectableOffer?.offer.angebot_id === offer.angebot_id
    const primaryButtonClass = selectionMode
      ? canSelect
        ? isDirectOnline
          ? "bg-[linear-gradient(135deg,#0f172a,#0f766e)] text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)]"
          : "bg-[linear-gradient(135deg,#0f172a,#78350f)] text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)]"
        : "bg-slate-300 text-slate-600 shadow-none"
      : canAccept
        ? "bg-[linear-gradient(135deg,#0f172a,#1e293b)] text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)]"
        : "bg-slate-300 text-slate-600 shadow-none"

    return (
      <div
        key={offer.angebot_id}
        className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:rounded-[30px] sm:p-5 ${cardShellClass} ${
          isRecommendedSelection ? "ring-2 ring-emerald-200/90 ring-offset-2 ring-offset-white" : ""
        }`}
      >
        <div className={glowClass} />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-[4.25rem] w-full max-w-[9rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-3 shadow-sm sm:w-36">
                <ProviderLogo
                  key={view.providerBrand?.src ?? view.providerName}
                  brand={view.providerBrand}
                  providerName={view.providerName}
                  lookupLoading={providerLookupLoading}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-slate-900">{view.providerName}</div>

                {view.productName ? <div className="mt-1 text-sm text-slate-600">{view.productName}</div> : null}

                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
                  {isRecommendedSelection ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 shadow-sm">
                      Beste Option aktuell
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 font-semibold leading-tight shadow-sm ${flowBadgeClass}`}
                  >
                    {flowBadgeLabel}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 font-semibold ${
                      view.diagnostics.blocking.length
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : view.diagnostics.postSelection.length
                          ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {completenessLabel}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 font-semibold ${
                      normalizeStatus(offer.machbarkeit_status) === "MACHBAR"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : normalizeStatus(offer.machbarkeit_status) === "MACHBAR_UNTER_VORBEHALT"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {labelStatus(offer.machbarkeit_status)}
                  </span>
                  {view.accountCheck ? (
                    <span className={`rounded-full border px-3 py-1 font-semibold ${view.accountCheck.className}`}>
                      {view.accountCheck.label}
                    </span>
                  ) : null}
                  {view.technicalAcceptanceFailed ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-800">
                      Technisch aktuell blockiert
                    </span>
                  ) : null}
                  {isAccepted ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                      Angenommen
                    </span>
                  ) : null}
                  {isSuperseded ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                      Veraltet
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 xl:items-end">
            {selectionMode ? (
              <button
                type="button"
                onClick={() => router.push(buildSelectionHref(offer.angebot_id))}
                disabled={!canSelect}
                className={`inline-flex h-11 w-full items-center justify-center rounded-2xl px-5 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] ${primaryButtonClass}`}
              >
                {selectionButtonLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void acceptOffer(offer.angebot_id)}
                disabled={!canAccept || busyOfferId === offer.angebot_id}
                className={`inline-flex h-11 w-full items-center justify-center rounded-2xl px-5 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[220px] ${primaryButtonClass}`}
              >
                {busyOfferId === offer.angebot_id
                  ? "Starte..."
                  : isAccepted
                    ? "Angenommen"
                    : hasRunningJob
                      ? "Läuft"
                      : "Jetzt annehmen"}
              </button>
            )}

            {view.diagnostics.editableFields.length ? (
              <button
                type="button"
                onClick={() =>
                  void openQuickEdit(
                    view.diagnostics.editableFields,
                    view.diagnostics.blocking.map((item) => item.text)
                  )
                }
                className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-center text-sm font-semibold text-slate-900 shadow-sm sm:w-auto sm:min-w-[220px]"
              >
                Offene Punkte ergänzen
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Monatsrate</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{formatEUR(snapshot?.gesamtkonditionen?.rateMonatlich)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Effektivzins</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{formatPct(snapshot?.gesamtkonditionen?.effektivzins)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sollzins</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{formatPct(snapshot?.gesamtkonditionen?.sollzins)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kreditbetrag</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {formatEUR(snapshot?.gesamtkonditionen?.nettokreditbetrag ?? snapshot?.gesamtkonditionen?.gesamtkreditbetrag)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Auszahlung</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{formatEUR(snapshot?.gesamtkonditionen?.auszahlungsbetrag)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Laufzeit</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {snapshot?.gesamtkonditionen?.laufzeitInMonaten ? `${snapshot.gesamtkonditionen.laufzeitInMonaten} Monate` : "-"}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/80 bg-white/82 px-4 py-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)] lg:items-start">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Was diese Karte bedeutet</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {inAccountCheckCluster
                  ? isDirectOnline
                    ? "Nach dem Kontocheck geht diese Route direkt digital weiter."
                    : "Nach dem Kontocheck übernimmt SEPANA den begleiteten Abschluss."
                  : isDirectOnline
                    ? "Diese Variante ist auf einen schnellen digitalen Abschluss ausgelegt."
                    : "Diese Variante ist auswählbar, läuft danach aber bewusst mit SEPANA-Begleitung weiter."}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-600">
                {isRecommendedSelection
                  ? "Unter den aktuell final auswählbaren Varianten ist das gerade die stärkste Kombination aus Rate, Effektivzins und Abschlussroute."
                  : view.accountCheck?.note ?? feedbackTextForOffer(view, {
                      hasRejectedApplication: resolvedHasRejectedApplication,
                      rejectedApplicationMessage: normalizedRejectedApplicationMessage,
                    })}
              </div>
            </div>
            {renderOfferMetaSummary({
              calculatedAt: offer.calculated_at ?? offer.created_at,
              acceptedAt: offer.accepted_at,
              score: snapshot?.vorhersage?.machbarkeit?.score,
              isAccepted,
            })}
          </div>
        </div>

      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.08)] sm:rounded-[36px] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {isPublicOnlinekredit ? "Onlinekredit" : "Privatkredit"}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {shouldHidePublicLiveOfferSections
              ? "Dein final angenommenes Angebot"
              : shouldHideCustomerLiveOfferSections
                ? hasRunningJob
                  ? "Dein ausgewähltes Angebot wird verarbeitet"
                  : "Dein ausgewähltes Angebot"
                : "Live-Angebote vergleichen"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-[15px]">
            {isPublicOnlinekredit
              ? shouldHidePublicLiveOfferSections
                ? "Für diese Route liegt bereits eine positive Bankrückmeldung vor. Deshalb zeigen wir dir hier nur noch das angenommene Angebot. Weitere Varianten prüfst du bitte direkt mit deinem Berater."
                : "Hier ziehst du die aktuelle Bankrückmeldung zu deinem Antrag nach. Sichtbar bleiben nur Varianten, die aktuell freigegeben, in Prüfung oder für den Kontocheck relevant sind."
              : shouldHideCustomerLiveOfferSections
                ? hasRunningJob
                  ? "Du hast bereits ein Angebot ausgewählt. Wir zeigen dir hier nur noch dieses Angebot, bis dein Antrag vollständig angelegt ist."
                  : "Du hast bereits ein Angebot ausgewählt. Weitere Live-Angebote blenden wir in dieser Ansicht bewusst aus."
                : "Sobald alle Pflichtangaben vorliegen, kannst du hier deine aktuellen SEPANA-Angebote abrufen. Sichtbar bleiben hier nur Angebote, die aktuell direkt vollständig und final auswählbar sind."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {!shouldHideLiveOfferSections ? (
            <button
              type="button"
              onClick={() => void rereshOffers()}
              disabled={refreshingOffers || hasRunningJob}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {refreshButtonLabel}
            </button>
          ) : null}
          {isPublicOnlinekredit ? (
              <div className="max-w-full text-xs leading-relaxed text-slate-500 sm:max-w-xs sm:text-right">
              {shouldHidePublicLiveOfferSections
                ? "Weitere Angebotsvarianten werden in dieser Ansicht bewusst gesperrt, weil bereits ein Angebot final bestätigt wurde."
                : "Prüft Angebote, Freigaben und aktuelle Bankrückmeldungen für diesen Onlinekredit erneut."}
            </div>
          ) : null}
          {!selectionMode && job.jobId ? (
            <button
              type="button"
              onClick={() => void pollJob(true)}
              disabled={polling}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {polling ? "Prüfe Status…" : "Antragsstatus prüfen"}
            </button>
          ) : null}
        </div>
      </div>

      {isPublicOnlinekredit && publicStatusSummary ? (
        <div
          className={`mt-4 rounded-[24px] border px-4 py-4 shadow-sm ${
            publicStatusSummary.tone === "rose"
              ? "border-rose-200 bg-rose-50/80"
              : publicStatusSummary.tone === "amber"
                ? "border-amber-200 bg-amber-50/80"
                : publicStatusSummary.tone === "cyan"
                  ? "border-cyan-200 bg-cyan-50/80"
                  : publicStatusSummary.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50/80"
                    : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{publicStatusSummary.label}</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{publicStatusSummary.title}</div>
              <div className="mt-1 text-sm leading-relaxed text-slate-700">{publicStatusSummary.description}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {currentSyncStatus ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                  Sync: {labelStatus(currentSyncStatus)}
                </span>
              ) : null}
              {currentApplicationNo ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                  Antrag: {currentApplicationNo}
                </span>
              ) : null}
              {currentProviderReference ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                  Produktanbieter-Ref: {currentProviderReference}
                </span>
              ) : null}
              {currentLastSyncAt ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                  Stand: {dt(currentLastSyncAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!selectionMode && job.jobId ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          <div className="font-semibold">Antragsprozess läuft</div>
          <div className="mt-1">Status: {labelStatus(job.status)}</div>
          {job.antragsnummer ? <div className="mt-1">Antrag: {job.antragsnummer}</div> : null}
          {job.produktanbieterantragsnummer ? (
            <div className="mt-1">Produktanbieter-Ref: {job.produktanbieterantragsnummer}</div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : publicMetaError ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div>Letzter Hinweis aus der Berechnung: {publicMetaError}</div>
          {metaErrorQuickEditFields.length ? (
            <button
              type="button"
              onClick={() => void openQuickEdit(metaErrorQuickEditFields, [publicMetaError])}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 shadow-sm"
            >
              Fehlerhafte Daten direkt korrigieren
            </button>
          ) : null}
        </div>
      ) : null}

      {normalizedAccountCheckRestrictedReason ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {normalizedAccountCheckRestrictedReason}
        </div>
      ) : null}

      {!error && shouldHideLiveOfferSections ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(255,255,255,0.98))] px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              {shouldHidePublicLiveOfferSections
                ? "Final bestätigt"
                : hasRunningJob
                  ? "Ausgewählt und in Bearbeitung"
                  : "Bereits ausgewählt"}
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {shouldHidePublicLiveOfferSections
                ? "Hier steht nur noch dein angenommener und von der Bank positiv bestätigter Angebotsstand."
                : hasRunningJob
                  ? "Dein gewähltes Angebot wird gerade zum Antrag verarbeitet. Weitere Live-Angebote blenden wir hier bewusst aus."
                  : "Hier steht nur noch dein final ausgewähltes Angebot."}
            </div>
          </div>
          {lockedOfferViews.length > 0 ? (
            lockedOfferViews.map((view) => renderOfferCard(view))
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
              {shouldHidePublicLiveOfferSections
                ? "Dein angenommener Angebotsstand wird gerade geladen. Weitere Varianten bleiben in dieser Ansicht gesperrt."
                : "Dein ausgewähltes Angebot wird aktuell verarbeitet. Sobald der Antrag vollständig angelegt ist, siehst du hier nur noch den finalen Stand."}
            </div>
          )}
        </div>
      ) : null}

      {!shouldHideLiveOfferSections ? (
        <div className="contents">
      {!error && acceptedOfferViews.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(255,255,255,0.98))] px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Bereits ausgewählt</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {acceptedOfferViews.length === 1
                    ? "Dein bereits angenommenes Angebot steht hier immer ganz oben."
                    : "Deine bereits angenommenen Angebote stehen hier immer ganz oben."}
                </div>
              </div>
              {acceptedOfferViews.map((view) => renderOfferCard(view))}
            </div>
          ) : null}

      {!error && acceptedOfferViews.length === 0 && summarySelectableOfferViews.length > 0 ? (
            <div className="mt-4 rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.98))] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Jetzt final auswählbar</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {summaryDirectOnlineOfferViews.length > 0
                      ? summaryDirectOnlineOfferViews.length === 1
                        ? "Du kannst jetzt 1 Angebot direkt online in wenigen Minuten abschließen."
                        : `Du kannst jetzt ${summaryDirectOnlineOfferViews.length} Angebote direkt online in wenigen Minuten abschließen.`
                      : summaryGuidedOfferViews.length === 1
                        ? "Du kannst jetzt 1 Angebot final auswählen. Dieses läuft mit SEPANA-Begleitung weiter."
                        : `Du kannst jetzt ${summaryGuidedOfferViews.length} Angebote final auswählen. Diese laufen mit SEPANA-Begleitung weiter.`}
                  </div>
                  {recommendedFinalSelectableOffer ? (
                    <div className="mt-2 text-sm text-slate-700">
                      Beste Option aktuell: <span className="font-semibold text-slate-900">{recommendedFinalSelectableOffer.providerName}</span>
                      {" • "}
                      {formatEUR(recommendedFinalSelectableOffer.snapshot?.gesamtkonditionen?.rateMonatlich)}
                      {" Monatsrate • "}
                      {formatPct(recommendedFinalSelectableOffer.snapshot?.gesamtkonditionen?.effektivzins)}
                      {" Effektivzins"}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {summarySelectableOfferViews.slice(0, 4).map((view) => (
                      <span
                        key={`selectable-summary-${view.offer.angebot_id}`}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800"
                      >
                        {view.providerName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
                  {summaryDirectOnlineOfferViews.length > 0 ? (
                    <>
                      Wähle unten die Karte <span className="font-semibold">„Jetzt direkt online auswählen“</span>.
                    </>
                  ) : (
                    <>
                      Wähle unten die Karte <span className="font-semibold">„Mit SEPANA auswählen“</span>.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

      {!error && diagnostics.blocking.length ? (
            <div className="mt-4 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(255,255,255,0.96))] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Noch offen</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    Ein paar Angaben blockieren noch die vollständige Auswahl.
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-amber-950">
                    {diagnostics.blocking.slice(0, 6).map((item) => (
                      <li key={item.key} className="flex gap-2">
                        <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  {diagnostics.blocking.length > 6 ? (
                    <div className="mt-3 text-xs font-medium text-amber-800">
                      Weitere offene Punkte: {diagnostics.blocking.length - 6}
                    </div>
                  ) : null}
                </div>

                {hasQuickEdit ? (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void openQuickEdit(
                          diagnostics.editableFields,
                          diagnostics.editableReasons.map((item) => item.text)
                        )
                      }
                      className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm sm:w-auto"
                    >
                      Offene Punkte direkt ergänzen
                    </button>
                    <div className="mt-2 max-w-xs text-xs text-slate-600">
                      Ohne Seitenwechsel. SEPANA speichert nur die relevanten Felder und berechnet die Angebote danach neu.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

      {!error && accountCheckOfferViews.length > 0 && !isPublicOnlinekredit ? (
        <div className="mt-4 rounded-[28px] border border-cyan-200 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,rgba(248,253,255,0.98),rgba(255,255,255,0.98))] p-5 text-sm text-cyan-950 shadow-[0_16px_40px_rgba(14,165,233,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Kontocheck-Angebote</div>
              <div className="mt-2 text-base font-semibold text-slate-900">Diese Varianten laufen gesammelt über den Kontocheck.</div>
              <div className="mt-2 text-slate-700">
            {pendingAccountCheckOfferViews.length === accountCheckOfferViews.length
              ? `Bei ${accountCheckOfferViews.length} Angebot${accountCheckOfferViews.length === 1 ? "" : "en"} verlangt der Anbieter vor der Auswahl zuerst einen Kontocheck.`
              : pendingAccountCheckOfferViews.length === 0
                ? `Bei ${accountCheckOfferViews.length} Angebot${accountCheckOfferViews.length === 1 ? "" : "en"} läuft die Bankprüfung über Kontocheck. Bereits freigegebene Varianten bleiben hier oben gebündelt.`
                : `Bei ${pendingAccountCheckOfferViews.length} von ${accountCheckOfferViews.length} Kontocheck-Angeboten fehlt der Kontocheck noch. Bereits freigegebene Varianten bleiben trotzdem hier oben gebuendelt.`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 font-semibold text-cyan-900 shadow-sm">
                {accountCheckOfferViews.length} Kontocheck-Angebote
              </span>
              {completedAccountCheckOfferViews.length > 0 ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 shadow-sm">
                  {completedAccountCheckOfferViews.length} bereits freigegeben
                </span>
              ) : null}
              {pendingAccountCheckOfferViews.length > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-900 shadow-sm">
                  {pendingAccountCheckOfferViews.length} warten noch
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!error && accountCheckOfferViews.length > 0 && !isPublicOnlinekredit ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {accountCheckOfferViews.map((view) =>
            requiresAccountCheckBeforeSelection(view) ? (
              renderPendingAccountCheckCard(view)
            ) : (
              renderOfferCard(view)
            )
          )}
        </div>
      ) : null}

      {pendingAccountCheckOfferViews.length > 0 && accountCheckStatus === "activated" ? (
        <div className="mt-4 rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-emerald-950 shadow-[0_18px_50px_rgba(16,185,129,0.10)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative mt-1 flex h-8 w-8 items-center justify-center">
                <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-300/50 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
              </div>
              <div>
                <div className="font-semibold">Kontocheck aktiviert</div>
                <div className="mt-1">
                  Wir warten jetzt auf den Abschluss des Kontochecks im Browser. Schließe den Ablauf vollständig ab und
                  rufe danach die Live-Angebote erneut ab.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => reopenAccountCheck()}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Kontocheck erneut starten
            </button>
          </div>
        </div>
      ) : null}

      {!error && !diagnostics.blocking.length && diagnostics.feasibility.length && acceptableOfferCount === 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="font-semibold">Aktuell noch kein direkt auswählbares Angebot</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {diagnostics.feasibility.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!error && technicalFailureOfferViews.length > 0 ? (
        <div className="mt-3 rounded-[28px] border border-rose-200 bg-[linear-gradient(135deg,rgba(251,113,133,0.10),rgba(255,255,255,0.98))] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Technisch aktuell blockiert</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {technicalFailureOfferViews.length === 1
              ? "1 Angebot konnte technisch nicht final bestätigt werden."
              : `${technicalFailureOfferViews.length} Angebote konnten technisch nicht final bestätigt werden.`}
          </div>
          <div className="mt-1 text-sm text-slate-700">
            Diese Varianten stehen erst wieder oben zur Auswahl, wenn der Anbieter eine neue gültige Version liefert.
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {technicalFailureOfferViews.slice(0, 6).map((view) => (
              <div key={`technical-${view.offer.angebot_id}`} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">{view.providerName}</div>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
                    Technische Rückmeldung
                  </span>
                </div>
                {view.productName ? <div className="mt-1 text-xs text-slate-500">{view.productName}</div> : null}
                <div className="mt-2 text-sm text-rose-950">
                  {feedbackTextForOffer(view, {
                    hasRejectedApplication: resolvedHasRejectedApplication,
                    rejectedApplicationMessage: normalizedRejectedApplicationMessage,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!error && pendingFeedbackOfferViews.length > 0 ? (
        <div className="mt-3 rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.10),rgba(255,255,255,0.98))] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Noch nicht final freigegeben</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {pendingFeedbackOfferViews.length === 1
              ? "1 Angebot ist aktuell noch nicht final auswählbar."
              : `${pendingFeedbackOfferViews.length} Angebote sind aktuell noch nicht final auswählbar.`}
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {pendingFeedbackOfferViews.slice(0, 6).map((view) => (
              <div key={`pending-${view.offer.angebot_id}`} className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">{view.providerName}</div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {labelStatus(view.offer.machbarkeit_status)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {labelStatus(view.offer.vollstaendigkeit_status)}
                  </span>
                </div>
                {view.productName ? <div className="mt-1 text-xs text-slate-500">{view.productName}</div> : null}
                <div className="mt-2 text-sm text-amber-950">
                  {feedbackTextForOffer(view, {
                    hasRejectedApplication: resolvedHasRejectedApplication,
                    rejectedApplicationMessage: normalizedRejectedApplicationMessage,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {visibleOfferViews.length === 0 && accountCheckOfferViews.length === 0 ? (
          <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.10),rgba(255,255,255,0.98))] p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Aktuell noch kein Angebot</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              Wir prüfen gern mit dir, was für die nächste Angebotsrunde noch angepasst werden sollte
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-700">{noOfferLeadMessage}</div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Angaben kurz prüfen</div>
                <div className="mt-1">
                  Häufig reichen schon kleine Anpassungen bei Beschäftigung, Einkommen, Haushaltsdaten oder Laufzeit.
                </div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Berater meldet sich</div>
                <div className="mt-1">
                  Wenn sich nicht direkt ein passendes Angebot ergibt, schaut SEPANA den Fall noch einmal manuell an und meldet sich bei dir.
                </div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Direkt anrufen</div>
                <div className="mt-1">Wenn du lieber sofort sprechen möchtest, kannst du uns auch direkt telefonisch erreichen.</div>
                {resolvedContactPhoneHref ? (
                  <a
                    href={resolvedContactPhoneHref}
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                  >
                    {resolvedContactPhone}
                  </a>
                ) : null}
              </div>
            </div>
            {(declinedOfferViews.length > 0 || hiddenNonGreenOfferCount > 0) ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Unten siehst du zusätzlich, welche Varianten abgelehnt wurden oder aktuell noch auf Freigabe warten.
              </div>
            ) : null}
          </div>
        ) : null}

        {renderedDirectSectionOfferViews.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.98))] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                {isPublicOnlinekredit ? "Onlinekredit ohne Begleitung" : "Direkt online in wenigen Minuten"}
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {isPublicOnlinekredit
                  ? directOnlinePendingCount > 0
                    ? "Hier stehen alle Angebote, die ohne SEPANA-Begleitung laufen. Falls ein Kontocheck nötig ist, startest du ihn direkt in der jeweiligen Karte."
                    : "Hier stehen alle Angebote, die komplett digital und ohne SEPANA-Begleitung direkt weiterlaufen."
                  : "Diese Angebote kannst du jetzt komplett digital und ohne Berater direkt auswählen."}
              </div>
            </div>
            {renderedDirectSectionOfferViews.map((view) =>
              requiresAccountCheckBeforeSelection(view) ? renderPendingAccountCheckCard(view) : renderOfferCard(view)
            )}
          </div>
        ) : null}

        {renderedGuidedSectionOfferViews.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-[24px] border border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.98))] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Mit SEPANA-Begleitung</div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {isPublicOnlinekredit
                  ? guidedPendingCount > 0
                    ? "Hier stehen alle Angebote, die nach dem Kontocheck oder nach deiner Auswahl mit SEPANA weiterlaufen."
                    : "Diese Angebote sind auswählbar, der eigentliche Abschluss läuft danach aber mit SEPANA-Begleitung weiter."
                  : "Diese Angebote sind auswählbar, der eigentliche Abschluss läuft danach aber nicht komplett digital, sondern mit SEPANA-Begleitung weiter."}
              </div>
            </div>
            {renderedGuidedSectionOfferViews.map((view) =>
              requiresAccountCheckBeforeSelection(view) ? renderPendingAccountCheckCard(view) : renderOfferCard(view)
            )}
          </div>
        ) : null}

        {!error && declinedOfferViews.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(135deg,rgba(251,113,133,0.10),rgba(255,255,255,0.98))] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">Ganz unten einsortiert: abgelehnt oder aktuell nicht machbar</div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {declinedOfferViews.length === 1
                  ? "1 Anbieter hat unter den aktuellen Angaben kein freigegebenes Angebot."
                  : `${declinedOfferViews.length} Anbieter haben unter den aktuellen Angaben kein freigegebenes Angebot.`}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {declinedOfferViews.slice(0, 6).map((view) => {
                const rejectedAcceptedOffer = isRejectedAcceptedOffer(view, resolvedHasRejectedApplication)
                return (
                  <div key={`declined-${view.offer.angebot_id}`} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{view.providerName}</div>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
                        {rejectedAcceptedOffer ? "Abgelehnt" : labelStatus(view.offer.machbarkeit_status)}
                      </span>
                    </div>
                    {view.productName ? <div className="mt-1 text-xs text-slate-500">{view.productName}</div> : null}
                    <div className="mt-2 text-sm text-rose-950">
                      {feedbackTextForOffer(view, {
                        hasRejectedApplication: resolvedHasRejectedApplication,
                        rejectedApplicationMessage: normalizedRejectedApplicationMessage,
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
        </div>
      ) : null}
      </div>

      <AccountCheckInfoDialog
        open={Boolean(accountCheckDialogView)}
        onClose={() => setAccountCheckDialogView(null)}
        providerName={accountCheckDialogView?.providerName}
        productName={accountCheckDialogView?.productName}
        onStart={accountCheckStartEndpoint ? startAccountCheck : null}
        startStatus={accountCheckStatus}
        errorText={accountCheckDialogError}
        wizardSessionKey={accountCheckWizardSessionKey}
        onWizardFinished={() => {
          void handleAccountCheckFinished()
        }}
        onWizardAborted={() => {
          setAccountCheckStatus("idle")
          setAccountCheckCompleted(false)
          setAccountCheckWizardSessionKey(null)
          setAccountCheckDialogError("Kontocheck wurde im Browser abgebrochen. Bitte starte ihn erneut.")
          try {
            window.localStorage.removeItem(accountCheckStorageKey)
          } catch {
            // ignore storage issues
          }
        }}
      />

      {accountCheckRereshOverlay ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-emerald-200/80 bg-white p-6 text-center shadow-[0_28px_90px_rgba(15,23,42,0.20)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-300/50 animate-ping" />
                <span className="absolute inline-flex h-8 w-8 rounded-full border-2 border-emerald-500/30" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-600" />
              </div>
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              Kontocheck übernommen
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-900">
              Deine Angebote werden jetzt aktualisiert
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">
              Wir prüfen gerade, welche Angebote du jetzt final auswählen kannst. Das dauert nur einen kurzen Moment.
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#10b981,#06b6d4)] animate-[pulse_1.2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => closeQuickEdit()}
          role="presentation"
        >
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-edit-title"
          >
            <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.10),rgba(16,185,129,0.10))] px-5 py-5 sm:px-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Direkt ergänzen</div>
              <h3 id="quick-edit-title" className="mt-1 text-xl font-semibold text-slate-900">
                Fehlerhafte oder fehlende Pflichtangaben direkt korrigieren
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Wir aktualisieren direkt in diesem Fall {editorFields.length ? editorFields.map(editorFieldLabel).join(" ⬢ ") : ""} und
                rechnen die Angebote danach sofort neu.
              </p>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {editorReasons.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <div className="font-semibold">Diese Punkte blockieren aktuell die Auswahl</div>
                  <ul className="mt-2 space-y-2">
                    {editorReasons.map((reason) => (
                      <li key={reason} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {editorLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Aktuelle Fallangaben werden geladen...
                </div>
              ) : (
                <>
                  {showBirthDateField || showEmploymentSinceField || showAddressSinceField || showPreviousAddressSinceField ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {showBirthDateField ? (
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-900">Geburtsdatum</span>
                          <input
                            type="date"
                            value={editorState.birth_date}
                            onChange={(event) => updateEditorField("birth_date", event.target.value)}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          />
                        </label>
                      ) : null}

                      {showEmploymentSinceField ? (
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-900">Beschäftigt seit</span>
                          <input
                            type="date"
                            value={editorState.employment_since}
                            onChange={(event) => updateEditorField("employment_since", event.target.value)}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          />
                        </label>
                      ) : null}

                      {showAddressSinceField ? (
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-900">Wohnhaft seit</span>
                          <input
                            type="date"
                            value={editorState.address_since}
                            onChange={(event) => updateEditorField("address_since", event.target.value)}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          />
                        </label>
                      ) : null}

                      {showPreviousAddressSinceField ? (
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-900">Voranschrift wohnhaft seit</span>
                          <input
                            type="date"
                            value={editorState.previous_address_since}
                            onChange={(event) => updateEditorField("previous_address_since", event.target.value)}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  {showPhoneField ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">Telefon privat</span>
                      <input
                        type="tel"
                        value={editorState.phone}
                        onChange={(event) => updateEditorField("phone", event.target.value)}
                        autoComplete="tel"
                        placeholder="+49 ..."
                        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>
                  ) : null}

                  {showBankFields ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-sm font-semibold text-slate-900">Kontoinhaber</span>
                        <input
                          type="text"
                          value={editorState.bank_account_holder}
                          onChange={(event) => updateEditorField("bank_account_holder", event.target.value)}
                          autoComplete="name"
                          placeholder="Vor- und Nachname"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        />
                        {canApplySuggestedAccountHolder ? (
                          <button
                            type="button"
                            onClick={() => updateEditorField("bank_account_holder", editorSuggestedAccountHolder)}
                            className="mt-2 inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900"
                          >
                            Namen des Antragstellers übernehmen: {editorSuggestedAccountHolder}
                          </button>
                        ) : null}
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-900">IBAN</span>
                        <input
                          type="text"
                          value={editorState.bank_iban}
                          onChange={(event) => updateEditorField("bank_iban", event.target.value.toUpperCase())}
                          autoComplete="off"
                          placeholder="DE12..."
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm uppercase tracking-[0.08em] text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        />
                        <div className="mt-2 text-xs text-slate-500">
                          {editorBicLookupLoading
                            ? "BIC wird automatisch aus der IBAN geladen..."
                            : "Sobald die IBAN vollständig ist, wird die BIC automatisch ergänzt."}
                        </div>
                        {sandboxEditorIbanDemo ? (
                          <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Testmodus erkannt: <span className="font-semibold">{XS2A_SANDBOX_TEST_IBAN_ALIAS}</span> wird
                            nur im Hintergrund für den Sandbox-Check verwendet und mit
                            <span className="font-semibold"> {sandboxEditorIbanDemo.bic}</span> vorbelegt.
                          </div>
                        ) : null}
                        {looksLikeIban(editorState.bank_iban) ? (
                          <button
                            type="button"
                            onClick={() => void lookupEditorBic(editorState.bank_iban)}
                            disabled={editorBicLookupLoading}
                            className="mt-2 inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-900 disabled:opacity-60"
                          >
                            {editorBicLookupLoading ? "Lädt BIC..." : "BIC aus IBAN laden"}
                          </button>
                        ) : null}
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-900">BIC</span>
                        <input
                          type="text"
                          value={editorState.bank_bic}
                          onChange={(event) => updateEditorField("bank_bic", event.target.value.toUpperCase())}
                          autoComplete="off"
                          placeholder="COBADEFFXXX"
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm uppercase tracking-[0.08em] text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                        />
                        {editorBicLookupError ? <div className="mt-2 text-xs text-amber-700">{editorBicLookupError}</div> : null}
                      </label>
                    </div>
                  ) : null}
                </>
              )}

              {editorError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {editorError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={() => closeQuickEdit()}
                disabled={editorSaving}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void saveQuickEdit()}
                disabled={editorLoading || editorSaving}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {editorSaving ? "Speichere und berechne neu..." : "Speichern und Angebote aktualisieren"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

