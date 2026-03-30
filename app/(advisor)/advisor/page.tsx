import Link from "next/link"
import Image from "next/image"
import LogoutButton from "@/components/LogoutButton"
import AdvisorLivePanel from "@/components/live/AdvisorLivePanel"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"
import { translateCaseStatus } from "@/lib/caseStatus"

const ACTION_QUEUE_NOTIFICATION_TYPES = [
  "onlinekredit_guided_offer_selected",
  "document_uploaded",
  "signature_requested",
  "signature_signed",
  "offer_bank_status",
  "appointment_booked",
  "appointment_live_started",
] as const

type AdvisorCaseListResp = {
  cases: Array<{
    id: string
    case_ref: string | null
    status: string
    status_display?: string | null
    created_at: string
    customer_name?: string | null
    docsCount?: number | null
    offersCount?: number | null
  }>
  total?: number
}

type AdvisorNotificationResp = {
  items: Array<{
    id: string
    case_id?: string | null
    case_ref?: string | null
    counterpart_name?: string | null
    title: string
    body: string
    type?: string | null
    created_at: string
  }>
  total?: number
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function dtShort(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d))
}

function initials(name: string | null | undefined) {
  const value = String(name ?? "").trim()
  if (!value) return "B"
  const parts = value.split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function actionBadge(type: string | null | undefined) {
  const normalized = String(type ?? "").trim().toLowerCase()
  if (normalized === "onlinekredit_guided_offer_selected") {
    return {
      label: "SEPANA-Auswahl",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
  }
  if (normalized === "document_uploaded") {
    return {
      label: "Upload",
      className: "border-cyan-200 bg-cyan-50 text-cyan-900",
    }
  }
  if (normalized === "signature_requested" || normalized === "signature_signed") {
    return {
      label: "Unterschrift",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    }
  }
  if (normalized === "offer_bank_status") {
    return {
      label: "Bankstatus",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }
  if (normalized === "appointment_booked" || normalized === "appointment_live_started") {
    return {
      label: "Termin",
      className: "border-indigo-200 bg-indigo-50 text-indigo-900",
    }
  }
  return {
    label: "Update",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  }
}

export default async function AdvisorDashboard() {
  const { supabase, user } = await requireAdvisor()
  const actionTypesParam = ACTION_QUEUE_NOTIFICATION_TYPES.join(",")

  const [
    { data: profile },
    { data: activeLive },
    activeCasesRes,
    confirmedCasesRes,
    actionNotificationsRes,
  ] = await Promise.all([
    supabase
      .from("advisor_profiles")
      .select("display_name,languages,photo_path,is_online")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("live_queue_tickets").select("id").eq("advisor_id", user.id).eq("status", "active"),
    authFetch("/api/app/cases/list?advisorBucket=active&limit=6").catch(() => null),
    authFetch("/api/app/cases/list?advisorBucket=confirmed&limit=1").catch(() => null),
    authFetch(`/api/app/notifications?scope=inbox&limit=8&types=${encodeURIComponent(actionTypesParam)}`).catch(() => null),
  ])

  const activeCasesData: AdvisorCaseListResp =
    activeCasesRes && activeCasesRes.ok ? await activeCasesRes.json() : { cases: [] }
  const confirmedCasesData: AdvisorCaseListResp =
    confirmedCasesRes && confirmedCasesRes.ok ? await confirmedCasesRes.json() : { cases: [] }
  const actionNotificationsData: AdvisorNotificationResp =
    actionNotificationsRes && actionNotificationsRes.ok ? await actionNotificationsRes.json() : { items: [] }

  const cases = activeCasesData.cases ?? []
  const actionItems = actionNotificationsData.items ?? []
  const activeCaseCount = Number(activeCasesData.total ?? cases.length)
  const confirmedCaseCount = Number(confirmedCasesData.total ?? 0)
  const actionTotal = Number(actionNotificationsData.total ?? actionItems.length)
  const activeCount = (activeLive ?? []).length
  const guidedSelectionCount = actionItems.filter((item) => item.type === "onlinekredit_guided_offer_selected").length
  const documentUploadCount = actionItems.filter((item) => item.type === "document_uploaded").length
  const signatureTaskCount = actionItems.filter(
    (item) => item.type === "signature_requested" || item.type === "signature_signed"
  ).length

  const avatarPath = profile?.photo_path ?? null
  const avatarUrl = avatarPath
    ? `/api/baufi/logo?bucket=advisor_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(avatarPath)}`
    : null

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Berater"

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">Beraterbereich</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Arbeitsdashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Weniger Rauschen, mehr Fokus: neue SEPANA-Auswahlen, Uploads und Signaturen stehen jetzt direkt im Vordergrund.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/advisor/faelle"
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Fälle öffnen
              </Link>
              <Link
                href="/advisor/termine"
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Termine öffnen
              </Link>
              <Link
                href="/advisor/faelle/bestaetigt"
                className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bestätigte Fälle
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <span className="text-base font-semibold text-white">{initials(displayName)}</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{displayName}</div>
                <div className="mt-1 text-xs text-slate-200/80">
                  {(profile?.languages ?? []).join(", ") || user.email || "SEPANA Berater"}
                </div>
                <div className="mt-2 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                  {profile?.is_online ? "Live-Status: Online" : "Live-Status: Offline"}
                </div>
              </div>
            </div>
            <LogoutButton
              label="Logout"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktive Fälle</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{activeCaseCount}</div>
          <div className="mt-2 text-sm text-slate-600">Aktuell in Bearbeitung</div>
        </div>
        <div className="rounded-3xl border border-emerald-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Sofort prüfen</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{actionTotal}</div>
          <div className="mt-2 text-sm text-slate-600">Relevante Kundenaktionen im Fokus</div>
        </div>
        <div className="rounded-3xl border border-cyan-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">SEPANA-Auswahl</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{guidedSelectionCount}</div>
          <div className="mt-2 text-sm text-slate-600">Geführte Auswahlen im aktuellen Fokus</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Im Gespräch</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{activeCount}</div>
          <div className="mt-2 text-sm text-slate-600">Aktive Live-Tickets</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sofort prüfen</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">Aktuelle Aufgaben</div>
            </div>
            <Link href="/advisor/faelle" className="text-sm font-semibold text-slate-900 underline underline-offset-4">
              Alle Fälle ansehen
            </Link>
          </div>

          {actionItems.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              Aktuell gibt es keine priorisierten Kundenaktionen in Ihrer Inbox.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {actionItems.map((item) => {
                const badge = actionBadge(item.type)
                const href = item.case_id ? `/advisor/faelle/${item.case_id}` : "/advisor/faelle"

                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                          {item.counterpart_name ? (
                            <span className="text-xs text-slate-500">{item.counterpart_name}</span>
                          ) : null}
                          {item.case_ref ? (
                            <span className="text-xs text-slate-500">Fall {item.case_ref}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">{dtShort(item.created_at)}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Heute im Fokus</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Worauf es gerade ankommt</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">SEPANA-Auswahl</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{guidedSelectionCount}</div>
              <div className="mt-1 text-xs text-emerald-900">Geführte Angebotsauswahlen im aktuellen Aufgaben-Feed</div>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-900">Dokumente</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{documentUploadCount}</div>
              <div className="mt-1 text-xs text-cyan-950">Uploads im aktuellen Aufgaben-Feed</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">Unterschrift</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{signatureTaskCount}</div>
              <div className="mt-1 text-xs text-amber-950">Signatur-Ereignisse im aktuellen Aufgaben-Feed</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bank bestätigt</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{confirmedCaseCount}</div>
              <div className="mt-1 text-xs text-slate-600">Bereits bestätigte Fälle im Bestand</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Link
              href="/advisor/faelle"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Aktive Fälle öffnen
            </Link>
            <Link
              href="/advisor/termine"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Terminplan öffnen
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
              Der Fokus liegt jetzt bewusst auf konkreten Kundenaktionen statt auf langen Notification-Feeds.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Meine Fälle</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Aktive Vorgänge</div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/advisor/faelle" className="text-sm font-semibold text-slate-900 underline underline-offset-4">
              Aktive ansehen
            </Link>
            <Link
              href="/advisor/faelle/bestaetigt"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Bestätigt ({confirmedCaseCount})
            </Link>
          </div>
        </div>

        {!cases.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            Aktuell sind keine aktiven Fälle vorhanden.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/advisor/faelle/${c.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{c.customer_name || `Fall ${c.case_ref || c.id.slice(0, 8)}`}</div>
                    <div className="mt-1 text-xs text-slate-500">{c.case_ref ? `Fall ${c.case_ref}` : c.id.slice(0, 8)}</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {translateCaseStatus(c.status_display ?? c.status)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-600">Erstellt {dt(c.created_at)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    Uploads {Number(c.docsCount ?? 0)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    Angebote {Number(c.offersCount ?? 0)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AdvisorLivePanel />
    </div>
  )
}
