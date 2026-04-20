import Link from "next/link"
import EuropaceCustomerOffersCard from "@/components/case/EuropaceCustomerOffersCard"
import { hasFinishedAccountCheckAfterLatestStart } from "@/lib/europace/offerSync"
import {
  buildEuropaceApplicationDecisionMessage,
  findRelevantEuropaceApplication,
  findRejectedEuropaceApplication,
  isCompletedEuropaceStatus,
  normalizeEuropaceApplications,
} from "@/lib/europace/status"
import { extractTechnicallyBlockedOfferIds } from "@/lib/europace/technicalFailures"
import { getOnlinekreditAccountCheckRestrictionReason } from "@/lib/onlinekredit/accountCheckPolicy"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  existing?: string
  prefetched?: string
}

type EuropaceMeta = {
  vorgangsnummer?: string | null
  annahme_job_id?: string | null
  antragsnummer?: string | null
  produktanbieterantragsnummer?: string | null
  selected_angebot_id?: string | null
  sync_status?: string | null
  last_sync_at?: string | null
  last_error?: string | null
  last_export_snapshot?: unknown
} | null

type EuropaceOfferRow = {
  angebot_id: string
  angebot_snapshot?: {
    sofortkredit?: boolean | null
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
    vorhersage?: {
      machbarkeit?: {
        score?: number | null
      } | null
    } | null
    vollstaendigkeit?: {
      messages?: Array<{ text?: string | null; property?: string | null }> | null
    } | null
  } | null
  machbarkeit_status?: string | null
  vollstaendigkeit_status?: string | null
  calculated_at?: string | null
  accepted_at?: string | null
  superseded_at?: string | null
  created_at?: string | null
}

type ApplicantPolicyRow = {
  employment_type?: string | null
}

type BaufiPolicyRow = {
  purpose?: string | null
}

type SyncEventRow = {
  created_at?: string | null
  operation?: string | null
  success?: boolean | null
  request_payload?: Record<string, unknown> | null
  response_payload?: Record<string, unknown> | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function isPositiveEuropaceDecisionStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase()
  if (!normalized) return false
  return (
    isCompletedEuropaceStatus(value) ||
    normalized === "ANGENOMMEN" ||
    normalized === "GENEHMIGT" ||
    normalized === "BEWILLIGT" ||
    normalized === "ZUGESAGT" ||
    normalized.includes("ANGENOMMEN") ||
    normalized.includes("GENEHMIGT") ||
    normalized.includes("BEWILLIGT") ||
    normalized.includes("ZUGESAGT")
  )
}

