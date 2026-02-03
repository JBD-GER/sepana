export type CountryOption = {
  code: string
  label: string
}

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: string) => string[]
}

function toCountryCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

function regionCodesFromIntl() {
  if (typeof Intl === "undefined") return [] as string[]
  const intl = Intl as IntlWithSupportedValues
  if (typeof intl.supportedValuesOf === "function") {
    try {
      const rows = intl.supportedValuesOf("region").filter((row) => /^[A-Z]{2}$/.test(row))
      if (rows.length > 0) return rows
    } catch {
      // Some runtimes don't support "region" as key yet.
      return [] as string[]
    }
  }
  return [] as string[]
}

function regionCodesFallback() {
  const rows: string[] = []
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      rows.push(String.fromCharCode(i, j))
    }
  }
  return rows
}

export function getCountryOptions(locale = "de-DE") {
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return [] as CountryOption[]
  const displayNames = new Intl.DisplayNames([locale, "en"], { type: "region" })
  const regionCodes = regionCodesFromIntl()
  const candidates = regionCodes.length > 0 ? regionCodes : regionCodesFallback()

  const out: CountryOption[] = []
  for (const code of candidates) {
    const label = displayNames.of(code)
    if (!label || label === code) continue
    out.push({ code, label })
  }

  out.sort((a, b) => a.label.localeCompare(b.label, locale))
  return out
}

export function formatCountryName(value: unknown, locale = "de-DE") {
  const code = toCountryCode(value)
  if (!code) return String(value ?? "")
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return code
  return new Intl.DisplayNames([locale, "en"], { type: "region" }).of(code) ?? code
}
