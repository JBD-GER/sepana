import type { SupabaseClient } from "@supabase/supabase-js"

export type EuropaceCaseSnapshot = {
  caseId: string
  caseRef: string | null
  caseType: string
  primaryApplicant: {
    caseApplicantId: string
    firstName: string
    lastName: string
    birthDate: string | null
    email: string | null
    phone: string | null
  }
  secondaryApplicant: {
    caseApplicantId: string
    firstName: string | null
    lastName: string | null
    birthDate: string | null
  } | null
}

export type EuropaceCaseDraft = EuropaceCaseSnapshot & {
  primaryApplicant: EuropaceCaseSnapshot["primaryApplicant"] & {
    salutation: string | null
    title: string[] | null
    birthName: string | null
    birthCountry: string | null
    nationality: string | null
    maritalStatus: string | null
    phoneBusiness: string | null
    taxId: string | null
    addressStreet: string | null
    addressHouseNo: string | null
    addressZip: string | null
    addressCity: string | null
    housingStatus: string | null
    employmentType: string | null
    employmentStatus: string | null
    employmentJobTitle: string | null
    employmentSince: string | null
    employerName: string | null
    employerIndustry: string | null
    employerAddressStreet: string | null
    employerAddressHouseNo: string | null
    employerAddressZip: string | null
    employerAddressCity: string | null
    employerAddressCountry: string | null
    netIncomeMonthly: number | null
    otherIncomeMonthly: number | null
    expensesMonthly: number | null
    existingLoansMonthly: number | null
  }
  secondaryApplicant: (NonNullable<EuropaceCaseSnapshot["secondaryApplicant"]> & {
    salutation: string | null
    title: string[] | null
    birthName: string | null
    birthCountry: string | null
    birthPlace: string | null
    nationality: string | null
    maritalStatus: string | null
    phoneBusiness: string | null
    taxId: string | null
    idDocumentNumber: string | null
    idIssuedPlace: string | null
    idIssuedAt: string | null
    idExpiresAt: string | null
    addressStreet: string | null
    addressHouseNo: string | null
    addressZip: string | null
    addressCity: string | null
    housingStatus: string | null
    sharedHouseholdWithPrimary: boolean | null
    residenceSince: string | null
    previousAddressStreet: string | null
    previousAddressHouseNo: string | null
    previousAddressZip: string | null
    previousAddressCity: string | null
    previousAddressSince: string | null
    householdPersons: number | null
    vehicleCount: number | null
    employmentType: string | null
    employmentStatus: string | null
    employmentJobTitle: string | null
    employmentSince: string | null
    employerName: string | null
    employerIndustry: string | null
    employerAddressStreet: string | null
    employerAddressHouseNo: string | null
    employerAddressZip: string | null
    employerAddressCity: string | null
    employerAddressCountry: string | null
    netIncomeMonthly: number | null
    otherIncomeMonthly: number | null
    expensesMonthly: number | null
    existingLoansMonthly: number | null
    email: string | null
    phone: string | null
  }) | null
  financing: {
    purpose: string | null
    loanAmountRequested: number | null
    termMonths: number | null
  }
  children: Array<{
    localId: string | null
    name: string | null
    childBenefit: boolean | null
    maintenanceIncomePresent: boolean | null
    maintenanceIncomeMonthly: number | null
    applicantScope: "primary" | "co" | "both" | null
  }>
  liabilities: Array<{
    localId: string | null
    liabilityType: "ratenkredit" | "dispositionskredit" | "kreditkarte" | "privates_leasing" | "sonstige_verbindlichkeit"
    applicantScope: "primary" | "co" | "both" | null
    creditor: string | null
    monthlyRate: number | null
    finalInstallment: number | null
    lastRateDate: string | null
    currentBalance: number | null
    originalAmount: number | null
    firstPaymentDate: string | null
    utilizedAmount: number | null
    creditLimit: number | null
    interestRate: number | null
    refinance: boolean | null
    iban: string | null
    bic: string | null
  }>
  realEstateAssets: Array<{
    localId: string | null
    applicantScope: "primary" | "co" | "both" | null
    propertyType: "eigentumswohnung" | "einfamilienhaus" | "mehrfamilienhaus" | "buerogebaeude" | null
    description: string | null
    valueAmount: number | null
    livingSpaceSqm: number | null
    usageType: "eigengenutzt" | "vermietet" | "beides" | null
    rentedLivingSpaceSqm: number | null
    rentIncomeColdMonthly: number | null
    rentIncomeWarmMonthly: number | null
    ancillaryCostsMonthly: number | null
    loans: Array<{
      localId: string | null
      remainingDebt: number | null
      interestFixedUntil: string | null
      monthlyRate: number | null
    }>
  }>
  additional: {
    birthPlace: string | null
    residenceSince: string | null
    previousAddressStreet: string | null
    previousAddressHouseNo: string | null
    previousAddressZip: string | null
    previousAddressCity: string | null
    previousAddressSince: string | null
    probation: boolean
    probationMonths: number | null
    salaryCount: number | null
    householdSize: number | null
    currentWarmRent: number | null
    currentWarmRentNone: boolean
    vehiclesCount: number | null
    bankAccountHolder: string | null
    bankIban: string | null
    bankBic: string | null
    returnedDebitWindow: string | null
  }
}

