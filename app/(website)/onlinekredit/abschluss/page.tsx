import type { Metadata } from "next"
import { headers } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import OnlinekreditAccessCard from "@/components/onlinekredit/OnlinekreditAccessCard"
import OnlinekreditFinalOfferAction from "@/components/onlinekredit/OnlinekreditFinalOfferAction"
import { hasFinishedAccountCheckAfterLatestStart } from "@/lib/europace/offerSync"
import { findRejectedEuropaceApplication, normalizeEuropaceApplications } from "@/lib/europace/status"
import { getOnlinekreditAccountCheckRestrictionReason } from "@/lib/onlinekredit/accountCheckPolicy"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const metadata: Metadata = {
  title: "Onlinekredit Abschluss | SEPANA",
  robots: { index: false, follow: false },
}

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  angebotId?: string
  existing?: string
}

type EuropaceMeta = {
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  last_error?: string | null
  last_export_snapshot?: unknown
} | null

type OfferRow = {
  angebot_id: string
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
  angebot_snapshot?: {
    sofortkredit?: boolean | null
    digitalisierungsmerkmale?: {
      accountCheck?: {
        modus?: string | null
      } | null
    } | null
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
    vollstaendigkeit?: {
      messages?: Array<{ text?: string | null; property?: string | null }> | null
    } | null
  } | null
}

type OfferMessage = {
  text?: string | null
  property?: string | null
}

type ApplicantPolicyRow = {
  employment_type?: string | null
}

type BaufiPolicyRow = {
  purpose?: string | null
}

type ProviderCatalogItem = {
  provider?: {
    id: string
    name: string
    slug?: string | null
    logo_horizontal_path?: string | null
    logo_icon_path?: string | null
    preferred_logo_variant?: string | null
  } | null
  term?: {
    rate_note?: string | null
    special_repayment_free_pct?: string | null
    special_repayment_free_note?: string | null
    repayment_change_note?: string | null
    loan_min?: string | null
    loan_max?: string | null
    features?: {
      ui_disclaimer?: string | null
    } | null
  } | null
} | null

type ProvidersResponse = {
  ok?: boolean
  items?: ProviderCatalogItem[] | null
} | null

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function customerText(value: unknown) {
  return String(value ?? "").replace(/europace/gi, "SEPANA").trim()
}

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}${path}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function isAccountCheckMessage(entry: OfferMessage | null | undefined) {
  const haystack = [String(entry?.property ?? ""), String(entry?.text ?? "")]
    .join(" ")
    .toLowerCase()
  return haystack.includes("kontocheck") || haystack.includes("accountcheck") || haystack.includes("account check")
}

function formatOfferMessage(entry: OfferMessage | null | undefined) {
  const text = String(entry?.text ?? "").trim()
  const property = String(entry?.property ?? "").trim()
  if (property && text) return customerText(`${property}: ${text}`)
  return customerText(text || property)
}

function deriveOfferNotices(
  offer: OfferRow | null,
  accountCheckRestrictedReason?: string | null,
  accountCheckCompleted = false
) {
  const messages = Array.isArray(offer?.angebot_snapshot?.vollstaendigkeit?.messages)
    ? (offer?.angebot_snapshot?.vollstaendigkeit?.messages ?? [])
    : []
  const accountCheckMode = String(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus ?? "")
    .trim()
    .toUpperCase()
  const completenessStatus = String(offer?.vollstaendigkeit_status ?? "").trim().toUpperCase()

  const blockingMessages = messages
    .filter((entry) => !isAccountCheckMessage(entry))
    .map((entry) => formatOfferMessage(entry))
    .filter(Boolean)

  const hasAccountCheckNotice =
    accountCheckMode === "OPTIONAL" ||
    (accountCheckMode === "REQUIRED" && !accountCheckCompleted && completenessStatus !== "VOLLSTAENDIG") ||
    (!accountCheckCompleted && messages.some(isAccountCheckMessage))
  const accountCheckNote = accountCheckRestrictedReason
    ? hasAccountCheckNotice || Boolean(offer?.angebot_snapshot?.sofortkredit)
      ? accountCheckRestrictedReason
      : null
    : hasAccountCheckNotice
      ? accountCheckMode === "REQUIRED" && completenessStatus !== "VOLLSTAENDIG"
        ? "Für dieses Angebot ist vor der finalen Annahme zuerst ein Kontocheck nötig. Danach kannst du die finalen Konditionen erneut prüfen."
        : accountCheckMode === "OPTIONAL"
          ? "Falls der Anbieter für dieses Angebot einen Kontocheck nutzt, startest du ihn nach deiner finalen Annahme direkt online im Browser."
          : null
      : null

  const accountCheckBadgeLabel = accountCheckCompleted
    ? null
    : accountCheckRestrictedReason
    ? accountCheckNote
      ? "Mit SEPANA-Begleitung"
      : null
    : accountCheckMode === "REQUIRED" && completenessStatus !== "VOLLSTAENDIG"
      ? "Kontocheck zuerst nötig"
      : accountCheckNote
        ? "Kontocheck online im Browser"
        : null

  return {
    blockingMessages,
    accountCheckNote,
    accountCheckBadgeLabel,
  }
}

