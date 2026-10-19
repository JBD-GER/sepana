import { isIP } from "node:net"
import { buildCreditoloPayload as buildPayload, validateCreditoloPayload as validatePayload, CreditoloValidationError, type CreditoloPayload, type CreditoloVariant } from "./payload"
export { CreditoloValidationError, creditoloTimestamp, normalizeCreditoloPhone, needsResidencePermit } from "./payload"
export type { CreditoloPayload, CreditoloVariant } from "./payload"

export function validateCreditoloPayload(payload: CreditoloPayload, variant: CreditoloVariant) {
  validatePayload(payload, variant)
  if (!isIP(payload[2]?.remote ?? "")) throw new CreditoloValidationError(["IP-Adresse"])
}

export function buildCreditoloPayload(input: Parameters<typeof buildPayload>[0]) {
  const payload = buildPayload(input)
  validateCreditoloPayload(payload, input.variant)
  return payload
}