type MinimalSupabase = Pick<SupabaseClient, "from">

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function stringArrayOrNull(value: unknown) {
  if (!Array.isArray(value)) return null
  const entries = value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
  return entries.length ? entries : null
}

function isMissingRelationError(error: unknown) {
  const relationError = error as { code?: string; message?: string } | null
  if (!relationError) return false
  if (relationError.code === "42P01") return true
  const message = String(relationError.message ?? "").toLowerCase()
  return message.includes("relation") && message.includes("does not exist")
}

export async function loadEuropaceCaseSnapshot(admin: MinimalSupabase, caseId: string): Promise<EuropaceCaseSnapshot> {
  const draft = await loadEuropaceCaseDraft(admin, caseId)
  return {
    caseId: draft.caseId,
    caseRef: draft.caseRef,
    caseType: draft.caseType,
    primaryApplicant: {
      caseApplicantId: draft.primaryApplicant.caseApplicantId,
      firstName: draft.primaryApplicant.firstName,
      lastName: draft.primaryApplicant.lastName,
      birthDate: draft.primaryApplicant.birthDate,
      email: draft.primaryApplicant.email,
      phone: draft.primaryApplicant.phone,
    },
    secondaryApplicant: draft.secondaryApplicant
      ? {
          caseApplicantId: draft.secondaryApplicant.caseApplicantId,
          firstName: draft.secondaryApplicant.firstName,
          lastName: draft.secondaryApplicant.lastName,
          birthDate: draft.secondaryApplicant.birthDate,
        }
      : null,
  }
}

