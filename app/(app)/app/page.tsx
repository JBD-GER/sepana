import Link from "next/link"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"
import { parseAppointmentDateTime } from "@/components/appointments/utils"
import NotificationLog from "@/components/notifications/NotificationLog"
import { derivePrivatkreditJourney } from "@/lib/europace/customerJourney"
import type { EuropaceFlowSummary } from "@/lib/europace/flow"

const APPOINTMENT_LOG_TYPES = ["appointment_booked", "appointment_live_started", "appointment_cancelled"]

type DashboardResp = {
  openCases: number
  assignedAdvisorEmail: string | null
  tip: string
}

type AppointmentMini = {
  start_at: string
  end_at: string
  reason?: string | null
  advisor_name?: string | null
  case_ref?: string | null
}

type MissingSummaryResp = {
  ok: true
  caseId: string | null
  caseRef: string | null
  missingCount: number
  firstTab: "contact" | "household" | "finance" | "details" | null
}

type CaseListMiniResp = {
  cases: Array<{
    id: string
    case_ref: string | null
    status_display?: string | null
    case_type?: string | null
  }>
}

type CaseDetailJourneyResp = {
  europace?: {
    vorgangsnummer?: string | null
    annahme_job_id?: string | null
    antragsnummer?: string | null
    produktanbieterantragsnummer?: string | null
    sync_status?: string | null
    last_error?: string | null
  } | null
  europace_offers?: Array<{
    angebot_id: string
    accepted_at?: string | null
    superseded_at?: string | null
    vollstaendigkeit_status?: string | null
    angebot_snapshot?: {
      sofortkredit?: boolean | null
    } | null
  }>
  europace_flow?: EuropaceFlowSummary | null
  europace_documents?: Array<{
    local_document_id?: string | null
    europace_document_id?: string | null
    category?: string | null
    assignment_id?: string | null
    release_status?: string | null
    upload_status?: string | null
  }>
  europace_upload_targets?: Array<{
    key: string
    title: string
    category_id: string
    assignment_id?: string | null
  }>
}

type SignatureJourneyResp = {
  items: Array<{
    id: string
    title?: string | null
    requires_wet_signature?: boolean | null
    advisor_signed_at?: string | null
    customer_signed_at?: string | null
    status?: string | null
    fields?: Array<{ owner?: "advisor" | "customer" | string | null }> | null
    documents?: Array<{ document_kind?: "signature_original" | "signature_signed" | string | null }> | null
  }>
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(parseAppointmentDateTime(value))
}

