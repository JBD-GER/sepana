"use client"

import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toPublicOfferAcceptanceMessage } from "@/lib/europace/offerAcceptance"

type OfferSnapshot = {
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
  sofortkredit?: boolean | null
  vorhersage?: {
    machbarkeit?: {
      score?: number | null
    } | null
  } | null
  vollstaendigkeit?: {
    messages?: Array<{ text?: string | null; property?: string | null }> | null
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
  last_export_snapshot?: {
    antraege?: Array<{
      antragsnummer?: string | null
      produktanbieterantragsnummer?: string | null
      antragstellerstatus?:
        | string
        | {
            status?: string | null
          }
        | null
      produktanbieterstatus?:
        | string
        | {
            status?: string | null
          }
        | null
      provisionsforderungsstatus?:
        | string
        | {
            status?: string | null
          }
        | null
    }> | null
  } | null
} | null

type EuropaceApplicationRow = {
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  antragstellerstatus?: string | null
  produktanbieterstatus?: string | null
  provisionsforderungsstatus?: string | null
}

type JobState = {
  jobId: string | null
  status: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  hasApplication: boolean
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
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

function labelStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return "-"
  if (raw === "GRUEN") return "Gruen"
  if (raw === "GELB") return "Gelb"
  if (raw === "ROT") return "Rot"
  if (raw === "VOLLSTAENDIG") return "Vollstaendig"
  if (raw === "UNVOLLSTAENDIG") return "Unvollstaendig"
  if (raw === "MACHBAR") return "Machbar"
  if (raw === "MACHBAR_UNTER_VORBEHALT") return "Machbar unter Vorbehalt"
  if (raw === "NICHT_MACHBAR") return "Nicht machbar"
  if (raw === "BEANTRAGT") return "Beantragt"
  if (raw === "NICHT_BEARBEITET") return "Nicht bearbeitet"
  if (raw === "ABGELEHNT") return "Abgelehnt"
  if (raw === "AUTOMATISCH_ABGELEHNT") return "Automatisch abgelehnt"
  if (raw === "PENDING") return "Laeuft"
  if (raw === "SUCCESS") return "Erfolgreich"
  if (raw === "FAILURE") return "Fehlgeschlagen"
  return raw.toLowerCase()
}

function extractStatusValue(value: string | { status?: string | null } | null | undefined) {
  if (typeof value === "string") return trimOrNull(value)
  return trimOrNull(value?.status)
}

function normalizeApplications(meta: EuropaceMeta) {
  const rows = Array.isArray(meta?.last_export_snapshot?.antraege) ? meta.last_export_snapshot.antraege : []
  return rows.map((row) => ({
    antragsnummer: trimOrNull(row?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(row?.produktanbieterantragsnummer),
    antragstellerstatus: extractStatusValue(row?.antragstellerstatus),
    produktanbieterstatus: extractStatusValue(row?.produktanbieterstatus),
    provisionsforderungsstatus: extractStatusValue(row?.provisionsforderungsstatus),
  }))
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

function isCompletedEuropaceStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (!normalized) return false
  return (
    normalized === "ABGESCHLOSSEN" ||
    normalized === "AUSGEZAHLT" ||
    normalized === "ERLEDIGT" ||
    normalized === "SIGNIERT" ||
    normalized.includes("ABGESCHLOSSEN") ||
    normalized.includes("AUSGEZAHLT") ||
    normalized.includes("ERLEDIGT") ||
    normalized.includes("SIGNIERT") ||
    normalized.includes("UNTERSCHRIEBEN")
  )
}

function applicationBadge(application: EuropaceApplicationRow | null) {
  if (!application) return null

  if (
    isRejectedEuropaceStatus(application.produktanbieterstatus) ||
    isRejectedEuropaceStatus(application.antragstellerstatus)
  ) {
    return {
      label: "Abgelehnt",
      tone: "border-rose-200 bg-rose-50 text-rose-800",
    }
  }

  if (
    isCompletedEuropaceStatus(application.produktanbieterstatus) ||
    isCompletedEuropaceStatus(application.antragstellerstatus)
  ) {
    return {
      label: "Abgeschlossen",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
  }

  if (trimOrNull(application.antragsnummer) || trimOrNull(application.produktanbieterantragsnummer)) {
    return {
      label: "Antrag gestellt",
      tone: "border-sky-200 bg-sky-50 text-sky-800",
    }
  }

  return {
    label: "Ausgewaehlt",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }
}

function isOfferAcceptable(offer: EuropaceOfferRow) {
  const vollstaendig = String(offer.vollstaendigkeit_status ?? "").trim().toUpperCase() === "VOLLSTAENDIG"
  return vollstaendig && !offer.accepted_at && !offer.superseded_at
}

function shortOfferId(value: string) {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return "-"
  if (trimmed.length <= 18) return trimmed
  return `${trimmed.slice(0, 10)}...${trimmed.slice(-4)}`
}

function numericOrNull(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function compareEuropaceOffers(left: EuropaceOfferRow, right: EuropaceOfferRow) {
  const acceptedDiff = Number(Boolean(right.accepted_at)) - Number(Boolean(left.accepted_at))
  if (acceptedDiff !== 0) return acceptedDiff

  const acceptableDiff = Number(isOfferAcceptable(right)) - Number(isOfferAcceptable(left))
  if (acceptableDiff !== 0) return acceptableDiff

  const leftApr = numericOrNull(left.angebot_snapshot?.gesamtkonditionen?.effektivzins)
  const rightApr = numericOrNull(right.angebot_snapshot?.gesamtkonditionen?.effektivzins)
  if (leftApr !== rightApr) {
    if (leftApr === null) return 1
    if (rightApr === null) return -1
    return leftApr - rightApr
  }

  const leftRate = numericOrNull(left.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)
  const rightRate = numericOrNull(right.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)
  if (leftRate !== rightRate) {
    if (leftRate === null) return 1
    if (rightRate === null) return -1
    return leftRate - rightRate
  }

  const leftCreatedAt = new Date(String(left.calculated_at ?? left.created_at ?? "")).getTime()
  const rightCreatedAt = new Date(String(right.calculated_at ?? right.created_at ?? "")).getTime()
  return rightCreatedAt - leftCreatedAt
}

export default function EuropaceOffersCard({
  caseId,
  initialOffers,
  initialMeta,
  initialApplications,
}: {
  caseId: string
  initialOffers: EuropaceOfferRow[]
  initialMeta: EuropaceMeta
  initialApplications?: EuropaceApplicationRow[]
}) {
  const router = useRouter()
  const [busyRefresh, setBusyRefresh] = useState(false)
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [comparisonOfferIds, setComparisonOfferIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobState>({
    jobId: trimOrNull(initialMeta?.annahme_job_id),
    status: trimOrNull(initialMeta?.annahme_job_id) ? "PENDING" : null,
    antragsnummer: trimOrNull(initialMeta?.antragsnummer),
    produktanbieterantragsnummer: trimOrNull(initialMeta?.produktanbieterantragsnummer),
    hasApplication: Boolean(trimOrNull(initialMeta?.antragsnummer)),
  })

  const hasRunningJob = Boolean(job.jobId) && (job.status === null || job.status === "PENDING")
  const orderedOffers = useMemo(() => [...initialOffers].sort(compareEuropaceOffers), [initialOffers])
  const applications = (initialApplications ?? normalizeApplications(initialMeta)).filter(
    (row) =>
      trimOrNull(row.antragsnummer) ||
      trimOrNull(row.produktanbieterantragsnummer) ||
      trimOrNull(row.antragstellerstatus) ||
      trimOrNull(row.produktanbieterstatus) ||
      trimOrNull(row.provisionsforderungsstatus)
  )
  const currentApplication = applications[0] ?? null
  const latestAcceptedOfferId =
    [...orderedOffers]
      .filter((offer) => Boolean(offer.accepted_at) && !Boolean(offer.superseded_at))
      .sort((left, right) => new Date(String(right.accepted_at ?? "")).getTime() - new Date(String(left.accepted_at ?? "")).getTime())[0]
      ?.angebot_id ?? null
  const currentApplicationBadge = applicationBadge(currentApplication)
  const comparisonOffers = useMemo(
    () => orderedOffers.filter((offer) => comparisonOfferIds.includes(offer.angebot_id)).slice(0, 3),
    [comparisonOfferIds, orderedOffers]
  )
  const bestComparisonAprOfferId = useMemo(() => {
    const comparable = comparisonOffers.filter((offer) => numericOrNull(offer.angebot_snapshot?.gesamtkonditionen?.effektivzins) !== null)
    if (comparable.length === 0) return null
    return [...comparable].sort(compareEuropaceOffers)[0]?.angebot_id ?? null
  }, [comparisonOffers])
  const bestComparisonRateOfferId = useMemo(() => {
    const comparable = comparisonOffers.filter((offer) => numericOrNull(offer.angebot_snapshot?.gesamtkonditionen?.rateMonatlich) !== null)
    if (comparable.length === 0) return null
    return [...comparable].sort((left, right) => {
      const leftRate = numericOrNull(left.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)
      const rightRate = numericOrNull(right.angebot_snapshot?.gesamtkonditionen?.rateMonatlich)
      if (leftRate === null && rightRate === null) return 0
      if (leftRate === null) return 1
      if (rightRate === null) return -1
      return leftRate - rightRate
    })[0]?.angebot_id ?? null
  }, [comparisonOffers])

  useEffect(() => {
    setComparisonOfferIds((current) =>
      current.filter((angebotId) => orderedOffers.some((offer) => offer.angebot_id === angebotId)).slice(0, 3)
    )
  }, [orderedOffers])

  async function refreshOffers() {
    setBusyRefresh(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Angebote konnten nicht geladen werden."))
        return
      }

      const count = Array.isArray(json?.offers) ? json.offers.length : 0
      const vorgangsnummer = String(json?.vorgangsnummer ?? "").trim()
      setMessage(
        vorgangsnummer
          ? `${count} Europace-Angebote fuer Vorgang ${vorgangsnummer} aktualisiert.`
          : `${count} Europace-Angebote aktualisiert.`
      )
      startTransition(() => router.refresh())
    } finally {
      setBusyRefresh(false)
    }
  }

  async function acceptOffer(angebotId: string) {
    setBusyOfferId(angebotId)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/offers/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, angebotId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Angebot konnte nicht angenommen werden."))
        return
      }

      const jobId = trimOrNull(json?.jobId)
      setJob({
        jobId,
        status: "PENDING",
        antragsnummer: null,
        produktanbieterantragsnummer: null,
        hasApplication: false,
      })
      setMessage(jobId ? `Angebotsannahme gestartet. Job ${jobId} laeuft.` : "Angebotsannahme gestartet.")
      startTransition(() => router.refresh())
    } finally {
      setBusyOfferId(null)
    }
  }

  function toggleComparison(angebotId: string) {
    setComparisonOfferIds((current) => {
      if (current.includes(angebotId)) {
        return current.filter((value) => value !== angebotId)
      }
      if (current.length >= 3) {
        return current
      }
      return [...current, angebotId]
    })
  }

  const pollJob = useCallback(async (manual = false) => {
    if (!job.jobId) return
    if (manual) {
      setMessage(null)
      setError(null)
    }

    setPolling(true)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/offers/job", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        if (manual) setError(String(json?.error ?? "Europace-Annahmejob konnte nicht geladen werden."))
        return
      }

	      const nextStatus = trimOrNull(json?.status)
	      const nextAntragsnummer = trimOrNull(json?.antragsnummer)
	      const nextProviderApplicationNo = trimOrNull(json?.produktanbieterantragsnummer)
	      const hasApplication = Boolean(json?.hasApplication)
        const hasRejectedApplication = Boolean(json?.hasRejectedApplication)
        const terminalMessage = trimOrNull(json?.terminalMessage)

      setJob({
        jobId: nextStatus === "PENDING" ? trimOrNull(json?.jobId) ?? job.jobId : null,
        status: nextStatus,
        antragsnummer: nextAntragsnummer,
        produktanbieterantragsnummer: nextProviderApplicationNo,
        hasApplication,
      })

	      if (nextStatus === "SUCCESS" && hasApplication && nextAntragsnummer) {
	        setMessage(`Antrag ${nextAntragsnummer} wurde erfolgreich angelegt.`)
	        startTransition(() => router.refresh())
	      } else if (nextStatus === "SUCCESS" && !hasApplication) {
	        setError(toPublicOfferAcceptanceMessage(terminalMessage || "Europace meldet SUCCESS, aber ohne erzeugten Antrag.", { hasRejectedApplication }))
	        startTransition(() => router.refresh())
	      } else if (nextStatus === "FAILURE") {
	        setError(toPublicOfferAcceptanceMessage(terminalMessage, { hasRejectedApplication }))
	        startTransition(() => router.refresh())
	      } else if (manual) {
	        setMessage(`Annahmejob ${trimOrNull(json?.jobId) ?? job.jobId} ist noch in Bearbeitung.`)
	      }
    } finally {
      setPolling(false)
    }
  }, [caseId, job.jobId, router])

  useEffect(() => {
    if (!job.jobId) return
    if (job.status && job.status !== "PENDING") return

    const interval = window.setInterval(() => {
      void pollJob(false)
    }, 7000)

    void pollJob(false)

    return () => window.clearInterval(interval)
  }, [job.jobId, job.status, pollJob])

  return (
    <div className="rounded-3xl border border-emerald-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Privatkredit Angebote</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Live-Konditionen vergleichen</h2>
          <p className="mt-1 text-sm text-slate-600">
            Hier siehst du die aktuellen Live-Konditionen fuer den Beraterfall, kannst bis zu drei Varianten direkt
            vergleichen und fuer das passende Angebot sofort die finale Anfrage starten.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshOffers}
            disabled={busyRefresh || hasRunningJob}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyRefresh ? "Lade Angebote..." : "Angebote abrufen"}
          </button>
          {job.jobId ? (
            <button
              type="button"
              onClick={() => void pollJob(true)}
              disabled={polling}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {polling ? "Pruefe Job..." : "Jobstatus pruefen"}
            </button>
          ) : null}
        </div>
      </div>

      {job.jobId ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          <div className="font-semibold">Annahmejob {job.jobId}</div>
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
      ) : null}

      {comparisonOffers.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Vergleich</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {comparisonOffers.length === 1 ? "1 Angebot vorgemerkt" : `${comparisonOffers.length} Angebote im Direktvergleich`}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {comparisonOffers.length === 1
                  ? "Waehl noch mindestens ein weiteres Angebot aus, um Rate, Zins und Laufzeit direkt gegeneinander zu sehen."
                  : "Effektivzins, Monatsrate und Laufzeit stehen hier direkt nebeneinander."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setComparisonOfferIds([])}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Vergleich leeren
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {comparisonOffers.map((offer) => {
              const snapshot = offer.angebot_snapshot ?? null
              const providerName = snapshot?.ratenkredit?.produktanbieter?.name ?? "-"
              const productName = snapshot?.ratenkredit?.produktbezeichnung ?? null
              const canAccept = isOfferAcceptable(offer) && !hasRunningJob
              const isBestApr = offer.angebot_id === bestComparisonAprOfferId
              const isBestRate = offer.angebot_id === bestComparisonRateOfferId

              return (
                <div key={`compare-${offer.angebot_id}`} className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">{providerName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {productName || "Privatkredit"} | ID {shortOfferId(offer.angebot_id)}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isBestApr ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                        Bester Effektivzins
                      </span>
                    ) : null}
                    {isBestRate ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                        Niedrigste Rate
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500">Monatsrate</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatEUR(snapshot?.gesamtkonditionen?.rateMonatlich)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500">Effektivzins</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatPct(snapshot?.gesamtkonditionen?.effektivzins)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500">Sollzins</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatPct(snapshot?.gesamtkonditionen?.sollzins)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-500">Laufzeit</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">
                        {snapshot?.gesamtkonditionen?.laufzeitInMonaten
                          ? `${snapshot.gesamtkonditionen.laufzeitInMonaten} Monate`
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>Machbarkeit: {labelStatus(offer.machbarkeit_status)}</span>
                    <span>Vollstaendigkeit: {labelStatus(offer.vollstaendigkeit_status)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void acceptOffer(offer.angebot_id)}
                    disabled={!canAccept || busyOfferId === offer.angebot_id}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyOfferId === offer.angebot_id
                      ? "Starte..."
                      : offer.accepted_at
                        ? "Bereits gestartet"
                        : hasRunningJob
                          ? "Job laeuft"
                          : "Finale Anfrage starten"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {orderedOffers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
            Noch keine Live-Angebote im Fall gespeichert.
          </div>
        ) : null}

        {orderedOffers.map((offer) => {
          const snapshot = offer.angebot_snapshot ?? null
          const providerName = snapshot?.ratenkredit?.produktanbieter?.name ?? "-"
          const productName = snapshot?.ratenkredit?.produktbezeichnung ?? null
          const messages = Array.isArray(snapshot?.vollstaendigkeit?.messages) ? snapshot.vollstaendigkeit.messages : []
          const isSuperseded = Boolean(offer.superseded_at)
          const isAccepted = Boolean(offer.accepted_at)
          const isLatestAcceptedOffer = isAccepted && offer.angebot_id === latestAcceptedOfferId
          const acceptedBadge = isLatestAcceptedOffer ? currentApplicationBadge : null
          const isRejectedAcceptedOffer = acceptedBadge?.label === "Abgelehnt"
          const canAccept = isOfferAcceptable(offer) && !hasRunningJob
          const isInComparison = comparisonOfferIds.includes(offer.angebot_id)

          return (
            <div
              key={offer.angebot_id}
              className={`rounded-2xl border p-4 ${
                isRejectedAcceptedOffer
                  ? "border-rose-200 bg-rose-50"
                  : isAccepted
                    ? "border-sky-200 bg-sky-50"
                    : "border-slate-200/70 bg-slate-50"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{providerName}</div>
                  <div className="mt-1 text-xs text-slate-600 break-all">
                    Angebot {offer.angebot_id}
                    {productName ? ` · ${productName}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
                    Machbarkeit: {labelStatus(offer.machbarkeit_status)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
                    Vollstaendigkeit: {labelStatus(offer.vollstaendigkeit_status)}
                  </span>
                  {snapshot?.sofortkredit ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                      Sofortkredit
                    </span>
                  ) : null}
                  {isAccepted ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        acceptedBadge?.tone ?? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {acceptedBadge?.label ?? "Ausgewaehlt"}
                    </span>
                  ) : null}
                  {isSuperseded ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                      Veraltet
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleComparison(offer.angebot_id)}
                    className={`inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-semibold shadow-sm ${
                      isInComparison
                        ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    {isInComparison ? "Im Vergleich" : "Vergleichen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void acceptOffer(offer.angebot_id)}
                    disabled={!canAccept || busyOfferId === offer.angebot_id}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyOfferId === offer.angebot_id
                      ? "Starte..."
                      : isAccepted
                        ? acceptedBadge?.label ?? "Ausgewaehlt"
                        : hasRunningJob
                          ? "Job laeuft"
                          : "Finale Anfrage starten"}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Monatsrate</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(snapshot?.gesamtkonditionen?.rateMonatlich)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Effektivzins</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatPct(snapshot?.gesamtkonditionen?.effektivzins)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Sollzins</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatPct(snapshot?.gesamtkonditionen?.sollzins)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Kreditbetrag</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(snapshot?.gesamtkonditionen?.nettokreditbetrag ?? snapshot?.gesamtkonditionen?.gesamtkreditbetrag)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Auszahlung</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(snapshot?.gesamtkonditionen?.auszahlungsbetrag)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-500">Laufzeit</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {snapshot?.gesamtkonditionen?.laufzeitInMonaten
                      ? `${snapshot.gesamtkonditionen.laufzeitInMonaten} Monate`
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                <span>Berechnet: {dt(offer.calculated_at ?? offer.created_at)}</span>
                <span>Ausgewaehlt: {dt(offer.accepted_at)}</span>
                <span>Score: {snapshot?.vorhersage?.machbarkeit?.score ?? "-"}</span>
                {isLatestAcceptedOffer && currentApplication ? (
                  <>
                    <span>Antrag: {trimOrNull(currentApplication.antragsnummer) || "-"}</span>
                    <span>Produktanbieterstatus: {labelStatus(currentApplication.produktanbieterstatus)}</span>
                  </>
                ) : null}
              </div>

              {messages.length ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {messages
                    .map((entry) => {
                      const text = String(entry?.text ?? "").trim()
                      const property = String(entry?.property ?? "").trim()
                      return property && text ? `${property}: ${text}` : text || property
                    })
                    .filter(Boolean)
                    .join(" | ")}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
