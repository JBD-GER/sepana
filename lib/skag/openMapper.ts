type ApplicantLike = {
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  email?: string | null
  phone?: string | null
}

type DetailsLike = {
  loan_amount_requested?: number | null
  gender?: number | null
  date_of_birth?: string | null
  place_of_birth?: string | null
  nationality?: string | null
  family_situation?: number | null
  tax_child?: number | string | null
  dependent_children_count?: number | null
  children_ages_csv?: string | null
  street?: string | null
  house_number?: string | null
  zipcode?: string | null
  city?: string | null
  phone_primary?: string | null
  phone_secondary?: string | null
  email?: string | null
  profession?: number | null
  employer_name?: string | null
  employer_street?: string | null
  employer_house?: string | null
  employer_zipcode?: string | null
  employer_city?: string | null
  employer_phone?: string | null
  profession_begin_date?: string | null
  net_income_monthly?: number | null
  additional_income_monthly?: number | null
  tax_class?: number | null
  bank_name?: string | null
  iban?: string | null
  residence_type?: number | null
  resident_since?: string | null
  rent_monthly?: number | null
  spouse_first_name?: string | null
  spouse_birth_name?: string | null
  spouse_birth_date?: string | null
  spouse_income_monthly?: number | null
  ratenschutz_opt_in?: boolean | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function digitsOnly(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits || null
}

function childrenAgesArray(childrenCount: number | null, childrenAgesCsv: string | null) {
  const count = Math.max(0, Number(childrenCount ?? 0) || 0)
  if (!count) return null

  const ages = String(childrenAgesCsv ?? "")
    .split(/[;,]+/g)
    .map((entry) => Number(String(entry).trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0)
    .slice(0, count)

  return ages.length ? ages : null
}

function compactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => compactObject(entry))
      .filter((entry) => entry !== null && entry !== undefined) as T
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, compactObject(entry)] as const)
      .filter(([, entry]) => {
        if (entry === null || entry === undefined || entry === "") return false
        if (Array.isArray(entry)) return entry.length > 0
        if (typeof entry === "object") return Object.keys(entry as Record<string, unknown>).length > 0
        return true
      })

    return Object.fromEntries(entries) as T
  }

  return value
}

export function buildSkagOpenLeadPayload(input: {
  applicant: ApplicantLike | null
  details: DetailsLike
  clientId?: string | null
}) {
  const applicant = input.applicant ?? null
  const details = input.details
  const childrenCount = Math.max(0, Number(details.dependent_children_count ?? 0) || 0)

  return compactObject({
    client_id: trimOrNull(input.clientId),
    requested_amount: numberOrNull(details.loan_amount_requested),
    appeal_id: numberOrNull(details.gender),
    first_name: trimOrNull(applicant?.first_name),
    last_name: trimOrNull(applicant?.last_name),
    date_birth: trimOrNull(details.date_of_birth) ?? trimOrNull(applicant?.birth_date),
    place_birth: trimOrNull(details.place_of_birth),
    nationality: trimOrNull(details.nationality),
    street: trimOrNull(details.street),
    house: trimOrNull(details.house_number),
    city: trimOrNull(details.city),
    zip: trimOrNull(details.zipcode),
    phone: digitsOnly(details.phone_primary) ?? digitsOnly(applicant?.phone),
    phone_two: digitsOnly(details.phone_secondary),
    email: trimOrNull(details.email) ?? trimOrNull(applicant?.email),
    marital_status_id: numberOrNull(details.family_situation),
    tax_child: numberOrNull(details.tax_child),
    amount_children: childrenCount,
    ages_children: childrenAgesArray(childrenCount, trimOrNull(details.children_ages_csv)),
    employer_position_uid: numberOrNull(details.profession),
    employer: trimOrNull(details.employer_name),
    employer_street: trimOrNull(details.employer_street),
    employer_house: trimOrNull(details.employer_house),
    employer_zip: trimOrNull(details.employer_zipcode),
    employer_city: trimOrNull(details.employer_city),
    employer_phone: digitsOnly(details.employer_phone),
    employed_since: trimOrNull(details.profession_begin_date),
    employer_income: numberOrNull(details.net_income_monthly),
    additional_income: numberOrNull(details.additional_income_monthly),
    tax_category: numberOrNull(details.tax_class),
    bank: trimOrNull(details.bank_name),
    iban: trimOrNull(details.iban),
    resident_type: numberOrNull(details.residence_type),
    resident_since: trimOrNull(details.resident_since),
    amount_rent: numberOrNull(details.rent_monthly),
    spouse_name: trimOrNull(details.spouse_first_name),
    spouse_birth_name: trimOrNull(details.spouse_birth_name),
    spouse_date_birth: trimOrNull(details.spouse_birth_date),
    spouse_income: numberOrNull(details.spouse_income_monthly),
    insurance: Boolean(details.ratenschutz_opt_in),
  })
}
