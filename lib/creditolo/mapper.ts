import { isIP } from "node:net"
import { CREDITOLO_PROFESSIONS } from "./fields"

type Row = Record<string, unknown>
export type CreditoloVariant = "standard" | "schufa_free"
export type CreditoloPayload = Array<Record<string, string>>

export class CreditoloValidationError extends Error {
  constructor(public fields: string[]) {
    super(`Bitte Angaben für Creditolo prüfen: ${fields.join(", ")}.`)
  }
}
const text = (v: unknown) => String(v ?? "").trim()
const EXEMPT = new Set(
  "BE BG DK DE EE FI FR GR IE IT HR LV LT LU MT NL AT PL PT RO SE SK SI ES CZ HU CY IS LI CH TR GB".split(
    " ",
  ),
)
export function needsResidencePermit(nationality: string) {
  return !EXEMPT.has(nationality.toUpperCase())
}

export function creditoloTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}
export function normalizeCreditoloPhone(v: unknown) {
  let phone = text(v).replace(/[\s()/-]/g, "")
  if (phone.startsWith("+49")) phone = `0${phone.slice(3)}`
  else if (phone.startsWith("0049")) phone = `0${phone.slice(4)}`
  return phone
}

export function validateCreditoloPayload(payload: CreditoloPayload, variant: CreditoloVariant) {
  const [, product, legal, user, additional] = payload
  const bad: string[] = []
  const check = (field: string, ok: boolean) => {
    if (!ok) bad.push(field)
  }
  const number = (v: string, min: number, max: number) =>
    v !== "" && /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max
  check("Kreditsumme (ab 3.000 EUR)", number(product.ksum, 3000, 999999))
  if (variant === "standard") {
    check(
      "Laufzeit",
      [12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 84, 96, 108, 120].includes(Number(product.lauf)),
    )
    check("SCHUFA-Einwilligung", legal.schufa === "Ja")
    check("Geburtsort", user.gort?.length >= 2)
    check("Wohnhaft seit", validDate(user.wsei) && user.wsei < new Date().toISOString().slice(0, 10))
    check("Erwachsene im Haushalt", ["1", "2"].includes(user.anpe))
    for (const key of ["kbfi", "kpkv", "kunt"]) check(key, number(user[key], 0, 9999))
  }
  check("Datenweitergabe", legal.compliance === "Ja")
  check("IP-Adresse", isIP(legal.remote) !== 0)
  check("E-Mail", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.mail))
  check("Anrede", ["Herr", "Frau"].includes(user.anre))
  for (const [key, label, min, max] of [
    ["vorn", "Vorname", 2, 50],
    ["name", "Nachname", 2, 50],
    ["stra", "Straße", 2, 50],
    ["hanr", "Hausnummer", 1, 10],
    ["ortt", "Ort", 2, 50],
  ] as const)
    check(label, user[key]?.length >= min && user[key]?.length <= max)
  const today = new Date().toISOString().slice(0, 10)
  const age = validDate(user.gdat)
    ? Number(today.slice(0, 4)) -
      Number(user.gdat.slice(0, 4)) -
      (today.slice(5) < user.gdat.slice(5) ? 1 : 0)
    : 0
  check("Geburtsdatum (18–85 Jahre)", age >= 18 && age < 86)
  check("Staatsangehörigkeit", /^[A-Z]{2}$/.test(user.sang))
  if (needsResidencePermit(user.sang))
    check("Aufenthaltstitel", validDate(user.atbf) && user.atbf > new Date().toISOString().slice(0, 10))
  check(
    "Familienstand",
    [
      "Ledig",
      "Eheähnliche Lebensgemeinschaft",
      "Eingetragene Lebenspartnerschaft",
      "Verheiratet",
      "Verwitwet",
      "Geschieden",
      "Getrennt",
    ].includes(user.fami),
  )
  check("Postleitzahl", /^\d{5}$/.test(user.plzz))
  check("Telefonnummer (deutsch)", /^0\d{4,19}$/.test(user.tele))
  check("Berufsgruppe", (CREDITOLO_PROFESSIONS as readonly string[]).includes(user.beru))
  check("Beschäftigt seit", validDate(user.bers) && user.bers < new Date().toISOString().slice(0, 10))
  if (
    [
      "Arbeiter",
      "Angestellter oeffentlicher Dienst",
      "Angestellter Privatwirtschaft",
      "Auszubildender/Lehrling",
      "Beamter",
      "Soldat",
    ].includes(user.beru)
  ) {
    check("Arbeitgeber", user.agna?.length >= 2 && user.agna?.length <= 100)
    check("Arbeitgeber-PLZ und Ort", /^\d{5} .{2,94}$/.test(user.agor))
    check("Steuerklasse", number(user.stkl, 1, 6))
  }
  check("Wohnsituation", ["Miete", "Eigentum", "Bei den Eltern", "Mietfrei"].includes(user.wohn))
  check("Warmmiete", number(user.wmie, 0, 9999))
  check("Kinder (0–6)", number(user.anki, 0, 6))
  check(
    "Einkommen",
    user.ekdt.split("|").length === 7 && user.ekdt.split("|").every((v) => number(v, 0, 99999)),
  )
  const iban = additional.iban
  check("Deutsche IBAN", /^DE\d{20}$/.test(iban) && ibanMod97(iban) === 1)
  if (bad.length) throw new CreditoloValidationError(bad)
}
function validDate(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v ?? "") &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  )
}
function ibanMod97(iban: string) {
  let n = 0
  for (const c of iban.slice(4) + "1314" + iban.slice(2, 4)) n = (n * 10 + Number(c)) % 97
  return n
}
const family: Record<string, string> = {
  single: "Ledig",
  married: "Verheiratet",
  widowed: "Verwitwet",
  divorced: "Geschieden",
  separated: "Getrennt",
  partner: "Eheähnliche Lebensgemeinschaft",
  partnership: "Eheähnliche Lebensgemeinschaft",
  registered: "Eingetragene Lebenspartnerschaft",
  "1": "Ledig",
  "2": "Verheiratet",
  "3": "Verwitwet",
  "4": "Geschieden",
  "5": "Getrennt",
  "6": "Eheähnliche Lebensgemeinschaft",
}
const housing: Record<string, string> = {
  rent: "Miete",
  owner: "Eigentum",
  with_family: "Bei den Eltern",
  other: "Miete",
  "1": "Miete",
  "2": "Eigentum",
  "3": "Bei den Eltern",
}
const money = (v: unknown) => (text(v) === "" ? "" : String(Math.round(Number(v))))

