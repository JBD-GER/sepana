import { translateCaseStatus } from "@/lib/caseStatus"
import { getSkagStatusMeta, translateSkagAlias } from "@/lib/skag/status"

type SyncRow = {
  skag_credit_id?: string | null
  skag_client_id?: string | null
  last_status_alias?: string | null
  last_status_description?: string | null
  last_submit_at?: string | null
  last_document_upload_at?: string | null
  last_error?: string | null
} | null

type PushRow = {
  status_alias?: string | null
  status_description?: string | null
  created_at?: string | null
}

function dt(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

export default function SchufaFreeStatusOverview({
  caseStatus,
  sync,
  pushEvents,
  documentCount,
  requestCount,
}: {
  caseStatus: string | null | undefined
  sync: SyncRow
  pushEvents: PushRow[]
  documentCount: number
  requestCount: number
}) {
  const latestPush = pushEvents[0] ?? null
  const badgeLabel =
    sync?.last_status_alias
      ? getSkagStatusMeta(sync.last_status_alias, sync.last_status_description).title
      : latestPush?.status_alias
        ? getSkagStatusMeta(latestPush.status_alias, latestPush.status_description).title
        : translateCaseStatus(caseStatus)
  const translatedAlias = translateSkagAlias(
    sync?.last_status_alias ?? latestPush?.status_alias ?? null,
    sync?.last_status_description ?? latestPush?.status_description ?? null
  )
  const recentEvents = pushEvents.slice(0, 4)
  const documentLabel =
    requestCount > 0 ? `${documentCount} hochgeladen · ${requestCount} angefordert` : `${documentCount} Dokumente im Fall`

  return (
    <section
      id="schufa-status"
      className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-sm sm:rounded-[32px] sm:p-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">SEPANA Status</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Aktueller Prüfstand</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Dieser Bereich bündelt den letzten SEPANA-Stand, den technischen Rückkanal und den Fortschritt bei den Unterlagen.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900 shadow-sm">
          {badgeLabel}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">SEPANA Credit ID</div>
          <div className="mt-2 break-all text-base font-semibold text-slate-900">{sync?.skag_credit_id ?? "-"}</div>
          <div className="mt-2 text-xs text-slate-500">Technische Referenz des übermittelten Falls</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Letzter Status</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{translatedAlias}</div>
          <div className="mt-2 text-xs text-slate-500">Zuletzt gemeldeter Schritt aus dem Prozess</div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Unterlagen</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{documentLabel}</div>
          <div className="mt-2 text-xs text-slate-500">Dokumentenfortschritt im aktuellen Fall</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Letztes Update</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{dt(latestPush?.created_at ?? sync?.last_submit_at)}</div>
          <div className="mt-2 text-xs text-slate-500">Zeitpunkt der letzten Rückmeldung oder Übermittlung</div>
        </div>
      </div>

      {sync?.last_error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          Letzter technischer Hinweis: {sync.last_error}
        </div>
      ) : null}

      {recentEvents.length ? (
        <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Letzte Statusmeldungen</div>
          <div className="mt-4 space-y-3">
            {recentEvents.map((event, index) => {
              const meta = getSkagStatusMeta(event.status_alias, event.status_description)
              const aliasLabel = translateSkagAlias(event.status_alias, event.status_description)
              const toneClass =
                meta.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : meta.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : meta.tone === "danger"
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : "border-slate-200 bg-white text-slate-900"

              return (
                <div
                  key={`${event.created_at ?? "event"}-${index}`}
                  className={`rounded-2xl border px-4 py-4 shadow-sm ${toneClass}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">{aliasLabel}</div>
                      {aliasLabel !== meta.title ? <div className="mt-1 text-sm font-semibold">{meta.title}</div> : null}
                    </div>
                    <div className="text-xs opacity-80">{dt(event.created_at)}</div>
                  </div>
                  {event.status_description ? (
                    <div className="mt-3 text-sm leading-relaxed opacity-90">{event.status_description}</div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}
