import type { CreditoloPayload, CreditoloVariant } from "./mapper"

export type CreditoloResult = {
  code: number
  delivered: boolean
  clientId: string | null
  loginUrl: string | null
  fields: string[]
}
export function parseCreditoloResponse(value: unknown): CreditoloResult {
  let row = value as Record<string, unknown>
  if (Array.isArray(row)) row = row[0] as Record<string, unknown>
  if (row?.creditolo) row = row.creditolo as Record<string, unknown>
  if (row?.response) row = row.response as Record<string, unknown>
  if (!row || typeof row !== "object" || !Number.isInteger(Number(row.code)))
    throw new Error("invalid_creditolo_response")
  const code = Number(row.code)
  const success = row.result === true || row.result === "true"
  const login = text(row.loginlink)
  let loginUrl: string | null = null
  if (login) {
    try {
      const u = new URL(login)
      if (u.protocol === "https:" && (u.hostname === "creditolo.de" || u.hostname.endsWith(".creditolo.de")))
        loginUrl = u.toString()
    } catch {}
  }
  // Preserve field identifiers only; upstream messages may echo customer data.
  const fields =
    row.fields && typeof row.fields === "object"
      ? Object.keys(row.fields).filter((k) => /^[a-z_]{2,30}$/.test(k))
      : []
  return {
    code,
    delivered: success && [11, 12, 13].includes(code),
    clientId: success ? text(row.client) : null,
    loginUrl,
    fields,
  }
}
function text(v: unknown) {
  return v == null ? null : String(v).trim() || null
}

export async function sendCreditolo(
  payload: CreditoloPayload,
  variant: CreditoloVariant,
  fetcher: typeof fetch = fetch,
) {
  const key = process.env.CREDITOLO_API_KEY
  const partner = process.env.CREDITOLO_PARTNER_ID
  if (!key || !partner) throw new Error("creditolo_not_configured")
  if (
    process.env.VERCEL_ENV !== "production" &&
    !(payload[3]?.vorn === "Test" && payload[3]?.name === "Test")
  )
    throw new Error("creditolo_preview_requires_test_names")
  const endpoint =
    variant === "schufa_free"
      ? "https://webservice.creditolo.de/webservice_kos.php?json"
      : "https://webservice.creditolo.de/webservice.php?json"
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify([{ ...payload[0], affid: partner, apikey: key }, ...payload.slice(1)]),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
    redirect: "error",
  })
  if (!response.ok) throw new Error(`creditolo_http_${response.status}`)
  return parseCreditoloResponse(await response.json())
}
