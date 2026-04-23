type SignatureFieldOwner = "advisor" | "customer"
type SignatureFieldType = "signature" | "checkbox" | "text"

type MinimalSignatureField = {
  owner?: string | null
}

export type SchufaFreeContractVariant = "without_assignment" | "with_assignment"

export type SchufaFreeContractPackageField = {
  id: string
  owner: SignatureFieldOwner
  type: SignatureFieldType
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

export type SchufaFreeContractPackageItem = {
  key:
    | "separate_mandate"
    | "contract"
    | "insurance_optional"
    | "service_fee"
    | "assignment"
    | "precontract_info"
  title: string
  pageFrom: number
  pageTo: number
  requiresWetSignature: boolean
  fields: SchufaFreeContractPackageField[]
}

export type SchufaFreeSignatureRequestMeta = {
  packageRelated: boolean
  key: SchufaFreeContractPackageItem["key"] | null
  order: number
  stepLabel: string | null
  kindLabel: string | null
  description: string | null
  actionLabel: string
  optional: boolean
  downloadOnly: boolean
  completionRequired: boolean
  requiresWetSignature: boolean
}

const CONTRACT_TITLE = "Kreditvertrag"
export const SEPARATE_MANDATE_TITLE = "Gesonderter Vermittlungsauftrag"
const INSURANCE_OPTIONAL_TITLE = "Ratenschutz (optional)"
const SERVICE_FEE_TITLE = "Serviceprovision an SEPANA"
const ASSIGNMENT_TITLE = "Abtretungserklärung (Original unterschreiben und wieder hochladen)"
const PRECONTRACT_INFO_TITLE = "Vorvertragliche Informationen"

const KNOWN_PACKAGE_TITLES = new Set(
  [
    CONTRACT_TITLE,
    INSURANCE_OPTIONAL_TITLE,
    SERVICE_FEE_TITLE,
    ASSIGNMENT_TITLE,
    PRECONTRACT_INFO_TITLE,
  ].map((value) => normalizeTitle(value))
)

function normalizeTitle(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function hasAdvisorFields(fields: MinimalSignatureField[] | null | undefined) {
  if (!Array.isArray(fields) || fields.length === 0) return false
  return fields.some((field) => String(field?.owner ?? "").trim().toLowerCase() !== "customer")
}

function hasCustomerFields(fields: MinimalSignatureField[] | null | undefined) {
  if (!Array.isArray(fields) || fields.length === 0) return false
  return fields.some((field) => String(field?.owner ?? "").trim().toLowerCase() === "customer")
}

export function detectSchufaFreeContractVariant(pageCount: number): SchufaFreeContractVariant | null {
  if (pageCount === 17) return "without_assignment"
  if (pageCount === 19) return "with_assignment"
  return null
}

export function getSchufaFreeContractPackageItems(
  variant: SchufaFreeContractVariant
): SchufaFreeContractPackageItem[] {
  const commonItems: SchufaFreeContractPackageItem[] = [
    {
      key: "contract",
      title: CONTRACT_TITLE,
      pageFrom: 1,
      pageTo: 7,
      requiresWetSignature: false,
      fields: [
        {
          id: "customer_contract_signature_page_4",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kunde",
          page: 4,
          x: 40,
          y: 85,
          width: 21,
          height: 5,
        },
        {
          id: "customer_contract_signature_page_5",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kunde",
          page: 5,
          x: 52,
          y: 80,
          width: 24,
          height: 5,
        },
        {
          id: "customer_contract_signature_page_6",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kunde",
          page: 6,
          x: 51,
          y: 24,
          width: 29,
          height: 5,
        },
        {
          id: "customer_contract_signature_page_7",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kunde",
          page: 7,
          x: 41,
          y: 74,
          width: 32,
          height: 6,
        },
      ],
    },
    {
      key: "insurance_optional",
      title: INSURANCE_OPTIONAL_TITLE,
      pageFrom: 8,
      pageTo: 8,
      requiresWetSignature: false,
      fields: [
        {
          id: "customer_insurance_signature",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Ratenschutz",
          page: 1,
          x: 31,
          y: 62,
          width: 33,
          height: 6,
        },
        {
          id: "customer_insurance_account_signature",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kontoinhaber",
          page: 1,
          x: 38,
          y: 89,
          width: 33,
          height: 5,
        },
      ],
    },
    {
      key: "service_fee",
      title: SERVICE_FEE_TITLE,
      pageFrom: 9,
      pageTo: 9,
      requiresWetSignature: false,
      fields: [
        {
          id: "customer_service_fee_signature",
          owner: "customer",
          type: "signature",
          label: "Unterschrift Serviceprovision",
          page: 1,
          x: 55.50747380443959,
          y: 92.85955056179775,
          width: 30,
          height: 5,
        },
      ],
    },
    {
      key: "precontract_info",
      title: PRECONTRACT_INFO_TITLE,
      pageFrom: variant === "with_assignment" ? 13 : 11,
      pageTo: variant === "with_assignment" ? 19 : 17,
      requiresWetSignature: false,
      fields: [],
    },
  ]

  if (variant === "with_assignment") {
    commonItems.splice(3, 0, {
      key: "assignment",
      title: ASSIGNMENT_TITLE,
      pageFrom: 11,
      pageTo: 12,
      requiresWetSignature: true,
      fields: [],
    })
  }

  return commonItems
}

export function isSchufaFreeContractPackageTitle(title: string | null | undefined) {
  return KNOWN_PACKAGE_TITLES.has(normalizeTitle(title))
}

export function getSchufaFreeSignatureRequestMeta(input: {
  title?: string | null
  requiresWetSignature?: boolean
  fields?: MinimalSignatureField[] | null
}): SchufaFreeSignatureRequestMeta {
  const normalizedTitle = normalizeTitle(input.title)
  const requiresWetSignature = input.requiresWetSignature === true
  const fields = Array.isArray(input.fields) ? input.fields : []
  const downloadOnly = !fields.length && !requiresWetSignature

  if (normalizedTitle === normalizeTitle(SEPARATE_MANDATE_TITLE)) {
    return {
      packageRelated: true,
      key: "separate_mandate",
      order: 5,
      stepLabel: "Schritt 1",
      kindLabel: "Pflichtdokument",
      description:
        "Bitte den gesonderten Vermittlungsauftrag prüfen, das Widerrufsrecht bestätigen und digital unterschreiben.",
      actionLabel: "Vermittlungsauftrag unterschreiben",
      optional: false,
      downloadOnly: false,
      completionRequired: true,
      requiresWetSignature: false,
    }
  }

  if (normalizedTitle === normalizeTitle(CONTRACT_TITLE)) {
    return {
      packageRelated: true,
      key: "contract",
      order: 10,
      stepLabel: "Schritt 2",
      kindLabel: "Pflichtdokument",
      description: "Bitte prüfen und digital unterschreiben.",
      actionLabel: "Kreditvertrag unterschreiben",
      optional: false,
      downloadOnly: false,
      completionRequired: true,
      requiresWetSignature: false,
    }
  }

  if (normalizedTitle === normalizeTitle(INSURANCE_OPTIONAL_TITLE)) {
    return {
      packageRelated: true,
      key: "insurance_optional",
      order: 20,
      stepLabel: null,
      kindLabel: "Optional",
      description: "Nur unterschreiben, wenn Sie den Ratenschutz nutzen möchten.",
      actionLabel: "Optional unterschreiben",
      optional: true,
      downloadOnly: false,
      completionRequired: false,
      requiresWetSignature: false,
    }
  }

  if (normalizedTitle === normalizeTitle(SERVICE_FEE_TITLE)) {
    return {
      packageRelated: true,
      key: "service_fee",
      order: 30,
      stepLabel: "Schritt 3",
      kindLabel: "Pflichtdokument",
      description: "Bitte die Serviceprovision prüfen und unterschreiben.",
      actionLabel: "Serviceprovision unterschreiben",
      optional: false,
      downloadOnly: false,
      completionRequired: true,
      requiresWetSignature: false,
    }
  }

  if (normalizedTitle === normalizeTitle(ASSIGNMENT_TITLE)) {
    return {
      packageRelated: true,
      key: "assignment",
      order: 40,
      stepLabel: "Schritt 4",
      kindLabel: "Original",
      description: "Bitte im Original unterschreiben, einscannen und wieder hochladen.",
      actionLabel: "Original hochladen",
      optional: false,
      downloadOnly: false,
      completionRequired: true,
      requiresWetSignature: true,
    }
  }

  if (normalizedTitle === normalizeTitle(PRECONTRACT_INFO_TITLE)) {
    return {
      packageRelated: true,
      key: "precontract_info",
      order: 50,
      stepLabel: null,
      kindLabel: "Nur Download",
      description: "Zur Information ansehen oder herunterladen. Keine Unterschrift erforderlich.",
      actionLabel: "PDF ansehen",
      optional: false,
      downloadOnly: true,
      completionRequired: false,
      requiresWetSignature: false,
    }
  }

  return {
    packageRelated: false,
    key: null,
    order: 999,
    stepLabel: null,
    kindLabel: downloadOnly ? "Nur Download" : requiresWetSignature ? "Original" : null,
    description: downloadOnly
      ? "Dokument ansehen oder herunterladen."
      : requiresWetSignature
        ? "Original unterschreiben und anschließend hochladen."
        : null,
    actionLabel: requiresWetSignature ? "Original hochladen" : "Jetzt unterschreiben",
    optional: false,
    downloadOnly,
    completionRequired: hasCustomerFields(fields) || hasAdvisorFields(fields) || requiresWetSignature,
    requiresWetSignature,
  }
}

export function isSchufaFreeCompletionRelevantRequest(input: {
  title?: string | null
  requiresWetSignature?: boolean
  fields?: MinimalSignatureField[] | null
}) {
  const meta = getSchufaFreeSignatureRequestMeta(input)
  return meta.packageRelated && meta.completionRequired
}

export function shouldSyncSchufaSignatureRequestToSkag(title: string | null | undefined) {
  const meta = getSchufaFreeSignatureRequestMeta({ title })
  return !meta.packageRelated
}

export function isSchufaSignatureRequestLockedUntilInvoice(title: string | null | undefined) {
  const meta = getSchufaFreeSignatureRequestMeta({ title })
  return meta.packageRelated && meta.key !== "separate_mandate"
}

export function isSignatureRequestComplete(input: {
  fields?: MinimalSignatureField[] | null
  requires_wet_signature?: boolean
  advisor_signed_at?: string | null
  customer_signed_at?: string | null
  status?: string | null
}) {
  const fields = Array.isArray(input.fields) ? input.fields : []
  const advisorRequired = hasAdvisorFields(fields)
  const customerRequired = hasCustomerFields(fields)
  const customerSigned = Boolean(String(input.customer_signed_at ?? "").trim())
  const advisorSigned = Boolean(String(input.advisor_signed_at ?? "").trim())

  if (input.requires_wet_signature) return customerSigned
  if (!advisorRequired && !customerRequired) return true

  return (!advisorRequired || advisorSigned) && (!customerRequired || customerSigned)
}
