"use client"

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AccountCheckInfoDialog from "@/components/onlinekredit/AccountCheckInfoDialog"
import { toPublicOfferAcceptanceMessage } from "@/lib/europace/offerAcceptance"
import {
  getOfferBlockingMessages,
  getOfferValidationMessage,
  isOfferGreenSelectable,
} from "@/lib/europace/offerEligibility"
import { compareEuropaceOfferRevisionsDesc } from "@/lib/europace/offerToken"

type Meta = {
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  last_error?: string | null
} | null

type OfferSnapshot = {
  sofortkredit?: boolean | null
  digitalisierungsmerkmale?: {
    accountCheck?: {
      modus?: string | null
    } | null
  } | null
  ratenkredit?: {
    produktanbieter?: {
      name?: string | null
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
} | null

type OfferRow = {
  angebot_id: string
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
  angebot_snapshot?: OfferSnapshot
}

type JobState = {
  jobId: string | null
  status: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  hasApplication: boolean
  hasRejectedApplication: boolean
  terminalMessage: string | null
}

type MetricComparison = {
  id: string
  label: string
  before: number | null
  after: number | null
  format: "currency" | "percent" | "months"
  betterDirection: "up" | "down" | "neutral"
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function customerText(value: unknown) {
  return String(value ?? "").replace(/europace/gi, "SEPANA").trim()
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatCurrency(value: number | null) {
  if (value === null) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value)
}

function formatPercent(value: number | null) {
  if (value === null) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)} %`
}

function formatMonths(value: number | null) {
  if (value === null) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} Monate`
}

function formatMetricValue(metric: MetricComparison, value: number | null) {
  if (metric.format === "currency") return formatCurrency(value)
  if (metric.format === "percent") return formatPercent(value)
  return formatMonths(value)
}

function formatMetricDelta(metric: MetricComparison) {
  if (metric.before === null || metric.after === null) return "-"
  const delta = metric.after - metric.before
  if (delta === 0) return "Unverändert"

  if (metric.format === "currency") {
    const absolute = formatCurrency(Math.abs(delta))
    return `${delta > 0 ? "+" : "-"}${absolute}`
  }
  if (metric.format === "percent") {
    const absolute = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Math.abs(delta))
    return `${delta > 0 ? "+" : "-"}${absolute} %`
  }

  return `${delta > 0 ? "+" : "-"}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.abs(delta))} Monate`
}

function providerName(offer: OfferRow | null | undefined) {
  return trimOrNull(offer?.angebot_snapshot?.ratenkredit?.produktanbieter?.name)
}

function productName(offer: OfferRow | null | undefined) {
  return trimOrNull(offer?.angebot_snapshot?.ratenkredit?.produktbezeichnung)
}

function accountCheckMode(offer: OfferRow | null | undefined) {
  return trimOrNull(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus)?.toUpperCase() ?? null
}

function offerIdentity(offer: OfferRow | null | undefined) {
  return JSON.stringify({
    provider: providerName(offer),
    product: productName(offer),
    amount: numberOrNull(
      offer?.angebot_snapshot?.gesamtkonditionen?.nettokreditbetrag ??
        offer?.angebot_snapshot?.gesamtkonditionen?.gesamtkreditbetrag
    ),
    payout: numberOrNull(offer?.angebot_snapshot?.gesamtkonditionen?.auszahlungsbetrag),
    term: numberOrNull(offer?.angebot_snapshot?.gesamtkonditionen?.laufzeitInMonaten),
    effectiveRate: numberOrNull(offer?.angebot_snapshot?.gesamtkonditionen?.effektivzins),
    nominalRate: numberOrNull(offer?.angebot_snapshot?.gesamtkonditionen?.sollzins),
    online: Boolean(offer?.angebot_snapshot?.sofortkredit),
    accountCheckMode: accountCheckMode(offer),
  })
}

function compareNullableNumbers(a: number | null, b: number | null, direction: "asc" | "desc" = "asc") {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return direction === "asc" ? a - b : b - a
}

function compareMatchedOffers(a: OfferRow, b: OfferRow) {
  const revisionDiff = compareEuropaceOfferRevisionsDesc(a.angebot_id, b.angebot_id)
  if (revisionDiff !== 0) return revisionDiff

  const monthlyRateDiff = compareNullableNumbers(
    numberOrNull(a.angebot_snapshot?.gesamtkonditionen?.rateMonatlich),
    numberOrNull(b.angebot_snapshot?.gesamtkonditionen?.rateMonatlich),
    "asc"
  )
  if (monthlyRateDiff !== 0) return monthlyRateDiff

  const effectiveRateDiff = compareNullableNumbers(
    numberOrNull(a.angebot_snapshot?.gesamtkonditionen?.effektivzins),
    numberOrNull(b.angebot_snapshot?.gesamtkonditionen?.effektivzins),
    "asc"
  )
  if (effectiveRateDiff !== 0) return effectiveRateDiff

  return String(a.angebot_id ?? "").localeCompare(String(b.angebot_id ?? ""), "de", { sensitivity: "base" })
}

