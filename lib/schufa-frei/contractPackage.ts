type SignatureFieldOwner = "advisor" | "customer"
type SignatureFieldType = "signature" | "checkbox" | "text"

type MinimalSignatureField = {
  id?: string | null
  owner?: string | null
}

export type SchufaFreeContractVariant = "without_assignment" | "with_assignment"

export type SchufaFreeContractPackageLayout = {
  pageCount: 17 | 19
  brokerageMandatePage: number
  brokerageMandateField: Pick<SchufaFreeContractPackageField, "x" | "y" | "width" | "height">
  insurancePage: number | null
  serviceFeePage: number
  assignmentPageFrom: number | null
  precontractPageFrom: number
}

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
    | "brokerage_mandate"
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
export const BROKERAGE_MANDATE_TITLE = "Kreditvermittlungsauftrag"
const BROKERAGE_MANDATE_SIGNATURE_FIELD_ID = "customer_brokerage_mandate_signature"
const INSURANCE_OPTIONAL_TITLE = "Ratenschutz (optional)"
const SERVICE_FEE_TITLE = "Serviceprovision an SEPANA"
const ASSIGNMENT_TITLE = "Abtretungserklärung (Original unterschreiben und wieder hochladen)"
export const PRECONTRACT_INFO_TITLE = "Vorvertragliche Informationen"

const KNOWN_PACKAGE_TITLES = new Set(
  [
    CONTRACT_TITLE,
    BROKERAGE_MANDATE_TITLE,
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

export function getSchufaFreeContractVariant(layout: SchufaFreeContractPackageLayout): SchufaFreeContractVariant {
  return layout.assignmentPageFrom ? "with_assignment" : "without_assignment"
}

export function getSchufaFreeContractPackageItems(
  layout: SchufaFreeContractPackageLayout
): SchufaFreeContractPackageItem[] {
  const brokerageMandatePage = Number(layout.brokerageMandatePage)
  if (
    !Number.isInteger(brokerageMandatePage) ||
    brokerageMandatePage < 2 ||
    brokerageMandatePage >= layout.serviceFeePage
  ) {
    throw new Error("Die Seite des Kreditvermittlungsauftrags ist ungültig.")
  }

  const contractPageTo = brokerageMandatePage - 1
  const contractFields: SchufaFreeContractPackageField[] = ([
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
  ] satisfies SchufaFreeContractPackageField[]).filter((field) => field.page <= contractPageTo)

  const items: SchufaFreeContractPackageItem[] = [
    {
      key: "contract",
      title: CONTRACT_TITLE,
      pageFrom: 1,
      pageTo: contractPageTo,
      requiresWetSignature: false,
      fields: contractFields,
    },
    {
      key: "brokerage_mandate",
      title: BROKERAGE_MANDATE_TITLE,
      pageFrom: brokerageMandatePage,
      pageTo: brokerageMandatePage,
      requiresWetSignature: false,
      fields: [
        {
          id: BROKERAGE_MANDATE_SIGNATURE_FIELD_ID,
          owner: "customer",
          type: "signature",
          label: "Unterschrift Kreditvermittlungsauftrag",
          page: 1,
          ...layout.brokerageMandateField,
        },
      ],
    },
  ]

  if (layout.insurancePage) {
    items.push({
      key: "insurance_optional",
      title: INSURANCE_OPTIONAL_TITLE,
      pageFrom: layout.insurancePage,
      pageTo: layout.insurancePage,
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
    })
  }

  items.push({
    key: "service_fee",
    title: SERVICE_FEE_TITLE,
    pageFrom: layout.serviceFeePage,
    pageTo: layout.serviceFeePage,
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
  })

  if (layout.assignmentPageFrom) {
    items.push({
      key: "assignment",
      title: ASSIGNMENT_TITLE,
      pageFrom: layout.assignmentPageFrom,
      pageTo: layout.assignmentPageFrom + 1,
      requiresWetSignature: true,
      fields: [],
    })
  }

  items.push({
    key: "precontract_info",
    title: PRECONTRACT_INFO_TITLE,
    pageFrom: layout.precontractPageFrom,
    pageTo: layout.pageCount,
    requiresWetSignature: false,
    fields: [],
  })

  return items
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

  if (normalizedTitle === normalizeTitle(BROKERAGE_MANDATE_TITLE)) {
    const signatureRequired = fields.some(
      (field) =>
        String(field?.id ?? "").trim() === BROKERAGE_MANDATE_SIGNATURE_FIELD_ID &&
        String(field?.owner ?? "").trim().toLowerCase() === "customer"
    )
    return {
      packageRelated: true,
      key: "brokerage_mandate",
      order: 20,
      stepLabel: null,
      kindLabel: signatureRequired ? "Pflichtdokument" : "Nur Download",
      description: signatureRequired
        ? "Bitte den Kreditvermittlungsauftrag prüfen und digital unterschreiben."
        : "Zur Information ansehen oder herunterladen. Keine Unterschrift erforderlich.",
      actionLabel: signatureRequired ? "Kreditvermittlungsauftrag unterschreiben" : "PDF ansehen",
      optional: false,
      downloadOnly: !signatureRequired,
      completionRequired: signatureRequired,
      requiresWetSignature: false,
    }
  }

  if (normalizedTitle === normalizeTitle(INSURANCE_OPTIONAL_TITLE)) {
    return {
      packageRelated: true,
      key: "insurance_optional",
      order: 25,
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

export function shouldSyncSchufaSignatureRequestToSkag(
  title: string | null | undefined,
  fields?: MinimalSignatureField[] | null
) {
  const meta = getSchufaFreeSignatureRequestMeta({ title, fields })
  if (meta.key === "brokerage_mandate" && !meta.completionRequired) return true
  return !meta.packageRelated
}

export function isSchufaSignatureRequestLockedUntilInvoice(
  title: string | null | undefined,
  fields?: MinimalSignatureField[] | null
) {
  const meta = getSchufaFreeSignatureRequestMeta({ title, fields })
  if (meta.key === "brokerage_mandate" && !meta.completionRequired) return false
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
