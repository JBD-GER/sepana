function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export type SkagApiVariant = "standard" | "open" | "full-service"

function mustEnv(name: string, value: unknown) {
  const trimmed = trimOrNull(value)
  if (!trimmed) throw new Error(`Missing env: ${name}`)
  return trimmed
}

export function getSkagStandardApiBaseUrl() {
  return getSkagApiBaseUrl("standard")
}

export function getSkagApiBaseUrl(variant: SkagApiVariant = "standard") {
  switch (variant) {
    case "open":
      return trimOrNull(process.env.SKAG_OPEN_API_BASE_URL) ?? "https://api.partner.skag.gmbh/open"
    case "full-service":
      return trimOrNull(process.env.SKAG_FULL_SERVICE_API_BASE_URL) ?? "https://api.partner.skag.gmbh/full-service"
    default:
      return trimOrNull(process.env.SKAG_STANDARD_API_BASE_URL) ?? "https://api.partner.skag.gmbh/standard"
  }
}

export function hasDedicatedSkagVariantCredentials(variant: Exclude<SkagApiVariant, "standard">) {
  if (variant === "open") {
    return Boolean(
      trimOrNull(process.env.SKAG_OPEN_USERNAME) &&
        trimOrNull(process.env.SKAG_OPEN_PASSWORD) &&
        trimOrNull(process.env.SKAG_OPEN_API_KEY)
    )
  }

  return Boolean(
    trimOrNull(process.env.SKAG_FULL_SERVICE_USERNAME) &&
      trimOrNull(process.env.SKAG_FULL_SERVICE_PASSWORD) &&
      trimOrNull(process.env.SKAG_FULL_SERVICE_API_KEY)
  )
}

export function getSkagConfig(variant: SkagApiVariant = "standard") {
  if (variant === "open") {
    return {
      baseUrl: getSkagApiBaseUrl("open"),
      username: mustEnv("SKAG_OPEN_USERNAME", process.env.SKAG_OPEN_USERNAME ?? process.env.SKAG_STANDARD_USERNAME),
      password: mustEnv("SKAG_OPEN_PASSWORD", process.env.SKAG_OPEN_PASSWORD ?? process.env.SKAG_STANDARD_PASSWORD),
      apiKey: mustEnv("SKAG_OPEN_API_KEY", process.env.SKAG_OPEN_API_KEY ?? process.env.SKAG_STANDARD_API_KEY),
    }
  }

  if (variant === "full-service") {
    return {
      baseUrl: getSkagApiBaseUrl("full-service"),
      username: mustEnv(
        "SKAG_FULL_SERVICE_USERNAME",
        process.env.SKAG_FULL_SERVICE_USERNAME ?? process.env.SKAG_STANDARD_USERNAME
      ),
      password: mustEnv(
        "SKAG_FULL_SERVICE_PASSWORD",
        process.env.SKAG_FULL_SERVICE_PASSWORD ?? process.env.SKAG_STANDARD_PASSWORD
      ),
      apiKey: mustEnv(
        "SKAG_FULL_SERVICE_API_KEY",
        process.env.SKAG_FULL_SERVICE_API_KEY ?? process.env.SKAG_STANDARD_API_KEY
      ),
    }
  }

  return {
    baseUrl: getSkagApiBaseUrl("standard"),
    username: mustEnv("SKAG_STANDARD_USERNAME", process.env.SKAG_STANDARD_USERNAME),
    password: mustEnv("SKAG_STANDARD_PASSWORD", process.env.SKAG_STANDARD_PASSWORD),
    apiKey: mustEnv("SKAG_STANDARD_API_KEY", process.env.SKAG_STANDARD_API_KEY),
  }
}

export function getSkagPushCredentials() {
  const username = mustEnv("SKAG_PUSH_BASIC_USER", process.env.SKAG_PUSH_BASIC_USER)
  const password = mustEnv("SKAG_PUSH_BASIC_PASS", process.env.SKAG_PUSH_BASIC_PASS)
  return { username, password }
}
