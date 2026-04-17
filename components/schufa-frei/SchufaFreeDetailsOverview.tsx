type ApplicantRow = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
}

type DetailsRow = {
  loan_amount_requested?: number | null
  term_months?: number | null
  net_income_monthly?: number | null
  nationality_group?: string | null
  sigma_existing_customer?: boolean | null
  employment_mode?: string | null
  employment_months_current?: number | null
  street?: string | null
  house_number?: string | null
  zipcode?: string | null
  city?: string | null
  employer_name?: string | null
  bank_name?: string | null
  iban?: string | null
  ratenschutz_opt_in?: boolean | null
  ratenschutz_opt_in_at?: string | null
  spouse_first_name?: string | null
  spouse_birth_name?: string | null
  spouse_birth_date?: string | null
  spouse_income_monthly?: number | null
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value))
  } catch {
    return value
  }
}

function hasSpouseData(details: DetailsRow | null) {
  if (!details) return false
  return [
    details.spouse_first_name,
    details.spouse_birth_name,
    details.spouse_birth_date,
    details.spouse_income_monthly,
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== "")
}

function DetailCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "accent" | "info"
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-200 bg-cyan-50/70"
      : tone === "info"
        ? "border-emerald-200 bg-emerald-50/70"
        : "border-slate-200/80 bg-white/90"

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-sm leading-relaxed text-slate-600">{hint}</div> : null}
    </div>
  )
}

export default function SchufaFreeDetailsOverview({
  applicant,
  details,
}: {
  applicant: ApplicantRow | null
  details: DetailsRow | null
}) {
  const address = [details?.street, details?.house_number].filter(Boolean).join(" ").trim()
  const cityLine = [details?.zipcode, details?.city].filter(Boolean).join(" ").trim()
  const spousePresent = hasSpouseData(details)
  const ratenschutzSelected = Boolean(details?.ratenschutz_opt_in || details?.ratenschutz_opt_in_at)
  const applicantName = [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ").trim() || "-"
  const variantValue = `${formatCurrency(details?.loan_amount_requested)} / ${details?.term_months ?? "-"} Monate`
  const precheckValue = details?.sigma_existing_customer ? "Sigma-Bestandskunde" : "Neukunde"
  const precheckHint = `${details?.nationality_group ?? "-"} · ${details?.employment_mode ?? "-"} · ${details?.employment_months_current ?? "-"} Monate`

  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-sm sm:rounded-[32px] sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Antragsdaten</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Gespeicherte Angaben</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Alle gespeicherten Kerndaten des Falls in einer kompakten Übersicht.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <DetailCard
          label="Antragsteller"
          value={applicantName}
          hint={[applicant?.email ?? "-", applicant?.phone ?? "-"].filter(Boolean).join(" · ")}
          tone="accent"
        />
        <DetailCard
          label="Variante"
          value={variantValue}
          hint={`Nettoeinkommen: ${formatCurrency(details?.net_income_monthly)}`}
          tone="info"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailCard label="Vorprüfung" value={precheckValue} hint={precheckHint} />
        <DetailCard label="Adresse" value={address || "-"} hint={cityLine || "-"} />
        <DetailCard label="Arbeitgeber" value={details?.employer_name ?? "-"} />
        <DetailCard label="Bank" value={details?.bank_name ?? "-"} hint={details?.iban ?? "-"} />

        {spousePresent ? (
          <DetailCard
            label="Ehegatte"
            value={details?.spouse_first_name ?? "-"}
            hint={`Geburtsname: ${details?.spouse_birth_name ?? "-"} · Geburtsdatum: ${formatDate(details?.spouse_birth_date)} · Einkommen: ${formatCurrency(details?.spouse_income_monthly)}`}
            tone="accent"
          />
        ) : null}

        <DetailCard
          label="Ratenschutz"
          value={ratenschutzSelected ? "Gewünscht" : "Nicht vorgemerkt"}
          hint={
            ratenschutzSelected
              ? "Der Wunsch wurde im Fall gespeichert."
              : "Der Antrag läuft ohne zusätzlichen Ratenschutz-Wunsch."
          }
        />
      </div>
    </section>
  )
}
