export const CREDITOLO_CONSENT_VERSION = "2026-10-14"

export const CREDITOLO_PROFESSIONS = [
  "Arbeiter",
  "Angestellter oeffentlicher Dienst",
  "Angestellter Privatwirtschaft",
  "Auszubildender/Lehrling",
  "Beamter",
  "Freiberufler",
  "Hausfrau/Hausmann",
  "Nicht Erwerbstaetiger",
  "Pensionaer",
  "Rentner",
  "Schueler/Student",
  "Selbstaendiger",
  "Soldat",
] as const

export type CreditoloExtra = {
  consent: boolean
  schufaConsent: boolean
  profession: string
  taxClass: string
  adults: string
  mortgageRate: string
  privateHealthCosts: string
  maintenanceCosts: string
  otherIncome: string
  childIncome: string
  maintenanceIncome: string
  pensionIncome: string
  rentalIncome: string
  socialIncome: string
  residencePermitUntil: string
}

export function emptyCreditoloExtra(): CreditoloExtra {
  return {
    consent: false,
    schufaConsent: false,
    profession: "",
    taxClass: "",
    adults: "",
    mortgageRate: "0",
    privateHealthCosts: "0",
    maintenanceCosts: "0",
    otherIncome: "0",
    childIncome: "0",
    maintenanceIncome: "0",
    pensionIncome: "0",
    rentalIncome: "0",
    socialIncome: "0",
    residencePermitUntil: "",
  }
}
