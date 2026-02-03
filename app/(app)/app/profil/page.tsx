import LogoutButton from "@/components/LogoutButton"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { formatCountryName } from "@/lib/countries"

export default async function ProfilPage() {
  const { supabase, user } = await requireCustomer()

  // Basisdaten immer aus der ersten Anfrage (erstem Baufi-Fall) ziehen.
  const { data: firstCase } = await supabase
    .from("cases")
    .select("id")
    .eq("customer_id", user.id)
    .eq("case_type", "baufi")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  let applicant: {
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    birth_date?: string | null
    nationality?: string | null
    marital_status?: string | null
    address_street?: string | null
    address_zip?: string | null
    address_city?: string | null
    housing_status?: string | null
    employment_type?: string | null
    employment_status?: string | null
    employer_name?: string | null
    net_income_monthly?: number | null
  } | null = null

  if (firstCase?.id) {
    const { data } = await supabase
      .from("case_applicants")
      .select(
        "first_name,last_name,email,phone,birth_date,nationality,marital_status,address_street,address_zip,address_city,housing_status,employment_type,employment_status,employer_name,net_income_monthly"
      )
      .eq("case_id", firstCase.id)
      .eq("role", "primary")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    applicant = data
  } else {
    // Fallback fuer Alt-Daten.
    const { data } = await supabase
      .from("case_applicants")
      .select(
        "first_name,last_name,email,phone,birth_date,nationality,marital_status,address_street,address_zip,address_city,housing_status,employment_type,employment_status,employer_name,net_income_monthly"
      )
      .eq("created_by", user.id)
      .eq("role", "primary")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    applicant = data
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -top-12 right-0 h-36 w-36 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-6 h-32 w-32 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Profil</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Ihre hinterlegten Daten fuer den Finanzierungsprozess. Diese Ansicht ist bewusst read-only.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Account</div>
          <div className="mt-4 grid gap-3">
            <Field label="E-Mail" value={user.email} />
            <Field label="User-ID" value={user.id} />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
            Sicherheits-Hinweis: Falls Sie Ihre E-Mail aendern moechten, melden Sie sich bitte beim Support.
          </div>

          <div className="mt-5 border-t border-slate-200/70 pt-5">
            <LogoutButton />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Baufinanzierung</div>
              <div className="mt-1 text-base font-semibold text-slate-900">Antragsteller</div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              Read-only
            </span>
          </div>

          {applicant ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Vorname" value={applicant.first_name} />
              <Field label="Nachname" value={applicant.last_name} />
              <Field label="Telefon" value={applicant.phone} />
              <Field label="Geburtsdatum" value={applicant.birth_date} />
              <Field label="Staatsangehoerigkeit" value={formatCountryName(applicant.nationality, "de-DE")} />
              <Field label="Familienstand" value={applicant.marital_status} />
              <Field
                label="Adresse"
                value={[applicant.address_street, applicant.address_zip, applicant.address_city].filter(Boolean).join(", ")}
              />
              <Field label="Wohnstatus" value={applicant.housing_status} />
              <Field label="Beschaeftigung (Typ)" value={applicant.employment_type} />
              <Field label="Beschaeftigung (Status)" value={applicant.employment_status} />
              <Field label="Arbeitgeber" value={applicant.employer_name} />
              <Field label="Netto/Monat" value={applicant.net_income_monthly?.toString()} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
              Noch keine Antragsdaten gefunden. Die Felder fuellen sich automatisch, sobald ein Fall angelegt wurde.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value ? String(value) : "-"}</div>
    </div>
  )
}
