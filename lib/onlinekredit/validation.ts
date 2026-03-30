export type OnlinekreditStepId = "basis" | "person" | "residence" | "employment" | "details" | "co" | "review"

export type OnlinekreditValidationIssue = {
  step: OnlinekreditStepId
  section?: string | null
  fields?: string[]
  message: string
  messages: string[]
}

type EuropaceOfferValidationMessage = {
  text?: unknown
  property?: unknown
  category?: unknown
  reason?: unknown
}

export const ONLINEKREDIT_MIN_LOAN_AMOUNT = 5000
export const ONLINEKREDIT_MAX_NET_INCOME_MONTHLY = 20000
export const ONLINEKREDIT_MAX_WARM_RENT_MONTHLY = 10000

type EuropaceOfferValidationLike = {
  angebot_snapshot?: {
    vollstaendigkeit?: {
      messages?: EuropaceOfferValidationMessage[] | null
    } | null
  } | null
}

function parseIsoDateStrict(value: unknown) {
  const raw = String(value ?? "").trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const yearNumber = Number(year)
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  const parsed = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber))
  if (Number.isNaN(parsed.getTime())) return null
  if (
    parsed.getUTCFullYear() !== yearNumber ||
    parsed.getUTCMonth() !== monthNumber - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return null
  }
  return parsed
}

function parseLooseMoneyAmount(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function createIssue(input: Partial<OnlinekreditValidationIssue> & { step: OnlinekreditStepId; message: string }) {
  const message = String(input.message ?? "").trim()
  return {
    step: input.step,
    section: input.section ?? null,
    fields: Array.isArray(input.fields) ? input.fields.filter(Boolean) : [],
    message,
    messages: Array.isArray(input.messages) && input.messages.length ? input.messages.filter(Boolean) : [message],
  } satisfies OnlinekreditValidationIssue
}

function startOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export function getAdditionalIdDateValidationIssue(input: {
  id_issued_at?: unknown
  id_expires_at?: unknown
}) {
  const issuedAt = parseIsoDateStrict(input.id_issued_at)
  const expiresAt = parseIsoDateStrict(input.id_expires_at)
  if (!issuedAt || !expiresAt) return null
  if (expiresAt.getTime() >= issuedAt.getTime()) return null

  return createIssue({
    step: "details",
    section: "legitimation",
    fields: ["id_issued_at", "id_expires_at"],
    message: "Das Ablaufdatum des Ausweises muss am oder nach dem Ausstellungsdatum liegen.",
  })
}

export function getLoanAmountMinimumValidationIssue(input: {
  loan_amount_requested?: unknown
  minimum?: number
}) {
  const raw = String(input.loan_amount_requested ?? "").trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null

  const minimum = Math.max(0, Number(input.minimum ?? ONLINEKREDIT_MIN_LOAN_AMOUNT) || ONLINEKREDIT_MIN_LOAN_AMOUNT)
  if (amount >= minimum) return null

  return createIssue({
    step: "basis",
    section: "kreditwunsch",
    fields: ["loan_amount_requested"],
    message: `Die Kreditsumme muss mindestens ${minimum.toLocaleString("de-DE")} EUR betragen.`,
  })
}

export function getMonthlyAmountPlausibilityValidationIssue(input: {
  value?: unknown
  max?: number
  step: OnlinekreditStepId
  section?: string | null
  fields?: string[]
  label: string
}) {
  const amount = parseLooseMoneyAmount(input.value)
  if (amount === null) return null

  const max = Math.max(0, Number(input.max ?? 0) || 0)
  if (!max || amount <= max) return null

  return createIssue({
    step: input.step,
    section: input.section ?? null,
    fields: Array.isArray(input.fields) ? input.fields : [],
    message: `${input.label} wirkt als Monatswert unplausibel. Bitte prüfe, ob hier wirklich ein Monatswert und nicht z. B. ein Jahreswert eingetragen ist.`,
  })
}

export function getEmploymentSinceValidationIssue(input: {
  birth_date?: unknown
  employment_since?: unknown
  step?: OnlinekreditStepId
  section?: string | null
  field?: string
  label?: string
}) {
  const birthRaw = String(input.birth_date ?? "").trim()
  const employmentRaw = String(input.employment_since ?? "").trim()
  if (!employmentRaw) return null

  const employmentSince = parseIsoDateStrict(employmentRaw)
  if (!employmentSince) {
    return createIssue({
      step: input.step ?? "employment",
      section: input.section ?? "beruf",
      fields: [input.field ?? "employment_since"],
      message: `Bitte ein gültiges Datum für ${input.label ?? "Beschäftigt seit"} eingeben.`,
    })
  }

  const today = startOfTodayUtc()
  if (employmentSince.getTime() > today.getTime()) {
    return createIssue({
      step: input.step ?? "employment",
      section: input.section ?? "beruf",
      fields: [input.field ?? "employment_since"],
      message: `${input.label ?? "Beschäftigt seit"} darf nicht in der Zukunft liegen.`,
    })
  }

  if (!birthRaw) return null
  const birthDate = parseIsoDateStrict(birthRaw)
  if (!birthDate) return null

  if (employmentSince.getTime() < birthDate.getTime()) {
    return createIssue({
      step: input.step ?? "employment",
      section: input.section ?? "beruf",
      fields: [input.field ?? "employment_since"],
      message: `${input.label ?? "Beschäftigt seit"} kann nicht vor dem Geburtsdatum liegen.`,
    })
  }

  return null
}

export function normalizeOnlinekreditValidationIssue(value: unknown): OnlinekreditValidationIssue | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<OnlinekreditValidationIssue>
  const step = String(raw.step ?? "").trim() as OnlinekreditStepId
  const message = String(raw.message ?? "").trim()
  if (!step || !message) return null
  return createIssue(raw as Partial<OnlinekreditValidationIssue> & { step: OnlinekreditStepId; message: string })
}