function buildOfferResultHref(baseHref: string, angebotId: string | null | undefined) {
  const normalizedOfferId = trimOrNull(angebotId)
  if (!normalizedOfferId) return baseHref

  const [pathname, hash = ""] = baseHref.split("#", 2)
  const [path, query = ""] = pathname.split("?", 2)
  const params = new URLSearchParams(query)
  params.set("angebotId", normalizedOfferId)
  const nextPath = `${path}?${params.toString()}`
  return hash ? `${nextPath}#${hash}` : nextPath
}

function findMatchingOffer(initialOffer: OfferRow, offers: OfferRow[]) {
  const identity = offerIdentity(initialOffer)
  const provider = providerName(initialOffer)
  const product = productName(initialOffer)

  const candidates = offers
    .map((offer) => {
      if (offer.angebot_id === initialOffer.angebot_id) return { offer, matchRank: 0 }
      if (offerIdentity(offer) === identity) return { offer, matchRank: 1 }
      if (providerName(offer) === provider && productName(offer) === product) return { offer, matchRank: 2 }
      return null
    })
    .filter(Boolean) as Array<{ offer: OfferRow; matchRank: number }>

  if (!candidates.length) return null

  const greenCandidates = candidates
    .filter((entry) => isOfferGreenSelectable(entry.offer))
    .sort((left, right) => left.matchRank - right.matchRank || compareMatchedOffers(left.offer, right.offer))

  if (greenCandidates.length) return greenCandidates[0]?.offer ?? null

  const fallbackCandidates = candidates.sort(
    (left, right) => left.matchRank - right.matchRank || compareMatchedOffers(left.offer, right.offer)
  )
  return fallbackCandidates[0]?.offer ?? null
}

function labelStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "-"
  if (raw === "PENDING") return "Läuft"
  if (raw === "SUCCESS") return "Erfolgreich"
  if (raw === "FAILURE") return "Fehlgeschlagen"
  return raw.toLowerCase()
}

function accountCheckNote(offer: OfferRow | null | undefined) {
  const normalized = String(offer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus ?? "")
    .trim()
    .toUpperCase()
  const completeness = String(offer?.vollstaendigkeit_status ?? "").trim().toUpperCase()
  if (normalized === "REQUIRED") {
    return completeness === "VOLLSTAENDIG"
      ? null
      : "Vor der finalen Annahme ist für dieses Angebot zuerst ein Kontocheck nötig."
  }
  if (normalized === "OPTIONAL") {
    return "Falls der Anbieter einen Kontocheck nutzt, startest du ihn nach der finalen Annahme direkt online im Browser."
  }
  return null
}

function buildMetricComparisons(initialOffer: OfferRow, finalOffer: OfferRow): MetricComparison[] {
  return [
    {
      id: "monthlyRate",
      label: "Monatsrate",
      before: numberOrNull(initialOffer.angebot_snapshot?.gesamtkonditionen?.rateMonatlich),
      after: numberOrNull(finalOffer.angebot_snapshot?.gesamtkonditionen?.rateMonatlich),
      format: "currency",
      betterDirection: "down",
    },
    {
      id: "effectiveRate",
      label: "Effektivzins",
      before: numberOrNull(initialOffer.angebot_snapshot?.gesamtkonditionen?.effektivzins),
      after: numberOrNull(finalOffer.angebot_snapshot?.gesamtkonditionen?.effektivzins),
      format: "percent",
      betterDirection: "down",
    },
    {
      id: "payoutAmount",
      label: "Auszahlung",
      before: numberOrNull(initialOffer.angebot_snapshot?.gesamtkonditionen?.auszahlungsbetrag),
      after: numberOrNull(finalOffer.angebot_snapshot?.gesamtkonditionen?.auszahlungsbetrag),
      format: "currency",
      betterDirection: "up",
    },
    {
      id: "termMonths",
      label: "Laufzeit",
      before: numberOrNull(initialOffer.angebot_snapshot?.gesamtkonditionen?.laufzeitInMonaten),
      after: numberOrNull(finalOffer.angebot_snapshot?.gesamtkonditionen?.laufzeitInMonaten),
      format: "months",
      betterDirection: "neutral",
    },
  ]
}

