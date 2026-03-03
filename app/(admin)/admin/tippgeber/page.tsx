import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import {
  computeTippgeberYtdMetrics,
  listAllTippgeberReferrals,
} from "@/lib/tippgeber/service"
import { formatEuro } from "@/lib/tippgeber/commission"
import {
  normalizeTippgeberKind,
  tippgeberKindLabel,
} from "@/lib/tippgeber/kinds"
import InviteTippgeberForm from "./ui/InviteTippgeberForm"
import TippgeberReferralsAdminTable, {
  type AdminTippgeberReferralRow,
} from "./ui/TippgeberReferralsAdminTable"

type TippgeberProfileMini = {
  user_id: string
  company_name: string
  tippgeber_kind: string | null
  email: string | null
  phone: string | null
  logo_path: string | null
  is_active: boolean | null
  address_zip: string
  address_city: string
}

type CaseMini = {
  id: string
  case_ref: string | null
  status: string | null
}

type AdvisorProfileMini = {
  user_id: string
  display_name: string | null
}

function tippgeberLogoUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=tipgeber_logos&width=128&height=128&resize=contain&path=${encodeURIComponent(clean)}`
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

export default async function AdminTippgeberPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const [referrals, tippgeberProfilesRes, advisorsRes] = await Promise.all([
    listAllTippgeberReferrals(500),
    admin
      .from("tippgeber_profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("user_id").eq("role", "advisor"),
  ])

  const tippgeberProfiles = (tippgeberProfilesRes.data ?? []) as TippgeberProfileMini[]
  const tippgeberByUserId = Object.fromEntries(
    tippgeberProfiles.map((p) => [
      p.user_id,
      {
        company_name: p.company_name,
        tippgeber_kind: normalizeTippgeberKind(p.tippgeber_kind),
        email: p.email,
        phone: p.phone,
        logo_path: p.logo_path,
        is_active: p.is_active,
        address_zip: p.address_zip,
        address_city: p.address_city,
      },
    ])
  ) as Record<
    string,
    {
      company_name: string
      tippgeber_kind: "classic" | "private_credit"
      email: string | null
      phone: string | null
      logo_path: string | null
      is_active: boolean | null
      address_zip: string
      address_city: string
    }
  >

  const advisorIds = (advisorsRes.data ?? []).map((a) => a.user_id)
  const [{ data: advisorProfiles }, usersRes] = await Promise.all([
    advisorIds.length
      ? admin.from("advisor_profiles").select("user_id,display_name").in("user_id", advisorIds)
      : Promise.resolve({ data: [] as AdvisorProfileMini[] }),
    admin.auth.admin.listUsers({ page: 1, perPage: 2000 }),
  ])

  const advisorDisplayById = new Map<string, string>()
  for (const row of (advisorProfiles ?? []) as AdvisorProfileMini[]) {
    const displayName = String(row.display_name ?? "").trim()
    if (displayName) advisorDisplayById.set(String(row.user_id), displayName)
  }
  const advisorEmailById = new Map<string, string>()
  for (const authUser of usersRes.data?.users ?? []) {
    if (authUser.id) advisorEmailById.set(authUser.id, authUser.email ?? "")
  }

  const advisorOptions = advisorIds
    .map((id) => {
      const display = advisorDisplayById.get(id)
      const email = advisorEmailById.get(id) || id
      return { id, label: display ? `${display} (${email})` : email }
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de"))

  const caseIds = Array.from(new Set(referrals.map((r) => r.linked_case_id).filter(Boolean))) as string[]
  const { data: casesRes } = caseIds.length
    ? await admin.from("cases").select("id,case_ref,status").in("id", caseIds)
    : { data: [] as CaseMini[] }

  const caseById = Object.fromEntries(
    ((casesRes ?? []) as CaseMini[]).map((c) => [c.id, { case_ref: c.case_ref, status: c.status }])
  ) as Record<string, { case_ref: string | null; status: string | null }>

  const metrics = computeTippgeberYtdMetrics(referrals)
  const openCommissionCount = referrals.filter((r) => String(r.commission_status ?? "") === "open").length
  const paidCommissionCount = referrals.filter((r) => String(r.commission_status ?? "") === "paid").length

  const privateTippgeberCount = tippgeberProfiles.filter((p) => normalizeTippgeberKind(p.tippgeber_kind) === "private_credit").length
  const classicTippgeberCount = tippgeberProfiles.length - privateTippgeberCount

  const enrichedReferrals = referrals.map((r) => {
    const company = tippgeberByUserId[r.tippgeber_user_id]
    const c = r.linked_case_id ? caseById[r.linked_case_id] : null
    return {
      ...r,
      tippgeber_company_name: company?.company_name ?? "Tippgeber",
      tippgeber_kind: company?.tippgeber_kind ?? "classic",
      tippgeber_logo_path: company?.logo_path ?? null,
      tippgeber_email: company?.email ?? null,
      tippgeber_phone: company?.phone ?? null,
      linked_case_ref: c?.case_ref ?? null,
      linked_case_status: c?.status ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Tippgeber</h1>
            <p className="mt-1 text-sm text-slate-600">
              Tippgeber einladen, eingereichte Tipps verwalten, Berater zuweisen und Provisionen freigeben.
            </p>
          </div>
          <Link
            href="/admin/faelle"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Zu den Faellen
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tippgeber</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{tippgeberProfiles.length}</div>
          <div className="mt-2 text-sm text-slate-600">{classicTippgeberCount} Baufinanzierung, {privateTippgeberCount} Privatkredit.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tipps (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{metrics.totalTipsYtd}</div>
          <div className="mt-2 text-sm text-slate-600">{referrals.length} Tipps insgesamt.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Offene Provision (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatEuro(metrics.openCommissionGrossYtd)}</div>
          <div className="mt-2 text-sm text-slate-600">{openCommissionCount} Tipps mit offener Provision.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ausgezahlt (YTD)</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatEuro(metrics.paidCommissionGrossYtd)}</div>
          <div className="mt-2 text-sm text-slate-600">{paidCommissionCount} Tipps auf bezahlt gesetzt.</div>
        </div>
      </section>

      <InviteTippgeberForm />

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Partner</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">Eingeladene Tippgeber</div>
          </div>
          <div className="text-xs text-slate-500">Zuletzt aktualisiert: {dt(new Date().toISOString())}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tippgeberProfiles.map((p) => {
            const logoUrl = tippgeberLogoUrl(p.logo_path)
            const kind = normalizeTippgeberKind(p.tippgeber_kind)
            return (
              <div key={p.user_id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-slate-400">Logo</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{p.company_name}</div>
                    <div className="text-xs text-slate-600">{p.email || "-"}</div>
                    <div className="text-xs text-slate-600">{p.phone || "-"}</div>
                    <div className="text-xs text-slate-500">{[p.address_zip, p.address_city].filter(Boolean).join(" ")}</div>
                    <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                      kind === "private_credit"
                        ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}>
                      {tippgeberKindLabel(kind)}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                      p.is_active === false
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {p.is_active === false ? "Deaktiviert" : "Aktiv"}
                  </span>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/admin/tippgeber/${p.user_id}`}
                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-300"
                  >
                    Bearbeiten
                  </Link>
                </div>
              </div>
            )
          })}
          {tippgeberProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Noch keine Tippgeber vorhanden.
            </div>
          ) : null}
        </div>
      </section>

      <TippgeberReferralsAdminTable referrals={enrichedReferrals as AdminTippgeberReferralRow[]} advisorOptions={advisorOptions} />
    </div>
  )
}