export async function loadEuropaceCaseDraft(admin: MinimalSupabase, caseId: string): Promise<EuropaceCaseDraft> {
  const [
    { data: caseRow, error: caseError },
    { data: primaryRow, error: primaryError },
    { data: secondaryRow, error: secondaryError },
    { data: financingRow, error: financingError },
    { data: additionalRow, error: additionalError },
    { data: childrenRows, error: childrenError },
    { data: liabilitiesRows, error: liabilitiesError },
    { data: realEstateAssetsRows, error: realEstateAssetsError },
  ] = await Promise.all([
    admin.from("cases").select("id,case_ref,case_type").eq("id", caseId).maybeSingle(),
    admin.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    admin.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "co").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    admin.from("case_baufi_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin
      .from("case_additional_details")
      .select(
        "birth_place,residence_since,previous_address_street,previous_address_house_no,previous_address_zip,previous_address_city,previous_address_since,probation,probation_months,salary_count,household_size,warm_rent_monthly,warm_rent_not_applicable,vehicles_count,bank_account_holder,bank_iban,bank_bic,returned_debit_window"
      )
      .eq("case_id", caseId)
      .maybeSingle(),
    admin.from("case_children").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
    admin.from("case_liabilities").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
    admin.from("case_real_estate_assets").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
  ])

  if (caseError) throw caseError
  if (!caseRow) throw new Error("Fall nicht gefunden.")

  const caseType = String(caseRow.case_type ?? "").trim().toLowerCase()
  if (caseType !== "konsum") {
    throw new Error("Europace-Privatkredit ist aktuell nur fuer Konsumfaelle vorgesehen.")
  }

  if (primaryError) throw primaryError
  if (secondaryError) throw secondaryError
  if (financingError) throw financingError
  if (additionalError) throw additionalError
  if (childrenError) throw childrenError
  if (liabilitiesError && !isMissingRelationError(liabilitiesError)) throw liabilitiesError
  if (realEstateAssetsError && !isMissingRelationError(realEstateAssetsError)) throw realEstateAssetsError
  if (!primaryRow?.id) {
    throw new Error("Hauptantragsteller fehlt.")
  }

  const firstName = trimOrNull(primaryRow.first_name)
  const lastName = trimOrNull(primaryRow.last_name)
  if (!firstName || !lastName) {
    throw new Error("Vor- und Nachname des Hauptantragstellers werden fuer Europace benoetigt.")
  }

  const secondaryApplicant =
    secondaryRow?.id
      ? {
          caseApplicantId: String(secondaryRow.id),
          firstName: trimOrNull((secondaryRow as Record<string, unknown>).first_name),
          lastName: trimOrNull((secondaryRow as Record<string, unknown>).last_name),
          birthDate: trimOrNull((secondaryRow as Record<string, unknown>).birth_date),
          salutation: trimOrNull((secondaryRow as Record<string, unknown>).salutation),
          title: stringArrayOrNull((secondaryRow as Record<string, unknown>).title),
          birthName: trimOrNull((secondaryRow as Record<string, unknown>).birth_name),
          birthCountry: trimOrNull((secondaryRow as Record<string, unknown>).birth_country),
          birthPlace: trimOrNull((secondaryRow as Record<string, unknown>).birth_place),
          email: trimOrNull((secondaryRow as Record<string, unknown>).email),
          phone: trimOrNull((secondaryRow as Record<string, unknown>).phone),
          phoneBusiness: trimOrNull((secondaryRow as Record<string, unknown>).phone_business),
          nationality: trimOrNull((secondaryRow as Record<string, unknown>).nationality),
          maritalStatus: trimOrNull((secondaryRow as Record<string, unknown>).marital_status),
          taxId: trimOrNull((secondaryRow as Record<string, unknown>).tax_id),
          idDocumentNumber: trimOrNull((secondaryRow as Record<string, unknown>).id_document_number),
          idIssuedPlace: trimOrNull((secondaryRow as Record<string, unknown>).id_issued_place),
          idIssuedAt: trimOrNull((secondaryRow as Record<string, unknown>).id_issued_at),
          idExpiresAt: trimOrNull((secondaryRow as Record<string, unknown>).id_expires_at),
          addressStreet: trimOrNull((secondaryRow as Record<string, unknown>).address_street),
          addressHouseNo: trimOrNull((secondaryRow as Record<string, unknown>).address_house_no),
          addressZip: trimOrNull((secondaryRow as Record<string, unknown>).address_zip),
          addressCity: trimOrNull((secondaryRow as Record<string, unknown>).address_city),
          housingStatus: trimOrNull((secondaryRow as Record<string, unknown>).housing_status),
          sharedHouseholdWithPrimary:
            (secondaryRow as Record<string, unknown>).shared_household_with_primary === null ||
            (secondaryRow as Record<string, unknown>).shared_household_with_primary === undefined
              ? null
              : Boolean((secondaryRow as Record<string, unknown>).shared_household_with_primary),
          residenceSince: trimOrNull((secondaryRow as Record<string, unknown>).residence_since),
          previousAddressStreet: trimOrNull((secondaryRow as Record<string, unknown>).previous_address_street),
          previousAddressHouseNo: trimOrNull((secondaryRow as Record<string, unknown>).previous_address_house_no),
          previousAddressZip: trimOrNull((secondaryRow as Record<string, unknown>).previous_address_zip),
          previousAddressCity: trimOrNull((secondaryRow as Record<string, unknown>).previous_address_city),
          previousAddressSince: trimOrNull((secondaryRow as Record<string, unknown>).previous_address_since),
          householdPersons: numberOrNull((secondaryRow as Record<string, unknown>).household_persons),
          vehicleCount: numberOrNull((secondaryRow as Record<string, unknown>).vehicle_count),
          employmentType: trimOrNull((secondaryRow as Record<string, unknown>).employment_type),
          employmentStatus: trimOrNull((secondaryRow as Record<string, unknown>).employment_status),
          employmentJobTitle: trimOrNull((secondaryRow as Record<string, unknown>).employment_job_title),
          employmentSince: trimOrNull((secondaryRow as Record<string, unknown>).employment_since),
          employerName: trimOrNull((secondaryRow as Record<string, unknown>).employer_name),
          employerIndustry: trimOrNull((secondaryRow as Record<string, unknown>).employer_industry),
          employerAddressStreet: trimOrNull((secondaryRow as Record<string, unknown>).employer_address_street),
          employerAddressHouseNo: trimOrNull((secondaryRow as Record<string, unknown>).employer_address_house_no),
          employerAddressZip: trimOrNull((secondaryRow as Record<string, unknown>).employer_address_zip),
          employerAddressCity: trimOrNull((secondaryRow as Record<string, unknown>).employer_address_city),
          employerAddressCountry: trimOrNull((secondaryRow as Record<string, unknown>).employer_address_country),
          netIncomeMonthly: numberOrNull((secondaryRow as Record<string, unknown>).net_income_monthly),
          otherIncomeMonthly: numberOrNull((secondaryRow as Record<string, unknown>).other_income_monthly),
          expensesMonthly: numberOrNull((secondaryRow as Record<string, unknown>).expenses_monthly),
          existingLoansMonthly: numberOrNull((secondaryRow as Record<string, unknown>).existing_loans_monthly),
        }
      : null

  const realEstateAssetIds = Array.isArray(realEstateAssetsRows)
    ? realEstateAssetsRows.map((row) => trimOrNull((row as Record<string, unknown>).id)).filter(Boolean) as string[]
    : []

  const { data: realEstateLoansRows, error: realEstateLoansError } = realEstateAssetIds.length
    ? await admin.from("case_real_estate_loans").select("*").in("asset_id", realEstateAssetIds).order("created_at", { ascending: true })
    : { data: [], error: null as unknown }

  if (realEstateLoansError && !isMissingRelationError(realEstateLoansError)) throw realEstateLoansError

  const realEstateLoansByAssetId = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (realEstateLoansRows as Array<Record<string, unknown>> | null) ?? []) {
    const assetId = trimOrNull(row.asset_id)
    if (!assetId) continue
    const bucket = realEstateLoansByAssetId.get(assetId) ?? []
    bucket.push(row)
    realEstateLoansByAssetId.set(assetId, bucket)
  }

  return {
    caseId: String(caseRow.id),
    caseRef: trimOrNull(caseRow.case_ref),
    caseType,
    primaryApplicant: {
      caseApplicantId: String(primaryRow.id),
      firstName,
      lastName,
      birthDate: trimOrNull(primaryRow.birth_date),
      salutation: trimOrNull((primaryRow as Record<string, unknown>).salutation),
      title: stringArrayOrNull((primaryRow as Record<string, unknown>).title),
      birthName: trimOrNull((primaryRow as Record<string, unknown>).birth_name),
      birthCountry: trimOrNull((primaryRow as Record<string, unknown>).birth_country),
      email: trimOrNull(primaryRow.email),
      phone: trimOrNull(primaryRow.phone),
      phoneBusiness: trimOrNull((primaryRow as Record<string, unknown>).phone_business),
      nationality: trimOrNull((primaryRow as Record<string, unknown>).nationality),
      maritalStatus: trimOrNull((primaryRow as Record<string, unknown>).marital_status),
      taxId: trimOrNull((primaryRow as Record<string, unknown>).tax_id),
      addressStreet: trimOrNull((primaryRow as Record<string, unknown>).address_street),
      addressHouseNo: trimOrNull((primaryRow as Record<string, unknown>).address_house_no),
      addressZip: trimOrNull((primaryRow as Record<string, unknown>).address_zip),
      addressCity: trimOrNull((primaryRow as Record<string, unknown>).address_city),
      housingStatus: trimOrNull((primaryRow as Record<string, unknown>).housing_status),
      employmentType: trimOrNull((primaryRow as Record<string, unknown>).employment_type),
      employmentStatus: trimOrNull((primaryRow as Record<string, unknown>).employment_status),
      employmentJobTitle: trimOrNull((primaryRow as Record<string, unknown>).employment_job_title),
      employmentSince: trimOrNull((primaryRow as Record<string, unknown>).employment_since),
      employerName: trimOrNull((primaryRow as Record<string, unknown>).employer_name),
      employerIndustry: trimOrNull((primaryRow as Record<string, unknown>).employer_industry),
      employerAddressStreet: trimOrNull((primaryRow as Record<string, unknown>).employer_address_street),
      employerAddressHouseNo: trimOrNull((primaryRow as Record<string, unknown>).employer_address_house_no),
      employerAddressZip: trimOrNull((primaryRow as Record<string, unknown>).employer_address_zip),
      employerAddressCity: trimOrNull((primaryRow as Record<string, unknown>).employer_address_city),
      employerAddressCountry: trimOrNull((primaryRow as Record<string, unknown>).employer_address_country),
      netIncomeMonthly: numberOrNull((primaryRow as Record<string, unknown>).net_income_monthly),
      otherIncomeMonthly: numberOrNull((primaryRow as Record<string, unknown>).other_income_monthly),
      expensesMonthly: numberOrNull((primaryRow as Record<string, unknown>).expenses_monthly),
      existingLoansMonthly: numberOrNull((primaryRow as Record<string, unknown>).existing_loans_monthly),
    },
    secondaryApplicant,
    financing: {
      purpose: trimOrNull((financingRow as Record<string, unknown> | null)?.purpose),
      loanAmountRequested: numberOrNull((financingRow as Record<string, unknown> | null)?.loan_amount_requested),
      termMonths: numberOrNull((financingRow as Record<string, unknown> | null)?.term_months),
    },
    children: Array.isArray(childrenRows)
      ? childrenRows.map((row) => ({
          localId: trimOrNull((row as Record<string, unknown>).id),
          name: trimOrNull((row as Record<string, unknown>).child_name),
          childBenefit:
            (row as Record<string, unknown>).child_benefit === null ||
            (row as Record<string, unknown>).child_benefit === undefined
              ? null
              : Boolean((row as Record<string, unknown>).child_benefit),
          maintenanceIncomePresent:
            (row as Record<string, unknown>).maintenance_income_present === null ||
            (row as Record<string, unknown>).maintenance_income_present === undefined
              ? null
              : Boolean((row as Record<string, unknown>).maintenance_income_present),
          maintenanceIncomeMonthly: numberOrNull((row as Record<string, unknown>).support_income_monthly),
          applicantScope: (() => {
            const value = trimOrNull((row as Record<string, unknown>).applicant_scope)
            return value === "primary" || value === "co" || value === "both" ? value : null
          })(),
        }))
      : [],
    liabilities: Array.isArray(liabilitiesRows)
      ? liabilitiesRows
          .map((row) => {
            const liabilityType = trimOrNull((row as Record<string, unknown>).liability_type)
            if (
              liabilityType !== "ratenkredit" &&
              liabilityType !== "dispositionskredit" &&
              liabilityType !== "kreditkarte" &&
              liabilityType !== "privates_leasing" &&
              liabilityType !== "sonstige_verbindlichkeit"
            ) {
              return null
            }

            return {
              localId: trimOrNull((row as Record<string, unknown>).id),
              liabilityType,
              applicantScope: (() => {
                const value = trimOrNull((row as Record<string, unknown>).applicant_scope)
                return value === "primary" || value === "co" || value === "both" ? value : null
              })(),
              creditor: trimOrNull((row as Record<string, unknown>).creditor),
              monthlyRate: numberOrNull((row as Record<string, unknown>).monthly_rate),
              finalInstallment: numberOrNull((row as Record<string, unknown>).final_installment),
              lastRateDate: trimOrNull((row as Record<string, unknown>).last_rate_date),
              currentBalance: numberOrNull((row as Record<string, unknown>).current_balance),
              originalAmount: numberOrNull((row as Record<string, unknown>).original_amount),
              firstPaymentDate: trimOrNull((row as Record<string, unknown>).first_payment_date),
              utilizedAmount: numberOrNull((row as Record<string, unknown>).utilized_amount),
              creditLimit: numberOrNull((row as Record<string, unknown>).credit_limit),
              interestRate: numberOrNull((row as Record<string, unknown>).interest_rate),
              refinance:
                (row as Record<string, unknown>).refinance === null ||
                (row as Record<string, unknown>).refinance === undefined
                  ? null
                  : Boolean((row as Record<string, unknown>).refinance),
              iban: trimOrNull((row as Record<string, unknown>).iban),
              bic: trimOrNull((row as Record<string, unknown>).bic),
            }
          })
          .filter(Boolean) as EuropaceCaseDraft["liabilities"]
      : [],
    realEstateAssets: Array.isArray(realEstateAssetsRows)
      ? realEstateAssetsRows
          .map((row) => {
            const assetId = trimOrNull((row as Record<string, unknown>).id)
            const propertyType = trimOrNull((row as Record<string, unknown>).property_type)
            const usageType = trimOrNull((row as Record<string, unknown>).usage_type)
            return {
              localId: assetId,
              applicantScope: (() => {
                const value = trimOrNull((row as Record<string, unknown>).applicant_scope)
                return value === "primary" || value === "co" || value === "both" ? value : null
              })(),
              propertyType:
                propertyType === "eigentumswohnung" ||
                propertyType === "einfamilienhaus" ||
                propertyType === "mehrfamilienhaus" ||
                propertyType === "buerogebaeude"
                  ? propertyType
                  : null,
              description: trimOrNull((row as Record<string, unknown>).description),
              valueAmount: numberOrNull((row as Record<string, unknown>).value_amount),
              livingSpaceSqm: numberOrNull((row as Record<string, unknown>).living_space_sqm),
              usageType:
                usageType === "eigengenutzt" || usageType === "vermietet" || usageType === "beides"
                  ? usageType
                  : null,
              rentedLivingSpaceSqm: numberOrNull((row as Record<string, unknown>).rented_living_space_sqm),
              rentIncomeColdMonthly: numberOrNull((row as Record<string, unknown>).rent_income_cold_monthly),
              rentIncomeWarmMonthly: numberOrNull((row as Record<string, unknown>).rent_income_warm_monthly),
              ancillaryCostsMonthly: numberOrNull((row as Record<string, unknown>).ancillary_costs_monthly),
              loans: (assetId ? realEstateLoansByAssetId.get(assetId) : [])?.map((loan) => ({
                localId: trimOrNull(loan.id),
                remainingDebt: numberOrNull(loan.remaining_debt),
                interestFixedUntil: trimOrNull(loan.interest_fixed_until),
                monthlyRate: numberOrNull(loan.monthly_rate),
              })) ?? [],
            }
          })
          .filter(Boolean) as EuropaceCaseDraft["realEstateAssets"]
      : [],
    additional: {
      birthPlace: trimOrNull((additionalRow as Record<string, unknown> | null)?.birth_place),
      residenceSince: trimOrNull((additionalRow as Record<string, unknown> | null)?.residence_since),
      previousAddressStreet: trimOrNull((additionalRow as Record<string, unknown> | null)?.previous_address_street),
      previousAddressHouseNo: trimOrNull((additionalRow as Record<string, unknown> | null)?.previous_address_house_no),
      previousAddressZip: trimOrNull((additionalRow as Record<string, unknown> | null)?.previous_address_zip),
      previousAddressCity: trimOrNull((additionalRow as Record<string, unknown> | null)?.previous_address_city),
      previousAddressSince: trimOrNull((additionalRow as Record<string, unknown> | null)?.previous_address_since),
      probation: Boolean((additionalRow as Record<string, unknown> | null)?.probation),
      probationMonths: numberOrNull((additionalRow as Record<string, unknown> | null)?.probation_months),
      salaryCount: numberOrNull((additionalRow as Record<string, unknown> | null)?.salary_count),
      householdSize: numberOrNull((additionalRow as Record<string, unknown> | null)?.household_size),
      currentWarmRent: numberOrNull((additionalRow as Record<string, unknown> | null)?.warm_rent_monthly),
      currentWarmRentNone: Boolean((additionalRow as Record<string, unknown> | null)?.warm_rent_not_applicable),
      vehiclesCount: numberOrNull((additionalRow as Record<string, unknown> | null)?.vehicles_count),
      bankAccountHolder: trimOrNull((additionalRow as Record<string, unknown> | null)?.bank_account_holder),
      bankIban: trimOrNull((additionalRow as Record<string, unknown> | null)?.bank_iban),
      bankBic: trimOrNull((additionalRow as Record<string, unknown> | null)?.bank_bic),
      returnedDebitWindow: trimOrNull((additionalRow as Record<string, unknown> | null)?.returned_debit_window),
    },
  }
}
