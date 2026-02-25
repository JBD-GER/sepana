export type ProductType = "baufi" | "privatkredit"
export type CoApplicantChoice = "yes" | "no"
export type PropertyUse = "self" | "rent"
export type ObjectSelectionState = "yes" | "searching"

export type StepId =
  | "product"
  | "purpose"
  | "coApplicant"
  | "objectType"
  | "propertyUse"
  | "objectSelected"
  | "baufiObjectData"
  | "kreditData"
  | "person"
  | "contact"
  | "consent"

export type IconName =
  | "home"
  | "credit"
  | "build"
  | "refresh"
  | "cash"
  | "car"
  | "search"
  | "users"
  | "user"
  | "apartment"
  | "house"
  | "plot"
  | "blocks"
  | "factory"
  | "heart"
  | "mail"
  | "shield"
  | "check"
  | "route"

export type OptionItem<T extends string> = {
  value: T
  label: string
  description?: string
  icon: IconName
}

export type FormState = {
  productType: ProductType | null
  purpose: string | null
  coApplicant: CoApplicantChoice | null
  objectType: string | null
  propertyUse: PropertyUse | null
  objectSelected: ObjectSelectionState | null
  objectZip: string
  objectCity: string
  purchasePrice: string
  brokerCommission: string
  equity: string
  loanAmount: string
  desiredTermMonths: string
  salutation: string
  firstName: string
  lastName: string
  birthDate: string
  street: string
  houseNumber: string
  zip: string
  city: string
  familyStatus: string
  employmentStatus: string
  email: string
  mobile: string
  dsgvoConsent: boolean
  portalInviteConsent: boolean
}

export const INITIAL_FORM: FormState = {
  productType: null,
  purpose: null,
  coApplicant: null,
  objectType: null,
  propertyUse: null,
  objectSelected: null,
  objectZip: "",
  objectCity: "",
  purchasePrice: "",
  brokerCommission: "",
  equity: "",
  loanAmount: "",
  desiredTermMonths: "",
  salutation: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  street: "",
  houseNumber: "",
  zip: "",
  city: "",
  familyStatus: "",
  employmentStatus: "",
  email: "",
  mobile: "",
  dsgvoConsent: false,
  portalInviteConsent: false,
}

export const PRODUCT_OPTIONS: OptionItem<ProductType>[] = [
  { value: "baufi", label: "Baufinanzierung", description: "Kauf, Neubau, Modernisierung u. mehr", icon: "home" },
  { value: "privatkredit", label: "Privatkredit", description: "Typische Verwendungszwecke wie Auto oder freie Nutzung", icon: "credit" },
]

export const BAUFI_PURPOSE_OPTIONS: OptionItem<string>[] = [
  { value: "kauf", label: "Kauf", icon: "home" },
  { value: "neubau_bautraeger", label: "Neubau (Kauf vom Bauträger)", icon: "build" },
  { value: "neubau_eigenes", label: "Neubau (eigenes Bauvorhaben)", icon: "build" },
  { value: "modernisierung", label: "Modernisierung", icon: "build" },
  { value: "anschlussfinanzierung", label: "Anschlussfinanzierung", icon: "refresh" },
  { value: "kapitalbeschaffung", label: "Kapitalbeschaffung", icon: "cash" },
]

export const KREDIT_PURPOSE_OPTIONS: OptionItem<string>[] = [
  { value: "autokredit", label: "Autokredit", icon: "car" },
  { value: "freie_verwendung", label: "Freie Verwendung", icon: "cash" },
  { value: "umschuldung", label: "Umschuldung", icon: "refresh" },
  { value: "renovierung", label: "Renovierung / Modernisierung", icon: "build" },
  { value: "moebel", label: "Möbel / Elektronik", icon: "cash" },
  { value: "sonstiges", label: "Sonstiger Zweck", icon: "cash" },
]

export const CO_APPLICANT_OPTIONS: OptionItem<CoApplicantChoice>[] = [
  { value: "yes", label: "Ja, mit einer weiteren Person", icon: "users" },
  { value: "no", label: "Nein, allein", icon: "user" },
]

