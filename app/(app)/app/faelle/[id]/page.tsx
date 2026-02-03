// app/(app)/app/faelle/[id]/page.tsx
import Link from "next/link"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"
import CaseChat from "@/components/case/CaseChat"
import DocumentPanel from "@/components/case/DocumentPanel"
import SignaturePanel from "@/components/case/SignaturePanel"
import { translateCaseStatus, translateOfferStatus } from "@/lib/caseStatus"
import OfferList from "@/components/case/OfferList"
import LiveCasePanel from "@/components/live/LiveCasePanel"
import CaseAppointmentPanel from "@/components/appointments/CaseAppointmentPanel"
import AdvisorCard from "@/components/case/AdvisorCard"

type Resp = {
  case: {
    id: string
    case_ref: string | null
    status: string
    status_display?: string | null
    created_at: string
    updated_at: string
    case_type: string
    assigned_advisor_id: string | null
  }
  baufi_details: any | null
  applicants: any[]
  offer_previews: Array<{
    id: string
    created_at: string
    provider_id: string | null
    provider_name?: string | null
    provider_logo_path?: string | null
    product_type: string
    payload: any
  }>
  offers: Array<{
    id: string
    status: string
    provider_id: string
    provider_name?: string | null
    provider_logo_path?: string | null
    loan_amount: number | null
    rate_monthly: number | null
    apr_effective: number | null
    interest_nominal: number | null
    term_months: number | null
    zinsbindung_years: number | null
    special_repayment: string | null
    created_at: string
  }>
  documents: Array<{
    id: string
    request_id?: string | null
    file_name: string
    file_path: string
    mime_type: string | null
    size_bytes: number | null
    created_at: string
  }>
  document_requests: Array<{
    id: string
    case_id: string
    title: string
    required: boolean
    created_at: string
    created_by: string
  }>
  chat: Array<{
    id: string
    case_id: string
    author_id: string
    visibility: string
    body: string
    created_at: string
  }>
  advisor: {
    id: string
    email: string | null
    display_name: string | null
    bio: string | null
    languages: string[]
    photo_path: string | null
    phone: string | null
    is_active: boolean | null
  } | null
  viewer_role: string | null
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

function normalizeLogoPath(input: unknown): string | null {
  if (!input) return null
  if (typeof input === "string") {
    const s = input.trim()
    return s ? s : null
  }
  if (typeof input === "object") {
    const anyObj = input as any
    const candidate =
      anyObj?.path ??
      anyObj?.logo_path ??
      anyObj?.logoPath ??
      anyObj?.key ??
      anyObj?.name ??
      null
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return null
}

function logoSrc(pathLike?: unknown) {
  const path = normalizeLogoPath(pathLike)
  if (!path) return null
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path
  return `/api/baufi/logo?bucket=logo_banken&path=${encodeURIComponent(path)}`
}

// ✅ Status-Übersetzung (Case)

// ✅ Status-Übersetzung (Offer)

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireCustomer()
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
  const previewRow = data.offer_previews?.[0] ?? null
  let previewPayload: any = previewRow?.payload ?? null
  if (typeof previewPayload === "string") {
    try {
      previewPayload = JSON.parse(previewPayload)
    } catch {
      previewPayload = null
    }
  }
  const advisor = data.advisor

  const previewProviderName =
    previewRow?.provider_name ?? previewPayload?.provider?.name ?? "—"
  const previewProviderLogoPath = normalizeLogoPath(
    previewRow?.provider_logo_path ??
      previewPayload?.provider?.logo_path ??
      previewPayload?.provider?.logoPath ??
      previewPayload?.provider?.logo ??
      null
  )
  const previewLogoUrl = previewProviderLogoPath ? logoSrc(previewProviderLogoPath) : null
  const advisorAvatar = advisor?.photo_path
    ? `/api/baufi/logo?bucket=advisor_avatars&width=256&height=256&quality=100&resize=cover&path=${encodeURIComponent(advisor.photo_path)}`
    : null

  return (
    <div className="w-full overflow-x-clip space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/app/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              ← Zurück zu Fälle
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Erstellt: {dt(c.created_at)} · Status:{" "}
              <span className="font-medium text-slate-900">{translateCaseStatus(c.status_display ?? c.status)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm">
            <div className="text-xs text-slate-600">Fall-ID</div>
            <div className="font-medium text-slate-900 break-all">{c.id}</div>
          </div>
        </div>
      </div>

      {advisor ? (
        <AdvisorCard
          displayName={advisor.display_name}
          bio={advisor.bio}
          phone={advisor.phone}
          email={advisor.email}
          languages={advisor.languages ?? []}
          avatarUrl={advisorAvatar}
        />
      ) : null}

      <LiveCasePanel caseId={c.id} caseRef={c.case_ref ?? null} defaultCollapsed />
      <CaseAppointmentPanel caseId={c.id} />

      {/* Startschuss */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Startschuss (Vergleich bereit)</div>
            <p className="mt-1 text-xs text-slate-600">
              Momentaufnahme aus dem Vergleich - dient als Startpunkt. Finale Angebote kommen separat hinzu.
            </p>
          </div>
          {previewLogoUrl ? (
            <img src={previewLogoUrl} alt="" className="h-10 w-auto max-w-[160px] object-contain" loading="lazy" />
          ) : null}
        </div>

        {!previewPayload ? (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
            Noch kein Startschuss vorhanden.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Ausgewaehlte Bank</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{previewProviderName}</div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Monatsrate</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(previewPayload?.computed?.rateMonthly ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Effektivzins</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatPct(previewPayload?.computed?.aprEffective ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Zinsbindung</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {previewPayload?.computed?.zinsbindung || "-"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Sondertilgung</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {previewPayload?.computed?.specialRepayment || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Eckdaten</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Darlehen</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {formatEUR(previewPayload?.inputs?.loanAmount ?? null)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white px-3 py-2">
                  <div className="text-[11px] text-slate-600">Laufzeit</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {previewPayload?.inputs?.years ? `${previewPayload.inputs.years} Jahre` : "-"}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs text-slate-700">
                Fall-Ref: {previewPayload?.caseRef || c.case_ref || "-"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Finale Angebote</div>
        <p className="mt-1 text-xs text-slate-600">
          Diese Angebote werden vom Berater freigegeben. Wichtig: Es ist nur eine Angebotsannahme moeglich.
        </p>
        <OfferList
          offers={data.offers ?? []}
          canManage={data.viewer_role === "advisor" || data.viewer_role === "admin"}
          canRespond={data.viewer_role === "customer"}
          filterStatuses={["sent", "accepted", "rejected"]}
        />
      </div>

      <DocumentPanel
        caseId={c.id}
        requests={data.document_requests ?? []}
        documents={data.documents ?? []}
        canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
      />

      <SignaturePanel caseId={c.id} canEdit={false} />

      <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
    </div>
  )
}

