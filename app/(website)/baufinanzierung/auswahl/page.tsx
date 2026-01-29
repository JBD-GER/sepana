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

function rankLabel(i: number) {
  if (i === 0) return "Top-Angebot"
  return `${i + 1}. Wahl`
}

// ✅ Logo kommt aus Supabase Storage (Bucket logo_banken) über unsere Route
function logoUrl(provider: any) {
  const prefer = provider?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const file = prefer === "icon" ? provider?.logo_icon_path : provider?.logo_horizontal_path
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
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
  }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const loanAmount = Math.max(50_000, toNumber(sp.loanAmount) || 300_000)
  const years = clamp(Math.round(toNumber(sp.years) || 30), 5, 35)

  const providers = await fetchJson<ProvidersResponse>(`/api/baufi/providers?product=baufi`)
  const metricsRes = caseId
    ? await fetchJson<MetricsResponse>(
        `/api/baufi/case-metrics?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}`
      )
    : null

  const m = metricsRes?.ok ? metricsRes.metrics : null
  const surplusRatio = m?.surplus_ratio ?? 0.12

  const liveHref = `/baufinanzierung/auswahl/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(
    caseRef
  )}${existing ? "&existing=1" : ""}`

  const disclaimer =
    "Unverbindliche Konditions-Vorschau. Finale Konditionen sind tagesaktuell sowie objekt- & bonitätsabhängig."

  // ✅ Build offers: Variation + Tilgung + Rate Split
  const offers =
    (providers?.items || []).map(({ provider, product, term }) => {
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

      const nextHref = `/baufinanzierung/auswahl/abschluss?provider=${encodeURIComponent(
        provider.slug
      )}&caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}&loanAmount=${encodeURIComponent(
        String(loanAmount)
      )}&years=${encodeURIComponent(String(years))}`

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

  // ✅ Sort: erst online-abschließbar nach günstigster Monatsrate, dann der Rest
  const sorted = offers
    .slice()
    .sort((a, b) => {
      const ao = a.availableOnline ? 0 : 1
      const bo = b.availableOnline ? 0 : 1
      if (ao !== bo) return ao - bo
      return a.pay.monthly - b.pay.monthly
    })

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          {/* LEFT */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Pill>DSGVO-konform</Pill>
              <Pill>Banken übersichtlich</Pill>
              <Pill>Start im Portal</Pill>
              {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
            </div>

            <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              Wählen Sie jetzt Ihre Bank –<br className="hidden sm:block" />
              dann starten Sie den Abschluss.
            </h1>

            <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
              Ihre Angaben sind gespeichert. Sie wählen eine Bank und können anschließend direkt im Portal starten.
              Wenn es knapp/komplex ist, wechseln Sie zur Live-Beratung.
            </p>

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

          {/* RIGHT: LIVE BOX */}
          <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: ACCENT }}
              >
                ☎
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">Live-Beratung</div>
                <div className="mt-1 text-xs text-slate-600">
                  Wenn es knapp/komplex ist: lieber einmal sauber prüfen als Ablehnungen sammeln.
                </div>
              </div>
            </div>

            <Link
              href={liveHref}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl transition hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
            >
              Zur Live-Beratung
            </Link>
          </div>
        </div>
      </div>

      {/* BANK LIST – volle Breite, nicht eng */}
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

              {/* Header row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      // ✅ absichtlich <img>, damit kein Next-Optimizer-Stress
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

              {/* Metrics grid (mobile clean, desktop breit) */}
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

              {/* Split + Notes */}
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

              {/* CTA row: immer Button */}
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

      {/* FOOTER */}
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
