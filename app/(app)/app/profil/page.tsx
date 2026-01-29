import LogoutButton from "@/components/LogoutButton"
import { requireCustomer } from "@/lib/app/requireCustomer"

export default async function ProfilPage() {
  const { supabase, user } = await requireCustomer()

  const { data: applicant } = await supabase
    .from("case_applicants")
    .select(
      "first_name,last_name,email,phone,birth_date,nationality,marital_status,address_street,address_zip,address_city,housing_status,employment_type,employment_status,employer_name,net_income_monthly"
    )
    .eq("created_by", user.id)
    .eq("role", "primary")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Profil</h1>
        <p className="mt-1 text-sm text-slate-600">Ihre hinterlegten Daten (read-only).</p>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Account</div>
        <div className="mt-2 text-sm text-slate-700">
          <div>
            <span className="text-slate-500">E-Mail:</span> {user.email}
          </div>
          <div>
            <span className="text-slate-500">User-ID:</span> {user.id}
          </div>
        </div>

        <div className="mt-5 h-px bg-slate-200/70" />

        <div className="mt-5 text-sm font-medium text-slate-900">Baufinanzierung – Antragsteller</div>

        {applicant ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Vorname" value={applicant.first_name} />
            <Field label="Nachname" value={applicant.last_name} />
            <Field label="Telefon" value={applicant.phone} />
            <Field label="Geburtsdatum" value={applicant.birth_date} />
            <Field label="Staatsangehörigkeit" value={applicant.nationality} />
            <Field label="Familienstand" value={applicant.marital_status} />
            <Field
              label="Adresse"
              value={[applicant.address_street, applicant.address_zip, applicant.address_city].filter(Boolean).join(", ")}
            />
            <Field label="Wohnstatus" value={applicant.housing_status} />
            <Field label="Beschäftigung (Typ)" value={applicant.employment_type} />
            <Field label="Beschäftigung (Status)" value={applicant.employment_status} />
            <Field label="Arbeitgeber" value={applicant.employer_name} />
            <Field label="Netto/Monat" value={applicant.net_income_monthly?.toString()} />
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-600">
            Noch keine Antragsdaten gefunden (wird befüllt, sobald ein Fall angelegt wurde).
          </div>
        )}

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</div>
    </div>
  )
}
