import { createHmac, timingSafeEqual } from "node:crypto"
import { trimOrNull } from "@/lib/financial-analysis/service"

type FinancialAnalysisTokenPayload = {
  serviceId: string
  caseId: string
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

function getFinancialAnalysisPublicSecret() {
  const secret =
    trimOrNull(process.env.PUBLIC_FINANCIAL_ANALYSIS_SECRET) ??
    trimOrNull(process.env.PUBLIC_CASE_ACCESS_SECRET) ??
    trimOrNull(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
    trimOrNull(process.env.CRON_SECRET) ??
    trimOrNull(process.env.SYSTEM_CRON_SECRET)

  if (!secret) {
    throw new Error("Missing secret for financial analysis public token.")
  }

  return secret
}

function signPayload(payloadBase64: string) {
  return createHmac("sha256", getFinancialAnalysisPublicSecret()).update(payloadBase64).digest("base64url")
}

export function createFinancialAnalysisPublicToken(input: {
  serviceId: string
  caseId: string
  ttlSeconds?: number
}) {
  const serviceId = trimOrNull(input.serviceId)
  const caseId = trimOrNull(input.caseId)
  if (!serviceId || !caseId) {
    throw new Error("serviceId und caseId werden benötigt.")
  }

  const issuedAt = Math.floor(Date.now() / 1000)
  const ttlSeconds = Math.max(300, Number(input.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS) || DEFAULT_TOKEN_TTL_SECONDS)
  const expiresAt = issuedAt + ttlSeconds

  const payloadBase64 = base64UrlEncode(
    JSON.stringify({
      serviceId,
      caseId,
      issuedAt,
      expiresAt,
    } satisfies FinancialAnalysisTokenPayload)
  )

  return `${payloadBase64}.${signPayload(payloadBase64)}`
}

export function verifyFinancialAnalysisPublicToken(token: string) {
  const normalized = trimOrNull(token)
  if (!normalized) return null

  const [payloadBase64, signature] = normalized.split(".")
  if (!payloadBase64 || !signature) return null

  const expectedSignature = signPayload(payloadBase64)
  const left = Buffer.from(signature)
  const right = Buffer.from(expectedSignature)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadBase64)) as FinancialAnalysisTokenPayload
    const now = Math.floor(Date.now() / 1000)
    if (!parsed?.serviceId || !parsed?.caseId || !parsed?.expiresAt || parsed.expiresAt < now) return null
    return parsed
  } catch {
    return null
  }
}
