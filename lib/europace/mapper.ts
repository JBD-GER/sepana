import type { EuropaceCaseDraft } from "@/lib/europace/case"
import { getSandboxIbanDemo, normalizeIbanInput } from "@/lib/banking/iban"
import { normalizePhoneForProviders } from "@/lib/onlinekredit/phone"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeLocalDateOrNull(value: unknown) {
  const trimmed = trimOrNull(value)
  if (!trimmed) return null
  const candidate = trimmed.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null
  const [yearRaw, monthRaw, dayRaw] = candidate.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || year > 9999) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return candidate
}

function normalizeSandboxBankConnection(input: {
  iban: string | null
  bic: string | null
}) {
  const sandboxDemo = getSandboxIbanDemo(input.iban)
  return {
    iban: trimOrNull(sandboxDemo?.iban ?? normalizeIbanInput(input.iban)),
    bic: trimOrNull(sandboxDemo?.bic ?? input.bic)?.toUpperCase() ?? null,
  }
}

function normalizeCountry(value: string | null) {
  const code = String(value ?? "").trim().toUpperCase()
  if (code === "DD") return "DE"
  if (/^[A-Z]{2}$/.test(code)) return code
  return code === "SONSTIGE" ? code : null
}

function mapSalutation(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "herr" || raw === "male" || raw === "m") return "HERR"
  if (raw === "frau" || raw === "female" || raw === "f") return "FRAU"
  return null
}

function mapFamilienstand(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "single" || raw === "ledig") return "LEDIG"
  if (raw === "married" || raw === "verheiratet") return "VERHEIRATET"
  if (raw === "divorced" || raw === "geschieden") return "GESCHIEDEN"
  if (raw === "widowed" || raw === "verwitwet") return "VERWITWET"
  if (raw === "separated" || raw === "getrennt" || raw === "getrennt_lebend") return "GETRENNT_LEBEND"
  if (raw === "partner" || raw === "partnership" || raw === "cohabiting" || raw === "eheähnlich" || raw === "eheaehnlich") {
    return "EHEAEHNLICHE_LEBENSGEMEINSCHAFT"
  }
  if (raw.includes("lebenspartnerschaft")) return "EINGETRAGENE_LEBENSPARTNERSCHAFT"
  return null
}

function mapWohnart(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "rent" || raw === "miete") return "ZUR_MIETE"
  if (raw === "owner" || raw === "eigentum") return "IM_EIGENEN_HAUS"
  if (raw === "with_family" || raw === "bei_familie" || raw === "bei_eltern") return "BEI_DEN_ELTERN"
  if (raw === "other" || raw === "untermiete") return "ZUR_UNTERMIETE"
  return null
}

function mapFinanzierungszweck(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "umschuldung") return "UMSCHULDUNG"
  if (raw === "auto" || raw === "fahrzeug" || raw === "fahrzeugkauf") return "FAHRZEUGKAUF"
  if (raw === "modernisierung" || raw === "modernize" || raw === "pv_anlage" || raw === "renovierung") return "MODERNISIERUNG"
  if (raw === "freie_verwendung" || raw === "hochzeitskredit" || raw === "sonstiges") return "FREIE_VERWENDUNG"
  return null
}

