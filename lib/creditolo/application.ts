import { buildCreditoloPayload, CreditoloValidationError, needsResidencePermit } from "./payload"

type Row = Record<string, unknown>
export type CreditoloApplication = {
  primary: Row
  baufi: Row
  additional: Row
  children?: unknown[]
  creditolo: Row
}

/** The wizard and the server use the same Creditolo field checks. */
export function validateCreditoloApplication(application: CreditoloApplication) {
  if (!application || typeof application !== "object" || !application.primary || !application.baufi || !application.additional || !application.creditolo ||
    [application.primary, application.baufi, application.additional, application.creditolo].some(value => typeof value !== "object" || Array.isArray(value)) ||
    (application.children !== undefined && !Array.isArray(application.children))) {
    throw new CreditoloValidationError(["Vollständiger Kreditantrag"])
  }
  const { primary, baufi, additional, creditolo, children = [] } = application
  return buildCreditoloPayload({
    variant: "standard",
    applicant: primary,
    details: baufi,
    additional: {
      ...additional,
      warm_rent_monthly: additional.current_warm_rent,
      warm_rent_not_applicable: additional.current_warm_rent_none,
      residence_since: additional.address_since,
      creditolo_children_count: additional.has_children ? children.length : 0,
    },
    extra: creditolo,
    caseId: "validation",
    remote: "",
    timestamp: "",
  })
}

export function getCreditoloApplicationErrors(application: CreditoloApplication): string[] {
  try { validateCreditoloApplication(application); return [] }
  catch (error) {
    return error instanceof CreditoloValidationError ? error.fields.map((field) => `${field}: bitte vollständig und gültig angeben.`) : ["Bitte alle Pflichtangaben für Creditolo ergänzen."]
  }
}

export function getCreditoloExtraErrors(extra: Row, schufaFree: boolean, nationality: string): string[] {
  const errors: string[] = []
  if (!extra.profession) errors.push("Berufsgruppe fehlt.")
  if (extra.consent !== true) errors.push("Bitte die Datenweitergabe an Creditolo bestätigen.")
  if (!schufaFree) {
    if (extra.schufaConsent !== true) errors.push("Bitte die SCHUFA-Einwilligung bestätigen.")
    if (!["1", "2"].includes(String(extra.adults))) errors.push("Erwachsene im Haushalt fehlt.")
  }
  // Match the payload validator's conditional residence-permit requirement.
  if (nationality && needsResidencePermit(nationality) && !extra.residencePermitUntil) {
    errors.push("Gültigkeit des Aufenthaltstitels fehlt.")
  }
  return errors
}