function resolveSelectedEuropaceOfferId(
  offers: Array<{ angebot_id?: string | null; accepted_at?: string | null; superseded_at?: string | null; created_at?: string | null }>,
  syncEvents: SyncEventRow[],
  reference?: { annahme_job_id?: string | null } | null
) {
  const acceptedOffer = offers
    .filter((offer) => trimOrNull(offer.accepted_at) && !trimOrNull(offer.superseded_at))
    .sort((left, right) => {
      const leftTs = new Date(String(left.accepted_at ?? left.created_at ?? "")).getTime()
      const rightTs = new Date(String(right.accepted_at ?? right.created_at ?? "")).getTime()
      return rightTs - leftTs
    })[0]
  if (trimOrNull(acceptedOffer?.angebot_id)) return trimOrNull(acceptedOffer?.angebot_id)

  const currentJobId = trimOrNull(reference?.annahme_job_id)
  if (currentJobId) {
    const byJob = syncEvents.find((event) => trimOrNull(event.response_payload?.jobId) === currentJobId)
    const jobOfferId = trimOrNull(byJob?.request_payload?.resolvedAngebotId) ?? trimOrNull(byJob?.request_payload?.angebotId)
    if (jobOfferId) return jobOfferId
  }

  const latestEvent = syncEvents.find(
    (event) => trimOrNull(event.request_payload?.resolvedAngebotId) || trimOrNull(event.request_payload?.angebotId)
  )
  return trimOrNull(latestEvent?.request_payload?.resolvedAngebotId) ?? trimOrNull(latestEvent?.request_payload?.angebotId)
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

export default async function OnlinekreditOffersPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const existingAccount = parseBoolParam(sp.existing)
  const prefetched = parseBoolParam(sp.prefetched)

  if (!caseId || !caseRef || !accessToken) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-sm sm:rounded-[32px] sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig</h1>
        <p className="mt-2 text-sm text-slate-600">
          Für die Angebotsansicht fehlt der öffentliche Fallzugriff. Starte den Onlinekredit bitte erneut.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm sm:w-auto"
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
      <div className="rounded-[24px] border border-amber-200 bg-white p-4 shadow-sm sm:rounded-[32px] sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Onlinekredit</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig oder abgelaufen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dieser Onlinekredit-Link kann nicht mehr verwendet werden. Starte den Vorgang bitte erneut.
        </p>
        <div className="mt-4">
          <Link
            href="/onlinekredit"
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm sm:w-auto"
          >
            Neu starten
          </Link>
        </div>
      </div>
    )
  }

  const query = buildBaseQuery({ caseId, caseRef, accessToken, existingAccount })
  const formHref = `/onlinekredit?${query.toString()}`

  const [europaceResult, offersResult, applicantsResult, baufiResult, accountCheckCompleted, syncEventsResult] = await Promise.all([
    admin
      .from("case_europace")
      .select("vorgangsnummer,annahme_job_id,antragsnummer,produktanbieterantragsnummer,sync_status,last_sync_at,last_error,last_export_snapshot")
      .eq("case_id", caseId)
      .maybeSingle(),
    admin
      .from("case_europace_offers")
      .select(
        "angebot_id,angebot_snapshot,machbarkeit_status,vollstaendigkeit_status,calculated_at,accepted_at,superseded_at,created_at"
      )
      .eq("case_id", caseId)
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("calculated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    admin.from("case_applicants").select("employment_type").eq("case_id", caseId),
    admin.from("case_baufi_details").select("purpose").eq("case_id", caseId).maybeSingle(),
    hasFinishedAccountCheckAfterLatestStart(admin, caseId).catch(() => false),
    admin
      .from("case_europace_sync_events")
      .select("created_at,operation,success,request_payload,response_payload")
      .eq("case_id", caseId)
      .in("operation", ["angebotAnnehmen", "annahmeJob"])
      .order("created_at", { ascending: false })
      .limit(80),
  ])

  const europaceMeta = (europaceResult.data ?? null) as EuropaceMeta
  const offers = ((offersResult.data ?? []) as EuropaceOfferRow[]) ?? []
  const applicants = ((applicantsResult.data ?? []) as ApplicantPolicyRow[]) ?? []
  const baufi = (baufiResult.data ?? null) as BaufiPolicyRow | null
  const syncEvents = ((syncEventsResult.data ?? []) as SyncEventRow[]) ?? []
  const applications = normalizeEuropaceApplications(
    (europaceMeta?.last_export_snapshot ?? null) as Parameters<typeof normalizeEuropaceApplications>[0]
  )
  const selectedEuropaceOfferId = resolveSelectedEuropaceOfferId(offers, syncEvents, {
    annahme_job_id: europaceMeta?.annahme_job_id,
  })
  const relevantApplication = findRelevantEuropaceApplication(applications, {
    antragsnummer: europaceMeta?.antragsnummer,
    produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
  })
  const rejectedApplication = findRejectedEuropaceApplication(applications, {
    antragsnummer: europaceMeta?.antragsnummer,
    produktanbieterantragsnummer: europaceMeta?.produktanbieterantragsnummer,
  })
  const rejectedApplicationMessage = buildEuropaceApplicationDecisionMessage(rejectedApplication)
  const accountCheckRestrictedReason = getOnlinekreditAccountCheckRestrictionReason({
    purpose: baufi?.purpose,
    employmentTypes: applicants.map((row) => row.employment_type),
  })
  const technicalBlockedOfferIds = extractTechnicallyBlockedOfferIds(
    syncEvents
  )
  const activeOffers = offers.filter((row) => !trimOrNull(row.superseded_at))
  const directOnlineOfferCount = activeOffers.filter((row) => Boolean(row.angebot_snapshot?.sofortkredit)).length
  const acceptedOfferCount = activeOffers.filter((row) => Boolean(trimOrNull(row.accepted_at))).length
  const hasFinalPositiveApplication =
    Boolean(selectedEuropaceOfferId) &&
    Boolean(relevantApplication) &&
    !Boolean(rejectedApplication) &&
    Boolean(
      isPositiveEuropaceDecisionStatus(relevantApplication?.antragstellerstatus) ||
        isPositiveEuropaceDecisionStatus(relevantApplication?.produktanbieterstatus) ||
        isPositiveEuropaceDecisionStatus(relevantApplication?.provisionsforderungsstatus)
    )
  const resolvedEuropaceMeta: EuropaceMeta = europaceMeta
    ? { ...europaceMeta, selected_angebot_id: selectedEuropaceOfferId }
    : selectedEuropaceOfferId
      ? { selected_angebot_id: selectedEuropaceOfferId }
      : null
  const progressItems = hasFinalPositiveApplication
    ? [
        { label: "Angaben", state: "done" as const },
        { label: "Angebot angenommen", state: "done" as const },
        { label: "Bank bestätigt", state: "done" as const },
        { label: "Status & Upload", state: "current" as const },
      ]
    : [
        { label: "Angaben", state: "done" as const },
        { label: "Angebote", state: "current" as const },
        { label: "Finale Anfrage", state: "next" as const },
        { label: "Status & Upload", state: "next" as const },
      ]

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_38%)] blur-3xl" />

      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.10)] sm:rounded-[40px] sm:p-8">
        <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.18),transparent)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {hasFinalPositiveApplication ? "Onlinekredit · Bank positiv bestätigt" : "Onlinekredit · Stufe 2 von 4"}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {hasFinalPositiveApplication ? "Dein final angenommenes Angebot" : "Live-Angebote mit echter Richtung"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              {hasFinalPositiveApplication
                ? "Für dieses Angebot liegt bereits eine positive Bankrückmeldung vor. Wir zeigen dir hier nur noch die angenommene Variante. Wenn du weitere Angebote prüfen möchtest, kläre das bitte direkt mit deinem Berater."
                : "Hier landet die echte Bankrückmeldung zu deinem Antrag. Du siehst sofort, was direkt digital weiterläuft, was mit SEPANA begleitet wird und welche Variante aktuell die stärkste Route in den Abschluss ist."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {progressItems.map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                    item.state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : item.state === "current"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item.state === "done" ? "✓ " : item.state === "current" ? "● " : ""}
                  {item.label}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {hasFinalPositiveApplication ? (
                <>
                  <div className="inline-flex items-center rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 shadow-sm backdrop-blur">
                    Dieses Angebot ist bereits fixiert. Eine neue Angebotsauswahl ist in dieser Ansicht gesperrt.
                  </div>
                  <div className="inline-flex items-center rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur">
                    Weitere Varianten prüfen wir bei Bedarf gemeinsam mit deinem Berater.
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href={formHref}
                    prefetch={false}
                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
                  >
                    Angaben anpassen
                  </Link>
                  <div className="inline-flex w-full items-center rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur sm:w-auto">
                    Jede neue Berechnung holt die aktuelle Banklage live in diese Ansicht.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur sm:rounded-[28px] sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {hasFinalPositiveApplication ? "Sichtbare Auswahl" : "Aktive Angebote"}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {hasFinalPositiveApplication ? 1 : activeOffers.length}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {hasFinalPositiveApplication
                  ? "In dieser Ansicht bleibt nur noch das bereits angenommene Angebot sichtbar."
                  : "Freigegebene oder aktuell relevante Varianten in dieser Runde."}
              </div>
            </div>
            <div className="rounded-[24px] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.94))] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {hasFinalPositiveApplication ? "Bankstatus" : "Direkt digital"}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {hasFinalPositiveApplication ? "Positiv" : directOnlineOfferCount}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {hasFinalPositiveApplication
                  ? "Die Bank hat für diese Route bereits eine positive Rückmeldung gegeben."
                  : "Angebote, die ohne Medienbruch bis in den Online-Abschluss laufen können."}
              </div>
            </div>
            <div className="rounded-[24px] border border-cyan-200/80 bg-[linear-gradient(180deg,rgba(236,254,255,0.96),rgba(255,255,255,0.94))] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                {hasFinalPositiveApplication ? "Antrag" : "Bereits fixiert"}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {hasFinalPositiveApplication ? (trimOrNull(europaceMeta?.antragsnummer) ?? "Läuft") : acceptedOfferCount}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {hasFinalPositiveApplication
                  ? "Weitere Angebotsvarianten sind hier bewusst gesperrt und laufen nur noch über die Beratung."
                  : "Schon angenommene Varianten bleiben oben sichtbar und nachvollziehbar."}
              </div>
            </div>
          </div>
        </div>
      </section>

      <EuropaceCustomerOffersCard
        caseId={caseId}
        initialOffers={offers}
        initialMeta={resolvedEuropaceMeta}
        offersEndpoint="/api/onlinekredit/europace/offers"
        requestContext={{ caseRef, access: accessToken, existing: existingAccount ? "1" : "" }}
        mode="select"
        selectionPath="/onlinekredit/abschluss"
        autoRefreshOnMount={!prefetched && !hasFinalPositiveApplication}
        lockPublicOffers={hasFinalPositiveApplication}
        hasRejectedApplication={Boolean(rejectedApplication)}
        rejectedApplicationMessage={rejectedApplicationMessage}
        accountCheckStartEndpoint="/api/onlinekredit/account-check/start"
        accountCheckRestrictedReason={accountCheckRestrictedReason}
        initialAccountCheckCompleted={accountCheckCompleted}
        initialTechnicallyBlockedOfferIds={technicalBlockedOfferIds}
        contactPhone="+49 5761 8429660"
        surface="public_onlinekredit"
        emptyStateMessage="Aktuell liegt noch kein auswählbares SEPANA-Angebot vor. Passe deine Angaben an und berechne danach erneut."
      />
    </div>
  )
}
