import Link from "next/link"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"

type Resp = {
  case: {
    id: string
    case_ref: string | null
    status: string
    created_at: string
    updated_at: string
    case_type: string
    assigned_advisor_id: string | null
  }
  baufi_details: any | null
  applicants: any[]
  offer_previews: Array<{ id: string; created_at: string; provider_id: string; product_type: string; payload: any }>
  offers: Array<{
    id: string
    status: string
    provider_id: string
    loan_amount: number | null
    rate_monthly: number | null
    apr_effective: number | null
    interest_nominal: number | null
    term_months: number | null
    zinsbindung_years: number | null
    special_repayment: string | null
    created_at: string
  }>
  documents: Array<{ id: string; file_name: string; file_path: string; mime_type: string | null; size_bytes: number | null; created_at: string }>
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function formatEUR(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(n))
}

function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} %`
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCustomer()
  const { id } = await params

  const res = await authFetch(`/api/app/cases/get?id=${encodeURIComponent(id)}`).catch(() => null)
  const data: Resp | null = res && res.ok ? await res.json() : null

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-600">Fall konnte nicht geladen werden.</div>
          <Link href="/app/faelle" className="mt-3 inline-flex text-slate-900 underline underline-offset-4">
            Zurück zu Fälle
          </Link>
        </div>
      </div>
    )
  }

  const c = data.case
  const preview = data.offer_previews?.[0]?.payload ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/app/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              ← Zurück zu Fälle
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Erstellt: {dt(c.created_at)} · Status: <span className="font-medium text-slate-900">{c.status}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-xs text-slate-600">Case-ID</div>
            <div className="font-medium text-slate-900 break-all">{c.id}</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Startschuss (Temp-Angebot)</div>
        <p className="mt-1 text-xs text-slate-600">
          Snapshot aus dem Vergleich – dient dem Berater als Startpunkt. Finale Angebote kommen separat hinzu.
        </p>

        {!preview ? (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
            Noch kein Startschuss vorhanden.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Ausgewählte Bank</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{preview?.provider?.name || "—"}</div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Monatsrate</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(preview?.computed?.rateMonthly ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Effektivzins</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatPct(preview?.computed?.aprEffective ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Zinsbindung</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">{preview?.computed?.zinsbindung || "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Sondertilgung</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">{preview?.computed?.specialRepayment || "—"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Eckdaten</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Darlehen</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(preview?.inputs?.loanAmount ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Laufzeit</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {preview?.inputs?.years ? `${preview.inputs.years} Jahre` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-700">
                Fall-Ref: {preview?.caseRef || c.case_ref || "—"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Finale Angebote</div>
        <p className="mt-1 text-xs text-slate-600">Diese Angebote werden später vom Berater erstellt und freigegeben.</p>

        {data.offers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
            Noch keine finalen Angebote vorhanden.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.offers.map((o) => (
              <div key={o.id} className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Angebot</div>
                    <div className="text-xs text-slate-600">Status: {o.status} · Erstellt: {dt(o.created_at)}</div>
                  </div>
                  <div className="text-xs text-slate-500 break-all">ID: {o.id}</div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-600">Rate</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(o.rate_monthly)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-600">Effektivzins</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatPct(o.apr_effective)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-600">Darlehen</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatEUR(o.loan_amount)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-600">
                  Sondertilgung: {o.special_repayment || "—"} · Zinsbindung:{" "}
                  {o.zinsbindung_years ? `${o.zinsbindung_years} Jahre` : "—"} · Laufzeit:{" "}
                  {o.term_months ? `${o.term_months} Monate` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Dokumente</div>

        {data.documents.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
            Noch keine Dokumente hochgeladen.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/80 backdrop-blur">
                <tr className="border-b border-slate-200/70">
                  <th className="px-4 py-3 font-medium text-slate-700">Datei</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Datum</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((d) => (
                  <tr key={d.id} className="border-b border-slate-200/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.file_name}</div>
                      <div className="text-xs text-slate-500 break-all">{d.file_path}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{dt(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">Upload/Download bauen wir als nächsten Schritt.</div>
      </div>
    </div>
  )
}
