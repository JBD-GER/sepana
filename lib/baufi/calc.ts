// lib/baufi/calc.ts
export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function toNumber(v: unknown) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function formatEUR(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

export function formatPct(n: number, digits = 2) {
  return `${n.toFixed(digits).replace(".", ",")} %`
}

/**
 * Pick APR aus Term-Daten.
 * Für Baufinanzierung sind viele Felder null → fallback sauber.
 */
export function pickAprPercent(term: any) {
  const from = toNumber(term?.apr_from)
  const ex = toNumber(term?.apr_example)
  const nom = toNumber(term?.nominal_example)

  const base = from > 0 ? from : ex > 0 ? ex : nom > 0 ? nom : 3.79
  return clamp(base, 0.5, 12)
}

/**
 * leichte Individualisierung über Haushalts-Puffer (UI only).
 */
export function personalizeApr(baseApr: number, surplusRatio: number) {
  const r = Number.isFinite(surplusRatio) ? surplusRatio : 0
  let delta = 0
  if (r <= 0.06) delta = 0.45
  else if (r <= 0.10) delta = 0.28
  else if (r <= 0.14) delta = 0.18
  else if (r <= 0.18) delta = 0.10
  else if (r >= 0.30) delta = -0.10
  return clamp(baseApr + delta, 0.5, 12)
}

/** deterministischer Hash → gleiche Bank = gleiche Variation */
function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 0..1
  return (h >>> 0) / 4294967295
}

/**
 * Provider-spezifische Spread-Variation (damit nicht alle bei 3,84% landen).
 * Range: ca. -0.35 .. +0.45
 */
export function providerAprSpread(slug: string) {
  const r = hash01(slug)
  const spread = (r - 0.5) * 0.8 // ~ -0.4..+0.4
  return clamp(spread, -0.35, 0.45)
}

/**
 * Initiale Tilgung (p.a.) zwischen 1.00% und 2.00%,
 * leicht höher bei gutem Puffer.
 */
export function pickTilgungPct(slug: string, surplusRatio: number) {
  const r = hash01("tilg:" + slug)
  const base = 1.0 + r * 1.0 // 1.0..2.0
  const bonus =
    surplusRatio >= 0.25 ? 0.20 :
    surplusRatio >= 0.18 ? 0.12 :
    surplusRatio >= 0.12 ? 0.06 : 0

  return clamp(base + bonus, 1.0, 2.0)
}

/**
 * Check24-like: Monatsrate aus (Zins + Tilgung) als anfängliche Annuität.
 */
export function monthlyFromAprAndTilgung(opts: { principal: number; aprPercent: number; tilgungPct: number }) {
  const P = Math.max(0, opts.principal)
  const apr = Math.max(0, opts.aprPercent) / 100
  const t = Math.max(0, opts.tilgungPct) / 100

  const monthly = (P * (apr + t)) / 12
  const interestMonthly = (P * apr) / 12
  const principalMonthly = Math.max(0, monthly - interestMonthly)

  // Tilgung in % p.a. aus Betrag zurückgerechnet (damit Anzeige konsistent ist)
  const tilgungPctEff = P > 0 ? (principalMonthly * 12 * 100) / P : 0

  return {
    monthly,
    interestMonthly,
    principalMonthly,
    tilgungPctEff,
  }
}
