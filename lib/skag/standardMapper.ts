type ApplicantLike = {
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  email?: string | null
  phone?: string | null
}

type DetailsLike = {
  gender?: number | null
  birth_name?: string | null
  date_of_birth?: string | null
  nationality?: string | null
  family_situation?: number | null
  dependent_children_count?: number | null
  children_ages_csv?: string | null
  street?: string | null
  house_number?: string | null
  zipcode?: string | null
  city?: string | null
  phone_primary?: string | null
  phone_secondary?: string | null
  email?: string | null
  residence_type?: number | null
  rent_monthly?: number | null
  resident_since?: string | null
  tax_class?: number | null
  profession?: number | null
  profession_begin_date?: string | null
  employer_name?: string | null
  employer_street?: string | null
  employer_house?: string | null
  employer_zipcode?: string | null
  employer_city?: string | null
  employer_phone?: string | null
  employer_email?: string | null
  net_income_monthly?: number | null
  additional_income_monthly?: number | null
  additional_income_begin_date?: string | null
  employment_relationship_limited?: boolean | null
  wage_garnishment_assignment?: boolean | null
  bank_name?: string | null
  iban?: string | null
  spouse_first_name?: string | null
  spouse_birth_date?: string | null
  spouse_birth_name?: string | null
  spouse_income_monthly?: number | null
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

function childrenAgesObject(childrenCount: number | null, childrenAgesCsv: string | null) {
  const count = Math.max(0, Number(childrenCount ?? 0) || 0)
  if (!count) return null

  const ages = String(childrenAgesCsv ?? "")
    .split(/[;,]+/g)
    .map((entry) => Number(String(entry).trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0)
    .slice(0, count)

  if (!ages.length) return null

  const result: Record<string, number> = {}
  for (let index = 0; index < ages.length; index += 1) {
    result[`age${index + 1}`] = ages[index]
  }
  return result
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

export function buildSkagStandardLeadPayload(input: {
  applicant: ApplicantLike | null
  details: DetailsLike
}) {
  const applicant = input.applicant ?? null
  const details = input.details
  const childrenCount = Math.max(0, Number(details.dependent_children_count ?? 0) || 0)
  const applicantEmail = trimOrNull(details.email) ?? trimOrNull(applicant?.email)
  const applicantPhonePrimary = digitsOnly(details.phone_primary) ?? digitsOnly(applicant?.phone)
  const employerFields = {
    employerName: trimOrNull(details.employer_name),
    employerStreet: trimOrNull(details.employer_street),
    employerHouse: trimOrNull(details.employer_house),
    employerZipcode: trimOrNull(details.employer_zipcode),
    employerCity: trimOrNull(details.employer_city),
    employerPhone: digitsOnly(details.employer_phone),
    employerEmail: trimOrNull(details.employer_email),
  }
  const additionalIncome = numberOrNull(details.additional_income_monthly)
  const additionalIncomeBeginDate = trimOrNull(details.additional_income_begin_date)
  const spouseFirstName = trimOrNull(details.spouse_first_name)
  const spouseBirthDate = trimOrNull(details.spouse_birth_date)
  const spouseBirthName = trimOrNull(details.spouse_birth_name)
  const spouseIncome = numberOrNull(details.spouse_income_monthly)

  return compactObject({
    generalData: {
      gender: numberOrNull(details.gender),
      firstName: trimOrNull(applicant?.first_name),
      lastName: trimOrNull(applicant?.last_name),
      dateOfBirth: trimOrNull(details.date_of_birth) ?? trimOrNull(applicant?.birth_date),
      nationality: trimOrNull(details.nationality),
      street: trimOrNull(details.street),
      houseNumber: trimOrNull(details.house_number),
      zipcode: trimOrNull(details.zipcode),
      city: trimOrNull(details.city),
      phone1: applicantPhonePrimary,
      phone2: digitsOnly(details.phone_secondary),
      email: applicantEmail,
      familySituation: numberOrNull(details.family_situation),
      numberOfChildren: childrenCount,
      agesOfChildren: childrenAgesObject(childrenCount, trimOrNull(details.children_ages_csv)),
    },
    residenceInfo: {
      type: numberOrNull(details.residence_type),
      rent: numberOrNull(details.rent_monthly),
      resident_since: trimOrNull(details.resident_since),
    },
    financialData: {
      germanTaxClass: numberOrNull(details.tax_class),
      profession: numberOrNull(details.profession),
      professionBeginDate: trimOrNull(details.profession_begin_date),
      employerData: Object.values(employerFields).some(Boolean) ? employerFields : null,
      income: numberOrNull(details.net_income_monthly),
      additionalIncomeData:
        additionalIncome !== null || additionalIncomeBeginDate
          ? {
              income: additionalIncome,
              professionBeginDate: additionalIncomeBeginDate,
            }
          : null,
      employmentRelationshipTerminatedOrLimited: Boolean(details.employment_relationship_limited),
      wageGarnishmentAssignment: Boolean(details.wage_garnishment_assignment),
    },
    bankData:
      trimOrNull(details.bank_name) || trimOrNull(details.iban)
        ? {
            bankName: trimOrNull(details.bank_name),
            iban: trimOrNull(details.iban),
          }
        : null,
    spouse:
      spouseFirstName || spouseBirthDate || spouseBirthName || spouseIncome !== null
        ? {
            firstName: spouseFirstName,
            dateBirth: spouseBirthDate,
            birthName: spouseBirthName,
            income: spouseIncome,
          }
        : null,
  })
}
