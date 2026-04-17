import { getSkagConfig, type SkagApiVariant } from "@/lib/skag/config"

type JsonRecord = Record<string, unknown>

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  const normalized = String(value ?? "").trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "success" || normalized === "ok"
}

function scalarToString(value: unknown) {
  if (typeof value === "string") return trimOrNull(value)
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function stringifyOrNull(value: unknown) {
  try {
    return trimOrNull(JSON.stringify(value))
  } catch {
    return null
  }
}

function describeStructuredError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null

  const record = value as JsonRecord
  const description =
    scalarToString(record.description) ??
    scalarToString(record.message) ??
    scalarToString(record.error_description) ??
    scalarToString(record.error)
  const data = record.data

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fieldNames = Object.keys(data as JsonRecord).filter(Boolean)
    if (fieldNames.length) {
      return description ? `${description}: ${fieldNames.join(", ")}` : fieldNames.join(", ")
    }
  }

  if (Array.isArray(data) && data.length) {
    const entries = data
      .map((entry) => scalarToString(entry) ?? describeStructuredError(entry) ?? stringifyOrNull(entry))
      .filter(Boolean)
    if (entries.length) {
      return description ? `${description}: ${entries.join(", ")}` : entries.join(", ")
    }
  }

  const code = scalarToString(record.code)
  if (description && code) return `${description} (code ${code})`
  return description ?? code ?? stringifyOrNull(value)
}

async function parseJsonResponse(response: Response) {
  const text = await response.text().catch(() => "")
  if (!text.trim()) return { rawText: text, json: null as JsonRecord | null }
  try {
    return { rawText: text, json: JSON.parse(text) as JsonRecord }
  } catch {
    return { rawText: text, json: null as JsonRecord | null }
  }
}

function findFirstString(input: unknown, keys: string[]): string | null {
  if (!input || typeof input !== "object") return null
  const record = input as JsonRecord

  for (const key of keys) {
    const direct = scalarToString(record[key])
    if (direct) return direct
  }

  for (const nestedKey of ["data", "result", "payload", "response", "user"]) {
    const nested = record[nestedKey]
    if (nested && typeof nested === "object") {
      const nestedResult = findFirstString(nested, keys)
      if (nestedResult) return nestedResult
    }
  }

  return null
}

function extractErrorMessage(json: JsonRecord | null, rawText: string) {
  if (json) {
    const errors = json.errors
    if (Array.isArray(errors) && errors.length) {
      return errors
        .map((entry) => {
          if (typeof entry === "string") return entry.trim()
          if (entry && typeof entry === "object") {
            const nested = [
              trimOrNull((entry as JsonRecord).message),
              trimOrNull((entry as JsonRecord).error),
              trimOrNull((entry as JsonRecord).error_description),
              trimOrNull((entry as JsonRecord).field),
            ].filter(Boolean)
            return nested.join(": ") || JSON.stringify(entry)
          }
          return String(entry ?? "").trim()
        })
        .filter(Boolean)
        .join("; ")
    }

    const structuredError = describeStructuredError(json.error)
    if (structuredError) return structuredError

    const error =
      trimOrNull(json.error) ??
      trimOrNull(json.message) ??
      trimOrNull(json.error_description) ??
      trimOrNull(json.error_type) ??
      scalarToString(json.description)
    if (error) return error
  }

  return trimOrNull(rawText) ?? "SEPANA-Anfrage fehlgeschlagen."
}

function isSkagSuccessLike(json: JsonRecord | null, responseOk: boolean) {
  if (!json) return responseOk

  if (json.success !== undefined) {
    return asBoolean(json.success)
  }

  const status = String(json.status ?? "").trim().toLowerCase()
  if (status) {
    if (["success", "ok"].includes(status)) return true
    if (["error", "failed", "fail"].includes(status)) return false
  }

  return responseOk
}

function leadEndpointCandidates() {
  return ["credit-application", "process-lead"] as const
}

function buildSkagHeaders(input: {
  authorization: string
  apiKey?: string
  contentType?: "application/json"
}) {
  return {
    Authorization: input.authorization,
    Accept: "application/json",
    ...(input.apiKey ? { "X-Api-Key": input.apiKey } : {}),
    ...(input.contentType ? { "Content-Type": input.contentType } : {}),
  }
}