export const OBJECT_TYPE_OPTIONS: OptionItem<string>[] = [
  { value: "wohnung", label: "Wohnung", icon: "apartment" },
  { value: "haus", label: "Haus", icon: "house" },
  { value: "grundstueck", label: "Grundstück", icon: "plot" },
  { value: "mehrfamilienhaus", label: "Mehrfamilienhaus", icon: "blocks" },
  { value: "wohn_geschaeftshaus", label: "Wohn- und Geschäftshaus", icon: "blocks" },
  { value: "gewerbeimmobilie", label: "Gewerbeimmobilie", icon: "factory" },
]

export const PROPERTY_USE_OPTIONS: OptionItem<PropertyUse>[] = [
  { value: "self", label: "Eigennutzung", icon: "heart" },
  { value: "rent", label: "Vermietung", icon: "cash" },
]

export const OBJECT_SELECTED_OPTIONS: OptionItem<ObjectSelectionState>[] = [
  { value: "yes", label: "Ja, konkretes Objekt vorhanden", icon: "check" },
  { value: "searching", label: "Nein, auf Immobiliensuche", icon: "search" },
]

export const TERM_OPTIONS = ["6", "12", "24", "36", "48", "60", "72", "84", "96", "120"] as const

export const SALUTATION_OPTIONS = [
  { value: "herr", label: "Herr" },
  { value: "frau", label: "Frau" },
  { value: "divers", label: "Divers" },
] as const

export const FAMILY_STATUS_OPTIONS = [
  { value: "ledig", label: "Ledig" },
  { value: "verheiratet", label: "Verheiratet" },
  { value: "geschieden", label: "Geschieden" },
  { value: "verwitwet", label: "Verwitwet" },
] as const

export const EMPLOYMENT_OPTIONS = [
  { value: "angestellt_unbefristet", label: "Angestellt (unbefristet)" },
  { value: "angestellt_befristet", label: "Angestellt (befristet)" },
  { value: "selbststaendig", label: "Selbstständig" },
  { value: "beamter", label: "Beamter" },
  { value: "rentner", label: "Rentner" },
  { value: "student", label: "Student / Ausbildung" },
] as const

export const STEP_META: Record<StepId, { title: string; subtitle: string; icon: IconName }> = {
  product: { title: "Baufinanzierung oder Privatkredit?", subtitle: "Wir passen den Funnel danach automatisch an.", icon: "route" },
  purpose: { title: "Welches Vorhaben möchten Sie anfragen?", subtitle: "Bitte wählen Sie den passenden Zweck aus.", icon: "cash" },
  coApplicant: { title: "Mit weiterer Person anfragen?", subtitle: "Einzel- oder Gemeinschaftsanfrage.", icon: "users" },
  objectType: { title: "Um was für ein Objekt handelt es sich?", subtitle: "Objektart für die erste Einordnung.", icon: "home" },
  propertyUse: { title: "Eigennutzung oder Vermietung?", subtitle: "Die Nutzung beeinflusst die Bewertung.", icon: "heart" },
  objectSelected: { title: "Ist schon ein konkretes Objekt ausgewählt?", subtitle: "Damit wissen wir, ob Objektdaten direkt erfasst werden.", icon: "search" },
  baufiObjectData: { title: "Objektdaten", subtitle: "Basisdaten für die Baufi-Anfrage.", icon: "home" },
  kreditData: { title: "Kreditdaten", subtitle: "Kreditbedarf und Wunschlaufzeit erfassen.", icon: "credit" },
  person: { title: "Persönliche Angaben", subtitle: "Für Lead-Erstellung und Portalzuordnung.", icon: "user" },
  contact: { title: "Kontaktdaten", subtitle: "E-Mail und Mobilnummer für Einladung und Rückfragen.", icon: "mail" },
  consent: { title: "Datenschutz & Portal-Hinweis", subtitle: "Zum Abschluss Einwilligungen bestätigen.", icon: "shield" },
}

export function buildFlow(productType: ProductType | null): StepId[] {
  if (productType === "baufi") {
    return [
      "product",
      "purpose",
      "coApplicant",
      "objectType",
      "propertyUse",
      "objectSelected",
      "baufiObjectData",
      "person",
      "contact",
      "consent",
    ]
  }
  if (productType === "privatkredit") {
    return ["product", "purpose", "coApplicant", "kreditData", "person", "contact", "consent"]
  }
  return ["product"]
}