function mapEmployerIndustry(value: string | null) {
  const raw = String(value ?? "").trim().toUpperCase()
  if (!raw) return null

  const aliasMap: Record<string, string> = {
    LANDWIRTSCHAFT: "LANDWIRTSCHAFT_FORSTWIRTSCHAFT_FISCHEREI",
    FORSTWIRTSCHAFT: "LANDWIRTSCHAFT_FORSTWIRTSCHAFT_FISCHEREI",
    FISCHEREI: "LANDWIRTSCHAFT_FORSTWIRTSCHAFT_FISCHEREI",
    ENERGIE: "ENERGIE_WASSERVERSORGUNG_BERGBAU",
    WASSER: "ENERGIE_WASSERVERSORGUNG_BERGBAU",
    BERGBAU: "ENERGIE_WASSERVERSORGUNG_BERGBAU",
    PRODUKTION: "VERARBEITENDES_GEWERBE",
    INDUSTRIE: "VERARBEITENDES_GEWERBE",
    BAU: "BAUGEWERBE",
    HANDEL: "HANDEL",
    LOGISTIK: "VERKEHR_LOGISTIK",
    VERKEHR: "VERKEHR_LOGISTIK",
    IT: "INFORMATION_KOMMUNIKATION",
    INFORMATION: "INFORMATION_KOMMUNIKATION",
    KOMMUNIKATION: "INFORMATION_KOMMUNIKATION",
    VEREIN: "GEMEINNUETZIGE_ORGANISATION",
    NONPROFIT: "GEMEINNUETZIGE_ORGANISATION",
    VERSICHERUNG: "KREDITINSTITUTE_VERSICHERUNGEN",
    BANK: "KREDITINSTITUTE_VERSICHERUNGEN",
    HAUSHALT: "PRIVATE_HAUSHALTE",
    DIENSTLEISTUNG: "DIENSTLEISTUNGEN",
    OEFFENTLICH: "OEFFENTLICHER_DIENST",
    STAAT: "OEFFENTLICHER_DIENST",
    BEHOERDE: "GEBIETSKOERPERSCHAFTEN",
    HOTEL: "HOTEL_GASTRONOMIE",
    GASTRONOMIE: "HOTEL_GASTRONOMIE",
    BILDUNG: "ERZIEHUNG_UNTERRICHT",
    ERZIEHUNG: "ERZIEHUNG_UNTERRICHT",
    SPORT: "KULTUR_SPORT_UNTERHALTUNG",
    KULTUR: "KULTUR_SPORT_UNTERHALTUNG",
    GESUNDHEIT: "GESUNDHEIT_SOZIALWESEN",
    PFLEGE: "GESUNDHEIT_SOZIALWESEN",
    SOZIALWESEN: "GESUNDHEIT_SOZIALWESEN",
  }

  if (raw in aliasMap) return aliasMap[raw]

  const allowed = new Set([
    "LANDWIRTSCHAFT_FORSTWIRTSCHAFT_FISCHEREI",
    "ENERGIE_WASSERVERSORGUNG_BERGBAU",
    "VERARBEITENDES_GEWERBE",
    "BAUGEWERBE",
    "HANDEL",
    "VERKEHR_LOGISTIK",
    "INFORMATION_KOMMUNIKATION",
    "GEMEINNUETZIGE_ORGANISATION",
    "KREDITINSTITUTE_VERSICHERUNGEN",
    "PRIVATE_HAUSHALTE",
    "DIENSTLEISTUNGEN",
    "OEFFENTLICHER_DIENST",
    "GEBIETSKOERPERSCHAFTEN",
    "HOTEL_GASTRONOMIE",
    "ERZIEHUNG_UNTERRICHT",
    "KULTUR_SPORT_UNTERHALTUNG",
    "GESUNDHEIT_SOZIALWESEN",
  ])

  return allowed.has(raw) ? raw : null
}

function mapImmobilienart(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "eigentumswohnung") return "EIGENTUMSWOHNUNG"
  if (raw === "einfamilienhaus") return "EINFAMILIENHAUS"
  if (raw === "mehrfamilienhaus") return "MEHRFAMILIENHAUS"
  if (raw === "buerogebaeude") return "BUEROGEBAEUDE"
  return null
}

function mapNutzungsart(value: string | null) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return null
  if (raw === "eigengenutzt") return "EIGENGENUTZT"
  if (raw === "vermietet") return "VERMIETET"
  if (raw === "beides") return "EIGENGENUTZT_UND_VERMIETET"
  return null
}

function buildFirma(applicant: {
  employerName: string | null
  employerIndustry: string | null
  employerAddressStreet: string | null
  employerAddressHouseNo: string | null
  employerAddressZip: string | null
  employerAddressCity: string | null
  employerAddressCountry: string | null
}) {
  const employerName = trimOrNull(applicant.employerName)
  const employerIndustry = mapEmployerIndustry(applicant.employerIndustry)
  const employerStreet = trimOrNull(applicant.employerAddressStreet)
  const employerHouseNo = trimOrNull(applicant.employerAddressHouseNo)
  const employerZip = trimOrNull(applicant.employerAddressZip)
  const employerCity = trimOrNull(applicant.employerAddressCity)
  const employerCountry = normalizeCountry(applicant.employerAddressCountry) ?? "DE"

  if (!employerName && !employerIndustry && !employerStreet && !employerZip && !employerCity) return null

  const firma: Record<string, unknown> = {
    ...(employerName ? { name: employerName } : {}),
    ...(employerIndustry ? { branche: employerIndustry } : {}),
  }

  if (employerStreet || employerHouseNo || employerZip || employerCity) {
    firma.anschrift = {
      ...(employerStreet ? { strasse: employerStreet } : {}),
      ...(employerHouseNo ? { hausnummer: employerHouseNo } : {}),
      ...(employerZip ? { plz: employerZip } : {}),
      ...(employerCity ? { ort: employerCity } : {}),
      land: employerCountry,
    }
  }

  return Object.keys(firma).length ? firma : null
}

