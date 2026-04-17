// app/(app)/app/faelle/page.tsx
import Link from "next/link"
import Image from "next/image"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"
import { translateCaseStatus } from "@/lib/caseStatus"

type Money = number | null

type ComparisonMini = {
  provider_id: string | null
  provider_name: string | null
  provider_logo_path: string | null
  loan_amount: Money
  rate_monthly: Money
  apr_effective: Money
  interest_nominal: Money
  zinsbindung_years: number | null
  special_repayment: string | null
}

type CaseRow = {
  id: string
  case_ref: string | null
  status: string
  status_display?: string | null
  created_at: string
  assigned_advisor_id: string | null
  docsCount: number
  offersCount: number
  previewsCount: number
  comparison: ComparisonMini | null
  bestOffer: ComparisonMini | null
}

type CaseListResp = {
  cases: CaseRow[]
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

type DashboardResp = {
  openCases?: number
  latestCaseType?: string | null
}

type ProductTab = "baufi" | "konsum" | "schufa_frei"

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "-"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

function normalizeLogoPath(input: unknown): string | null {
  if (!input) return null
  if (typeof input === "string") {
    const path = input.trim()
    return path || null
  }
  if (typeof input !== "object") return null
  const obj = input as Record<string, unknown>
  const candidateKeys = ["path", "logo_path", "logoPath", "key", "name", "file_path", "storage_path", "url"]
  for (const key of candidateKeys) {
    const value = obj[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function logoSrc(pathLike?: unknown) {
  const path = normalizeLogoPath(pathLike)
  if (!path) return null
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(path)}`
}

function providerLabel(c: CaseRow, s: ComparisonMini | null) {
  return s?.provider_name || c.comparison?.provider_name || "Bankpartner"
}

function offerCountLabel(count: number) {
  return count === 1 ? "Angebot" : "Angebote"
}

function mobileCaseBadge(c: CaseRow, hasComparison: boolean) {
  const status = String(c.status_display ?? c.status ?? "").trim().toLowerCase()
  if (status === "offer_accepted" || status === "approved") return "Angebot angenommen"
  if (status === "offer_rejected") return "Angebot abgelehnt"
  if (hasComparison) return "Vergleich bereit"
  return "In Bearbeitung"
}

function parsePage(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return 1
  return Math.floor(num)
}

function normalizeProduct(raw: string | null | undefined): ProductTab | null {
  const normalized = String(raw ?? "").trim().toLowerCase()
  if (normalized === "konsum") return "konsum"
  if (normalized === "schufa_frei" || normalized === "schufafrei") return "schufa_frei"
  if (normalized === "baufi") return "baufi"
  return null
}

function parseProduct(raw: string | string[] | undefined): ProductTab | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return normalizeProduct(value)
}

function productHref(product: ProductTab) {
  if (product === "konsum") return "/app/faelle?product=konsum"
  if (product === "schufa_frei") return "/app/faelle?product=schufa_frei"
  return "/app/faelle?product=baufi"
}

function pageHref(page: number, product: ProductTab) {
  const params = new URLSearchParams()
  if (product !== "baufi") params.set("product", product)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/app/faelle?${query}` : "/app/faelle"
}

function continueCaseHref(caseId: string, product: ProductTab) {
  return product === "konsum" ? `/app/faelle/${caseId}#privatkredit-journey` : `/app/faelle/${caseId}`
}

function schufaFreeNextStepLabel(c: CaseRow) {
  const normalizedStatus = String(c.status_display ?? c.status ?? "").trim().toLowerCase()
  if (normalizedStatus === "completed" || normalizedStatus === "closed") return "Abgeschlossen"
  if (c.docsCount === 0) return "Unterlagen hochladen"
  if (normalizedStatus.includes("submitted") || normalizedStatus.includes("übermittelt")) return "Berater prüft Angaben"
  return "Im Fall weiter"
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[]; product?: string | string[] }>
}) {
  await requireCustomer()
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const requestedPage = parsePage(resolvedSearchParams?.page)
  const requestedProduct = parseProduct(resolvedSearchParams?.product)
  const dashboardRes = await authFetch("/api/app/dashboard").catch(() => null)
  const dashboardData: DashboardResp | null = dashboardRes && dashboardRes.ok ? await dashboardRes.json() : null
  const product =
    requestedProduct ??
    ((dashboardData?.openCases ?? 0) === 1 ? normalizeProduct(dashboardData?.latestCaseType ?? null) : null) ??
    "baufi"
  const productLabel = product === "konsum" ? "Privatkredit" : product === "schufa_frei" ? "Kredit ohne Schufa" : "Baufinanzierung"
  const res = await authFetch(`/api/app/cases/list?limit=10&page=${requestedPage}&caseType=${product}`).catch(() => null)
  const data: CaseListResp = res && res.ok ? await res.json() : { cases: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }

  const page = Math.max(1, Number(data.page ?? requestedPage))
  const totalPages = Math.max(1, Number(data.totalPages ?? 1))
  const total = Number(data.total ?? data.cases.length) || 0
  const showProductTabs = (dashboardData?.openCases ?? total) > 1

  return (
    <div className="w-full overflow-x-clip space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -top-14 right-0 h-36 w-36 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Ihre Fälle</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {product === "konsum"
                  ? "Hier fuehren Sie Ihren Privatkredit Schritt fuer Schritt weiter: Angaben, Live-Angebote, Unterlagen und Abschluss."
                  : product === "schufa_frei"
                    ? "Hier sehen Sie den aktuellen Stand Ihrer Schufa-frei Anfrage inklusive Unterlagen und SEPANA-Status."
                    : `Hier sehen Sie den aktuellen Stand Ihrer ${productLabel} inklusive Unterlagen und Angeboten.`}
              </p>
            </div>

            {(product === "konsum" || product === "schufa_frei") && data.cases[0] ? (
              <Link
                href={continueCaseHref(data.cases[0].id, product)}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                {product === "konsum" ? "Aktuellen Antrag fortsetzen" : "Aktuellen Fall oeffnen"}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {showProductTabs ? (
        <section className="rounded-3xl border border-slate-200/70 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "baufi" as const, label: "Baufinanzierung" },
              { id: "konsum" as const, label: "Privatkredit" },
              { id: "schufa_frei" as const, label: "Kredit ohne Schufa" },
            ] as const).map((tab) => {
              const active = product === tab.id
              return (
                <Link
                  key={tab.id}
                  href={productHref(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 lg:hidden">
        {data.cases.map((c) => {
          const s = c.bestOffer ?? c.comparison
          const hasComparison = !!c.comparison
          const bankLogo = s?.provider_logo_path ? logoSrc(s.provider_logo_path) : null
          const label = providerLabel(c, s)
          const badgeLabel = mobileCaseBadge(c, hasComparison)
          const acceptedBadge = badgeLabel === "Angebot angenommen"
          const rejectedBadge = badgeLabel === "Angebot abgelehnt"
          const schufaNextStep = schufaFreeNextStepLabel(c)

          return (
            <Link
              key={c.id}
              href={continueCaseHref(c.id, product)}
              className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {dt(c.created_at)} · Status: {translateCaseStatus(c.status_display ?? c.status)}
                  </div>
                </div>

                <div
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    acceptedBadge
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : rejectedBadge
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : hasComparison
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {badgeLabel}
                </div>
              </div>

              {product === "schufa_frei" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Status</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{translateCaseStatus(c.status_display ?? c.status)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Nächster Schritt</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{schufaNextStep}</div>
                  </div>
                </div>
              ) : s ? (
                <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Bank</div>
                      <div className="truncate text-sm font-semibold text-slate-900">{label}</div>
                    </div>
                    {bankLogo ? (
                      <Image
                        src={bankLogo}
                        alt=""
                        width={120}
                        height={32}
                        className="h-8 w-auto max-w-[120px] object-contain"
                        unoptimized
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Darlehen</div>
                      <div className="text-sm font-semibold text-slate-900">{formatEUR(s.loan_amount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Monatsrate</div>
                      <div className="text-sm font-semibold text-slate-900">{formatEUR(s.rate_monthly)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Effektivzins</div>
                      <div className="text-sm font-semibold text-slate-900">{formatPct(s.apr_effective)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-600">Zinsbindung</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {s.zinsbindung_years ? `${s.zinsbindung_years} Jahre` : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  Noch keine Vergleichswerte hinterlegt.
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Unterlagen: <span className="font-medium text-slate-900">{c.docsCount}</span>
                </span>
                {product !== "schufa_frei" ? (
                  <span>
                    {offerCountLabel(c.offersCount)}: <span className="font-medium text-slate-900">{c.offersCount}</span>
                  </span>
                ) : (
                  <span>
                    Schritt: <span className="font-medium text-slate-900">{schufaNextStep}</span>
                  </span>
                )}
              </div>

              {product === "konsum" || product === "schufa_frei" ? (
                <div className="mt-4">
                  <span className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    {product === "konsum" ? "Antrag fortsetzen" : "Details ansehen"}
                  </span>
                </div>
              ) : null}
            </Link>
          )
        })}

        {data.cases.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Noch keine Fälle in {productLabel} vorhanden.
          </div>
        ) : null}
      </section>

      <section className="hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm lg:block">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Ihre Fälle im Überblick</div>
          <div className="text-xs text-slate-500">
            {data.cases.length} von {total} Einträgen
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Bank</th> : null}
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Darlehen</th> : null}
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Rate</th> : null}
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Effektivzins</th> : null}
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Zinsbindung</th> : null}
                <th className="px-4 py-3 font-medium text-slate-700">Unterlagen</th>
                {product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Nächster Schritt</th> : null}
                {product !== "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Angebote</th> : null}
                {product === "konsum" || product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Weiter</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.cases.map((c) => {
                const s = c.bestOffer ?? c.comparison
                const bankLogo = s?.provider_logo_path ? logoSrc(s.provider_logo_path) : null
                const label = providerLabel(c, s)
                const schufaNextStep = schufaFreeNextStepLabel(c)

                return (
                  <tr key={c.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={continueCaseHref(c.id, product)} className="block">
                        <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">{dt(c.created_at)}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Link href={continueCaseHref(c.id, product)} className="block">
                        {translateCaseStatus(c.status_display ?? c.status)}
                      </Link>
                    </td>
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3">
                        <Link href={continueCaseHref(c.id, product)} className="flex items-center gap-2">
                          <span className="max-w-[170px] truncate text-slate-900">{label}</span>
                          {bankLogo ? (
                            <Image
                              src={bankLogo}
                              alt=""
                              width={100}
                              height={24}
                              className="h-6 w-auto max-w-[100px] object-contain"
                              unoptimized
                            />
                          ) : null}
                        </Link>
                      </td>
                    ) : null}
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {formatEUR(s?.loan_amount ?? null)}
                        </Link>
                      </td>
                    ) : null}
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {formatEUR(s?.rate_monthly ?? null)}
                        </Link>
                      </td>
                    ) : null}
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {formatPct(s?.apr_effective ?? null)}
                        </Link>
                      </td>
                    ) : null}
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {s?.zinsbindung_years ? `${s.zinsbindung_years} J.` : "-"}
                        </Link>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-slate-700">
                      <Link href={continueCaseHref(c.id, product)} className="block">
                        {c.docsCount}
                      </Link>
                    </td>
                    {product === "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {schufaNextStep}
                        </Link>
                      </td>
                    ) : null}
                    {product !== "schufa_frei" ? (
                      <td className="px-4 py-3 text-slate-700">
                        <Link href={continueCaseHref(c.id, product)} className="block">
                          {c.offersCount}
                        </Link>
                      </td>
                    ) : null}
                    {product === "konsum" || product === "schufa_frei" ? (
                      <td className="px-4 py-3">
                        <Link
                          href={continueCaseHref(c.id, product)}
                          className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          {product === "schufa_frei" ? "Öffnen" : "Fortsetzen"}
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                )
              })}

              {data.cases.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-slate-500"
                    colSpan={product === "schufa_frei" ? 5 : product === "konsum" ? 10 : 9}
                  >
                    Noch keine Fälle in {productLabel} vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 ? (
        <section className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Seite <span className="font-semibold text-slate-900">{page}</span> von{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1, product)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                >
                  Zurück
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400">
                  Zurück
                </span>
              )}

              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1, product)}
                  className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Weiter
                </Link>
              ) : (
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400">
                  Weiter
                </span>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}