function buildBaseQuery(input: {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount: boolean
}) {
  const params = new URLSearchParams({
    caseId: input.caseId,
    caseRef: input.caseRef,
    access: input.accessToken,
  })
  if (input.existingAccount) params.set("existing", "1")
  return params
}

function formatEUR(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(value))} %`
}

function compactText(value: unknown) {
  const text = String(value ?? "").trim()
  return text ? text : null
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

  return Array.from(new Set([...baseValues, ...strippedValues].filter(Boolean)))
}

function providerLogoScaleHint(providerName: string, assetRef?: string | null, source: "provider" | "europace" = "provider") {
  const name = normalizeProviderKey(providerName)
  const asset = normalizeProviderKey(assetRef)

  if (source === "europace") return 1
  if (name === "ing" || asset.includes("ing group n v")) return 1.16
  if (name.includes("consors") || asset.includes("consors finanz")) return 1.22
  if (name === "dkb" || name.includes("deutsche kreditbank") || asset.includes("deutsche kreditbank")) return 1.14
  if (name.includes("deutsche bank") || asset.includes("deutsche bank")) return 1.1
  if (name.includes("santander") || asset.includes("santander")) return 1.1
  if (name.includes("targobank") || asset.includes("targobank")) return 1.1
  return 1
}

function providerCatalogLogo(provider: NonNullable<ProviderCatalogItem>["provider"]) {
  if (!provider) return null
  const prefer = provider.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const preferredFile = prefer === "icon" ? provider.logo_icon_path : provider.logo_horizontal_path
  const fallbackFile = prefer === "icon" ? provider.logo_horizontal_path : provider.logo_icon_path
  const file = compactText(preferredFile) ?? compactText(fallbackFile)
  if (!file) return null

  return {
    src: `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(file)}`,
    scale: providerLogoScaleHint(provider.name, `${provider.logo_horizontal_path ?? ""} ${provider.logo_icon_path ?? ""}`, "provider"),
  }
}

function offerSnapshotLogo(offer: OfferRow | null | undefined, providerName: string) {
  const remoteUrl = compactText(offer?.angebot_snapshot?.ratenkredit?.produktanbieter?.logo?.svg)
  if (!remoteUrl) return null

  return {
    src: `/api/baufi/provider-logo?url=${encodeURIComponent(remoteUrl)}`,
    scale: providerLogoScaleHint(providerName, remoteUrl, "europace"),
  }
}

function findMatchingProviderCatalogItem(items: ProviderCatalogItem[], providerName: string | null | undefined) {
  const providerKeys = new Set(providerLookupKeys(providerName))
  if (!providerKeys.size) return null

  for (const item of items) {
    const candidateKeys = providerLookupKeys(item?.provider?.name)
    if (candidateKeys.some((key) => providerKeys.has(key))) {
      return item ?? null
    }
  }

  return null
}

function buildSpecialRepaymentLabel(term: NonNullable<ProviderCatalogItem>["term"]) {
  if (!term) return null
  const pct = compactText(term.special_repayment_free_pct)
  if (pct) return `${pct} % p.a.`
  return compactText(term.special_repayment_free_note)
}

function buildLoanRangeLabel(term: NonNullable<ProviderCatalogItem>["term"]) {
  if (!term) return null
  const min = compactText(term.loan_min)
  const max = compactText(term.loan_max)
  if (min && max) return `${min} bis ${max} EUR`
  if (min) return `ab ${min} EUR`
  if (max) return `bis ${max} EUR`
  return null
}

function accountCheckInfoLabel(
  offer: OfferRow | null,
  accountCheckRestrictedReason?: string | null,
  accountCheckCompleted = false
) {
  if (accountCheckRestrictedReason && Boolean(offer?.angebot_snapshot?.sofortkredit)) {
    return accountCheckRestrictedReason
  }

  const accountCheckMode = String(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus ?? "")
    .trim()
    .toUpperCase()
  if (accountCheckMode === "REQUIRED") {
    return accountCheckCompleted ? "Bereits durchgeführt." : "Vor der finalen Annahme ist ein Kontocheck erforderlich."
  }
  if (accountCheckMode === "OPTIONAL") {
    return "Kontocheck optional, falls der Anbieter ihn im Abschluss nutzt."
  }
  return null
}

export default async function OnlinekreditFinalPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const angebotId = trimOrNull(sp.angebotId)
  const existingAccount = parseBoolParam(sp.existing)

  if (!caseId || !caseRef || !accessToken || !angebotId) {
    return (
      <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Angebot nicht gefunden</h1>
        <p className="mt-2 text-sm text-slate-600">
          Für den Abschluss fehlt die Angebots-ID oder der öffentliche Fallzugriff.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Zum Antrag
          </Link>
        </div>
      </div>
    )
  }

  const admin = supabaseAdmin()
  const access = await resolvePublicOnlinekreditCaseAccess(admin, {
    caseId,
    caseRef,
    accessToken,
    expectedCaseType: "konsum",
  })

  if (!access.ok) {
    return (
      <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig oder abgelaufen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dieser Onlinekredit-Link kann nicht mehr verwendet werden. Starte den Vorgang bitte erneut.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
          >
            Neu starten
          </Link>
        </div>
      </div>
    )
  }

  const query = buildBaseQuery({ caseId, caseRef, accessToken, existingAccount })
  const formHref = `/onlinekredit?${query.toString()}`
  const offersParams = new URLSearchParams(query)
  const offersHref = `/onlinekredit/angebote?${offersParams.toString()}`
  const successParams = new URLSearchParams(query)
  successParams.set("angebotId", angebotId)
  const successHref = `/onlinekredit/bestaetigung?${successParams.toString()}`
  const loginHref = `/login?next=${encodeURIComponent(`/app/faelle/${caseId}#privatkredit-journey`)}`

  const [primaryResult, europaceResult, offerResult, applicantsResult, baufiResult, accountCheckCompleted] = await Promise.all([
    admin.from("case_applicants").select("email").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    admin
      .from("case_europace")
      .select("annahme_job_id,antragsnummer,produktanbieterantragsnummer,last_error,last_export_snapshot")
      .eq("case_id", caseId)
      .maybeSingle(),
    admin
      .from("case_europace_offers")
      .select("angebot_id,machbarkeit_status,vollstaendigkeit_status,accepted_at,superseded_at,angebot_snapshot")
      .eq("case_id", caseId)
      .eq("angebot_id", angebotId)
      .maybeSingle(),
    admin.from("case_applicants").select("employment_type").eq("case_id", caseId),
    admin.from("case_baufi_details").select("purpose").eq("case_id", caseId).maybeSingle(),
    hasFinishedAccountCheckAfterLatestStart(admin, caseId).catch(() => false),
  ])

  const primaryEmail = trimOrNull((primaryResult.data as { email?: string | null } | null)?.email)
  const europaceMeta = (europaceResult.data ?? null) as EuropaceMeta
  const offer = (offerResult.data ?? null) as OfferRow | null
  const applicants = ((applicantsResult.data ?? []) as ApplicantPolicyRow[]) ?? []
  const baufi = (baufiResult.data ?? null) as BaufiPolicyRow | null
  const applications = normalizeEuropaceApplications(
    (europaceMeta?.last_export_snapshot ?? null) as Parameters<typeof normalizeEuropaceApplications>[0]
  )
  const hasRejectedApplication = Boolean(
    findRejectedEuropaceApplication(applications, {
      antragsnummer: europaceMeta?.antragsnummer,
      produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
    })
  )
  const accountCheckRestrictedReason = getOnlinekreditAccountCheckRestrictionReason({
    purpose: baufi?.purpose,
    employmentTypes: applicants.map((row) => row.employment_type),
  })

  if (!offer) {
    return (
      <div className="space-y-4">
        <div className="rounded-[32px] border border-amber-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Angebot nicht gefunden</h1>
          <p className="mt-2 text-sm text-slate-600">
            Das ausgewählte Angebot liegt auf diesem Fall nicht mehr vor. Gehe bitte zur Angebotsseite zurück und
            wähle ein aktuelles Angebot aus.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={offersHref}
              prefetch={false}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
            >
              Zur Angebotsseite
            </Link>
            <Link
              href={formHref}
              prefetch={false}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Angaben anpassen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const providersResponse = await fetchJson<ProvidersResponse>("/api/baufi/providers?product=konsum")
  const providerItems = Array.isArray(providersResponse?.items) ? providersResponse.items : []
  const selectedIsOnline = Boolean(offer.angebot_snapshot?.sofortkredit) && !accountCheckRestrictedReason
  const hasApplication = Boolean(trimOrNull(europaceMeta?.antragsnummer)) && !hasRejectedApplication
  const hasRunningApplicationJob = Boolean(trimOrNull(europaceMeta?.annahme_job_id)) && !hasApplication
  const selectedOfferAccepted =
    !hasRejectedApplication && Boolean(trimOrNull(offer.accepted_at)) && !Boolean(trimOrNull(offer.superseded_at))
  const hasAcceptedOffer = (!hasRejectedApplication && Boolean(trimOrNull(offer.accepted_at))) || hasApplication || hasRunningApplicationJob
  const providerName = offer.angebot_snapshot?.ratenkredit?.produktanbieter?.name ?? "-"
  const productName = offer.angebot_snapshot?.ratenkredit?.produktbezeichnung ?? null
  const providerItem = findMatchingProviderCatalogItem(providerItems, providerName)
  const providerLogo = providerCatalogLogo(providerItem?.provider) ?? offerSnapshotLogo(offer, providerName)
  const specialRepaymentLabel = buildSpecialRepaymentLabel(providerItem?.term)
  const repaymentChangeLabel = compactText(providerItem?.term?.repayment_change_note)
  const loanRangeLabel = buildLoanRangeLabel(providerItem?.term)
  const productInfoLabel =
    compactText(providerItem?.term?.features?.ui_disclaimer) ??
    compactText(providerItem?.term?.rate_note)
  const accountCheckLabel = accountCheckInfoLabel(offer, accountCheckRestrictedReason, accountCheckCompleted)
  const offerFeatureItems = [
    accountCheckLabel ? { label: "Kontocheck", value: accountCheckLabel } : null,
    specialRepaymentLabel ? { label: "Sondertilgung", value: specialRepaymentLabel } : null,
    repaymentChangeLabel ? { label: "Ratenpause / Ratenwechsel", value: repaymentChangeLabel } : null,
    loanRangeLabel ? { label: "Kreditrahmen", value: loanRangeLabel } : null,
    productInfoLabel ? { label: "Produktinfo", value: productInfoLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
  const offerNotices = deriveOfferNotices(offer, accountCheckRestrictedReason, accountCheckCompleted)

  if (hasRunningApplicationJob || selectedOfferAccepted) {
    redirect(successHref)
  }

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_38%)] blur-3xl" />

      <section className="relative overflow-hidden rounded-[40px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.18),transparent)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Onlinekredit · Stufe 3 von 4</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Finale Anfrage mit letzter Sicherheitsrunde
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              Du bist an der verbindlichen Entscheidung. SEPANA lädt jetzt die aktuellsten Konditionen nach, zeigt dir
              den direkten Vorher-Nachher-Vergleich und erst danach bestätigst du dein Angebot final.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">✓ Angaben</span>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">✓ Angebote</span>
              <span className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">● Finale Anfrage</span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">Status & Upload</span>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={offersHref}
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Zurück zu Angeboten
              </Link>
              <Link
                href={formHref}
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Angaben anpassen
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ausgewählt</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{providerName}</div>
              {productName ? <div className="mt-2 text-sm text-slate-600">{productName}</div> : null}
            </div>
            <div className="rounded-[28px] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Monatsrate</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {formatEUR(offer.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)}
              </div>
            </div>
            <div className="rounded-[28px] border border-cyan-200/80 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.94))] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Effektivzins</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {formatPct(offer.angebot_snapshot?.gesamtkonditionen?.effektivzins)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2 text-xs">
          {selectedIsOnline ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
              Online abschließbar
            </span>
          ) : (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
              Finale Bearbeitung ggf. mit Beratung
            </span>
          )}
          {!hasRejectedApplication && trimOrNull(offer.accepted_at) ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
              Bereits angenommen
            </span>
          ) : null}
          {!hasRejectedApplication && trimOrNull(offer.superseded_at) ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
              Angebot wurde ersetzt
            </span>
          ) : null}
          {offerNotices.accountCheckBadgeLabel ? (
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-cyan-800">
              {offerNotices.accountCheckBadgeLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ausgewähltes Live-Angebot</div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 shadow-sm">
              {providerLogo ? (
                <Image
                  src={providerLogo.src}
                  alt={providerName}
                  width={160}
                  height={40}
                  className="h-10 w-full object-contain object-center"
                  unoptimized
                  style={
                    providerLogo.scale && providerLogo.scale !== 1
                      ? {
                          transform: `scale(${providerLogo.scale})`,
                          transformOrigin: "center center",
                        }
                      : undefined
                  }
                />
              ) : (
                <span className="text-lg font-semibold text-slate-400">{providerName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-900">{providerName}</div>
              {productName ? <div className="mt-1 text-sm text-slate-600">{productName}</div> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Monatsrate</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatEUR(offer.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Effektivzins</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatPct(offer.angebot_snapshot?.gesamtkonditionen?.effektivzins)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Sollzins</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatPct(offer.angebot_snapshot?.gesamtkonditionen?.sollzins)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Kreditbetrag</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatEUR(
                offer.angebot_snapshot?.gesamtkonditionen?.nettokreditbetrag ??
                  offer.angebot_snapshot?.gesamtkonditionen?.gesamtkreditbetrag
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Auszahlung</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {formatEUR(offer.angebot_snapshot?.gesamtkonditionen?.auszahlungsbetrag)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">Laufzeit</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">
              {offer.angebot_snapshot?.gesamtkonditionen?.laufzeitInMonaten
                ? `${offer.angebot_snapshot.gesamtkonditionen.laufzeitInMonaten} Monate`
                : "-"}
            </div>
          </div>
        </div>

        {offerFeatureItems.length > 0 ? (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Weitere Produktinfos</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {offerFeatureItems.map((item) => (
                <div key={`${item.label}:${item.value}`} className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {offerNotices.accountCheckNote ? (
          <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            {offerNotices.accountCheckNote}
          </div>
        ) : null}

        {offerNotices.blockingMessages.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {offerNotices.blockingMessages.join(" | ")}
          </div>
        ) : null}
      </section>

      <OnlinekreditFinalOfferAction
        caseId={caseId}
        caseRef={caseRef}
        accessToken={accessToken}
        initialOffer={offer}
        initialMeta={europaceMeta}
        primaryEmail={primaryEmail}
        existingAccount={existingAccount}
        accountCheckRestrictedReason={accountCheckRestrictedReason}
        initialAccountCheckCompleted={accountCheckCompleted}
        initialHasRejectedApplication={hasRejectedApplication}
        offersHref={offersHref}
        successHref={successHref}
      />

      <OnlinekreditAccessCard
        caseId={caseId}
        loginHref={loginHref}
        primaryEmail={primaryEmail}
        existingAccount={existingAccount}
        hasAcceptedOffer={hasAcceptedOffer}
        hasApplication={hasApplication}
        hasRunningApplicationJob={hasRunningApplicationJob}
        acceptedOfferIsOnline={selectedIsOnline}
        directOnlineBankCompletionFlow={false}
      />
    </div>
  )
}
