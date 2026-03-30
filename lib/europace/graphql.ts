import { getEuropaceAccessToken } from "@/lib/europace/auth"
import { getEuropaceConfig, type EuropaceScope } from "@/lib/europace/config"

export class EuropaceGraphQLError extends Error {
  details: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = "EuropaceGraphQLError"
    this.details = details ?? null
  }
}

type GraphQlResponse<TData> = {
  data?: TData | null
  errors?: Array<{ message?: string; path?: Array<string | number>; status?: number }>
}

export type EuropaceGraphqlApi = "vorgaenge" | "export" | "angebote"

function getGraphqlUrl(api: EuropaceGraphqlApi) {
  const config = getEuropaceConfig()
  if (api === "vorgaenge") return config.vorgaengeApiUrl
  if (api === "export") return config.exportApiUrl
  return config.angeboteApiUrl
}

export async function europaceGraphqlRequest<TData, TVariables = Record<string, unknown>>(opts: {
  api: EuropaceGraphqlApi
  document: string
  variables?: TVariables
  scopes: EuropaceScope | EuropaceScope[]
}) {
  const token = await getEuropaceAccessToken(opts.scopes)

  const res = await fetch(getGraphqlUrl(opts.api), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `${token.tokenType} ${token.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: opts.document,
      variables: opts.variables ?? {},
    }),
    cache: "no-store",
  })

  const json = (await res.json().catch(() => null)) as GraphQlResponse<TData> | null

  if (!res.ok) {
    throw new EuropaceGraphQLError(`Europace GraphQL request failed with HTTP ${res.status}`, json)
  }

  if (json?.errors?.length) {
    const message = json.errors.map((entry) => String(entry?.message ?? "GraphQL error")).join(" | ")
    throw new EuropaceGraphQLError(message, json.errors)
  }

  if (!json?.data) {
    throw new EuropaceGraphQLError("Europace GraphQL response has no data", json)
  }

  return json.data
}
