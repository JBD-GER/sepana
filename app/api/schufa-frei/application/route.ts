import { NextResponse } from "next/server"
import { looksLikeIban, normalizeIbanInput } from "@/lib/banking/iban"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { updateCaseStatusCompat } from "@/lib/caseStatusCompat"
import { processSkagLead } from "@/lib/skag/client"
import { hasDedicatedSkagVariantCredentials, type SkagApiVariant } from "@/lib/skag/config"
import { buildSkagOpenLeadPayload } from "@/lib/skag/openMapper"
import { buildSkagStandardLeadPayload } from "@/lib/skag/standardMapper"
import { buildEmailHtml, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import {
  getSchufaFreeFamilyLabel,
  getSchufaFreeProfessionLabel,
  requiresSchufaFreeEmployerData,
} from "@/lib/schufa-frei/application"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"
const DEFAULT_ADMIN_RECIPIENT = "info@sepana.de"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function isBankSubmissionBundleDocument(input: { document_kind?: string | null; file_path?: string | null }) {
  const documentKind = String(input.document_kind ?? "").trim().toLowerCase()
  if (documentKind === "bank_submission_bundle") return true

  const filePath = String(input.file_path ?? "").trim().toLowerCase()
  return filePath.includes("/bank-submission/")
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null
}

function moneyOrNull(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (!digits) return null
  const numeric = Number(digits)
  return Number.isFinite(numeric) ? numeric : null
}

function decimalOrNull(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function asIsoDate(value: unknown) {
  const raw = trimOrNull(value)
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function digitsOnly(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits || null
}

function normalizeZipcode(value: unknown) {
  const digits = digitsOnly(value)
  return digits ? digits.slice(0, 5) : null
}

function normalizeNationality(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
  return normalized.length === 2 ? normalized : null
}

function parseAdminRecipients() {
  const configured = [
    process.env.PRIVATKREDIT_NOTIFY_TO,
    process.env.ADMIN_NOTIFY_TO,
    process.env.LIVE_QUEUE_ALERT_TO,
    process.env.INVITE_ACCEPTED_NOTIFY_TO,
  ]
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .join(" ")

  return Array.from(
    new Set(
      `${configured} ${DEFAULT_ADMIN_RECIPIENT}`
        .split(/[;,\s]+/g)
        .map((entry) => entry.trim().replace(/^["'<]+|[>"']+$/g, "").toLowerCase())
        .filter((entry) => entry.includes("@"))
    )
  )
}

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  return new URL(req.url).origin
}

async function notifyAdminSubmitted(input: {
  caseId: string
  caseRef: string | null
  firstName: string
  lastName: string
  email: string
  phonePrimary: string
  dateOfBirth: string
  loanAmountRequested: number | null
  termMonths: number | null
  netIncomeMonthly: number | null
  professionLabel: string
  uploadedDocumentCount: number
  advisorCaseUrl: string
}) {
  const recipients = parseAdminRecipients()
  if (!recipients.length) return

  const steps = [
    input.caseRef ? `Fall: ${input.caseRef}` : `Fall-ID: ${input.caseId}`,
    `Name: ${`${input.firstName} ${input.lastName}`.trim()}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phonePrimary}`,
    `Geburtsdatum: ${input.dateOfBirth}`,
    input.loanAmountRequested && input.termMonths
      ? `Anfrage: ${input.loanAmountRequested.toLocaleString("de-DE")} EUR / ${input.termMonths} Monate`
      : null,
    input.netIncomeMonthly ? `Nettoeinkommen: ${input.netIncomeMonthly.toLocaleString("de-DE")} EUR` : null,
    input.professionLabel ? `Beschäftigungsverhältnis: ${input.professionLabel}` : null,
    `Dokumente bereits im Fall vorhanden: ${input.uploadedDocumentCount}`,
    "Der Vollantrag wurde erfolgreich abgesendet und an SEPANA uebermittelt.",
  ].filter((entry): entry is string => Boolean(entry))

  const html = buildEmailHtml({
    title: "Neuer Vollantrag: Kredit ohne Schufa",
    intro: input.caseRef
      ? `Der Vollantrag fuer den Fall ${input.caseRef} wurde erfolgreich abgeschlossen.`
      : "Ein Vollantrag fuer Kredit ohne Schufa wurde erfolgreich abgeschlossen.",
    steps,
    ctaLabel: "Fall ansehen",
    ctaUrl: input.advisorCaseUrl,
    eyebrow: "SEPANA - Schufa-frei Vollantrag",
    supportNote: "Diese Nachricht wurde automatisch nach dem Abschluss des zweiten Formulars versendet.",
  })

  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: input.caseRef
          ? `Neuer Vollantrag: Kredit ohne Schufa (${input.caseRef})`
          : "Neuer Vollantrag: Kredit ohne Schufa",
        html,
      }).catch(() => null)
    )
  )
}

function isEmail(value: string | null) {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isPhone(value: string | null) {
  return (digitsOnly(value)?.length ?? 0) >= 6
}

function parseChildrenAges(value: unknown, count: number) {
  if (count <= 0) return []

  return String(value ?? "")
    .split(/[;,]+/g)
    .map((entry) => Number(String(entry).replace(/[^\d]/g, "")))
    .filter((entry) => Number.isFinite(entry) && entry >= 0)
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "boolean") return true
  return String(value).trim().length > 0
}

function isSpouseRequired(familySituation: number | null) {
  return familySituation === 2
}

function extractMissingColumnName(error: unknown) {
  const err = error as { message?: string } | null
  const message = String(err?.message ?? "")
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i)
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1]

  const postgresMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']?/i)
  if (postgresMatch?.[1]) return postgresMatch[1]

  return null
}