export function mapOnlinekreditSaveValidationIssue(input: {
  stage?: unknown
  message?: unknown
  validation?: unknown
}) {
  const normalized = normalizeOnlinekreditValidationIssue(input.validation)
  if (normalized) return normalized

  const stage = String(input.stage ?? "").trim().toLowerCase()
  const message = String(input.message ?? "").trim().toLowerCase()
  if (!message) return null

  if (
    (stage === "additional_upsert" || stage === "additional_validation") &&
    (message.includes("case_additional_details_id_date_check") ||
      (message.includes("ablaufdatum") && message.includes("ausstellungsdatum")))
  ) {
    return createIssue({
      step: "details",
      section: "legitimation",
      fields: ["id_issued_at", "id_expires_at"],
      message: "Das Ablaufdatum des Ausweises muss am oder nach dem Ausstellungsdatum liegen.",
    })
  }

  if (
    stage === "baufi_validation" &&
    message.includes("kreditsumme") &&
    (message.includes("mindestens") || message.includes("5000"))
  ) {
    return createIssue({
      step: "basis",
      section: "kreditwunsch",
      fields: ["loan_amount_requested"],
      message: `Die Kreditsumme muss mindestens ${ONLINEKREDIT_MIN_LOAN_AMOUNT.toLocaleString("de-DE")} EUR betragen.`,
    })
  }

  return null
}

function validationHaystack(input: EuropaceOfferValidationMessage | null | undefined) {
  return [
    String(input?.property ?? ""),
    String(input?.text ?? ""),
    String(input?.category ?? ""),
    String(input?.reason ?? ""),
  ]
    .join(" ")
    .trim()
    .toLowerCase()
}

function normalizedValidationMessage(value: unknown, fallback: string) {
  const text = String(value ?? "").trim()
  if (!text) return fallback
  return text
}

function mapEuropaceRequirementToIssue(entry: EuropaceOfferValidationMessage | null | undefined) {
  const haystack = validationHaystack(entry)
  if (!haystack) return null
  if (haystack.includes("kontocheck") || haystack.includes("accountcheck") || haystack.includes("account check")) {
    return null
  }

  if (
    haystack.includes("beschaeftigtseit") ||
    haystack.includes("beschaeftigt seit") ||
    haystack.includes("employment_since") ||
    haystack.includes("beschaeftigung seit")
  ) {
    return createIssue({
      step: "employment",
      section: "beruf",
      fields: ["employment_since"],
      message: normalizedValidationMessage(
        entry?.text,
        "Bitte pruefe das Feld 'Beschaeftigt seit'. Das Datum muss zwischen Geburtsdatum und heute liegen."
      ),
    })
  }

  if (haystack.includes("geburtsdatum") || haystack.includes("birth_date") || haystack.includes("personendaten.geburtsdatum")) {
    return createIssue({
      step: "person",
      section: "person",
      fields: ["birth_date"],
      message: normalizedValidationMessage(entry?.text, "Bitte pruefe das Geburtsdatum."),
    })
  }

  if (
    haystack.includes("telefonprivat") ||
    haystack.includes("telefon privat") ||
    haystack.includes("telefonnummer") ||
    haystack.includes("mobile telefonnummer")
  ) {
    return createIssue({
      step: "basis",
      section: "kontakt",
      fields: ["phone"],
      message: normalizedValidationMessage(entry?.text, "Bitte pruefe die Telefonnummer."),
    })
  }

  if (
    haystack.includes("previous_address_since") ||
    haystack.includes("voranschrift wohnhaft seit") ||
    haystack.includes("voranschrift")
  ) {
    return createIssue({
      step: "residence",
      section: "voranschrift",
      fields: ["previous_address_since"],
      message: normalizedValidationMessage(entry?.text, "Bitte pruefe die Angaben zur Voranschrift."),
    })
  }

  if (
    haystack.includes("indeutschlandseit") ||
    haystack.includes("in deutschland seit") ||
    haystack.includes("wohnhaft seit") ||
    haystack.includes("residence_since") ||
    haystack.includes("address_since")
  ) {
    return createIssue({
      step: "residence",
      section: "wohnen",
      fields: ["address_since"],
      message: normalizedValidationMessage(entry?.text, "Bitte pruefe die Angabe 'Wohnhaft seit'."),
    })
  }

  if (
    haystack.includes("kontoverbindung") ||
    haystack.includes("auszahlungskonto") ||
    haystack.includes(" iban") ||
    haystack.startsWith("iban") ||
    haystack.includes(" bic") ||
    haystack.startsWith("bic")
  ) {
    return createIssue({
      step: "details",
      section: "konto",
      fields: ["bank_account_holder", "bank_iban", "bank_bic"],
      message: normalizedValidationMessage(entry?.text, "Bitte pruefe die Bankverbindung."),
    })
  }

  return null
}

export function extractEuropaceOfferValidationIssue(offers: EuropaceOfferValidationLike[] | null | undefined) {
  for (const offer of offers ?? []) {
    const messages = Array.isArray(offer?.angebot_snapshot?.vollstaendigkeit?.messages)
      ? offer.angebot_snapshot.vollstaendigkeit.messages
      : []
    for (const entry of messages) {
      const issue = mapEuropaceRequirementToIssue(entry)
      if (issue) return issue
    }
  }

  return null
}
