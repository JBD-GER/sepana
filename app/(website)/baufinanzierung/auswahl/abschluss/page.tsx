import Link from "next/link"
import type { Metadata } from "next"
import { headers } from "next/headers"
import SuccessConfetti from "./ui/SuccessConfetti"
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
  title: "Abschluss starten – Baufinanzierung",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {text}
    </span>
  )
}

function buildHref(basePath: string, qp: Record<string, string | undefined>) {
  const u = new URL("http://x" + basePath)
  for (const [k, v] of Object.entries(qp)) {
    if (v != null && String(v).length) u.searchParams.set(k, String(v))
  }
  const qs = u.searchParams.toString()
  return qs ? `${basePath}?${qs}` : basePath
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

// ✅ nur Baufi-Dokumente
const BAUFI_DOCS: Array<{ title: string; required: boolean; sort: number }> = [
  { title: "Personalausweis (Vorder- & Rückseite)", required: true, sort: 10 },
  { title: "Letzte 3 Gehaltsabrechnungen", required: true, sort: 20 },
  { title: "Letzte 3 Kontoauszüge (Gehaltseingang ersichtlich)", required: true, sort: 30 },
  { title: "Nachweis Eigenkapital (z. B. Kontoauszug)", required: true, sort: 40 },
].sort((a, b) => a.sort - b.sort)

type Provider = {
  id: string
  name: string
  slug: string
  logo_horizontal_path: string | null
  logo_icon_path: string | null
  preferred_logo_variant: string | null
}

type ProvidersResponse = {
  ok: boolean
  items: Array<{
    provider: Provider
    product: { is_available_online: boolean; is_available_live: boolean } | null
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

function logoUrl(provider: Provider) {
  const prefer = provider?.preferred_logo_variant === "icon" ? "icon" : "horizontal"
  const file = prefer === "icon" ? provider?.logo_icon_path : provider?.logo_horizontal_path
  if (!file) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(String(file))}`
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string
    bank?: string
    caseId?: string
    caseRef?: string
    existing?: string
    loanAmount?: string
    years?: string
  }>
}) {
  const sp = await searchParams

  const providerSlug = sp.provider || sp.bank || ""
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const loanAmountNum = Math.max(50_000, toNumber(sp.loanAmount) || 300_000)
  const yearsNum = clamp(Math.round(toNumber(sp.years) || 30), 5, 35)

  const providers = await fetchJson<ProvidersResponse>(`/api/baufi/providers?product=baufi`)
  const selected = (providers?.items || []).find((x) => x.provider.slug === providerSlug) || null

  const metricsRes = caseId
    ? await fetchJson<MetricsResponse>(
        `/api/baufi/case-metrics?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}`
      )
    : null

  const m = metricsRes?.ok ? metricsRes.metrics : null
  const surplusRatio = m?.surplus_ratio ?? 0.12

  const provider: Provider =
    selected?.provider || {
      id: "",
      name: providerSlug || "—",
      slug: providerSlug,
      logo_horizontal_path: null,
      logo_icon_path: null,
      preferred_logo_variant: "horizontal",
    }

  const term = selected?.term || null
  const product = selected?.product || null

  const baseApr = pickAprPercent(term)
  const shownApr = clamp(personalizeApr(baseApr, surplusRatio) + providerAprSpread(provider.slug), 0.5, 12)
  const tilgungPct = pickTilgungPct(provider.slug, surplusRatio)
  const pay = monthlyFromAprAndTilgung({ principal: loanAmountNum, aprPercent: shownApr, tilgungPct })

  const srep = term?.special_repayment_free_pct
    ? `${term.special_repayment_free_pct}% p.a.`
    : term?.special_repayment_free_note || "produktabhängig"

  const zbind =
    term?.zinsbindung_min_years || term?.zinsbindung_max_years
      ? `${term.zinsbindung_min_years ?? "—"}–${term.zinsbindung_max_years ?? "—"} Jahre`
      : "objektabhängig"

  const statusPill = product?.is_available_online ? "Online-Abschluss möglich" : "Abschluss mit Beratung"

  const back = buildHref("/baufinanzierung/auswahl", {
    caseId,
    caseRef,
    existing: existing ? "1" : undefined,
    loanAmount: String(loanAmountNum),
    years: String(yearsNum),
  })

  // ✅ WICHTIG: richtiges Next nach Login -> /app/faelle/[caseId]
  const nextAfterLogin = caseId ? `/app/faelle/${encodeURIComponent(caseId)}` : "/app/faelle"
  const loginHref = buildHref("/login", { next: nextAfterLogin })

  // ✅ Temp-Angebot Snapshot speichern (für Berater)
  if (caseId && provider?.id) {
    await postJson("/api/baufi/offer-preview", {
      caseId,
      providerId: provider.id,
      productType: "baufi",
      payload: {
        kind: "baufi_comparison_preview",
        caseRef: metricsRes?.caseRef || caseRef || null,
        provider: {
          id: provider.id,
          slug: provider.slug,
          name: provider.name,
          logo: {
            horizontal: provider.logo_horizontal_path ?? null,
            icon: provider.logo_icon_path ?? null,
            preferred: provider.preferred_logo_variant ?? "horizontal",
          },
        },
        inputs: {
          loanAmount: loanAmountNum,
          years: yearsNum,
          surplusRatio,
        },
        computed: {
          rateMonthly: pay.monthly,
          aprEffective: shownApr,
          tilgungPctEff: pay.tilgungPctEff,
          interestMonthly: pay.interestMonthly,
          principalMonthly: pay.principalMonthly,
          zinsbindung: zbind,
          specialRepayment: srep,
        },
        term: term ?? null,
        createdAt: new Date().toISOString(),
      },
    })
  }

  const logo = logoUrl(provider)

  return (
    <div className="relative space-y-4">
      <SuccessConfetti accent={ACCENT} burst={120} />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.10] blur-3xl"
          style={{ background: ACCENT }}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {pill("Auswahl gespeichert")}
              {pill("Nächster Schritt: Konto & Upload")}
              {existing ? pill("Bestehendes Konto erkannt") : null}
              {providerSlug ? pill(statusPill) : null}
            </div>

            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: ACCENT }}
                aria-hidden="true"
              >
                ✓
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
                  Super – Sie haben Ihre Bank ausgewählt.
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                  Sie haben eine <span className="font-medium text-slate-900">E-Mail</span> erhalten – darüber legen Sie
                  einmalig Ihr Konto an. Danach loggen Sie sich ein und laden die Unterlagen hoch. Anschließend prüfen
                  wir alles vor und melden uns innerhalb von{" "}
                  <span className="font-medium text-slate-900">24 Stunden telefonisch</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[540px] rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-600">Ausgewählte Bank</div>
                <div className="mt-1 flex items-center gap-3">
                  {logo ? (
                    <img src={logo} alt={provider.name} className="h-7 w-auto max-w-[180px] object-contain" loading="lazy" />
                  ) : (
                    <div className="text-lg font-semibold text-slate-900">{provider.name}</div>
                  )}
                  <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] text-slate-700 shadow-sm backdrop-blur-xl">
                    {statusPill}
                  </span>
                </div>
              </div>

              <div className="rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm" style={{ background: ACCENT }}>
                Auswahl gespeichert
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Monatsrate</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(pay.monthly)}</div>
                <div className="mt-1 text-[11px] text-slate-600">bei {formatPct(pay.tilgungPctEff, 2)} Tilgung</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Effektivzins</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatPct(shownApr)}</div>
                <div className="mt-1 text-[11px] text-slate-600">individuelle Vorschau</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Zinsbindung</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{zbind}</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Sondertilgung</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{srep}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Darlehen (Beispiel)</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(loanAmountNum)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
                <div className="text-[11px] text-slate-600">Laufzeit (Beispiel)</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">{yearsNum} Jahre</div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/60 px-3 py-2">
              <div className="text-[11px] text-slate-600">Fall</div>
              <div className="mt-0.5 text-xs text-slate-700 break-all">
                Case-ID: {caseId || "—"} · Fall-Ref: {metricsRes?.caseRef || caseRef || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
            <div className="text-sm font-medium text-slate-900">So geht’s jetzt weiter</div>

            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: ACCENT }}>
                  1
                </span>
                <span>
                  Sie haben eine <span className="font-medium text-slate-900">E-Mail</span> erhalten – dort legen Sie Ihr Konto an (einmalig).
                </span>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: ACCENT }}>
                  2
                </span>
                <span>
                  Danach <span className="font-medium text-slate-900">loggen Sie sich ein</span> und können sofort die Dokumente hochladen.
                </span>
              </li>

              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: ACCENT }}>
                  3
                </span>
                <span>
                  Wir prüfen die Unterlagen vor und melden uns innerhalb von <span className="font-medium text-slate-900">24 Stunden telefonisch</span>.
                </span>
              </li>
            </ol>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={loginHref}
                className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
                style={{ background: ACCENT }}
              >
                Zum Login / Konto
              </Link>

              <Link
                href={back}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-3 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl transition hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.99] sm:w-auto"
              >
                Zurück zur Auswahl
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
            <div className="text-sm font-medium text-slate-900">Benötigte Dokumente (Baufinanzierung)</div>
            <p className="mt-1 text-xs text-slate-600">
              Bitte laden Sie die Unterlagen nach dem Login hoch – das beschleunigt die Prüfung deutlich.
            </p>

            <ul className="mt-3 space-y-2">
              {BAUFI_DOCS.map((d) => (
                <li
                  key={d.title}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{d.title}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/60 bg-white/70 px-2 py-0.5 text-[11px] text-slate-700">
                    {d.required ? "Pflicht" : "Optional"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 text-xs text-slate-500">
              Hinweis: Je nach Objekt & Bank können zusätzliche Unterlagen erforderlich sein.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