type EuropaceApplicantLike = {
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  salutation: string | null
  title?: string[] | null
  birthName: string | null
  birthCountry: string | null
  email: string | null
  phone: string | null
  phoneBusiness: string | null
  nationality: string | null
  maritalStatus: string | null
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
}

function mapTitles(values: string[] | null | undefined) {
  const titles = new Set<string>()
  for (const rawEntry of values ?? []) {
    const raw = String(rawEntry ?? "").trim().toLowerCase()
    if (!raw) continue
    if (raw === "dr" || raw === "doktor") titles.add("DOKTOR")
    if (raw === "prof" || raw === "prof." || raw === "professor") titles.add("PROFESSOR")
  }
  return titles.size ? Array.from(titles) : null
}

function buildEuropacePersonendatenPayloadForApplicant(
  applicant: EuropaceApplicantLike,
  options?: { birthPlace?: string | null; includeBirthPlace?: boolean; includeMaritalStatus?: boolean; includeContact?: boolean }
) {
  const payload: Record<string, unknown> = {}
  const firstName = trimOrNull(applicant.firstName)
  const lastName = trimOrNull(applicant.lastName)
  const birthDate = normalizeLocalDateOrNull(applicant.birthDate)
  const salutation = mapSalutation(applicant.salutation)
  const titles = mapTitles(applicant.title)
  const birthName = trimOrNull(applicant.birthName)
  const birthCountry = normalizeCountry(applicant.birthCountry)
  const birthPlace = trimOrNull(options?.birthPlace)
  const family = mapFamilienstand(applicant.maritalStatus)
  const email = trimOrNull(applicant.email)
  const phone = normalizePhoneForProviders(applicant.phone)
  const phoneBusiness = normalizePhoneForProviders(applicant.phoneBusiness)

  if (firstName) payload.vorname = firstName
  if (lastName) payload.nachname = lastName
  if (salutation) payload.anrede = salutation
  if (titles?.length) payload.titel = titles
  if (birthDate) payload.geburtsdatum = birthDate
  if (birthCountry) payload.geburtsland = birthCountry
  if (birthName) payload.geburtsname = birthName
  if (options?.includeBirthPlace && birthPlace) payload.geburtsort = birthPlace
  if (options?.includeMaritalStatus && family) payload.familienstand = family
  if (options?.includeContact && email) payload.email = email
  if (options?.includeContact && phone) payload.telefonPrivat = phone
  if (options?.includeContact && phoneBusiness) payload.telefonGeschaeftlich = phoneBusiness

  return Object.keys(payload).length ? payload : null
}

function buildEuropaceHerkunftPayloadForApplicant(applicant: EuropaceApplicantLike, residenceSince: string | null) {
  const nationality = normalizeCountry(applicant.nationality)
  const taxId = trimOrNull(applicant.taxId)
  const normalizedResidenceSince = normalizeLocalDateOrNull(residenceSince)
  if (!nationality && !normalizedResidenceSince && !taxId) return null

  const payload: Record<string, unknown> = {}
  if (nationality) payload.staatsangehoerigkeit = nationality
  if (taxId) payload.steuerId = taxId
  if (normalizedResidenceSince) payload.inDeutschlandSeit = normalizedResidenceSince
  return payload
}

