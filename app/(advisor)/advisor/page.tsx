import Link from "next/link"
import Image from "next/image"
import LogoutButton from "@/components/LogoutButton"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import { authFetch } from "@/lib/app/authFetch"
import AdvisorLivePanel from "@/components/live/AdvisorLivePanel"
import NotificationLog from "@/components/notifications/NotificationLog"
import { translateCaseStatus } from "@/lib/caseStatus"

const APPOINTMENT_LOG_TYPES = ["appointment_booked", "appointment_live_started", "appointment_cancelled"]

type AdvisorCaseListResp = {
  cases: Array<{
    id: string
    case_ref: string | null
    status: string
    status_display?: string | null
    created_at: string
  }>
  total?: number
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
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

export default async function AdvisorDashboard() {
  const { supabase, user } = await requireAdvisor()

  const [{ data: profile }, { data: activeLive }, activeCasesRes, confirmedCasesRes] = await Promise.all([
    supabase
      .from("advisor_profiles")
      .select("display_name,bio,languages,photo_path,is_online")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("live_queue_tickets").select("id").eq("advisor_id", user.id).eq("status", "active"),
    authFetch("/api/app/cases/list?advisorBucket=active&limit=6").catch(() => null),
    authFetch("/api/app/cases/list?advisorBucket=confirmed&limit=1").catch(() => null),
  ])

  const activeCasesData: AdvisorCaseListResp =
    activeCasesRes && activeCasesRes.ok ? await activeCasesRes.json() : { cases: [] }
  const confirmedCasesData: AdvisorCaseListResp =
    confirmedCasesRes && confirmedCasesRes.ok ? await confirmedCasesRes.json() : { cases: [] }
  const cases = activeCasesData.cases ?? []
  const activeCaseCount = Number(activeCasesData.total ?? cases.length)
  const confirmedCaseCount = Number(confirmedCasesData.total ?? 0)

  const activeCount = (activeLive ?? []).length
  const avatarPath = profile?.photo_path ?? null
  const avatarUrl = avatarPath
    ? `/api/baufi/logo?bucket=advisor_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(avatarPath)}`
    : null

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Berater"

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">Beraterbereich</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Steuerzentrale</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Verwalten Sie Faelle, Termine und Live-Anfragen in einer Oberflaeche - schnell, klar und mobil optimiert.
            </p>
            <div className="mt-3 text-sm text-slate-200/90">{user.email}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/advisor/faelle"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Faelle
            </Link>
            <Link
              href="/advisor/termine"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Termine
            </Link>
            <LogoutButton
              label="Logout"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktive Faelle</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{activeCaseCount}</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bank bestaetigt</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{confirmedCaseCount}</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Live-Status</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{profile?.is_online ? "Online" : "Offline"}</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Im Gespraech</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{activeCount}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
              ) : (
                <span className="text-base font-semibold text-slate-700">{initials(displayName)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Profil</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{displayName}</div>
              <div className="mt-1 text-sm text-slate-600">
                {(profile?.languages ?? []).join(", ") || "Keine Sprachen hinterlegt"}
              </div>
            </div>
          </div>
          {profile?.bio ? <p className="mt-4 text-sm leading-relaxed text-slate-700">{profile.bio}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktionsfokus</div>
          <div className="mt-2 text-base font-semibold text-slate-900">Heute priorisieren</div>
          <div className="mt-3 grid gap-2">
            <Link
              href="/advisor/termine"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Terminplan oeffnen
            </Link>
            <Link
              href="/advisor/faelle"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Faelle pruefen
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
              Tipp: Oeffnen Sie den Live-Status fruehzeitig, um neue Kunden ohne Wartezeit anzunehmen.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Meine Faelle</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Aktive Vorgaenge</div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/advisor/faelle" className="text-sm font-semibold text-slate-900 underline underline-offset-4">
              Aktive ansehen
            </Link>
            <Link
              href="/advisor/faelle/bestaetigt"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Bestaetigt ({confirmedCaseCount})
            </Link>
          </div>
        </div>

        {!cases || cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            Aktuell sind keine aktiven Faelle vorhanden.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/advisor/faelle/${c.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Status: {translateCaseStatus(c.status_display ?? c.status)} | Erstellt {dt(c.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <NotificationLog
          limit={5}
          title="Terminverlauf"
          scope="inbox"
          types={APPOINTMENT_LOG_TYPES}
          enableCustomerFilter
          caseHrefBase="/advisor/faelle"
        />
        <NotificationLog
          limit={5}
          title="Benachrichtigungen"
          scope="inbox"
          excludeTypes={APPOINTMENT_LOG_TYPES}
          enableCustomerFilter
          caseHrefBase="/advisor/faelle"
        />
      </section>

      <AdvisorLivePanel />
    </div>
  )
}
