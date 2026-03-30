export type EuropaceScope =
  | "impersonieren"
  | "privatkredit:vorgang:lesen"
  | "privatkredit:vorgang:schreiben"
  | "privatkredit:angebot:ermitteln"
  | "privatkredit:antrag:schreiben"
  | "privatkredit:unterlage:lesen"
  | "privatkredit:unterlage:schreiben"
  | "unterlagen:dokument:lesen"
  | "unterlagen:dokument:schreiben"
  | "unterlagen:unterlage:lesen"
  | "unterlagen:unterlage:schreiben"
  | "unterlagen:unterlage:freigeben"
  | "unterlagen:freigabe:lesen"
  | "unterlagen:freigabe:schreiben"

export type EuropaceDatenkontext = "TESTUMGEBUNG" | "ECHTGESCHAEFT"

export type EuropaceConfig = {
  tokenUrl: string
  clientId: string
  clientSecret: string
  clientPartnerId: string | null
  importUrl: string
  datenkontext: EuropaceDatenkontext
  vorgaengeApiUrl: string
  exportApiUrl: string
  angeboteApiUrl: string
  unterlagenApiUrl: string
  privatkreditPartnerId: string
  privatkreditBearbeiterPartnerId: string | null
  privatkreditLeadquelle: string | null
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function must(name: string, value: string | null) {
  if (!value) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

function normalizeEuropaceDatenkontext(value: string | undefined | null) {
  const normalized = trimOrNull(value)?.toUpperCase() ?? null
  if (!normalized) return null
  if (normalized === "ECHTGESCHAEFT" || normalized === "PRODUCTION") return "ECHTGESCHAEFT" as const
  if (
    normalized === "TESTUMGEBUNG" ||
    normalized === "TEST" ||
    normalized === "DEVELOPMENT" ||
    normalized === "PREVIEW"
  ) {
    return "TESTUMGEBUNG" as const
  }
  return null
}

function resolveEuropaceDatenkontext(importUrl: string): EuropaceDatenkontext {
  const explicitContext = normalizeEuropaceDatenkontext(process.env.EUROPACE_DATENKONTEXT)
  if (explicitContext) return explicitContext

  const explicitImportEnvironment = normalizeEuropaceDatenkontext(process.env.EUROPACE_IMPORT_ENVIRONMENT)
  if (explicitImportEnvironment) return explicitImportEnvironment

  const urlEnvironment = (() => {
    try {
      return normalizeEuropaceDatenkontext(new URL(importUrl).searchParams.get("environment"))
    } catch {
      return null
    }
  })()
  if (urlEnvironment) return urlEnvironment

  return String(process.env.VERCEL_ENV ?? "").trim().toLowerCase() === "production"
    ? "ECHTGESCHAEFT"
    : "TESTUMGEBUNG"
}

function buildEuropaceImportUrl(importUrl: string, datenkontext: EuropaceDatenkontext) {
  const url = new URL(importUrl)

  if (datenkontext === "ECHTGESCHAEFT") {
    url.searchParams.set("environment", "PRODUCTION")
  } else if (String(url.searchParams.get("environment") ?? "").trim().toUpperCase() === "PRODUCTION") {
    url.searchParams.delete("environment")
  }

  return url.toString()
}

export function getEuropaceConfig(): EuropaceConfig {
  const privatkreditPartnerId = must(
    "EUROPACE_PRIVATKREDIT_PARTNER_ID",
    trimOrNull(process.env.EUROPACE_PRIVATKREDIT_PARTNER_ID)
  )
  const privatkreditBearbeiterPartnerId =
    trimOrNull(process.env.EUROPACE_PRIVATKREDIT_BEARBEITER_PARTNER_ID) ?? privatkreditPartnerId
  const rawImportUrl = must("EUROPACE_IMPORT_URL", trimOrNull(process.env.EUROPACE_IMPORT_URL))
  const datenkontext = resolveEuropaceDatenkontext(rawImportUrl)

  return {
    tokenUrl: must("EUROPACE_TOKEN_URL", trimOrNull(process.env.EUROPACE_TOKEN_URL)),
    clientId: must("EUROPACE_CLIENT_ID", trimOrNull(process.env.EUROPACE_CLIENT_ID)),
    clientSecret: must("EUROPACE_CLIENT_SECRET", trimOrNull(process.env.EUROPACE_CLIENT_SECRET)),
    clientPartnerId: trimOrNull(process.env.EUROPACE_CLIENT_PARTNER_ID),
    importUrl: buildEuropaceImportUrl(rawImportUrl, datenkontext),
    datenkontext,
    vorgaengeApiUrl: must("EUROPACE_VORGAENGE_API_URL", trimOrNull(process.env.EUROPACE_VORGAENGE_API_URL)),
    exportApiUrl: must("EUROPACE_EXPORT_API_URL", trimOrNull(process.env.EUROPACE_EXPORT_API_URL)),
    angeboteApiUrl: must("EUROPACE_ANGEBOTE_API_URL", trimOrNull(process.env.EUROPACE_ANGEBOTE_API_URL)),
    unterlagenApiUrl: trimOrNull(process.env.EUROPACE_UNTERLAGEN_API_URL) ?? "https://api.europace2.de",
    privatkreditPartnerId,
    privatkreditBearbeiterPartnerId,
    privatkreditLeadquelle: trimOrNull(process.env.EUROPACE_PRIVATKREDIT_LEADQUELLE),
  }
}

export function hasEuropaceConfig() {
  return Boolean(
    trimOrNull(process.env.EUROPACE_TOKEN_URL) &&
      trimOrNull(process.env.EUROPACE_CLIENT_ID) &&
      trimOrNull(process.env.EUROPACE_CLIENT_SECRET) &&
      trimOrNull(process.env.EUROPACE_IMPORT_URL) &&
      trimOrNull(process.env.EUROPACE_VORGAENGE_API_URL) &&
      trimOrNull(process.env.EUROPACE_EXPORT_API_URL) &&
      trimOrNull(process.env.EUROPACE_ANGEBOTE_API_URL) &&
      trimOrNull(process.env.EUROPACE_PRIVATKREDIT_PARTNER_ID)
  )
}