function buildEuropaceWohnsituationPayloadForApplicant(
  applicant: EuropaceApplicantLike,
  options?: {
    residenceSince?: string | null
    householdSize?: number | null
    vehiclesCount?: number | null
    gemeinsamerHaushalt?: boolean | null
    previousAddressStreet?: string | null
    previousAddressHouseNo?: string | null
    previousAddressZip?: string | null
    previousAddressCity?: string | null
    previousAddressSince?: string | null
  }
) {
  const wohnart = mapWohnart(applicant.housingStatus)
  const street = trimOrNull(applicant.addressStreet)
  const houseNo = trimOrNull(applicant.addressHouseNo)
  const zip = trimOrNull(applicant.addressZip)
  const city = trimOrNull(applicant.addressCity)
  const wohnhaftSeit = normalizeLocalDateOrNull(options?.residenceSince)
  const previousStreet = trimOrNull(options?.previousAddressStreet)
  const previousHouseNo = trimOrNull(options?.previousAddressHouseNo)
  const previousZip = trimOrNull(options?.previousAddressZip)
  const previousCity = trimOrNull(options?.previousAddressCity)
  const previousWohnhaftSeit = normalizeLocalDateOrNull(options?.previousAddressSince)
  const householdSize = numberOrNull(options?.householdSize)
  const vehiclesCount = numberOrNull(options?.vehiclesCount)
  const gemeinsamerHaushalt = typeof options?.gemeinsamerHaushalt === "boolean" ? options.gemeinsamerHaushalt : null

  if (
    !wohnart &&
    !street &&
    !houseNo &&
    !zip &&
    !city &&
    householdSize === null &&
    vehiclesCount === null &&
    !wohnhaftSeit &&
    !previousStreet &&
    !previousHouseNo &&
    !previousZip &&
    !previousCity &&
    !previousWohnhaftSeit
  ) {
    return null
  }

  const payload: Record<string, unknown> = {}
  if (wohnart) payload.wohnart = wohnart
  if (householdSize !== null) payload.anzahlPersonenImHaushalt = householdSize
  if (vehiclesCount !== null) payload.anzahlPkw = vehiclesCount
  if (gemeinsamerHaushalt !== null) payload.gemeinsamerHaushalt = gemeinsamerHaushalt

  if (street || zip || city || wohnhaftSeit) {
    payload.anschrift = {
      ...(street ? { strasse: street } : {}),
      ...(houseNo ? { hausnummer: houseNo } : {}),
      ...(zip ? { plz: zip } : {}),
      ...(city ? { ort: city } : {}),
      ...(wohnhaftSeit ? { wohnhaftSeit } : {}),
      land: "DE",
    }
  }

  if (previousStreet || previousZip || previousCity || previousWohnhaftSeit) {
    payload.voranschrift = {
      ...(previousStreet ? { strasse: previousStreet } : {}),
      ...(previousHouseNo ? { hausnummer: previousHouseNo } : {}),
      ...(previousZip ? { plz: previousZip } : {}),
      ...(previousCity ? { ort: previousCity } : {}),
      ...(previousWohnhaftSeit ? { wohnhaftSeit: previousWohnhaftSeit } : {}),
      land: "DE",
    }
  }

  return payload
}

function buildEuropaceBeschaeftigungPayloadForApplicant(
  applicant: EuropaceApplicantLike,
  options?: { probation?: boolean }
) {
  const type = String(applicant.employmentType ?? "").trim().toLowerCase()
  const status = String(applicant.employmentStatus ?? "").trim().toLowerCase()
  const monthlyNet = numberOrNull(applicant.netIncomeMonthly)
  const monthlyOther = numberOrNull(applicant.otherIncomeMonthly)
  const employer = buildFirma(applicant)
  const inProbezeit = Boolean(options?.probation || status === "probation")
  const jobTitle = trimOrNull(applicant.employmentJobTitle)
  const employmentSince = normalizeLocalDateOrNull(applicant.employmentSince)

  if (!type) return null

  const commonEmployment = {
    ...(employer ? { arbeitgeber: employer } : {}),
    ...(jobTitle ? { berufsbezeichnung: jobTitle } : {}),
    ...(status === "fixed_term" ? { befristung: "BEFRISTET" } : {}),
    ...(status === "permanent" ? { befristung: "UNBEFRISTET" } : {}),
    ...(employmentSince ? { beschaeftigtSeit: employmentSince } : {}),
    ...(inProbezeit ? { inProbezeit: true } : {}),
    ...(monthlyNet !== null ? { nettoeinkommenMonatlich: monthlyNet } : {}),
  }

  if (type === "employed") {
    return {
      beschaeftigungsart: "ANGESTELLTER",
      angestellter: {
        beschaeftigungsverhaeltnis: commonEmployment,
      },
    }
  }

  if (type === "civil_servant") {
    return {
      beschaeftigungsart: "BEAMTER",
      beamter: {
        beschaeftigungsverhaeltnis: {
          ...commonEmployment,
          ...(employmentSince ? { verbeamtetSeit: employmentSince } : {}),
        },
      },
    }
  }

  if (type === "self_employed") {
    const yearlyNet = monthlyNet !== null ? monthlyNet * 12 : null
    return {
      beschaeftigungsart: "SELBSTSTAENDIGER",
      selbststaendiger: {
        ...(jobTitle ? { berufsbezeichnung: jobTitle } : {}),
        ...(employmentSince ? { selbststaendigSeit: employmentSince } : {}),
        ...(employer ? { firma: employer } : {}),
        ...(yearlyNet !== null ? { nettoeinkommenJaehrlich: yearlyNet } : {}),
      },
    }
  }

  if (type === "retired") {
    return {
      beschaeftigungsart: "RENTNER",
      rentner: {
        ...(monthlyNet !== null ? { staatlicheRenteMonatlich: monthlyNet } : {}),
      },
    }
  }

  if (type === "unemployed") {
    return {
      beschaeftigungsart: "ARBEITSLOSER",
      arbeitsloser: {
        ...(monthlyNet !== null || monthlyOther !== null
          ? { sonstigesEinkommenMonatlich: (monthlyNet ?? 0) + (monthlyOther ?? 0) }
          : {}),
      },
    }
  }

  return null
}

