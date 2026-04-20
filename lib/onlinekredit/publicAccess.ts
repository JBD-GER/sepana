import { createHmac, timingSafeEqual } from "node:crypto"

type PublicCaseTokenPayload = {
  caseId: string
  caseRef: string
  customerId: string | null
  issuedAt: number
  expiresAt: number
}

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url")
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8")
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function getPublicCaseAccessSecret() {
  const secret =
    trimOrNull(process.env.PUBLIC_CASE_ACCESS_SECRET) ??
    trimOrNull(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
    trimOrNull(process.env.SUPABASE_SERVICE_ROLE) ??
    trimOrNull(process.env.CRON_SECRET) ??
    trimOrNull(process.env.SYSTEM_CRON_SECRET) ??
    trimOrNull(process.env.EUROPACE_CLIENT_SECRET)

  if (!secret) {
    throw new Error("Missing secret for public case access token.")
  }

  return secret
}

function signPayload(payloadBase64: string) {
  return createHmac("sha256", getPublicCaseAccessSecret()).update(payloadBase64).digest("base64url")
}

export function createPublicCaseAccessToken(input: {
  caseId: string
  caseRef: string
  customerId?: string | null
  ttlSeconds?: number
}) {
  const caseId = trimOrNull(input.caseId)
  const caseRef = trimOrNull(input.caseRef)
  if (!caseId || !caseRef) {
    throw new Error("caseId und caseRef werden fuer den Public-Access-Token benoetigt.")
  }

  const issuedAt = Math.floor(Date.now() / 1000)
  const ttlSeconds = Math.max(300, Number(input.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS)
  const expiresAt = issuedAt + ttlSeconds

  const payload: PublicCaseTokenPayload = {
    caseId,
    caseRef,
    customerId: trimOrNull(input.customerId) ?? null,
    issuedAt,
    expiresAt,
  }

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(payloadBase64)
  return `${payloadBase64}.${signature}`
}

export function verifyPublicCaseAccessToken(input: {
  token: string
  caseId: string
  caseRef: string
}) {
  const token = trimOrNull(input.token)
  const expectedCaseId = trimOrNull(input.caseId)
  const expectedCaseRef = trimOrNull(input.caseRef)
  if (!token || !expectedCaseId || !expectedCaseRef) return null

  const [payloadBase64, signature] = token.split(".")
  if (!payloadBase64 || !signature) return null

  const expectedSignature = signPayload(payloadBase64)
  const left = Buffer.from(signature)
  const right = Buffer.from(expectedSignature)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadBase64)) as PublicCaseTokenPayload
    const now = Math.floor(Date.now() / 1000)
    if (!parsed || parsed.caseId !== expectedCaseId || parsed.caseRef !== expectedCaseRef) return null
    if (!parsed.expiresAt || parsed.expiresAt < now) return null
    return parsed
  } catch {
    return null
  }
}

export function buildOnlinekreditApplicationHref(input: {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount?: boolean
}) {
  const params = new URLSearchParams({
    caseId: input.caseId,
    caseRef: input.caseRef,
    access: input.accessToken,
  })

  if (input.existingAccount) params.set("existing", "1")

  return `/onlinekredit/antrag?${params.toString()}`
}

export function buildSchufaFreeApplicationHref(input: {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount?: boolean
}) {
  const params = new URLSearchParams({
    caseId: input.caseId,
    caseRef: input.caseRef,
    access: input.accessToken,
  })

  if (input.existingAccount) params.set("existing", "1")

  return `/kredit-ohne-schufa/antrag?${params.toString()}`
}