export async function getSkagAccessToken(variant: SkagApiVariant = "standard") {
  const config = getSkagConfig(variant)
  const basicAuth = Buffer.from(`${config.username}:${config.password}`).toString("base64")
  const response = await fetch(`${config.baseUrl}/get-token`, {
    method: "POST",
    headers: buildSkagHeaders({
      authorization: `Basic ${basicAuth}`,
      apiKey: config.apiKey,
      contentType: "application/json",
    }),
    body: "{}",
    cache: "no-store",
  })

  const parsed = await parseJsonResponse(response)
  if (!response.ok || !isSkagSuccessLike(parsed.json, response.ok)) {
    throw new Error(extractErrorMessage(parsed.json, parsed.rawText))
  }

  const accessToken = trimOrNull(parsed.json?.access_token)
  if (!accessToken) throw new Error("SEPANA hat kein Zugriffstoken zurückgegeben.")
  return accessToken
}

export async function processSkagLead(payload: JsonRecord, variant: SkagApiVariant = "standard") {
  const config = getSkagConfig(variant)
  const accessToken = await getSkagAccessToken(variant)
  const endpoints = leadEndpointCandidates()
  let lastError: Error | null = null

  for (const endpoint of endpoints) {
    const response = await fetch(`${config.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: buildSkagHeaders({
        authorization: `Bearer ${accessToken}`,
        apiKey: config.apiKey,
        contentType: "application/json",
      }),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const parsed = await parseJsonResponse(response)
    const successLike = isSkagSuccessLike(parsed.json, response.ok)

    if (response.ok && successLike) {
      const creditId = findFirstString(parsed.json, ["credit_id", "creditId", "order_id", "orderId", "internal_id", "internalId"])
      const clientId = findFirstString(parsed.json, ["client_id", "clientId"])

      return {
        rawText: parsed.rawText,
        raw: parsed.json,
        creditId,
        clientId,
      }
    }

    const baseMessage = extractErrorMessage(parsed.json, parsed.rawText)
    const fallbackMessage = baseMessage.startsWith("{")
      ? `SEPANA-Endpunkt ${endpoint} antwortete mit ${response.status} ${response.statusText || ""}`.trim()
      : baseMessage
    lastError = new Error(fallbackMessage)

    if (response.status !== 404) break
  }

  throw lastError ?? new Error("SEPANA-Anfrage fehlgeschlagen.")
}

type UploadAttempt = {
  url: string
  includeCreditIdField: boolean
}

export async function uploadSkagDocument(input: {
  creditId: string
  fileName: string
  contentType: string
  data: ArrayBuffer
  variant?: SkagApiVariant
  documentType?: "unterlagen" | "bankeinreichung"
}) {
  const variant = input.variant ?? "standard"
  const documentType = input.documentType ?? "unterlagen"
  const config = getSkagConfig(variant)
  const accessToken = await getSkagAccessToken(variant)
  const attempts: UploadAttempt[] = [
    {
      url: `${config.baseUrl}/upload-document/${encodeURIComponent(input.creditId)}`,
      includeCreditIdField: false,
    },
    {
      url: `${config.baseUrl}/upload-document`,
      includeCreditIdField: true,
    },
  ]

  let lastError: Error | null = null

  for (const attempt of attempts) {
    try {
      const form = new FormData()
      const blob = new Blob([input.data], { type: input.contentType || "application/octet-stream" })
      form.set("file", blob, input.fileName)
      form.set("type", documentType)
      if (attempt.includeCreditIdField) {
        form.set("credit_id", input.creditId)
      }

      const response = await fetch(attempt.url, {
        method: "POST",
        headers: buildSkagHeaders({
          authorization: `Bearer ${accessToken}`,
          apiKey: config.apiKey,
        }),
        body: form,
        cache: "no-store",
      })

      const parsed = await parseJsonResponse(response)
      const successLike = isSkagSuccessLike(parsed.json, response.ok)
      if (!response.ok || !successLike) {
        throw new Error(extractErrorMessage(parsed.json, parsed.rawText))
      }

      return {
        rawText: parsed.rawText,
        raw: parsed.json,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("SEPANA-Dokumentenupload fehlgeschlagen.")
    }
  }

  throw lastError ?? new Error("SEPANA-Dokumentenupload fehlgeschlagen.")
}
