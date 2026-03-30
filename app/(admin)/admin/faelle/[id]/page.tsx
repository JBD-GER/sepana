import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { authFetch } from "@/lib/app/authFetch"
import { translateCaseStatus } from "@/lib/caseStatus"
import OfferList from "@/components/case/OfferList"
import OfferEditor from "@/components/case/OfferEditor"
import CaseChat from "@/components/case/CaseChat"
import DocumentPanel from "@/components/case/DocumentPanel"
import EuropaceStatusCard from "@/components/case/EuropaceStatusCard"
import SignaturePanel from "@/components/case/SignaturePanel"
import LiveCasePanel from "@/components/live/LiveCasePanel"
import ClearSignatureHash from "@/components/case/ClearSignatureHash"
import RecommendedByCard from "@/components/case/RecommendedByCard"
import ResendCustomerInviteButton from "@/components/case/ResendCustomerInviteButton"
import type { EuropaceFlowSummary } from "@/lib/europace/flow"

type Resp = {
  case: {
    id: string
    case_ref: string | null
    status: string
    status_display?: string | null
    created_at: string
    updated_at: string
    case_type: string
    customer_id: string | null
    assigned_advisor_id: string | null
  }
  offer_previews: Array<{
    id: string
    created_at: string
    provider_id: string | null
    provider_name?: string | null
    provider_logo_path?: string | null
    product_type: string
    payload: unknown
  }>
  offers: Array<{
    id: string
    status: string
    bank_status?: string | null
    bank_feedback_note?: string | null
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
    uploaded_by?: string | null
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
  recommended_by?: {
    referral_id: string
    company_name: string
    logo_path: string | null
  } | null
  europace?: {
    vorgangsnummer: string | null
    annahme_job_id: string | null
    antragsnummer: string | null
    produktanbieterantragsnummer: string | null
    sync_status: string | null
    last_sync_at: string | null
    letzte_aenderung_am: string | null
    letztes_ereignis_am: string | null
    last_error: string | null
  } | null
  europace_applications?: Array<{
    antragsnummer: string | null
    produktanbieterantragsnummer: string | null
    antragstellerstatus: string | null
    produktanbieterstatus: string | null
    provisionsforderungsstatus: string | null
  }>
  europace_flow?: EuropaceFlowSummary | null
  europace_documents?: Array<{
    local_document_id: string | null
    europace_document_id: string | null
    category: string | null
    assignment_id: string | null
    release_status: string | null
    upload_status: string | null
    last_sync_at: string | null
    last_error: string | null
    created_at: string | null
  }>
  europace_upload_targets?: Array<{
    key: string
    title: string
    category_id: string
    category_name: string | null
    category_description: string | null
    assignment_id: string | null
    assignment_type: string | null
    assignment_name: string | null
    assignment_role_name: string | null
  }>
  viewer_role: string | null
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function normalizeLogoPath(input: unknown): string | null {
  if (!input) return null
  if (typeof input === "string") {
    const s = input.trim()
    return s ? s : null
  }
  if (typeof input === "object") {
    const maybeObject = input as Record<string, unknown>
    const candidate =
      maybeObject.path ?? maybeObject.logo_path ?? maybeObject.logoPath ?? maybeObject.key ?? maybeObject.name ?? null
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

export default async function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin()
  const { id } = await params

  const res = await authFetch(`/api/app/cases/get?id=${encodeURIComponent(id)}`).catch(() => null)
  const data: Resp | null = res && res.ok ? await res.json() : null

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-600">Fall konnte nicht geladen werden.</div>
          <Link href="/admin/faelle" className="mt-3 inline-flex text-slate-900 underline underline-offset-4">
            Zurück zu Fälle
          </Link>
        </div>
      </div>
    )
  }

  const c = data.case
  const caseType = String(c.case_type ?? "").trim().toLowerCase() === "konsum" ? "konsum" : "baufi"
  const isKonsum = caseType === "konsum"
  const previewRow = data.offer_previews?.[0] ?? null
  let previewPayload: unknown = previewRow?.payload ?? null
  if (typeof previewPayload === "string") {
    try {
      previewPayload = JSON.parse(previewPayload)
    } catch {
      previewPayload = null
    }
  }
  const previewProvider =
    previewPayload && typeof previewPayload === "object"
      ? (((previewPayload as { provider?: unknown }).provider ?? null) as Record<string, unknown> | null)
      : null

  const previewProviderName =
    previewRow?.provider_name ?? (typeof previewProvider?.name === "string" ? previewProvider.name : null) ?? "-"
  const previewProviderLogoPath = normalizeLogoPath(
    previewRow?.provider_logo_path ??
      previewProvider?.logo_path ??
      previewProvider?.logoPath ??
      previewProvider?.logo ??
      null
  )
  const previewLogoUrl = previewProviderLogoPath ? logoSrc(previewProviderLogoPath) : null

  return (
    <div className="space-y-6">
      <ClearSignatureHash />
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/admin/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              {"<-"} Zurück zu Fälle
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Erstellt: {dt(c.created_at)} | Status:{" "}
              <span className="font-medium text-slate-900">{translateCaseStatus(c.status_display ?? c.status)}</span>
            </div>
          </div>

          <div className="w-full max-w-sm sm:w-auto">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm">
              <div className="text-xs text-slate-600">Fall-ID</div>
              <div className="font-medium text-slate-900 break-all">{c.id}</div>
            </div>
            {c.customer_id ? <ResendCustomerInviteButton caseId={c.id} /> : null}
          </div>
        </div>
      </div>

      <RecommendedByCard recommendedBy={data.recommended_by} />

      <LiveCasePanel caseId={c.id} caseRef={c.case_ref ?? null} defaultCollapsed />

      {isKonsum ? (
        <EuropaceStatusCard
          caseId={c.id}
          endpoint="/api/advisor/privatkredit/europace/status"
          initialMeta={data.europace ?? null}
          initialApplications={data.europace_applications ?? []}
          initialFlow={data.europace_flow ?? null}
        />
      ) : null}

      {!isKonsum ? (
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
          <div className="mt-3 text-sm text-slate-700">Ausgewaehlte Bank: {previewProviderName}</div>
        </div>
      ) : null}

      <OfferEditor caseId={c.id} caseType={caseType} />

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Finale Angebote</div>
        <p className="mt-1 text-xs text-slate-600">Verwaltung der finalen Angebote inklusive Bankrückmeldung.</p>
        <OfferList offers={data.offers ?? []} canManage caseType={caseType} />
      </div>

      <DocumentPanel
        caseId={c.id}
        requests={data.document_requests ?? []}
        documents={data.documents ?? []}
        europaceDocuments={data.europace_documents ?? []}
        europaceUploadTargets={data.europace_upload_targets ?? []}
        caseType={caseType}
        canCreateRequest
        caseCustomerId={c.customer_id ?? null}
        caseAdvisorId={c.assigned_advisor_id ?? null}
      />

      <div id="unterschriften" className="scroll-mt-24">
        <SignaturePanel caseId={c.id} canEdit />
      </div>

      <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
    </div>
  )
}


