// app/(website)/baufinanzierung/auswahl/page.tsx
import Link from "next/link"
import type { Metadata } from "next"
import { headers } from "next/headers"
import {
  formatEUR,
  formatPct,
  personalizeApr,
  pickAprPercent,
  pickTilgungPct,
  providerAprSpread,
  monthlyFromAprAndTilgung,
  toNumber,
  clamp,
} from "@/lib/baufi/calc"

export const metadata: Metadata = {
  title: "Baufinanzierung Auswahl",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

function metric(label: string, value: string) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function BonusBox({ amount }: { amount: number }) {
  const amountStr = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(amount)

  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ background: ACCENT }}
          aria-hidden="true"
        >
          🎁
        </div>

        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900">Bonus bei erfolgreichem Abschluss</div>

          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <div className="text-3xl font-semibold leading-none text-slate-900">{amountStr} €</div>
            <div className="text-sm font-medium text-slate-900">extra für Sie</div>
          </div>

          <div className="mt-2 text-xs text-slate-600">
            Gutschrift nach erfolgreicher Finanzierung/Abschluss gemäß Bedingungen.
          </div>

          <div className="mt-3">
            <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl">
              Tipp: Starten Sie jetzt – dauert wirklich nur kurz.
            </div>
          </div>
        </div>
      </div>

      {/* ✅ entfernt: "350€ Bonus ist im Prozess dauerhaft sichtbar." */}
    </div>
  )
}

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000"
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}${path}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

async function postJson<T>(path: string, body: any): Promise<T | null> {
  try {
    const base = await getBaseUrl()
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json().catch(() => null)) as T | null
  } catch {
    return null
  }
}

type ProvidersResponse = {
  ok: boolean
  items: Array<{
    provider: {
      id: string
      name: string
      slug: string
      logo_horizontal_path: string | null
      logo_icon_path: string | null
      preferred_logo_variant: string | null
    }
    product: {
      is_available_online: boolean
      is_available_live: boolean
    } | null
    term: any | null
  }>
}

type MetricsResponse = {
  ok: boolean
  caseRef: string | null
  metrics: {
    income_monthly: number
    out_monthly: number
    surplus_monthly: number
    surplus_ratio: number
    co_applicants: number
  }
}

type LiveStatusResponse = {
  ok: boolean
  onlineCount: number
  availableCount: number
  waitMinutes: number
}

type SortKey = "rate" | "tilgung" | "zins"

function rankLabel(i: number) {
  if (i === 0) return "Top-Angebot"
  return `${i + 1}. Wahl`
}

function sortLabel(s: SortKey) {
  if (s === "tilgung") return "Tilgungsanteil"
  if (s === "zins") return "Effektivzins"
  return "Rate"
}

function logoUrl(provider: any) {
  const prefer = provider?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const file = prefer === "icon" ? provider?.logo_icon_path : provider?.logo_horizontal_path
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
}

