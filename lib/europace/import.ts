import { getEuropaceAccessToken } from "@/lib/europace/auth"
import { getEuropaceConfig } from "@/lib/europace/config"
import { EuropaceGraphQLError } from "@/lib/europace/graphql"
import type { EuropaceImportResult } from "@/lib/europace/types"

export async function importEuropaceVorgang(input: {
  partnerId: string
  firstName: string
  lastName: string
  bearbeiterPartnerId?: string | null
  leadquelle?: string | null
}) {
  const config = getEuropaceConfig()
  const token = await getEuropaceAccessToken("privatkredit:vorgang:schreiben")

  const payload = {
    kundenbetreuer: {
      partnerId: input.partnerId,
    },
    ...(input.bearbeiterPartnerId
      ? {
          bearbeiter: {
            partnerId: input.bearbeiterPartnerId,
          },
        }
      : {}),
    ...(input.leadquelle
      ? {
          leadquelle: input.leadquelle,
        }
      : {}),
    antragsteller1: {
      personendaten: {
        vorname: input.firstName,
        nachname: input.lastName,
      },
    },
  }

  const res = await fetch(config.importUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `${token.tokenType} ${token.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const json = (await res.json().catch(() => null)) as EuropaceImportResult | { message?: string } | null

  if (!res.ok || !json) {
    const message =
      (json && typeof json === "object" && "message" in json ? String(json.message ?? "") : "") ||
      `Europace Import failed with HTTP ${res.status}`
    throw new EuropaceGraphQLError(message, json)
  }

  return json as EuropaceImportResult
}
