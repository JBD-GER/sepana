import Link from "next/link"
import { requireTippgeber } from "@/lib/tippgeber/requireTippgeber"
import {
  computeTippgeberYtdMetrics,
  getTippgeberProfileByUserId,
  listTippgeberReferralsForUser,
  type TippgeberReferralRow,
} from "@/lib/tippgeber/service"
import { formatEuro } from "@/lib/tippgeber/commission"
import TippgeberReferralForm from "./ui/TippgeberReferralForm"

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function statusLabel(value: string | null | undefined) {
  const v = String(value ?? "").trim().toLowerCase()
  switch (v) {
    case "new":
      return "Neu"
    case "assigned":
      return "Berater zugewiesen"
    case "case_created":
      return "Fall erstellt"
    case "commission_open":
      return "Provision offen"
    case "paid":
      return "Ausgezahlt"
    case "bank_approved":
      return "Bank angenommen"
    case "bank_declined":
      return "Bank abgelehnt"
    default:
      return v || "-"
  }
}

function statusBadgeClass(referral: TippgeberReferralRow) {
  const s = String(referral.commission_status ?? "").toLowerCase()
  if (s === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (s === "open") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function commissionReasonLabel(value: string | null | undefined) {
  const v = String(value ?? "").trim().toLowerCase()
  switch (v) {
    case "bank_approved_35pct_incl_vat":
      return "35 % inkl. MwSt. (nur bei Bankzusage)"
    case "bank_declined_no_commission":
      return "Keine Provision (nur bei Bankzusage)"
    case "bank_approved_30pct_of_internal_commission":
      return "Altmodell: 30 % zzgl. MwSt."
    case "bank_declined_100":
      return "Altmodell: 100 EUR zzgl. MwSt."
    default:
      return v || null
  }
}

function tippgeberLogoUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=tipgeber_logos&width=192&height=192&resize=contain&path=${encodeURIComponent(clean)}`
}

function companyInitials(name: string) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  const value = parts.map((part) => part.charAt(0)).join("").toUpperCase()
  return value || "TG"
}

export default async function TippgeberDashboardPage() {
  const { user, role } = await requireTippgeber()

  if (role === "admin") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Tippgeber-Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Als Admin bitte den Bereich <Link href="/admin/tippgeber" className="font-medium text-slate-900 underline underline-offset-4">Admin → Tippgeber</Link> verwenden.
          </p>
        </div>
      </div>
    )
  }

  const [profile, referrals] = await Promise.all([
    getTippgeberProfileByUserId(user.id),
    listTippgeberReferralsForUser(user.id),
  ])

  const metrics = computeTippgeberYtdMetrics(referrals)
  const companyName = profile?.company_name ?? "Tippgeber"
  const logoUrl = tippgeberLogoUrl(profile?.logo_path)
  const initials = companyInitials(companyName)

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">Tippgeber-Dashboard</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{companyName}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-200/90">
              Tipps einreichen, Status verfolgen und Provisionen transparent einsehen.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {logoUrl ? (
                <img src={logoUrl} alt={`${companyName} Logo`} className="h-full w-full object-contain p-1.5" />
              ) : (
                <span className="text-sm font-semibold text-slate-100">{initials}</span>
              )}
            </div>
            <div className="text-xs text-slate-200/90">
              <div className="font-semibold text-white">Ihr Profil</div>
              <div>{profile?.email ?? user.email ?? "-"}</div>
              <div>{[profile?.address_zip, profile?.address_city].filter(Boolean).join(" ") || "-"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-2 text-sm">
          <span className="inline-flex rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
            Hinweis
          </span>
          <p className="text-emerald-900">
            Wir stellen 35 % inkl. MwSt. von der ausgezahlten Provision aus.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {logoUrl ? (
                <img src={logoUrl} alt={`${companyName} Logo`} className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-lg font-semibold text-slate-700">{initials}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Willkommen</div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Schön, dass Sie da sind, {companyName}.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                In Ihrem Tippgeber-Bereich können Sie neue Tipps einreichen, den Bearbeitungsstand verfolgen und Ihre Provisionen transparent einsehen.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Schnellstart</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">So legen Sie los</h2>
          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              1. Neuen Tipp erfassen und Kontaktdaten vollständig eintragen
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              2. Status in der Übersicht verfolgen (Berater, Fall, Provision)
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              3. Exposé/Gutschriften später direkt pro Tipp herunterladen
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Gesamte Tipps (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalTipsYtd}</div>
          <p className="mt-2 text-sm text-slate-600">Alle in diesem Kalenderjahr eingereichten Tipps.</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Offene Provision (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatEuro(metrics.openCommissionGrossYtd)}</div>
          <p className="mt-2 text-sm text-slate-600">Berechnet, aber noch nicht zur Auszahlung freigegeben.</p>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ausgezahlte Provision (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatEuro(metrics.paidCommissionGrossYtd)}</div>
          <p className="mt-2 text-sm text-slate-600">Freigegebene und als ausgezahlt markierte Provisionen.</p>
        </div>
      </section>

      <TippgeberReferralForm companyName={companyName} />

      <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Übersicht</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Meine Tipps</h2>
            <p className="mt-1 text-sm text-slate-600">Status, Fallzuordnung, Exposé und Provisionsstand pro Tipp.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {referrals.length} Einträge
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Tipp</th>
                <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Provision</th>
                <th className="px-4 py-3 font-medium text-slate-700">Dateien</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const customerName = `${r.customer_first_name} ${r.customer_last_name}`.trim()
                const location = [r.property_zip, r.property_city].filter(Boolean).join(" ")
                const hasExpose = Boolean(r.expose_file_path)
                const hasCreditNote = Boolean(r.payout_credit_note_path)
                const reasonLabel = commissionReasonLabel(r.commission_reason)
                return (
                  <tr key={r.id} className="border-b border-slate-200/60 align-top last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500">Eingang: {dt(r.created_at)}</div>
                      {r.linked_case_id ? (
                        <div className="mt-1 text-xs text-slate-600">Fall: {r.linked_case_id.slice(0, 8)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{customerName || "-"}</div>
                      <div className="text-xs text-slate-600">{r.customer_email}</div>
                      <div className="text-xs text-slate-600">{r.customer_phone}</div>
                      {location ? <div className="mt-1 text-xs text-slate-500">{location}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(r)}`}>
                        {statusLabel(r.status)}
                      </span>
                      {r.bank_outcome ? (
                        <div className="mt-2 text-xs text-slate-600">
                          Bankstatus: {r.bank_outcome === "approved" ? "Angenommen" : "Abgelehnt"}
                        </div>
                      ) : null}
                      {r.assigned_advisor_id ? <div className="text-xs text-slate-500">Berater zugewiesen</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">Brutto: {formatEuro(r.commission_gross_amount)}</div>
                      <div className="text-xs text-slate-600">Netto: {formatEuro(r.commission_net_amount)}</div>
                      <div className="text-xs text-slate-600">
                        {r.commission_status === "paid" ? "Ausgezahlt" : r.commission_status === "open" ? "Offen" : "Noch keine Provision"}
                      </div>
                      {reasonLabel ? <div className="mt-1 text-xs text-slate-500">{reasonLabel}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {hasExpose ? (
                          <a
                            href={`/api/tippgeber/files?referralId=${encodeURIComponent(r.id)}&kind=expose&download=1`}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                          >
                            Exposé herunterladen
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Kein Exposé</span>
                        )}
                        {hasCreditNote ? (
                          <a
                            href={`/api/tippgeber/files?referralId=${encodeURIComponent(r.id)}&kind=credit_note&download=1`}
                            className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:border-emerald-300"
                          >
                            Gutschrift herunterladen
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Noch keine Tipps vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