export default async function CustomerDashboard() {
  await requireCustomer()

  const [res, apptRes, missingRes, latestKonsumRes] = await Promise.all([
    authFetch("/api/app/dashboard").catch(() => null),
    authFetch("/api/app/appointments?upcoming=1&limit=1").catch(() => null),
    authFetch("/api/app/cases/missing-summary").catch(() => null),
    authFetch("/api/app/cases/list?caseType=konsum&limit=1&page=1").catch(() => null),
  ])

  const data: DashboardResp =
    res && res.ok
      ? await res.json()
      : {
          openCases: 0,
          assignedAdvisorEmail: null,
          tip: "Halten Sie Gehaltsnachweise, Kontoauszüge und Eigenkapital-Nachweise griffbereit.",
        }

  const nextAppointment: AppointmentMini | null =
    apptRes && apptRes.ok ? (await apptRes.json())?.items?.[0] ?? null : null
  const missingSummary: MissingSummaryResp | null = missingRes && missingRes.ok ? await missingRes.json() : null
  const missingCount = missingSummary?.missingCount ?? 0
  const missingCaseId = missingSummary?.caseId ?? null
  const missingTab = missingSummary?.firstTab ?? "contact"
  const missingHref = missingCaseId
    ? `/app/faelle/${missingCaseId}?open=1&tab=${encodeURIComponent(missingTab)}#live-case-panel-${missingCaseId}`
    : null
  const latestKonsumList: CaseListMiniResp | null = latestKonsumRes && latestKonsumRes.ok ? await latestKonsumRes.json() : null
  const latestKonsumCase = latestKonsumList?.cases?.[0] ?? null

  let latestKonsumJourney:
    | ReturnType<typeof derivePrivatkreditJourney>
    | null = null

  if (latestKonsumCase?.id) {
    const [latestKonsumCaseRes, latestKonsumMissingRes, latestKonsumSignaturesRes] = await Promise.all([
      authFetch(`/api/app/cases/get?id=${encodeURIComponent(latestKonsumCase.id)}`).catch(() => null),
      authFetch(`/api/app/cases/missing-summary?caseId=${encodeURIComponent(latestKonsumCase.id)}&caseType=konsum`).catch(
        () => null
      ),
      authFetch(`/api/app/signatures?caseId=${encodeURIComponent(latestKonsumCase.id)}`).catch(() => null),
    ])

    const latestCaseData: CaseDetailJourneyResp | null =
      latestKonsumCaseRes && latestKonsumCaseRes.ok ? await latestKonsumCaseRes.json() : null
    const latestMissingData: MissingSummaryResp | null =
      latestKonsumMissingRes && latestKonsumMissingRes.ok ? await latestKonsumMissingRes.json() : null
    const latestSignatureData: SignatureJourneyResp | null =
      latestKonsumSignaturesRes && latestKonsumSignaturesRes.ok ? await latestKonsumSignaturesRes.json() : null

    if (latestCaseData) {
      latestKonsumJourney = derivePrivatkreditJourney({
        caseId: latestKonsumCase.id,
        meta: latestCaseData.europace ?? null,
        missingCount: latestMissingData?.missingCount ?? 0,
        firstMissingTab: latestMissingData?.firstTab ?? null,
        offers: latestCaseData.europace_offers ?? [],
        documents: latestCaseData.europace_documents ?? [],
        uploadTargets: latestCaseData.europace_upload_targets ?? [],
        signatureRequests: latestSignatureData?.items ?? [],
        flowSummary: latestCaseData.europace_flow ?? null,
      })
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">Kundenportal</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ihr Finanzierungs-Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Alles Wichtige auf einen Blick: Fälle, Termine, Rückmeldungen und der direkte Weg in Ihre Unterlagen.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {missingCount > 0 && missingHref ? (
              <Link
                href={missingHref}
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 sm:w-auto"
              >
                {missingCount === 1 ? "1 offene Angabe ausfüllen" : `${missingCount} offene Angaben ausfüllen`}
              </Link>
            ) : null}
            <Link
              href="/app/faelle"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
            >
              Zu den Fällen
            </Link>
            <Link
              href="/app/termine"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
            >
              Termine öffnen
            </Link>
          </div>
        </div>
      </section>

      {latestKonsumCase && latestKonsumJourney ? (
        <section className="rounded-[32px] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Privatkredit</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Aktuellen Antrag fortsetzen</h2>
              <p className="mt-2 text-sm text-slate-600">
                Fall {latestKonsumCase.case_ref || latestKonsumCase.id.slice(0, 8)}. {latestKonsumJourney.nextDescription}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {latestKonsumJourney.steps.map((step) => (
                  <span
                    key={step.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      step.state === "done"
                        ? "border border-emerald-200 bg-emerald-100 text-emerald-800"
                        : step.state === "current"
                          ? "border border-slate-900 bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {step.title}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <Link
                href={latestKonsumJourney.nextHref}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                {latestKonsumJourney.nextLabel}
              </Link>
              <Link
                href={`/app/faelle/${latestKonsumCase.id}#privatkredit-journey`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300"
              >
                Privatkredit-Dashboard oeffnen
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktive Fälle</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{data.openCases}</div>
          <p className="mt-2 text-sm text-slate-600">Wir halten Sie automatisch auf dem Laufenden.</p>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Berater</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {data.assignedAdvisorEmail || "Noch nicht zugewiesen"}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {data.assignedAdvisorEmail
              ? "Sie können Rückfragen direkt im passenden Fall schreiben."
              : "Sobald ein Berater zugewiesen ist, sehen Sie ihn hier."}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ihr Tipp</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{data.tip}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Nächster Termin</div>
              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">Live-Beratung</div>
            </div>
            <Link
              href="/app/termine"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              Alle Termine
            </Link>
          </div>

          {nextAppointment ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-base font-semibold text-slate-900">
                {nextAppointment.reason || "Beratungstermin"}
              </div>
              <div className="mt-1 text-sm text-slate-600">Fall {nextAppointment.case_ref || "-"}</div>
              <div className="mt-3 text-sm text-slate-700">
                Mit {nextAppointment.advisor_name || "Ihrem Berater"} am{" "}
                <span className="font-semibold text-slate-900">{formatDateTime(nextAppointment.start_at)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              Aktuell ist kein Termin geplant.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="text-sm font-semibold text-slate-900">Schnellzugriffe</div>
          <div className="mt-4 grid gap-2">
            <Link
              href="/app/faelle"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Fälle ansehen
            </Link>
            <Link
              href="/app/feedback"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Feedback senden
            </Link>
            <Link
              href="/app/profil"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Profil aktualisieren
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <NotificationLog
          limit={3}
          title="Terminverlauf"
          scope="inbox"
          types={APPOINTMENT_LOG_TYPES}
          caseHrefBase="/app/faelle"
        />
        <NotificationLog
          limit={3}
          title="Benachrichtigungen"
          scope="inbox"
          excludeTypes={APPOINTMENT_LOG_TYPES}
          caseHrefBase="/app/faelle"
        />
      </section>
    </div>
  )
}