export function buildEuropacePersonendatenPayload(draft: EuropaceCaseDraft) {
  return (
    buildEuropacePersonendatenPayloadForApplicant(draft.primaryApplicant, {
      birthPlace: draft.additional.birthPlace,
      includeBirthPlace: true,
      includeMaritalStatus: true,
      includeContact: true,
    }) ?? {
      vorname: draft.primaryApplicant.firstName,
      nachname: draft.primaryApplicant.lastName,
    }
  )
}

export function buildEuropaceHerkunftPayload(draft: EuropaceCaseDraft) {
  return buildEuropaceHerkunftPayloadForApplicant(draft.primaryApplicant, draft.additional.residenceSince)
}

export function buildEuropaceWohnsituationPayload(draft: EuropaceCaseDraft) {
  return buildEuropaceWohnsituationPayloadForApplicant(draft.primaryApplicant, {
    residenceSince: draft.additional.residenceSince,
    householdSize: draft.additional.householdSize,
    vehiclesCount: draft.additional.vehiclesCount,
    gemeinsamerHaushalt: draft.secondaryApplicant?.sharedHouseholdWithPrimary ?? null,
    previousAddressStreet: draft.additional.previousAddressStreet,
    previousAddressHouseNo: draft.additional.previousAddressHouseNo,
    previousAddressZip: draft.additional.previousAddressZip,
    previousAddressCity: draft.additional.previousAddressCity,
    previousAddressSince: draft.additional.previousAddressSince,
  })
}

export function buildEuropaceBeschaeftigungPayload(draft: EuropaceCaseDraft) {
  return buildEuropaceBeschaeftigungPayloadForApplicant(draft.primaryApplicant, {
    probation: draft.additional.probation,
  })
}

export function buildEuropaceKontoverbindungPayload(draft: EuropaceCaseDraft, applicantId: string) {
  const { iban, bic } = normalizeSandboxBankConnection({
    iban: draft.additional.bankIban,
    bic: draft.additional.bankBic,
  })
  if (!iban && !bic) return null

  return {
    antragstellerIds: [applicantId],
    ...(iban ? { iban } : {}),
    ...(bic ? { bic } : {}),
  }
}

export function buildEuropaceFinanzierungszweckPayload(draft: EuropaceCaseDraft) {
  return mapFinanzierungszweck(draft.financing.purpose)
}

export function buildEuropaceFinanzierungswunschPayload(draft: EuropaceCaseDraft) {
  const loanAmount = numberOrNull(draft.financing.loanAmountRequested)
  const termMonths = numberOrNull(draft.financing.termMonths)
  if (loanAmount === null && termMonths === null) return null

  return {
    ...(loanAmount !== null ? { kreditbetrag: loanAmount } : {}),
    ...(termMonths !== null ? { laufzeitInMonaten: termMonths } : {}),
    provisionswunschInProzent: 10,
  }
}

export function buildEuropaceMietausgabePayload(
  draft: EuropaceCaseDraft,
  applicantIds: string[]
) {
  const amount = numberOrNull(draft.additional.currentWarmRent)
  const hasWarmRent = draft.primaryApplicant.housingStatus === "rent" || draft.primaryApplicant.housingStatus === "other"
  const warmRentSuppressed = Boolean(draft.additional.currentWarmRentNone)
  const ids = applicantIds.map((entry) => trimOrNull(entry)).filter(Boolean) as string[]

  if (!ids.length) return null
  if (warmRentSuppressed || !hasWarmRent || amount === null || amount <= 0) return null

  return {
    antragstellerIds: ids,
    betragMonatlich: amount,
  }
}

