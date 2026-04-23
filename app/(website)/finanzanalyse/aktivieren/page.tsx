import type { Metadata } from "next"
import Link from "next/link"
import PublicFinancialAnalysisActivationClient from "@/components/financial-analysis/PublicFinancialAnalysisActivationClient"
import { loadFinancialAnalysisPublicContext } from "@/lib/financial-analysis/data"
import {
  FINANCIAL_ANALYSIS_DEFAULT_SUMMARY,
  FINANCIAL_ANALYSIS_FEATURES,
  FINANCIAL_ANALYSIS_LEGAL_NOTE,
  FINANCIAL_ANALYSIS_SERVICE_TITLE,
  formatFinancialAnalysisPrice,
  getFinancialAnalysisServiceStatusLabel,
  trimOrNull,
} from "@/lib/financial-analysis/service"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const metadata: Metadata = {
  title: "Finanzanalyse aktivieren | SEPANA",
  robots: { index: false, follow: false },
}

type PageSearchParams = {
  token?: string
}

function formatDateTime(value: string | null | undefined) {
  const normalized = trimOrNull(value)
  if (!normalized) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(normalized))
}

function InvalidState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-white p-6 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Finanzanalyse</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
      >
        Zur Startseite
      </Link>
    </div>
  )
}

export default async function FinancialAnalysisActivationPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const token = trimOrNull(sp.token)

  if (!token) {
    return <InvalidState title="Link ungültig" description="Für diese Seite fehlt der Aktivierungslink." />
  }

  const admin = supabaseAdmin()
  const access = await loadFinancialAnalysisPublicContext(admin, token).catch((error) => {
    console.error("[financial-analysis/activation] failed to load", error)
    return { ok: false as const, status: 500, error: "financial_analysis_public_failed" }
  })

  if (!access.ok) {
    return (
      <InvalidState
        title={access.status === 403 ? "Link ungültig oder abgelaufen" : "Finanzanalyse nicht verfügbar"}
        description={
          access.status === 403
            ? "Bitte fordern Sie bei Bedarf einen neuen Aktivierungslink an."
            : "Der gesonderte Service kann aktuell nicht geladen werden."
        }
      />
    )
  }

  const service = access.service
  const priceLabel = formatFinancialAnalysisPrice(service.price_gross_cents)
  const portalHref = `/app/faelle/${access.caseRow.id}#schufa-finanzanalyse`

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
              SEPANA - Gesonderte Servicebestätigung
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {FINANCIAL_ANALYSIS_SERVICE_TITLE} aktiv bestätigen
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Bitte prüfen Sie die Leistung noch einmal auf dieser separaten Seite und bestätigen Sie den Zusatzservice
              aktiv. Direkt danach wird Ihre Rechnung erstellt und per E-Mail versendet. Der Bereich im Kundendashboard
              wird erst nach interner Zahlungsmarkierung freigeschaltet.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Fall</div>
            <div className="mt-2 font-semibold text-slate-900">{access.caseRow.case_ref ?? access.caseRow.id}</div>
            <div className="mt-1 text-xs text-slate-500">{access.applicantName ?? "SEPANA Kunde"}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Leistungsumfang</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{service.offer_title ?? FINANCIAL_ANALYSIS_SERVICE_TITLE}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {service.offer_summary ?? FINANCIAL_ANALYSIS_DEFAULT_SUMMARY}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {FINANCIAL_ANALYSIS_FEATURES.map((feature) => (
                <div key={feature} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  {feature}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-3xl border border-cyan-200 bg-cyan-50/80 px-5 py-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800">Preis</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{priceLabel}</div>
              <div className="mt-1 text-sm text-slate-600">Einmalig inklusive MwSt.</div>
            </div>

            <div className="mt-4 text-xs leading-relaxed text-slate-500">{FINANCIAL_ANALYSIS_LEGAL_NOTE}</div>
          </section>

          <PublicFinancialAnalysisActivationClient
            token={token}
            initialService={{
              service_status: service.service_status,
              customer_confirmed_at: service.customer_confirmed_at,
            }}
            portalHref={portalHref}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktueller Stand</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Status:</span> {getFinancialAnalysisServiceStatusLabel(service.service_status)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Mail versendet:</span> {formatDateTime(service.offer_email_sent_at)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Bestätigt:</span> {formatDateTime(service.customer_confirmed_at)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Zahlung markiert:</span> {formatDateTime(service.payment_received_at)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Aktiv bis:</span> {formatDateTime(service.access_expires_at)}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Wichtiger Hinweis</div>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <div>Die Bestätigung auf dieser Seite ersetzt nicht die interne Zahlungsmarkierung.</div>
              <div>Nach Ihrer Bestätigung erhalten Sie die Rechnung automatisch per E-Mail als PDF-Anhang.</div>
              <div>Der Dashboard-Bereich wird erst nach bestätigtem Zahlungseingang freigeschaltet.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