function buildHref(basePath: string, qp: Record<string, string | undefined>) {
  const u = new URL("http://x" + basePath)
  for (const [k, v] of Object.entries(qp)) {
    if (v != null && String(v).length) u.searchParams.set(k, String(v))
  }
  const qs = u.searchParams.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    caseId?: string
    caseRef?: string
    existing?: string
    loanAmount?: string
    years?: string
    sort?: string
  }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const loanAmount = Math.max(50_000, toNumber(sp.loanAmount) || 300_000)
  const years = clamp(Math.round(toNumber(sp.years) || 30), 5, 35)

  const sort: SortKey = sp.sort === "tilgung" ? "tilgung" : sp.sort === "zins" ? "zins" : "rate"

  const providers = await fetchJson<ProvidersResponse>(`/api/baufi/providers?product=baufi`)
  const metricsRes = caseId
    ? await fetchJson<MetricsResponse>(
        `/api/baufi/case-metrics?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}`
      )
    : null
  const liveStatus = await fetchJson<LiveStatusResponse>(`/api/live/status`)

  const m = metricsRes?.ok ? metricsRes.metrics : null
  const surplusRatio = m?.surplus_ratio ?? 0.12

  const disclaimer =
    "Unverbindliche Konditions-Vorschau. Finale Konditionen sind tagesaktuell sowie objekt- & bonitätsabhängig."

  const activeBonusEUR = 350

  const offers =
    (providers?.items || [])
      .filter((x) => !!x.product)
      .map(({ provider, product, term }) => {
        const baseApr = pickAprPercent(term)
        const shownApr = clamp(personalizeApr(baseApr, surplusRatio) + providerAprSpread(provider.slug), 0.5, 12)

        const tilgungPct = pickTilgungPct(provider.slug, surplusRatio)
        const pay = monthlyFromAprAndTilgung({ principal: loanAmount, aprPercent: shownApr, tilgungPct })

        const availableOnline = !!product?.is_available_online
        const availableLive = !!product?.is_available_live

        const srep = term?.special_repayment_free_pct
          ? `${term.special_repayment_free_pct}% p.a.`
          : term?.special_repayment_free_note || "produktabhängig"

        const zbind =
          term?.zinsbindung_min_years || term?.zinsbindung_max_years
            ? `${term.zinsbindung_min_years ?? "—"}–${term.zinsbindung_max_years ?? "—"} Jahre`
            : "objektabhängig"

        const nextHref = buildHref("/baufinanzierung/auswahl/abschluss", {
          provider: provider.slug,
          caseId,
          caseRef,
          loanAmount: String(loanAmount),
          years: String(years),
        })

        return {
          provider,
          product,
          term,
          shownApr,
          tilgungPct,
          pay,
          availableOnline,
          availableLive,
          srep,
          zbind,
          nextHref,
        }
      }) || []

  const sorted = offers.slice().sort((a, b) => {
    if (sort === "tilgung") {
      const d = b.pay.principalMonthly - a.pay.principalMonthly
      if (d !== 0) return d
      const r = a.pay.monthly - b.pay.monthly
      if (r !== 0) return r
      return (b.availableOnline ? 0 : 1) - (a.availableOnline ? 0 : 1)
    }

    if (sort === "zins") {
      const d = a.shownApr - b.shownApr
      if (d !== 0) return d
      const r = a.pay.monthly - b.pay.monthly
      if (r !== 0) return r
      return (b.availableOnline ? 0 : 1) - (a.availableOnline ? 0 : 1)
    }

    const d = a.pay.monthly - b.pay.monthly
    if (d !== 0) return d
    const z = a.shownApr - b.shownApr
    if (z !== 0) return z
    return (b.availableOnline ? 0 : 1) - (a.availableOnline ? 0 : 1)
  })

  const sortHrefBase = {
    caseId,
    caseRef,
    existing: existing ? "1" : undefined,
    loanAmount: String(loanAmount),
    years: String(years),
  } as Record<string, string | undefined>

  const hrefRate = buildHref("/baufinanzierung/auswahl", { ...sortHrefBase, sort: "rate" })
  const hrefTilg = buildHref("/baufinanzierung/auswahl", { ...sortHrefBase, sort: "tilgung" })
  const hrefZins = buildHref("/baufinanzierung/auswahl", { ...sortHrefBase, sort: "zins" })
  const liveHref = buildHref("/baufinanzierung/auswahl/live", {
    caseId,
    caseRef,
    existing: existing ? "1" : undefined,
  })

  // ✅ Startschuss: sobald der Kunde auf /auswahl ist, Snapshot zum Top-Angebot speichern
  const startschuss = sorted[0]
  if (caseId && startschuss?.provider?.id) {
    await postJson("/api/baufi/offer-preview", {
      caseId,
      providerId: startschuss.provider.id,
      productType: "baufi",
      payload: {
        kind: "baufi_comparison_preview",
        caseRef: metricsRes?.caseRef || caseRef || null,
        provider: {
          id: startschuss.provider.id,
          slug: startschuss.provider.slug,
          name: startschuss.provider.name,
          logo: {
            horizontal: startschuss.provider.logo_horizontal_path ?? null,
            icon: startschuss.provider.logo_icon_path ?? null,
            preferred: startschuss.provider.preferred_logo_variant ?? "horizontal",
          },
        },
        inputs: {
          loanAmount,
          years,
          surplusRatio,
        },
        computed: {
          rateMonthly: startschuss.pay.monthly,
          aprEffective: startschuss.shownApr,
          tilgungPctEff: startschuss.pay.tilgungPctEff,
          interestMonthly: startschuss.pay.interestMonthly,
          principalMonthly: startschuss.pay.principalMonthly,
          zinsbindung: startschuss.zbind,
          specialRepayment: startschuss.srep,
        },
        term: startschuss.term ?? null,
        createdAt: new Date().toISOString(),
      },
    })
  }

  return (
    <div className="space-y-4">
{/* HERO (mit Bonus-Box rechts + Metrics volle Breite unten) */}
<div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
    {/* TOP LEFT */}
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill>DSGVO-konform</Pill>
        <Pill>Banken übersichtlich</Pill>
        <Pill>Start im Portal</Pill>
        {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
      </div>

      {liveStatus?.ok && caseId ? (
        <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Live-Beratung</div>
              <div className="mt-1 text-sm text-slate-600">
                {liveStatus.onlineCount > 0
                  ? liveStatus.availableCount > 0
                    ? "Jetzt sofort live mit einem Berater sprechen."
                    : "Alle Berater sind im Gespraech. Wartezeit ca. 15 Minuten."
                  : "Aktuell kein Berater online."}
              </div>
            </div>

            {liveStatus.onlineCount > 0 ? (
              <Link
                href={liveHref}
                className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
                style={{ background: ACCENT }}
              >
                Live-Beratung starten
              </Link>
            ) : (
              <div className="text-xs text-slate-500">Bitte spaeter erneut versuchen.</div>
            )}
          </div>
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
        Wählen Sie jetzt Ihre Bank –<br className="hidden sm:block" />
        dann starten Sie den Abschluss.
      </h1>

      <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
        Ihre Angaben sind gespeichert. Sie wählen eine Bank und können anschließend direkt im Portal starten.
      </p>
    </div>

    {/* TOP RIGHT */}
    <div className="lg:pt-1">
      <BonusBox amount={activeBonusEUR} />
    </div>

    {/* ✅ BOTTOM: volle Breite über beide Spalten */}
    <div className="space-y-3 lg:col-span-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metric("Fall-Referenz", metricsRes?.caseRef || caseRef || "—")}
        {metric("Darlehen (Beispiel)", formatEUR(loanAmount))}
        {metric("Laufzeit (Beispiel)", `${years} Jahre`)}
      </div>

      {m ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metric("Einnahmen/Monat", formatEUR(m.income_monthly))}
          {metric("Ausgaben/Monat", formatEUR(m.out_monthly))}
          {metric("Puffer/Monat", formatEUR(m.surplus_monthly))}
        </div>
      ) : null}

      <div className="text-xs text-slate-500">{disclaimer}</div>
    </div>
  </div>
</div>


      {/* ✅ SORT BAR – volle Breite */}
      <div className="w-full rounded-3xl border border-white/60 bg-white/65 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-900">
            Sortierung: <span className="text-slate-600">{sortLabel(sort)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Link
              href={hrefRate}
              className={[
                "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-medium shadow-sm ring-1 ring-inset backdrop-blur-xl transition active:scale-[0.99]",
                sort === "rate"
                  ? "text-white"
                  : "border border-slate-200/80 bg-white/70 text-slate-900 ring-white/40 hover:bg-white/90 hover:border-slate-300",
              ].join(" ")}
              style={sort === "rate" ? { background: ACCENT } : undefined}
            >
              Rate
            </Link>

            <Link
              href={hrefTilg}
              className={[
                "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-medium shadow-sm ring-1 ring-inset backdrop-blur-xl transition active:scale-[0.99]",
                sort === "tilgung"
                  ? "text-white"
                  : "border border-slate-200/80 bg-white/70 text-slate-900 ring-white/40 hover:bg-white/90 hover:border-slate-300",
              ].join(" ")}
              style={sort === "tilgung" ? { background: ACCENT } : undefined}
            >
              Tilgung
            </Link>

            <Link
              href={hrefZins}
              className={[
                "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-medium shadow-sm ring-1 ring-inset backdrop-blur-xl transition active:scale-[0.99]",
                sort === "zins"
                  ? "text-white"
                  : "border border-slate-200/80 bg-white/70 text-slate-900 ring-white/40 hover:bg-white/90 hover:border-slate-300",
              ].join(" ")}
              style={sort === "zins" ? { background: ACCENT } : undefined}
            >
              Zins
            </Link>
          </div>
        </div>
      </div>

      {/* BANK LIST */}
      <div className="space-y-4">
        {sorted.map((o, i) => {
          const top = i === 0
          const logo = logoUrl(o.provider)
          const statusPill = o.availableOnline ? "Online-Abschluss möglich" : "Abschluss mit Beratung"

          const note =
            o.term?.features?.ui_disclaimer ||
            "Unverbindliche Konditions-Vorschau. Finale Konditionen erst nach Prüfung."

          return (
            <div
              key={o.provider.id}
              className={[
                "relative overflow-hidden rounded-[2rem] border bg-white/70 p-4 shadow-sm backdrop-blur-xl transition sm:p-6",
                top ? "border-slate-900/80 shadow-md" : "border-white/60 hover:bg-white/80 hover:shadow-md",
              ].join(" ")}
            >
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.10] blur-3xl"
                style={{ background: ACCENT }}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <img
                        src={logo}
                        alt={o.provider.name}
                        className="h-8 w-auto max-w-[160px] object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-slate-900">{o.provider.name}</div>
                    )}

                    <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] text-slate-700 shadow-sm backdrop-blur-xl">
                      {statusPill}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-600">
                    {o.term?.rate_note || "tagesaktuell / objekt- & bonitätsabhängig (Orientierungswert)"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={[
                      "rounded-full px-3 py-1 text-xs font-medium shadow-sm",
                      top ? "text-white" : "text-slate-700 border border-white/60 bg-white/70",
                    ].join(" ")}
                    style={top ? { background: ACCENT } : undefined}
                  >
                    {rankLabel(i)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-[11px] text-slate-600">Monatsrate</div>
                  <div className="mt-0.5 text-xl font-semibold text-slate-900">{formatEUR(o.pay.monthly)}</div>
                  <div className="mt-1 text-xs text-slate-600">bei {formatPct(o.pay.tilgungPctEff, 2)} Tilgung</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-[11px] text-slate-600">Effektivzins</div>
                  <div className="mt-0.5 text-xl font-semibold text-slate-900">{formatPct(o.shownApr)}</div>
                  <div className="mt-1 text-xs text-slate-600">individuelle Vorschau</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-[11px] text-slate-600">Zinsbindung</div>
                  <div className="mt-0.5 text-base font-semibold text-slate-900">{o.zbind}</div>
                  <div className="mt-1 text-xs text-slate-600">Beispielbereich</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-[11px] text-slate-600">Sondertilgung</div>
                  <div className="mt-0.5 text-base font-semibold text-slate-900">{o.srep}</div>
                  <div className="mt-1 text-xs text-slate-600">vertraglich geregelt</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-xs font-medium text-slate-900">Erste Rate (Aufteilung)</div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-700">Zinsanteil</div>
                    <div className="text-right font-semibold text-slate-900">{formatEUR(o.pay.interestMonthly)}</div>

                    <div className="text-slate-700">Tilgungsanteil</div>
                    <div className="text-right font-semibold text-slate-900">
                      {formatEUR(o.pay.principalMonthly)}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({formatPct(o.pay.tilgungPctEff, 2)} p.a.)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3">
                  <div className="text-xs font-medium text-slate-900">Konditionen (Hinweise)</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
                      <span>
                        {o.term?.repayment_change_note
                          ? `Tilgungswechsel: ${o.term.repayment_change_note}`
                          : "Tilgungswechsel: vertraglich"}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
                      <span className="text-slate-600">{note}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href={o.nextHref}
                  className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
                  style={{ background: ACCENT }}
                >
                  Bank auswählen
                </Link>

                <div className="text-xs text-slate-500">
                  {o.availableOnline ? "Sie können später jederzeit wechseln." : "Auch später jederzeit wechselbar."}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-3xl border border-white/60 bg-white/55 p-4 text-sm text-slate-600 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Fall-Referenz:{" "}
            <span className="font-medium text-slate-900">{metricsRes?.caseRef || caseRef || "—"}</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-slate-900 underline underline-offset-4">
            Ich habe schon ein Konto → anmelden
          </Link>
        </div>
      </div>
    </div>
  )
}