export function buildEuropaceKindPayloads(
  draft: EuropaceCaseDraft,
  applicantIds: { primaryApplicantId: string; secondaryApplicantId?: string | null }
) {
  if (!trimOrNull(applicantIds.primaryApplicantId)) return []

  let childBenefitIndex = 0

  return draft.children
    .map((child) => {
      const name = trimOrNull(child.name)
      if (!name) return null

      const payload: Record<string, unknown> = {
        name,
      }

      // Europace child writes are household-level. Do not send applicant links here because
      // the current schema rejects them for `Kind`.

      if (child.childBenefit) {
        const kindergeldFuer =
          childBenefitIndex < 2
            ? "ERSTES_ODER_ZWEITES_KIND"
            : childBenefitIndex === 2
              ? "DRITTES_KIND"
              : "AB_VIERTEM_KIND"
        payload.kindergeldFuer = kindergeldFuer
        childBenefitIndex += 1
      }

      const maintenanceAmount = numberOrNull(child.maintenanceIncomeMonthly)
      if (maintenanceAmount !== null && maintenanceAmount > 0) {
        payload.unterhaltseinnahmenMonatlich = maintenanceAmount
      }

      return payload
    })
    .filter(Boolean) as Array<Record<string, unknown>>
}

function resolveApplicantIdsForScope(
  scope: "primary" | "co" | "both" | null,
  applicantIds: { primaryApplicantId: string; secondaryApplicantId?: string | null }
) {
  const primaryApplicantId = trimOrNull(applicantIds.primaryApplicantId)
  const secondaryApplicantId = trimOrNull(applicantIds.secondaryApplicantId)
  if (!primaryApplicantId) return [] as string[]

  if (scope === "co") {
    return secondaryApplicantId ? [secondaryApplicantId] : [primaryApplicantId]
  }

  if (scope === "both") {
    return [primaryApplicantId, secondaryApplicantId].filter(Boolean) as string[]
  }

  return [primaryApplicantId]
}