function changeBadge(metric: MetricComparison) {
  if (metric.before === null || metric.after === null || metric.before === metric.after) {
    return {
      label: "Unverändert",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  const delta = metric.after - metric.before
  const improved =
    metric.betterDirection === "neutral"
      ? delta === 0
      : metric.betterDirection === "up"
        ? delta > 0
        : delta < 0

  const direction = delta > 0 ? "↑" : "↓"
  if (improved) {
    return {
      label: `${direction} ${formatMetricDelta(metric)}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
  }

  return {
    label: `${direction} ${formatMetricDelta(metric)}`,
    className: "border-rose-200 bg-rose-50 text-rose-800",
  }
}

export default function OnlinekreditFinalOfferAction({
  caseId,
  caseRef,
  accessToken,
  initialOffer,
  initialMeta,
  primaryEmail,
  existingAccount = false,
  accountCheckRestrictedReason = null,
  initialAccountCheckCompleted = false,
  initialHasRejectedApplication = false,
  offersHref,
  successHref,
}: {
  caseId: string
  caseRef: string
  accessToken: string
  initialOffer: OfferRow
  initialMeta: Meta
  primaryEmail?: string | null
  existingAccount?: boolean
  accountCheckRestrictedReason?: string | null
  initialAccountCheckCompleted?: boolean
  initialHasRejectedApplication?: boolean
  offersHref: string
  successHref: string
}) {
  const router = useRouter()
  const accountCheckStorageKey = `sepana:account-check-finished:v2:${caseId}`
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [finalOffer, setFinalOffer] = useState<OfferRow | null>(null)
  const [accountCheckDialogOpen, setAccountCheckDialogOpen] = useState(false)
  const [accountCheckStatus, setAccountCheckStatus] = useState<"idle" | "starting" | "activated">("idle")
  const [accountCheckCompleted, setAccountCheckCompleted] = useState(initialAccountCheckCompleted)
  const [accountCheckDialogError, setAccountCheckDialogError] = useState<string | null>(null)
  const [accountCheckWizardSessionKey, setAccountCheckWizardSessionKey] = useState<string | null>(null)
  const [job, setJob] = useState<JobState>({
    jobId: trimOrNull(initialMeta?.annahme_job_id),
    status: trimOrNull(initialMeta?.annahme_job_id) ? "PENDING" : null,
    antragsnummer: trimOrNull(initialMeta?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(initialMeta?.produktanbieterantragsnummer),
    hasApplication: !initialHasRejectedApplication && Boolean(trimOrNull(initialMeta?.antragsnummer)),
    hasRejectedApplication: initialHasRejectedApplication,
    terminalMessage: null,
  })

  const hasRunningJob = Boolean(job.jobId) && (job.status === null || job.status === "PENDING")
  const hasAcceptedApplication = job.hasApplication && !job.hasRejectedApplication
  const comparisonRows = useMemo(
    () => (finalOffer ? buildMetricComparisons(initialOffer, finalOffer) : []),
    [initialOffer, finalOffer]
  )
  const finalOfferBlockingMessages = useMemo(() => getOfferBlockingMessages(finalOffer), [finalOffer])
  const finalOfferValidationMessage = useMemo(
    () => {
      const validationMessage = getOfferValidationMessage(finalOffer, { greenOnly: true })
      if (
        accountCheckRestrictedReason &&
        String(validationMessage ?? "").toLowerCase().includes("kontocheck")
      ) {
        return accountCheckRestrictedReason
      }
      return validationMessage
    },
    [accountCheckRestrictedReason, finalOffer]
  )
  const canAcceptFinalOffer = Boolean(finalOffer) && !finalOfferValidationMessage
  const accountCheckReferenceOffer = finalOffer ?? initialOffer
  const offerRequiresAccountCheck = useMemo(() => {
    if (accountCheckRestrictedReason) return false
    const mode = String(accountCheckReferenceOffer?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus ?? "")
      .trim()
      .toUpperCase()
    return mode === "REQUIRED"
  }, [accountCheckReferenceOffer, accountCheckRestrictedReason])
  const needsAccountCheckBeforeAcceptance = useMemo(() => {
    return offerRequiresAccountCheck && !accountCheckCompleted
  }, [accountCheckCompleted, offerRequiresAccountCheck])
  const offerChanged = useMemo(() => {
    if (!finalOffer) return false
    if (finalOffer.angebot_id !== initialOffer.angebot_id) return true
    return comparisonRows.some((metric) => metric.before !== metric.after)
  }, [comparisonRows, finalOffer, initialOffer.angebot_id])
  const shouldNotifyAdvisorAboutGuidedSelection = useMemo(
    () => Boolean(accountCheckRestrictedReason) || !Boolean(initialOffer.angebot_snapshot?.sofortkredit),
    [accountCheckRestrictedReason, initialOffer.angebot_snapshot?.sofortkredit]
  )
  const advisorSelectionNotificationStorageKey = useMemo(
    () => `sepana:advisor-guided-selection:${caseId}:${initialOffer.angebot_id}`,
    [caseId, initialOffer.angebot_id]
  )
  const pendingAccountCheckNote = useMemo(() => {
    if (accountCheckRestrictedReason && Boolean((finalOffer ?? initialOffer)?.angebot_snapshot?.sofortkredit)) {
      return accountCheckRestrictedReason
    }
    if (!needsAccountCheckBeforeAcceptance) return null
    return accountCheckNote(finalOffer ?? initialOffer)
  }, [accountCheckRestrictedReason, finalOffer, initialOffer, needsAccountCheckBeforeAcceptance])
  const primaryActionLabel = useMemo(() => {
    if (!finalOffer) return refreshing ? "Finale Anfrage läuft…" : "Finale Anfrage starten"
    if (hasAcceptedApplication) return "Bereits angenommen"
    if (needsAccountCheckBeforeAcceptance) {
      if (accountCheckStatus === "starting") return "Kontocheck wird aktiviert…"
      if (accountCheckStatus === "activated") {
        return accountCheckWizardSessionKey ? "Kontocheck läuft" : "Kontocheck durchführen"
      }
      return "Kontocheck durchführen"
    }
    if (canAcceptFinalOffer) return busy ? "Nimmt final an…" : "Final annehmen"
    return refreshing ? "Finale Anfrage läuft…" : "Konditionen erneut prüfen"
  }, [
    accountCheckStatus,
    accountCheckWizardSessionKey,
    busy,
    canAcceptFinalOffer,
    finalOffer,
    hasAcceptedApplication,
    needsAccountCheckBeforeAcceptance,
    refreshing,
  ])
  const primaryActionDisabled = useMemo(() => {
    if (!finalOffer) return refreshing || hasRunningJob || hasAcceptedApplication
    if (hasAcceptedApplication) return true
    if (needsAccountCheckBeforeAcceptance) return false
    if (canAcceptFinalOffer) return busy || hasRunningJob
    return refreshing || hasRunningJob
  }, [
    busy,
    canAcceptFinalOffer,
    finalOffer,
    hasAcceptedApplication,
    hasRunningJob,
    needsAccountCheckBeforeAcceptance,
    refreshing,
  ])
  const primaryActionClassName = useMemo(() => {
    if (finalOffer && needsAccountCheckBeforeAcceptance) {
      return `inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold shadow-sm ${
        accountCheckStatus === "activated"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border border-cyan-200 bg-cyan-50 text-cyan-950"
      }`
    }
    if (finalOffer && canAcceptFinalOffer) {
      return "inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    }
    return "inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
  }, [accountCheckStatus, canAcceptFinalOffer, finalOffer, needsAccountCheckBeforeAcceptance])
  const resultHref = useMemo(
    () => buildOfferResultHref(successHref, finalOffer?.angebot_id ?? initialOffer.angebot_id),
    [finalOffer?.angebot_id, initialOffer.angebot_id, successHref]
  )

  useEffect(() => {
    if (initialAccountCheckCompleted) {
      setAccountCheckCompleted(true)
      setAccountCheckStatus("activated")
    }
  }, [initialAccountCheckCompleted])

  useEffect(() => {
    try {
      if (initialAccountCheckCompleted || window.localStorage.getItem(accountCheckStorageKey)) {
        setAccountCheckCompleted(true)
        setAccountCheckStatus("activated")
      }
    } catch {
      // ignore storage issues
    }
  }, [accountCheckStorageKey, initialAccountCheckCompleted])

  useEffect(() => {
    if (offerRequiresAccountCheck) return
    setAccountCheckDialogError(null)
    setAccountCheckWizardSessionKey(null)
    if (!accountCheckCompleted && !initialAccountCheckCompleted) {
      setAccountCheckStatus((current) => (current === "starting" ? current : "idle"))
    }
  }, [accountCheckCompleted, initialAccountCheckCompleted, offerRequiresAccountCheck])

  async function markAccountCheckCompleted() {
    const response = await fetch("/api/onlinekredit/account-check/finished", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId,
        caseRef,
        access: accessToken,
      }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      throw new Error(customerText(json?.error) || "Kontocheck konnte noch nicht als abgeschlossen gespeichert werden.")
    }
  }

  async function startAccountCheck() {
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
      const response = await fetch("/api/onlinekredit/account-check/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
        }),
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

      setMessage("Kontocheck gestartet. Führe ihn jetzt direkt im Browser vollständig durch und aktualisiere danach die finalen Konditionen erneut.")
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

  function reopenAccountCheck() {
    setAccountCheckDialogOpen(true)
    void startAccountCheck()
  }

  async function sendPortalInvite() {
    const email = String(primaryEmail ?? "").trim().toLowerCase()
    if (!email || existingAccount || inviteSent) return false

    const response = await fetch("/api/auth/resend-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, forcePasswordSetup: true }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(String(json?.error ?? "Einladungslink konnte nicht versendet werden."))
    }

    setInviteSent(true)
    return Boolean(json?.sent)
  }

  async function sendConfirmationEmail() {
    const response = await fetch("/api/onlinekredit/abschluss/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseId,
        caseRef,
        access: accessToken,
        existing: existingAccount ? "1" : "",
      }),
    })

    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(String(json?.error ?? "Bestätigungs-E-Mail konnte nicht versendet werden."))
    }
  }

  async function refreshFinalOffer() {
    setRefreshing(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/onlinekredit/europace/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(customerText(json?.error) || "Die finalen Konditionen konnten nicht geladen werden.")
      }

      const offers = (Array.isArray(json?.offers) ? json.offers : []) as OfferRow[]
      const matched = findMatchingOffer(initialOffer, offers)
      if (!matched) {
        throw new Error(
          "Für dein ausgewähltes Angebot liegt aktuell keine passende neue Variante vor. Bitte gehe zur Angebotsübersicht zurück."
        )
      }

      const matchedComparisons = buildMetricComparisons(initialOffer, matched)
      const hasVisibleOfferChanges =
        matched.angebot_id !== initialOffer.angebot_id ||
        matchedComparisons.some((metric) => metric.before !== metric.after)

      setFinalOffer(matched)
      const validationMessage = getOfferValidationMessage(matched, { greenOnly: true })
      setMessage(
        validationMessage
          ? "Die finalen Konditionen wurden aktualisiert. Diese Variante ist aktuell noch nicht direkt final annehmbar."
          : !hasVisibleOfferChanges
            ? "Die finalen Konditionen wurden aktualisiert. Sichtbar hat sich nichts geändert. Die finale Bankentscheidung fällt trotzdem erst nach deiner verbindlichen Annahme."
            : matched.angebot_id === initialOffer.angebot_id
              ? "Die finalen Konditionen wurden aktualisiert. Bitte prüfe die Änderungen und nimm das Angebot danach final an."
              : "Dein ausgewähltes Angebot wurde mit der aktuell passenden Variante neu geladen. Bitte prüfe die Änderungen und nimm das Angebot danach final an."
      )
      startTransition(() => router.refresh())
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? customerText(refreshError.message) || "Die finalen Konditionen konnten nicht geladen werden."
          : "Die finalen Konditionen konnten nicht geladen werden."
      )
    } finally {
      setRefreshing(false)
    }
  }

  function handlePrimaryAction() {
    if (!finalOffer) {
      void refreshFinalOffer()
      return
    }
    if (hasAcceptedApplication) return
    if (needsAccountCheckBeforeAcceptance) {
      if (accountCheckStatus === "activated" && !accountCheckWizardSessionKey) {
        reopenAccountCheck()
      } else {
        setAccountCheckDialogOpen(true)
      }
      return
    }
    if (canAcceptFinalOffer) {
      void triggerFinalAcceptance()
      return
    }
    void refreshFinalOffer()
  }

  async function triggerFinalAcceptance() {
    if (!finalOffer) {
      setError("Bitte starte zuerst die finale Anfrage und prüfe die aktualisierten Konditionen.")
      return
    }

    const validationMessage = getOfferValidationMessage(finalOffer, { greenOnly: true })
    if (validationMessage) {
      setError(customerText(validationMessage))
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/onlinekredit/europace/offers/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
          angebotId: finalOffer.angebot_id,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        throw new Error(customerText(json?.error) || "Die finale Annahme konnte nicht gestartet werden.")
      }

      const acceptedOfferId = trimOrNull(json?.angebotId)
      if (acceptedOfferId && acceptedOfferId !== finalOffer.angebot_id) {
        setFinalOffer((current) => (current ? { ...current, angebot_id: acceptedOfferId } : current))
      }

      const jobId = trimOrNull(json?.jobId)
      setJob({
        jobId,
        status: "PENDING",
        antragsnummer: null,
        produktanbieterantragsnummer: null,
        hasApplication: false,
        hasRejectedApplication: false,
        terminalMessage: null,
      })
      setMessage(jobId ? `Die finale Annahme wurde gestartet. Job ${jobId} läuft.` : "Die finale Annahme wurde gestartet.")
    } catch (triggerError) {
      setError(
        triggerError instanceof Error
          ? customerText(triggerError.message) || "Die finale Annahme konnte nicht gestartet werden."
          : "Die finale Annahme konnte nicht gestartet werden."
      )
    } finally {
      setBusy(false)
    }
  }

  async function pollJob(manual = false) {
    if (!job.jobId) return
    if (manual) {
      setMessage(null)
      setError(null)
    }

    setPolling(true)
    try {
      const response = await fetch("/api/onlinekredit/europace/offers/job", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        if (manual) setError(customerText(json?.error) || "Der Status konnte nicht geladen werden.")
        return
      }

      const status = trimOrNull(json?.status)
      const antragsnummer = trimOrNull(json?.antragsnummer)
      const produktanbieterantragsnummer = trimOrNull(json?.produktanbieterantragsnummer)
      const hasApplication = Boolean(json?.hasApplication)
      const hasRejectedApplication = Boolean(json?.hasRejectedApplication)
      const terminalMessage = trimOrNull(json?.terminalMessage)

      setJob({
        jobId: status === "PENDING" ? trimOrNull(json?.jobId) ?? job.jobId : null,
        status,
        antragsnummer,
        produktanbieterantragsnummer,
        hasApplication,
        hasRejectedApplication,
        terminalMessage,
      })

      if (status === "SUCCESS" && hasApplication && antragsnummer) {
        const followUps: Array<Promise<unknown>> = [sendPortalInvite()]
        if (!hasRejectedApplication) {
          followUps.push(sendConfirmationEmail())
        }
        await Promise.allSettled(followUps)
        setMessage(
          hasRejectedApplication
            ? `Dein Antrag ${antragsnummer} wurde mit einer Rückmeldung des Produktanbieters aktualisiert.`
            : `Dein Antrag ${antragsnummer} wurde erfolgreich erstellt.`
        )
        startTransition(() => router.push(resultHref))
      } else if (status === "SUCCESS") {
        setError(
          customerText(
            toPublicOfferAcceptanceMessage(terminalMessage || "Europace meldet SUCCESS, aber ohne erzeugten Antrag.", {
              hasRejectedApplication,
            })
          )
        )
        startTransition(() => router.push(resultHref))
      } else if (status === "FAILURE") {
        const failureMessage = customerText(
          toPublicOfferAcceptanceMessage(terminalMessage, { hasRejectedApplication })
        )
        setError(failureMessage)
        if (hasRejectedApplication || hasApplication || antragsnummer) {
          startTransition(() => router.push(resultHref))
        } else {
          startTransition(() => router.refresh())
        }
      } else if (manual) {
        setMessage("Die finale Annahme wird noch verarbeitet.")
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

  useEffect(() => {
    if (!hasRunningJob) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasRunningJob])

  useEffect(() => {
    if (!shouldNotifyAdvisorAboutGuidedSelection) return
    if (trimOrNull(initialOffer.accepted_at)) return

    try {
      if (window.sessionStorage.getItem(advisorSelectionNotificationStorageKey) === "1") {
        return
      }
    } catch {
      // ignore storage issues
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch("/api/onlinekredit/abschluss/selection-notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            caseId,
            caseRef,
            access: accessToken,
            angebotId: initialOffer.angebot_id,
          }),
        })

        if (!response.ok || cancelled) return

        try {
          window.sessionStorage.setItem(advisorSelectionNotificationStorageKey, "1")
        } catch {
          // ignore storage issues
        }
      } catch {
        // notification is best effort only
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    accessToken,
    advisorSelectionNotificationStorageKey,
    caseId,
    caseRef,
    initialOffer.accepted_at,
    initialOffer.angebot_id,
    shouldNotifyAdvisorAboutGuidedSelection,
  ])

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10)] sm:p-8">
      <div className="pointer-events-none absolute -left-10 top-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Finale Anfrage - Stufe 3 von 4</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Finale Konditionen prüfen</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-[15px]">
            Bevor du verbindlich bestätigst, zieht SEPANA die aktuellsten Konditionen für dein ausgewähltes Angebot
            noch einmal live nach. Erst dann triffst du die finale Entscheidung.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">1. Abruf</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Aktuellste Bankkonditionen live ziehen</div>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">2. Vergleich</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Vorher und final direkt nebeneinander sehen</div>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">3. Bestätigung</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Danach verbindlich annehmen oder Kontocheck starten</div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm rounded-[28px] border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Deine Aktionen</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            {!finalOffer
              ? "Starte zuerst die finale Anfrage. Danach zeigen wir dir hier automatisch den nächsten klaren Schritt."
              : needsAccountCheckBeforeAcceptance
                ? "Der Anbieter verlangt jetzt zuerst den Kontocheck, bevor du final weitermachen kannst."
                : canAcceptFinalOffer
                  ? "Die Konditionen sind final geprüft. Du kannst jetzt verbindlich weitermachen."
                  : "Die finale Version ist geladen. Falls noch etwas blockiert, kannst du die Konditionen hier erneut prüfen."}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primaryActionDisabled}
            className={primaryActionClassName}
          >{primaryActionLabel}{/*
              {refreshing ? "Finale Anfrage läuft…" : finalOffer ? "Konditionen erneut prüfen" : "Finale Anfrage starten"}
            */}</button>
          {/* 
            <button
              type="button"
              onClick={() =>
                accountCheckStatus === "activated" && !accountCheckWizardSessionKey
                  ? reopenAccountCheck()
                  : setAccountCheckDialogOpen(true)
              }
              className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold shadow-sm ${
                accountCheckStatus === "activated"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border border-cyan-200 bg-cyan-50 text-cyan-950"
              }`}
            >
              {accountCheckStatus === "starting"
                ? "Kontocheck wird aktiviert…"
                : accountCheckStatus === "activated"
                  ? accountCheckWizardSessionKey
                    ? "Kontocheck läuft"
                    : "Kontocheck erneut starten"
                  : "Kontocheck durchführen"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void triggerFinalAcceptance()}
              disabled={!canAcceptFinalOffer || busy || hasRunningJob || hasAcceptedApplication}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hasAcceptedApplication
                ? "Bereits angenommen"
                : busy
                  ? "Nimmt final an…"
                  : finalOffer && finalOfferValidationMessage
                    ? "Noch nicht final annehmbar"
                    : "Final annehmen"}
            </button>
          */}
          {job.jobId ? (
            <button
              type="button"
              onClick={() => void pollJob(true)}
              disabled={polling}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {polling ? "Prüfe Status…" : "Status aktualisieren"}
            </button>
          ) : null}
        </div>
        </div>
      </div>

      {job.jobId ? (
        <div className="mt-1 rounded-[26px] border border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.92),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-cyan-950 shadow-sm">
          <div className="font-semibold">Annahme in Bearbeitung</div>
          <div className="mt-1">Status: {labelStatus(job.status)}</div>
          {job.antragsnummer ? <div className="mt-1">Antrag: {job.antragsnummer}</div> : null}
          {job.produktanbieterantragsnummer ? (
            <div className="mt-1">Produktanbieter-Ref: {job.produktanbieterantragsnummer}</div>
          ) : null}
        </div>
      ) : null}

      {hasRunningJob ? (
        <div className="mt-1 rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.92),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-amber-950 shadow-sm">
          <div className="font-semibold">Bitte dieses Fenster nicht schließen</div>
          <div className="mt-1 leading-6">
            SEPANA übermittelt deine finale Anfrage gerade an den Produktanbieter. Lass dieses Fenster bitte geöffnet,
            bis die Bestätigung erscheint.
          </div>
          {pendingAccountCheckNote ? <div className="mt-2">{pendingAccountCheckNote}</div> : null}
        </div>
      ) : null}

      {needsAccountCheckBeforeAcceptance && accountCheckStatus === "activated" ? (
        <div className="mt-1 rounded-[26px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-emerald-950 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative mt-1 flex h-8 w-8 items-center justify-center">
                <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-300/50 animate-ping" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
              </div>
              <div>
                <div className="font-semibold">Kontocheck aktiviert</div>
                <div className="mt-1">
                  Wir warten jetzt auf den Kontocheck im Browser. Schließe den Ablauf vollständig ab und prüfe danach
                  die finalen Konditionen erneut.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => reopenAccountCheck()}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Kontocheck erneut starten
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : initialMeta?.last_error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Letzter Hinweis aus dem Antrag: {customerText(initialMeta.last_error)}
        </div>
      ) : null}

      {!finalOffer ? (
        <div className="mt-1 grid gap-3 lg:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Schritt 1</div>
            <div className="mt-2 font-semibold text-slate-900">
              Starte die finale Anfrage und lade die aktuellsten Konditionen live nach.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Schritt 2</div>
            <div className="mt-2 font-semibold text-slate-900">
              Prüfe die Änderungen im direkten Vergleich zwischen Live-Angebot und finaler Version.
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Schritt 3</div>
            <div className="mt-2 font-semibold text-slate-900">
              Bestätige danach verbindlich oder starte den nötigen Kontocheck.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[26px] border border-slate-200/70 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vorheriges Live-Angebot</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{providerName(initialOffer) || "-"}</div>
              {productName(initialOffer) ? <div className="mt-1 text-sm text-slate-600">{productName(initialOffer)}</div> : null}
            </div>
            <div className="rounded-[26px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))] p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Aktuelle finale Konditionen</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{providerName(finalOffer) || "-"}</div>
              {productName(finalOffer) ? <div className="mt-1 text-sm text-slate-600">{productName(finalOffer)}</div> : null}
            </div>
          </div>

          {finalOfferValidationMessage ? (
            <div className="rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.92),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-amber-950 shadow-sm">
              <div className="font-semibold">Diese finale Variante ist noch nicht direkt annehmbar</div>
              <div className="mt-1">{customerText(finalOfferValidationMessage)}</div>
              {finalOfferBlockingMessages.length ? (
                <ul className="mt-3 space-y-2">
                  {finalOfferBlockingMessages.slice(0, 3).map((entry) => (
                    <li key={entry} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {false ? (
                <button
                  type="button"
                  onClick={() =>
                    accountCheckStatus === "activated" && !accountCheckWizardSessionKey
                      ? reopenAccountCheck()
                      : setAccountCheckDialogOpen(true)
                  }
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
                >
                  {accountCheckStatus === "starting"
                    ? "Kontocheck wird aktiviert…"
                    : accountCheckStatus === "activated"
                      ? accountCheckWizardSessionKey
                        ? "Kontocheck läuft"
                        : "Kontocheck erneut starten"
                      : "Kontocheck durchführen"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
            <div className="border-b border-slate-200/70 bg-slate-50/80 px-5 py-4 text-sm font-semibold text-slate-900">
              {offerChanged
                ? "Vergleich zwischen Live-Angebot und finalen Konditionen"
                : "Die finalen Konditionen stimmen mit deinem Live-Angebot überein"}
            </div>
            <div className="divide-y divide-slate-200/70">
              {comparisonRows.map((metric) => {
                const badge = changeBadge(metric)
                return (
                  <div key={metric.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center">
                    <div className="text-sm font-semibold text-slate-900">{metric.label}</div>
                    <div className="text-sm text-slate-600">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Vorher</div>
                      <div className="mt-1">{formatMetricValue(metric, metric.before)}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Final</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatMetricValue(metric, metric.after)}</div>
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {pendingAccountCheckNote && !hasRunningJob ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          {pendingAccountCheckNote}
        </div>
      ) : null}

      </div>

      <AccountCheckInfoDialog
        open={accountCheckDialogOpen}
        onClose={() => setAccountCheckDialogOpen(false)}
        providerName={providerName(finalOffer ?? initialOffer)}
        productName={productName(finalOffer ?? initialOffer)}
        onStart={startAccountCheck}
        startStatus={accountCheckStatus}
        errorText={accountCheckDialogError}
        wizardSessionKey={accountCheckWizardSessionKey}
        onWizardFinished={() => {
          void (async () => {
            try {
              await markAccountCheckCompleted()
              setAccountCheckCompleted(true)
              try {
                window.localStorage.setItem(accountCheckStorageKey, new Date().toISOString())
              } catch {
                // ignore storage issues
              }
              setAccountCheckDialogOpen(false)
              setAccountCheckWizardSessionKey(null)
              setMessage("Kontocheck abgeschlossen. Wir laden jetzt die aktuelle Angebotsübersicht neu.")
              startTransition(() => router.push(offersHref))
            } catch (accountCheckFinishError) {
              setAccountCheckDialogError(
                accountCheckFinishError instanceof Error
                  ? accountCheckFinishError.message
                  : "Kontocheck konnte noch nicht als abgeschlossen gespeichert werden."
              )
            }
          })()
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
    </div>
  )
}
