import { getEuropaceConfig, type EuropaceScope } from "@/lib/europace/config"

type TokenCacheEntry = {
  accessToken: string
  tokenType: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCacheEntry>()

function normalizeScopes(scopes: EuropaceScope | EuropaceScope[]): EuropaceScope[] {
  return (Array.isArray(scopes) ? scopes : [scopes])
    .map((scope) => String(scope).trim())
    .filter(Boolean)
    .sort() as EuropaceScope[]
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function encodeBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")
}

export async function getEuropaceAccessToken(scopes: EuropaceScope | EuropaceScope[]) {
  const config = getEuropaceConfig()
  const requestedScopes = normalizeScopes(scopes)
  const actorPartnerId = trimOrNull(config.clientPartnerId)
  const subjectPartnerId =
    trimOrNull(config.privatkreditBearbeiterPartnerId) ?? trimOrNull(config.privatkreditPartnerId)
  const shouldImpersonate = Boolean(actorPartnerId && subjectPartnerId && actorPartnerId !== subjectPartnerId)
  const impersonatedScopes: EuropaceScope[] = shouldImpersonate
    ? (["impersonieren", ...requestedScopes] as EuropaceScope[])
    : requestedScopes
  const normalizedScopes = shouldImpersonate
    ? normalizeScopes(impersonatedScopes)
    : requestedScopes
  const cacheKey = [normalizedScopes.join(" "), actorPartnerId ?? "-", shouldImpersonate ? subjectPartnerId ?? "-" : "-"].join(
    "|"
  )
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 15_000) {
    return cached
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: normalizedScopes.join(" "),
  })
  if (shouldImpersonate) {
    body.set("actor", actorPartnerId as string)
    body.set("subject", subjectPartnerId as string)
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  })

  const json = (await res.json().catch(() => null)) as
    | {
        access_token?: string
        token_type?: string
        expires_in?: number
        error?: string
        error_description?: string
      }
    | null

  if (!res.ok || !json?.access_token) {
    const details = json?.error_description || json?.error || res.statusText || "token_request_failed"
    throw new Error(`Europace token request failed: ${details}`)
  }

  const entry: TokenCacheEntry = {
    accessToken: json.access_token,
    tokenType: String(json.token_type ?? "Bearer"),
    expiresAt: Date.now() + Math.max(30, Number(json.expires_in ?? 60)) * 1000,
  }
  tokenCache.set(cacheKey, entry)
  return entry
}