export function buildEuropaceLiabilityPayloads(
  draft: EuropaceCaseDraft,
  applicantIds: { primaryApplicantId: string; secondaryApplicantId?: string | null }
) {
  const grouped = {
    ratenkredit: [] as Array<Record<string, unknown>>,
    dispositionskredit: [] as Array<Record<string, unknown>>,
    kreditkarte: [] as Array<Record<string, unknown>>,
    privates_leasing: [] as Array<Record<string, unknown>>,
    sonstige_verbindlichkeit: [] as Array<Record<string, unknown>>,
  }

  for (const row of draft.liabilities) {
    const targetApplicantIds = resolveApplicantIdsForScope(row.applicantScope, applicantIds)
    if (!targetApplicantIds.length) continue

    const creditor = trimOrNull(row.creditor)
    const monthlyRate = numberOrNull(row.monthlyRate)
    const finalInstallment = numberOrNull(row.finalInstallment)
    const lastRateDate = normalizeLocalDateOrNull(row.lastRateDate)
    const currentBalance = numberOrNull(row.currentBalance)
    const originalAmount = numberOrNull(row.originalAmount)
    const firstPaymentDate = normalizeLocalDateOrNull(row.firstPaymentDate)
    const utilizedAmount = numberOrNull(row.utilizedAmount)
    const creditLimit = numberOrNull(row.creditLimit)
    const interestRate = numberOrNull(row.interestRate)
    const iban = trimOrNull(row.iban)
    const bic = trimOrNull(row.bic)
    const refinance = row.refinance === null || row.refinance === undefined ? null : Boolean(row.refinance)

    const basePayload: Record<string, unknown> = {
      antragstellerIds: targetApplicantIds,
      ...(creditor ? { glaeubiger: creditor } : {}),
    }

    const hasRelevantData =
      Boolean(creditor) ||
      monthlyRate !== null ||
      finalInstallment !== null ||
      Boolean(lastRateDate) ||
      currentBalance !== null ||
      originalAmount !== null ||
      Boolean(firstPaymentDate) ||
      utilizedAmount !== null ||
      creditLimit !== null ||
      interestRate !== null ||
      Boolean(iban) ||
      Boolean(bic) ||
      refinance === true

    if (!hasRelevantData) continue

    if (row.liabilityType === "ratenkredit" || row.liabilityType === "sonstige_verbindlichkeit") {
      grouped[row.liabilityType].push({
        ...basePayload,
        ...(refinance !== null ? { abloesen: refinance } : {}),
        ...(monthlyRate !== null ? { rateMonatlich: monthlyRate } : {}),
        ...(finalInstallment !== null ? { schlussrate: finalInstallment } : {}),
        ...(lastRateDate ? { datumLetzteRate: lastRateDate } : {}),
        ...(currentBalance !== null ? { restschuld: currentBalance } : {}),
        ...(originalAmount !== null ? { urspruenglicherKreditbetrag: originalAmount } : {}),
        ...(firstPaymentDate ? { datumErsteZahlung: firstPaymentDate } : {}),
        ...(refinance && iban ? { iban } : {}),
        ...(refinance && bic ? { bic } : {}),
      })
      continue
    }

    if (row.liabilityType === "dispositionskredit") {
      grouped.dispositionskredit.push({
        ...basePayload,
        ...(refinance !== null ? { abloesen: refinance } : {}),
        ...(utilizedAmount !== null ? { beanspruchterBetrag: utilizedAmount } : {}),
        ...(creditLimit !== null ? { verfuegungsrahmen: creditLimit } : {}),
        ...(interestRate !== null ? { zinssatz: interestRate } : {}),
        ...(refinance && iban ? { iban } : {}),
        ...(refinance && bic ? { bic } : {}),
      })
      continue
    }

    if (row.liabilityType === "kreditkarte") {
      grouped.kreditkarte.push({
        ...basePayload,
        ...(refinance !== null ? { abloesen: refinance } : {}),
        ...(monthlyRate !== null ? { rateMonatlich: monthlyRate } : {}),
        ...(utilizedAmount !== null ? { beanspruchterBetrag: utilizedAmount } : {}),
        ...(creditLimit !== null ? { verfuegungsrahmen: creditLimit } : {}),
        ...(interestRate !== null ? { zinssatz: interestRate } : {}),
        ...(refinance && iban ? { iban } : {}),
        ...(refinance && bic ? { bic } : {}),
      })
      continue
    }

    if (row.liabilityType === "privates_leasing") {
      grouped.privates_leasing.push({
        ...basePayload,
        ...(monthlyRate !== null ? { rateMonatlich: monthlyRate } : {}),
        ...(finalInstallment !== null ? { schlussrate: finalInstallment } : {}),
        ...(lastRateDate ? { datumLetzteRate: lastRateDate } : {}),
      })
    }
  }

  return grouped
}

