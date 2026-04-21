import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import InsurancePartnerEditor from "./ui/InsurancePartnerEditor"
import InviteInsurancePartnerForm from "./ui/InviteInsurancePartnerForm"

export default async function AdminInsurancePartnersPage() {
  await requireAdmin()
  const admin = supabaseAdmin()

  const { data: partners } = await admin
    .from("profiles")
    .select("user_id,created_at")
    .eq("role", "insurance")
    .order("created_at", { ascending: false })

  const partnerIds = (partners ?? []).map((partner) => partner.user_id)
  const [{ data: partnerProfiles }, usersPage] = await Promise.all([
    partnerIds.length
      ? admin
          .from("insurance_partner_profiles")
          .select("user_id,partner_code,company_name,display_name,street,zipcode,city,bio,languages,photo_path,phone,email,is_active")
          .in("user_id", partnerIds)
      : Promise.resolve({ data: [] as any[] }),
    admin.auth.admin.listUsers({ page: 1, perPage: 2000 }),
  ])

  const profileById = new Map<string, any>()
  for (const profile of partnerProfiles ?? []) profileById.set(profile.user_id, profile)

  const authEmailById = new Map<string, string>()
  for (const user of usersPage.data?.users ?? []) authEmailById.set(user.id, user.email ?? "")

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Verwaltung</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Versicherungspartner</h1>
            <p className="mt-1 text-sm text-slate-600">
              Interne Versicherungspartner anlegen und in das Versicherungs-Dashboard einladen.
            </p>
          </div>
          <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600">
            Admin Bereich
          </div>
        </div>
      </div>

      <InviteInsurancePartnerForm />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-900">Partnerliste</div>
          <div className="text-xs text-slate-500">{(partners ?? []).length} Partner</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(partners ?? []).map((partner) => {
            const profile = profileById.get(partner.user_id) ?? {}
            const email = profile.email ?? authEmailById.get(partner.user_id) ?? partner.user_id
            return (
              <InsurancePartnerEditor
                key={partner.user_id}
                userId={partner.user_id}
                authEmail={authEmailById.get(partner.user_id) ?? ""}
                initial={{
                  partner_code: profile.partner_code ?? null,
                  company_name: profile.company_name ?? null,
                  display_name: profile.display_name ?? null,
                  street: profile.street ?? null,
                  zipcode: profile.zipcode ?? null,
                  city: profile.city ?? null,
                  bio: profile.bio ?? null,
                  languages: Array.isArray(profile.languages) ? profile.languages : [],
                  photo_path: profile.photo_path ?? null,
                  phone: profile.phone ?? null,
                  email: email ?? null,
                  is_active: profile.is_active ?? true,
                }}
              />
            )
          })}

          {(partners ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Noch keine Versicherungspartner vorhanden.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