export function buildCreditoloPayload({
  variant,
  applicant: a,
  details: d,
  additional: x,
  extra: e,
  caseId,
  remote,
  timestamp,
}: {
  variant: CreditoloVariant
  applicant: Row
  details: Row
  additional: Row
  extra: Row
  caseId: string
  remote: string
  timestamp: string
}): CreditoloPayload {
  const free = variant === "schufa_free"
  const user: Record<string, string> = {
    mail: text(free ? d.email : a.email),
    anre: free
      ? Number(d.gender) === 1
        ? "Herr"
        : Number(d.gender) === 2
          ? "Frau"
          : ""
      : ({ mr: "Herr", ms: "Frau", male: "Herr", female: "Frau", herr: "Herr", frau: "Frau" }[
          text(a.salutation).toLowerCase()
        ] ?? ""),
    vorn: text(a.first_name),
    name: text(a.last_name),
    gdat: text(free ? d.date_of_birth : a.birth_date),
    sang: text(free ? d.nationality : a.nationality).toUpperCase(),
    fami: family[text(free ? d.family_situation : a.marital_status)] ?? text(a.marital_status),
    stra: text(free ? d.street : a.address_street),
    hanr: text(free ? d.house_number : a.address_house_no),
    plzz: text(free ? d.zipcode : a.address_zip),
    ortt: text(free ? d.city : a.address_city),
    land: "Deutschland",
    tele: normalizeCreditoloPhone(free ? d.phone_primary : a.phone),
    beru: text(e.profession),
    bers: text(free ? d.profession_begin_date : a.employment_since),
    agna: text(free ? d.employer_name : a.employer_name),
    agor: [
      text(free ? d.employer_zipcode : a.employer_address_zip),
      text(free ? d.employer_city : a.employer_address_city),
    ]
      .join(" ")
      .trim(),
    wohn: housing[text(free ? d.residence_type : a.housing_status)] ?? "",
    wmie: money(free ? d.rent_monthly : x.warm_rent_not_applicable ? 0 : x.warm_rent_monthly),
    anki: text(free ? d.dependent_children_count : x.creditolo_children_count),
    stkl: text(free ? d.tax_class : e.taxClass),
    ekdt: (free
      ? [d.net_income_monthly, d.additional_income_monthly ?? 0, 0, 0, 0, 0, 0]
      : [
          a.net_income_monthly,
          e.otherIncome,
          e.childIncome,
          e.maintenanceIncome,
          e.pensionIncome,
          e.rentalIncome,
          e.socialIncome,
        ]
    )
      .map(money)
      .join("|"),
  }
  if (needsResidencePermit(user.sang)) user.atbf = text(e.residencePermitUntil)
  if (!free)
    Object.assign(user, {
      gort: text(x.birth_place),
      wsei: text(x.residence_since),
      anpe: text(e.adults),
      kbfi: money(e.mortgageRate),
      kpkv: money(e.privateHealthCosts),
      kunt: money(e.maintenanceCosts),
    })
  const payload: CreditoloPayload = [
    {
      subid: caseId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 39),
      ...(!free ? { operation: "delivery" } : {}),
    },
    {
      ksum: money(d.loan_amount_requested),
      ...(!free
        ? {
            selection: "loan",
            lauf: text(d.term_months),
            vwzz: /pv|solar|photovoltaik/i.test(text(d.purpose))
              ? "Energiedarlehen"
              : /umschuld/i.test(text(d.purpose))
                ? "Kreditumschuldung"
                : /auto/i.test(text(d.purpose))
                  ? "Autokredit"
                  : "Privatkredit",
          }
        : {}),
    },
    {
      compliance: e.consent === true ? "Ja" : "Nein",
      timestamp,
      remote,
      ...(!free ? { schufa: e.schufaConsent === true ? "Ja" : "Nein" } : {}),
    },
    user,
    {
      info: text(d.purpose).slice(0,500),
      iban: text(free ? d.iban : x.bank_iban)
        .replace(/\s/g, "")
        .toUpperCase(),
    },
  ]
  validateCreditoloPayload(payload, variant)
  return payload
}
