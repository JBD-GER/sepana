export function normalizeIbanInput(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim()
}

export function looksLikeIban(value: unknown) {
  const iban = normalizeIbanInput(value)
  return /^[A-Z]{2}[A-Z0-9]{13,32}$/.test(iban)
}

export type SandboxIbanDemo = {
  iban: string
  bic: string
  bankName: string
  bankCode: string
}

export const XS2A_SANDBOX_TEST_IBAN_ALIAS = "DE00000000000000000000"
const XS2A_SANDBOX_TEST_IBAN = "DE62888888880012345678"
const XS2A_SANDBOX_TEST_BIC = "TESTDE88XXX"
const XS2A_SANDBOX_TEST_BANK_NAME = "XS2A-Testbank"
const XS2A_SANDBOX_TEST_BANK_CODE = "88888888"

const SANDBOX_IBAN_DEMOS: Record<string, SandboxIbanDemo> = {
  [XS2A_SANDBOX_TEST_IBAN_ALIAS]: {
    // Alias used in our form flow; we persist the valid XS2A sandbox IBAN instead.
    iban: XS2A_SANDBOX_TEST_IBAN,
    bic: XS2A_SANDBOX_TEST_BIC,
    bankName: XS2A_SANDBOX_TEST_BANK_NAME,
    bankCode: XS2A_SANDBOX_TEST_BANK_CODE,
  },
  [XS2A_SANDBOX_TEST_IBAN]: {
    iban: XS2A_SANDBOX_TEST_IBAN,
    bic: XS2A_SANDBOX_TEST_BIC,
    bankName: XS2A_SANDBOX_TEST_BANK_NAME,
    bankCode: XS2A_SANDBOX_TEST_BANK_CODE,
  },
}

export function getSandboxIbanDemo(value: unknown) {
  const iban = normalizeIbanInput(value)
  return SANDBOX_IBAN_DEMOS[iban] ?? null
}

export function getIbanDisplayValue(value: unknown) {
  const iban = normalizeIbanInput(value)
  if (!iban) return ""
  return iban === XS2A_SANDBOX_TEST_IBAN ? XS2A_SANDBOX_TEST_IBAN_ALIAS : iban
}