async function upsertSchufaFreeDetailsWithFallback(
  admin: ReturnType<typeof supabaseAdmin>,
  payload: Record<string, unknown>
) {
  const mutablePayload = { ...payload }
  const removedColumns: string[] = []

  while (true) {
    const query = await admin.from("case_schufa_free_details").upsert(mutablePayload, { onConflict: "case_id" })
    if (!query.error) return { error: null as null, removedColumns }

    const missingColumn = extractMissingColumnName(query.error)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return { error: query.error, removedColumns }
  }
}

async function updateSchufaFreeDetailsWithFallback(
  admin: ReturnType<typeof supabaseAdmin>,
  caseId: string,
  payload: Record<string, unknown>
) {
  const mutablePayload = { ...payload }
  const removedColumns: string[] = []

  while (true) {
    const query = await admin.from("case_schufa_free_details").update(mutablePayload).eq("case_id", caseId)
    if (!query.error) return { error: null as null, removedColumns }

    const missingColumn = extractMissingColumnName(query.error)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return { error: query.error, removedColumns }
  }
}

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  gender: "Anrede",
  firstName: "Vorname",
  lastName: "Nachname",
  dateOfBirth: "Geburtsdatum",
  placeOfBirth: "Geburtsort",
  nationality: "Staatsangehoerigkeit",
  street: "Strasse",
  houseNumber: "Hausnummer",
  zipcode: "PLZ",
  city: "Ort",
  phonePrimary: "Telefon",
  email: "E-Mail",
  familySituation: "Familienstand",
  childrenTaxAllowance: "Kinderfreibetrag",
  numberOfChildren: "Anzahl Kinder",
  childrenAgesCsv: "Kinderalter",
  residenceType: "Wohnsituation",
  rentMonthly: "Warmmiete / Belastung pro Monat",
  taxClass: "Steuerklasse",
  profession: "Beschäftigungsverhältnis",
  professionBeginDate: "Im Beruf seit",
  employerName: "Arbeitgeber",
  employerZipcode: "Arbeitgeber PLZ",
  employerCity: "Arbeitgeber Ort",
  netIncomeMonthly: "Nettoeinkommen monatlich",
  bankName: "Name der Bank",
  iban: "IBAN",
  spouseFirstName: "Vorname Ehepartner",
  spouseBirthDate: "Geburtsdatum Ehepartner",
  spouseBirthName: "Geburtsname Ehepartner",
  spouseIncomeMonthly: "Einkommen Ehepartner",
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const caseId = trimOrNull(body?.caseId)
    const caseRef = trimOrNull(body?.caseRef)
    const accessToken = trimOrNull(body?.accessToken)
    const form = (body?.form ?? null) as Record<string, unknown> | null

    if (!caseId || !caseRef || !accessToken || !form) {
      return NextResponse.json({ ok: false, error: "Fehlende Felder." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const skagVariant: SkagApiVariant = hasDedicatedSkagVariantCredentials("open") ? "open" : "standard"
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "schufa_frei",
    })

    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "Link ungueltig oder abgelaufen." }, { status: access.status })
    }

    const [existingDetailsResult, existingApplicantResult, customerAuthResult] = await Promise.all([
      admin.from("case_schufa_free_details").select("email").eq("case_id", caseId).maybeSingle(),
      admin.from("case_applicants").select("email").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
      access.caseRow.customer_id
        ? admin.auth.admin.getUserById(access.caseRow.customer_id)
        : Promise.resolve({ data: null as { user?: { email?: string | null } | null } | null }),
    ])

    const customerAuthEmail = trimOrNull(customerAuthResult?.data?.user?.email)?.toLowerCase() ?? null
    if (existingDetailsResult.error) throw existingDetailsResult.error
    if (existingApplicantResult.error) throw existingApplicantResult.error
    const existingDetailsEmail = trimOrNull(existingDetailsResult.data?.email)?.toLowerCase() ?? null
    const existingApplicantEmail = trimOrNull(existingApplicantResult.data?.email)?.toLowerCase() ?? null

    const gender = integerOrNull(form.gender)
    const firstName = trimOrNull(form.firstName)
    const lastName = trimOrNull(form.lastName)
    const birthName = trimOrNull(form.birthName)
    const dateOfBirth = asIsoDate(form.dateOfBirth)
    const placeOfBirth = trimOrNull(form.placeOfBirth)
    const nationality = normalizeNationality(form.nationality)
    const familySituation = integerOrNull(form.familySituation)
    const spouseRequired = isSpouseRequired(familySituation)
    const childrenTaxAllowance = decimalOrNull(form.childrenTaxAllowance)
    const numberOfChildren = Math.max(0, integerOrNull(form.numberOfChildren) ?? 0)
    const childrenAges = parseChildrenAges(form.childrenAgesCsv, numberOfChildren)
    const childrenAgesCsv = childrenAges.length ? childrenAges.join(",") : null
    const street = trimOrNull(form.street)
    const houseNumber = trimOrNull(form.houseNumber)
    const zipcode = normalizeZipcode(form.zipcode)
    const city = trimOrNull(form.city)
    const phonePrimary = digitsOnly(form.phonePrimary)
    const phoneSecondary = digitsOnly(form.phoneSecondary)
    const submittedEmail = trimOrNull(form.email)?.toLowerCase() ?? null
    const email = customerAuthEmail ?? existingDetailsEmail ?? existingApplicantEmail ?? submittedEmail
    const residenceType = integerOrNull(form.residenceType)
    const rentMonthly = moneyOrNull(form.rentMonthly)
    const residentSince = asIsoDate(form.residentSince)
    const taxClass = integerOrNull(form.taxClass)
    const profession = integerOrNull(form.profession)
    const professionBeginDate = asIsoDate(form.professionBeginDate)
    const employerName = trimOrNull(form.employerName)
    const employerStreet = trimOrNull(form.employerStreet)
    const employerHouse = trimOrNull(form.employerHouse)
    const employerZipcode = normalizeZipcode(form.employerZipcode)
    const employerCity = trimOrNull(form.employerCity)
    const employerPhone = digitsOnly(form.employerPhone)
    const employerEmail = trimOrNull(form.employerEmail)?.toLowerCase() ?? null
    const netIncomeMonthly = moneyOrNull(form.netIncomeMonthly)
    const additionalIncomeMonthly = moneyOrNull(form.additionalIncomeMonthly)
    const additionalIncomeBeginDate = asIsoDate(form.additionalIncomeBeginDate)
    const employmentRelationshipLimited = Boolean(form.employmentRelationshipLimited)
    const wageGarnishmentAssignment = Boolean(form.wageGarnishmentAssignment)
    const bankName = trimOrNull(form.bankName)
    const iban = normalizeIbanInput(form.iban)
    const spouseFirstName = trimOrNull(form.spouseFirstName)
    const spouseBirthDate = asIsoDate(form.spouseBirthDate)
    const spouseBirthName = trimOrNull(form.spouseBirthName)
    const spouseIncomeMonthly = moneyOrNull(form.spouseIncomeMonthly)
    const ratenschutzOptIn = Boolean(form.ratenschutzOptIn)
    const familySituationLabel = getSchufaFreeFamilyLabel(familySituation) ?? String(familySituation ?? "")
    const professionLabel = getSchufaFreeProfessionLabel(profession) ?? String(profession ?? "")
    const employerRequired = requiresSchufaFreeEmployerData(profession)

    const missing = [
      ["gender", hasValue(gender)],
      ["firstName", hasValue(firstName)],
      ["lastName", hasValue(lastName)],
      ["dateOfBirth", hasValue(dateOfBirth)],
      ["placeOfBirth", hasValue(placeOfBirth)],
      ["nationality", hasValue(nationality)],
      ["street", hasValue(street)],
      ["houseNumber", hasValue(houseNumber)],
      ["zipcode", hasValue(zipcode)],
      ["city", hasValue(city)],
      ["phonePrimary", hasValue(phonePrimary)],
      ["email", hasValue(email)],
      ["familySituation", hasValue(familySituation)],
      ["childrenTaxAllowance", numberOfChildren > 0 ? hasValue(childrenTaxAllowance) : true],
      ["numberOfChildren", hasValue(numberOfChildren)],
      ["residenceType", hasValue(residenceType)],
      ["rentMonthly", hasValue(rentMonthly)],
      ["taxClass", hasValue(taxClass)],
      ["profession", hasValue(profession)],
      ["professionBeginDate", hasValue(professionBeginDate)],
      ["netIncomeMonthly", hasValue(netIncomeMonthly)],
      ["bankName", hasValue(bankName)],
      ["iban", hasValue(iban)],
      ["childrenAgesCsv", numberOfChildren > 0 ? childrenAges.length >= numberOfChildren : true],
      ["employerName", employerRequired ? hasValue(employerName) : true],
      ["employerZipcode", employerRequired ? hasValue(employerZipcode) : true],
      ["employerCity", employerRequired ? hasValue(employerCity) : true],
      ["spouseFirstName", spouseRequired ? hasValue(spouseFirstName) : true],
      ["spouseBirthDate", spouseRequired ? hasValue(spouseBirthDate) : true],
      ["spouseBirthName", spouseRequired ? hasValue(spouseBirthName) : true],
      ["spouseIncomeMonthly", spouseRequired ? hasValue(spouseIncomeMonthly) : true],
    ]
      .filter(([, valid]) => !valid)
      .map(([key]) => key as string)

    if (missing.length) {
      const missingLabels = missing.map((key) => REQUIRED_FIELD_LABELS[key] ?? key)
      return NextResponse.json(
        { ok: false, error: `Bitte Pflichtfelder ausfuellen: ${missingLabels.join(", ")}` },
        { status: 400 }
      )
    }

    if (![1, 2].includes(gender ?? 0)) {
      return NextResponse.json({ ok: false, error: "Anrede ist ungueltig." }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "E-Mail ist ungueltig." }, { status: 400 })
    }
    if (!isPhone(phonePrimary)) {
      return NextResponse.json({ ok: false, error: "Telefon ist ungueltig." }, { status: 400 })
    }
    if ((zipcode?.length ?? 0) !== 5) {
      return NextResponse.json({ ok: false, error: "PLZ muss 5-stellig sein." }, { status: 400 })
    }
    if (employerRequired && (employerZipcode?.length ?? 0) !== 5) {
      return NextResponse.json({ ok: false, error: "Arbeitgeber-PLZ muss 5-stellig sein." }, { status: 400 })
    }
    if (!familySituation || familySituation < 1 || familySituation > 6) {
      return NextResponse.json({ ok: false, error: "Familienstand ist ungueltig." }, { status: 400 })
    }
    if (!profession || profession < 1 || profession > 8) {
      return NextResponse.json({ ok: false, error: "Beruf ist ungueltig." }, { status: 400 })
    }
    const maxTaxClass = skagVariant === "standard" ? 5 : 6
    if (!taxClass || taxClass < 1 || taxClass > maxTaxClass) {
      return NextResponse.json(
        {
          ok: false,
          error:
            skagVariant === "standard"
              ? "Steuerklasse ist ungueltig. In der aktuell konfigurierten SEPANA-Standardstrecke sind nur Steuerklassen 1 bis 5 moeglich."
              : "Steuerklasse ist ungueltig.",
        },
        { status: 400 }
      )
    }
    if (!looksLikeIban(iban)) {
      return NextResponse.json({ ok: false, error: "IBAN ist ungueltig." }, { status: 400 })
    }
    if (numberOfChildren > 10) {
      return NextResponse.json({ ok: false, error: "Maximal 10 Kinder koennen erfasst werden." }, { status: 400 })
    }
    if (numberOfChildren > 0 && childrenAges.length < numberOfChildren) {
      return NextResponse.json({ ok: false, error: "Bitte das Alter aller Kinder angeben." }, { status: 400 })
    }
    if (childrenTaxAllowance !== null && (childrenTaxAllowance < 0 || childrenTaxAllowance > 10)) {
      return NextResponse.json({ ok: false, error: "Kinderfreibetrag ist ungueltig." }, { status: 400 })
    }

    const now = new Date().toISOString()
    const detailPayload = {
      case_id: caseId,
      gender,
      birth_name: birthName,
      date_of_birth: dateOfBirth,
      place_of_birth: placeOfBirth,
      nationality,
      family_situation: familySituation,
      tax_child: childrenTaxAllowance,
      dependent_children_count: numberOfChildren,
      children_ages_csv: childrenAgesCsv,
      street,
      house_number: houseNumber,
      zipcode,
      city,
      phone_primary: phonePrimary,
      phone_secondary: phoneSecondary,
      email,
      residence_type: residenceType,
      rent_monthly: rentMonthly,
      resident_since: residentSince,
      tax_class: taxClass,
      profession,
      profession_begin_date: professionBeginDate,
      employer_name: employerName,
      employer_street: employerStreet,
      employer_house: employerHouse,
      employer_zipcode: employerZipcode,
      employer_city: employerCity,
      employer_phone: employerPhone,
      employer_email: employerEmail,
      net_income_monthly: netIncomeMonthly,
      additional_income_monthly: additionalIncomeMonthly,
      additional_income_begin_date: additionalIncomeBeginDate,
      employment_relationship_limited: employmentRelationshipLimited,
      wage_garnishment_assignment: wageGarnishmentAssignment,
      bank_name: bankName,
      iban,
      spouse_first_name: spouseFirstName,
      spouse_birth_date: spouseBirthDate,
      spouse_birth_name: spouseBirthName,
      spouse_income_monthly: spouseIncomeMonthly,
      ratenschutz_opt_in: ratenschutzOptIn,
      ratenschutz_opt_in_at: ratenschutzOptIn ? now : null,
      completed_application_at: now,
      updated_at: now,
    }

    const detailUpsert = await upsertSchufaFreeDetailsWithFallback(admin, detailPayload)
    if (detailUpsert.error) throw detailUpsert.error
    if (ratenschutzOptIn && detailUpsert.removedColumns.includes("ratenschutz_opt_in")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ratenschutz konnte nicht gespeichert werden, weil die DB-Spalte fehlt. Bitte zuerst die Migration fuer ratenschutz_opt_in ausfuehren.",
        },
        { status: 500 }
      )
    }

    const applicantPayload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phonePrimary,
      birth_date: dateOfBirth,
      marital_status: familySituationLabel,
      employment_type: professionLabel,
      net_income_monthly: netIncomeMonthly,
      address_street: street && houseNumber ? `${street} ${houseNumber}` : street,
      address_zip: zipcode,
      address_city: city,
    }

    const existingApplicant = await admin
      .from("case_applicants")
      .select("id")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()

    if (existingApplicant.data?.id) {
      const applicantUpdate = await admin.from("case_applicants").update(applicantPayload).eq("id", existingApplicant.data.id)
      if (applicantUpdate.error) throw applicantUpdate.error
    } else {
      const applicantInsert = await admin.from("case_applicants").insert({
        case_id: caseId,
        role: "primary",
        ...applicantPayload,
        created_by: access.caseRow.customer_id ?? null,
      })
      if (applicantInsert.error) throw applicantInsert.error
    }

    const { data: details } = await admin.from("case_schufa_free_details").select("*").eq("case_id", caseId).maybeSingle()
    const { data: applicant } = await admin
      .from("case_applicants")
      .select("*")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()

    const mergedDetails = { ...(details ?? {}), ...detailPayload }
    const payload =
      skagVariant === "open"
        ? buildSkagOpenLeadPayload({
            applicant: applicant ?? null,
            details: mergedDetails as Parameters<typeof buildSkagOpenLeadPayload>[0]["details"],
            clientId: caseRef || caseId,
          })
        : buildSkagStandardLeadPayload({
            applicant: applicant ?? null,
            details: mergedDetails as Parameters<typeof buildSkagStandardLeadPayload>[0]["details"],
          })

    const skagResult = await processSkagLead(payload, skagVariant)
    if (!skagResult.creditId) {
      return NextResponse.json(
        { ok: false, error: "SEPANA hat keine credit_id zurueckgegeben.", raw: skagResult.raw ?? skagResult.rawText },
        { status: 502 }
      )
    }

    const syncUpsert = await admin.from("case_skag_sync").upsert(
      {
        case_id: caseId,
        api_variant: skagVariant,
        skag_client_id: skagResult.clientId,
        skag_credit_id: skagResult.creditId,
        last_submit_at: now,
        last_status_alias: "submitted",
        last_status_description: "Lead an SEPANA uebermittelt",
        raw_last_response: skagResult.raw ?? null,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "case_id" }
    )
    if (syncUpsert.error) throw syncUpsert.error

    const detailUpdate = await updateSchufaFreeDetailsWithFallback(admin, caseId, {
      submitted_to_skag_at: now,
      updated_at: now,
    })
    if (detailUpdate.error) throw detailUpdate.error

    await updateCaseStatusCompat(admin, {
      caseId,
      status: "skag_submitted",
      updatedAt: now,
    })

    const { data: uploadedDocumentRows } = await admin
      .from("documents")
      .select("id,signature_request_id,document_kind,file_path")
      .eq("case_id", caseId)
    const uploadedDocumentCount = (
      (uploadedDocumentRows as Array<{
        id?: string | null
        signature_request_id?: string | null
        document_kind?: string | null
        file_path?: string | null
      }> | null) ?? []
    ).filter((row) => {
      const signatureRequestId = trimOrNull(row.signature_request_id)
      return !signatureRequestId && !isBankSubmissionBundleDocument(row)
    }).length
    const siteOrigin = resolveSiteOrigin(req)
    const advisorCaseUrl = new URL(`/advisor/faelle/${encodeURIComponent(caseId)}`, siteOrigin).toString()
    const customerDashboardUrl = new URL(`/app/faelle/${encodeURIComponent(caseId)}#schufa-dokumente`, siteOrigin).toString()

    let emailSent = false
    let emailError: string | null = null

    if (email) {
      const html = buildEmailHtml({
        title: "Antrag erfolgreich abgeschickt",
        intro: caseRef
          ? `Ihr Antrag für den Fall ${caseRef} wurde erfolgreich an SEPANA übermittelt.`
          : "Ihr Antrag wurde erfolgreich an SEPANA übermittelt.",
        bodyHtml: `
          <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
            Der nächste Schritt ist jetzt der Upload Ihrer Unterlagen im Kundendashboard. Sobald die Dokumente
            vollständig vorliegen, prüft Ihr Berater die Angaben und begleitet den Fall weiter.
          </p>
        `,
        steps: [
          "Laden Sie jetzt Ihre Unterlagen im Dokumentebereich hoch.",
          "Danach prüft Ihr Berater Ihre Angaben.",
          "Sobald es weitergeht, erhalten Sie automatisch die nächste Rückmeldung.",
        ],
        ctaLabel: "Unterlagen jetzt hochladen",
        ctaUrl: customerDashboardUrl,
        preheader: "Ihr Antrag wurde erfolgreich übermittelt. Als Nächstes laden Sie bitte Ihre Unterlagen hoch.",
        eyebrow: "SEPANA - Antrag erfolgreich",
        supportNote: "Der Dokumentebereich ist direkt über den Button im Kundendashboard erreichbar.",
      })

      const emailResult = await sendEmail({
        to: email,
        subject: "Ihr Antrag wurde erfolgreich abgeschickt",
        html,
      }).catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "mail_failed",
      }))

      emailSent = Boolean(emailResult?.ok)
      emailError = emailSent ? null : String(emailResult?.error ?? "mail_failed")
    } else {
      emailError = "missing_customer_email"
    }

    await notifyAdminSubmitted({
      caseId,
      caseRef,
      firstName: String(firstName ?? ""),
      lastName: String(lastName ?? ""),
      email: String(email ?? ""),
      phonePrimary: String(phonePrimary ?? ""),
      dateOfBirth: String(dateOfBirth ?? ""),
      loanAmountRequested: integerOrNull(mergedDetails.loan_amount_requested),
      termMonths: integerOrNull(mergedDetails.term_months),
      netIncomeMonthly,
      professionLabel,
      uploadedDocumentCount,
      advisorCaseUrl,
    }).catch(() => null)

    await logCaseEvent({
      caseId,
      actorRole: "system",
      type: "schufa_free_application_submitted",
      title: "Antrag erfolgreich abgeschickt",
      body: emailSent
        ? "Ihr Antrag wurde an SEPANA übermittelt. Als Nächstes laden Sie bitte Ihre Unterlagen im Dashboard hoch."
        : "Ihr Antrag wurde an SEPANA übermittelt. Als Nächstes laden Sie bitte Ihre Unterlagen im Dashboard hoch.",
      meta: {
        customer_dashboard_url: customerDashboardUrl,
        uploaded_document_count: uploadedDocumentCount,
        email_sent: emailSent,
      },
      notifyAdvisor: false,
    })

    return NextResponse.json({
      ok: true,
      creditId: skagResult.creditId,
      clientId: skagResult.clientId,
      uploadedDocumentCount,
      ratenschutzOptIn,
      emailSent,
      emailError,
    })
  } catch (error) {
    console.error("[schufa-frei/application] unexpected error", error)
    const message =
      error instanceof Error
        ? error.message
        : trimOrNull((error as { message?: unknown; details?: unknown; error_description?: unknown } | null)?.message) ??
          trimOrNull((error as { error_description?: unknown } | null)?.error_description) ??
          trimOrNull((error as { details?: unknown } | null)?.details) ??
          "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