export function buildEuropaceImmobiliePayloads(
  draft: EuropaceCaseDraft,
  applicantIds: { primaryApplicantId: string; secondaryApplicantId?: string | null }
) {
  return draft.realEstateAssets
    .map((asset) => {
      const targetApplicantIds = resolveApplicantIdsForScope(asset.applicantScope, applicantIds)
      if (!targetApplicantIds.length) return null

      const immobilienart = mapImmobilienart(asset.propertyType)
      const nutzungsart = mapNutzungsart(asset.usageType)
      const bezeichnung = trimOrNull(asset.description)
      const wert = numberOrNull(asset.valueAmount)
      const wohnflaeche = numberOrNull(asset.livingSpaceSqm)
      const vermieteteWohnflaeche = numberOrNull(asset.rentedLivingSpaceSqm)
      const mieteinnahmenKaltMonatlich = numberOrNull(asset.rentIncomeColdMonthly)
      const mieteinnahmenWarmMonatlich = numberOrNull(asset.rentIncomeWarmMonthly)
      const nebenkostenMonatlich = numberOrNull(asset.ancillaryCostsMonthly)

      const darlehen = asset.loans
        .map((loan) => {
          const restschuld = numberOrNull(loan.remainingDebt)
          const zinsbindungBis = normalizeLocalDateOrNull(loan.interestFixedUntil)
          const rateMonatlich = numberOrNull(loan.monthlyRate)
          if (restschuld === null && !zinsbindungBis && rateMonatlich === null) return null
          return {
            ...(restschuld !== null ? { restschuld } : {}),
            ...(zinsbindungBis ? { zinsbindungBis } : {}),
            ...(rateMonatlich !== null ? { rateMonatlich } : {}),
          }
        })
        .filter(Boolean) as Array<Record<string, unknown>>

      const hasRelevantData =
        targetApplicantIds.length > 0 &&
        (immobilienart ||
          nutzungsart ||
          bezeichnung ||
          wert !== null ||
          wohnflaeche !== null ||
          vermieteteWohnflaeche !== null ||
          mieteinnahmenKaltMonatlich !== null ||
          mieteinnahmenWarmMonatlich !== null ||
          nebenkostenMonatlich !== null ||
          darlehen.length > 0)

      if (!hasRelevantData) return null

      return {
        antragstellerIds: targetApplicantIds,
        ...(bezeichnung ? { bezeichnung } : {}),
        ...(immobilienart ? { immobilienart } : {}),
        ...(nutzungsart ? { nutzungsart } : {}),
        ...(wert !== null ? { wert } : {}),
        ...(wohnflaeche !== null ? { wohnflaeche } : {}),
        ...(vermieteteWohnflaeche !== null ? { vermieteteWohnflaeche } : {}),
        ...(mieteinnahmenKaltMonatlich !== null ? { mieteinnahmenKaltMonatlich } : {}),
        ...(mieteinnahmenWarmMonatlich !== null ? { mieteinnahmenWarmMonatlich } : {}),
        ...(nebenkostenMonatlich !== null ? { nebenkostenMonatlich } : {}),
        ...(darlehen.length ? { darlehen } : {}),
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>
}

export function buildEuropaceSecondaryPersonendatenPayload(draft: EuropaceCaseDraft) {
  if (!draft.secondaryApplicant) return null
  return buildEuropacePersonendatenPayloadForApplicant(draft.secondaryApplicant, {
    birthPlace: draft.secondaryApplicant.birthPlace,
    includeBirthPlace: true,
    includeMaritalStatus: true,
    includeContact: true,
  })
}

export function buildEuropaceSecondaryBeschaeftigungPayload(draft: EuropaceCaseDraft) {
  if (!draft.secondaryApplicant) return null
  return buildEuropaceBeschaeftigungPayloadForApplicant(draft.secondaryApplicant, {
    probation: false,
  })
}

export function buildEuropaceSecondaryHerkunftPayload(draft: EuropaceCaseDraft) {
  if (!draft.secondaryApplicant) return null
  return buildEuropaceHerkunftPayloadForApplicant(draft.secondaryApplicant, draft.additional.residenceSince)
}

export function buildEuropaceSecondaryWohnsituationPayload(draft: EuropaceCaseDraft) {
  if (!draft.secondaryApplicant) return null
  if (draft.secondaryApplicant.sharedHouseholdWithPrimary) {
    return buildEuropaceWohnsituationPayloadForApplicant(
      {
        ...draft.secondaryApplicant,
        addressStreet: draft.primaryApplicant.addressStreet,
        addressHouseNo: draft.primaryApplicant.addressHouseNo,
        addressZip: draft.primaryApplicant.addressZip,
        addressCity: draft.primaryApplicant.addressCity,
        housingStatus: draft.primaryApplicant.housingStatus,
      },
      {
        residenceSince: draft.additional.residenceSince,
        householdSize: draft.additional.householdSize,
        vehiclesCount: draft.additional.vehiclesCount,
        gemeinsamerHaushalt: true,
        previousAddressStreet: draft.additional.previousAddressStreet,
        previousAddressHouseNo: draft.additional.previousAddressHouseNo,
        previousAddressZip: draft.additional.previousAddressZip,
        previousAddressCity: draft.additional.previousAddressCity,
        previousAddressSince: draft.additional.previousAddressSince,
      }
    )
  }

  return buildEuropaceWohnsituationPayloadForApplicant(draft.secondaryApplicant, {
    residenceSince: draft.secondaryApplicant.residenceSince,
    householdSize: draft.secondaryApplicant.householdPersons,
    vehiclesCount: draft.secondaryApplicant.vehicleCount,
    gemeinsamerHaushalt: draft.secondaryApplicant.sharedHouseholdWithPrimary,
    previousAddressStreet: draft.secondaryApplicant.previousAddressStreet,
    previousAddressHouseNo: draft.secondaryApplicant.previousAddressHouseNo,
    previousAddressZip: draft.secondaryApplicant.previousAddressZip,
    previousAddressCity: draft.secondaryApplicant.previousAddressCity,
    previousAddressSince: draft.secondaryApplicant.previousAddressSince,
  })
}
