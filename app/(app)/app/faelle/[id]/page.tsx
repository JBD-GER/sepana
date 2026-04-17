// app/(app)/app/faelle/[id]/page.tsx
import Link from "next/link"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"
import CaseChat from "@/components/case/CaseChat"
import DocumentPanel from "@/components/case/DocumentPanel"
import EuropaceCustomerOffersCard from "@/components/case/EuropaceCustomerOffersCard"
import EuropaceStatusCard from "@/components/case/EuropaceStatusCard"
import PrivatkreditJourneyPanel from "@/components/case/PrivatkreditJourneyPanel"
import SignaturePanel from "@/components/case/SignaturePanel"
import { translateCaseStatus } from "@/lib/caseStatus"
import OfferList from "@/components/case/OfferList"
import LiveCasePanel from "@/components/live/LiveCasePanel"
import CaseAppointmentPanel from "@/components/appointments/CaseAppointmentPanel"
import AdvisorCard from "@/components/case/AdvisorCard"
import ClearSignatureHash from "@/components/case/ClearSignatureHash"
import RecommendedByCard from "@/components/case/RecommendedByCard"
import { derivePrivatkreditJourney } from "@/lib/europace/customerJourney"
import type { EuropaceFlowSummary } from "@/lib/europace/flow"
import { isImportedBankDocumentPath } from "@/lib/europace/flow"
import { getOnlinekreditAccountCheckRestrictionReason } from "@/lib/onlinekredit/accountCheckPolicy"
import { getOnlinekreditDocumentPin } from "@/lib/onlinekredit/documentPin"
import SchufaFreeStatusOverview from "@/components/schufa-frei/SchufaFreeStatusOverview"
import SchufaFreeDetailsOverview from "@/components/schufa-frei/SchufaFreeDetailsOverview"
import SchufaFreePostIdentPanel from "@/components/schufa-frei/SchufaFreePostIdentPanel"
import SchufaFreeProvisionPanel from "@/components/schufa-frei/SchufaFreeProvisionPanel"
import SchufaFreeWorkspaceOverview from "@/components/schufa-frei/SchufaFreeWorkspaceOverview"
import { isSchufaFreeProvisionPaid } from "@/lib/schufa-frei/provisionInvoice"

type CaseApplicant = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  employment_type?: string | null
}

type CaseDetails = {
  purpose?: string | null
}

type PreviewProvider = {
  name?: string | null
  logo_path?: string | null
  logoPath?: string | null
  logo?: unknown
}

type PreviewPayload = {
  provider?: PreviewProvider | null
  computed?: {
    rateMonthly?: number | null
    aprEffective?: number | null
    zinsbindung?: string | null
    specialRepayment?: string | null
  } | null
  inputs?: {
    loanAmount?: number | null
    years?: number | null
  } | null
  caseRef?: string | null
}

type SchufaDetails = {
  loan_amount_requested?: number | null
  term_months?: number | null
  net_income_monthly?: number | null
  nationality_group?: string | null
  sigma_existing_customer?: boolean | null
  employment_mode?: string | null
  employment_months_current?: number | null
  street?: string | null
  house_number?: string | null
  zipcode?: string | null
  city?: string | null
  employer_name?: string | null
  bank_name?: string | null
  iban?: string | null
}

type SchufaSync = {
  skag_credit_id?: string | null
  skag_client_id?: string | null
  last_status_alias?: string | null
  last_status_description?: string | null
  last_submit_at?: string | null
  last_document_upload_at?: string | null
  last_error?: string | null
  postident_url?: string | null
  postident_added_at?: string | null
  postident_notified_at?: string | null
}

type SchufaPushEvent = {
  status_alias?: string | null
  status_description?: string | null
  created_at?: string | null
}

type SchufaInvoice = {
  id: string
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | null
  loan_amount?: number | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
}

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
  baufi_details: CaseDetails | null
  applicants: CaseApplicant[]
  offer_previews: Array<{
    id: string
    created_at: string
    provider_id: string | null
    provider_name?: string | null
    provider_logo_path?: string | null
    product_type: string
    payload: PreviewPayload | string | null
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
    vorgangsnummer?: string | null
    annahme_job_id: string | null
    antragsnummer: string | null
    produktanbieterantragsnummer: string | null
    selected_angebot_id?: string | null
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
  europace_offers?: Array<{
    angebot_id: string
    angebot_snapshot?: Record<string, unknown> | null
    machbarkeit_status: string | null
    vollstaendigkeit_status: string | null
    calculated_at: string | null
    accepted_at: string | null
    superseded_at: string | null
    created_at: string
  }>
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

type MissingSummaryResp = {
  ok: true
  caseId: string | null
  caseRef: string | null
  caseType?: string | null
  missingCount: number
  firstTab: "contact" | "household" | "finance" | "details" | null
}

type SignatureResp = {
  items: Array<{
    id: string
    title: string | null
    requires_wet_signature: boolean | null
    advisor_signed_at: string | null
    customer_signed_at: string | null
    status: string | null
    fields?: Array<{ owner?: "advisor" | "customer" | string | null }> | null
    documents?: Array<{ document_kind?: "signature_original" | "signature_signed" | string | null }> | null
  }>
}

const LIVE_CASE_TAB_IDS = ["contact", "household", "finance", "details"] as const
type LiveCaseTabId = (typeof LIVE_CASE_TAB_IDS)[number]

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
    const s = input.trim()
    return s ? s : null
  }
  if (typeof input === "object") {
    const objectInput = input as Record<string, unknown>
    const candidate =
      objectInput.path ??
      objectInput.logo_path ??
      objectInput.logoPath ??
      objectInput.key ??
      objectInput.name ??
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

function SchufaFreeIntroCard({
  eyebrow,
  title,
  description,
  tone = "slate",
}: {
  eyebrow: string
  title: string
  description: string
  tone?: "slate" | "cyan" | "emerald"
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-200/80 bg-[linear-gradient(135deg,rgba(236,254,255,0.95),rgba(255,255,255,0.92))]"
      : tone === "emerald"
        ? "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.92))]"
        : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.94))]"

  return (
    <div className={`rounded-[26px] border p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  )
}

function SchufaFreeHeroMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "dark" | "accent"
}) {
  const toneClass =
    tone === "dark"
      ? "border-slate-900/80 bg-slate-950 text-white"
      : tone === "accent"
        ? "border-cyan-200/80 bg-cyan-50/80 text-slate-900"
        : "border-white/70 bg-white/85 text-slate-900"

  const hintClass = tone === "dark" ? "text-slate-300" : "text-slate-500"
  const labelClass = tone === "dark" ? "text-slate-400" : "text-slate-500"

  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur ${toneClass}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${labelClass}`}>{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      {hint ? <div className={`mt-2 text-sm leading-relaxed ${hintClass}`}>{hint}</div> : null}
    </div>
  )
}

function parseTabParam(value: string | string[] | undefined): LiveCaseTabId | null {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return LIVE_CASE_TAB_IDS.includes(normalized as LiveCaseTabId) ? (normalized as LiveCaseTabId) : null
}

function parseBoolParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function getJourneyStepBadgeLabel(stepNumber: number, state: "done" | "current" | "upcoming") {
  if (state === "done") return `Schritt ${stepNumber} · Erledigt`
  if (state === "current") return `Schritt ${stepNumber} · Aktuell`
  return `Schritt ${stepNumber} · Danach`
}

function getJourneyStepBadgeClass(state: "done" | "current" | "upcoming") {
  if (state === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (state === "current") return "border-slate-900 bg-slate-900 text-white"
  return "border-slate-200 bg-slate-50 text-slate-600"
}

function caseDocumentDownloadHref(path: string, fileName?: string | null) {
  const fileNameParam = fileName ? `&filename=${encodeURIComponent(fileName)}` : ""
  return `/api/baufi/logo?bucket=case_documents&path=${encodeURIComponent(path)}&raw=1&download=1${fileNameParam}`
}

function normalizeBankDocumentTitle(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.(pdf|jpg|jpeg|png|tif|tiff)$/i, "")
    .replace(/\s+/g, " ")
}

function bankDocumentKindLabel(fileName: string | null | undefined) {
  const normalized = normalizeBankDocumentTitle(fileName)
  if (!normalized) return "Bankdokument"
  if (normalized.includes("kreditvertrag") || normalized.includes("darlehensvertrag") || normalized.includes("vertrag")) {
    return "Kreditvertrag"
  }
  if (normalized.includes("datenschutz") || normalized.includes("einwilligung")) {
    return "Datenschutz"
  }
  return "Bankdokument"
}

// OK Status-Übersetzung (Case)

// OK Status-Übersetzung (Offer)

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ open?: string | string[]; tab?: string | string[] }>
}) {
  const { user } = await requireCustomer()
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const [res, missingRes, signaturesRes, schufaRes] = await Promise.all([
    authFetch(`/api/app/cases/get?id=${encodeURIComponent(id)}`).catch(() => null),
    authFetch(`/api/app/cases/missing-summary?caseId=${encodeURIComponent(id)}&caseType=konsum`).catch(() => null),
    authFetch(`/api/app/signatures?caseId=${encodeURIComponent(id)}`).catch(() => null),
    authFetch(`/api/app/cases/schufa-frei?caseId=${encodeURIComponent(id)}`).catch(() => null),
  ])

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
  const rawCaseType = String(c.case_type ?? "").trim().toLowerCase()
  const caseType = rawCaseType === "konsum" ? "konsum" : rawCaseType === "schufa_frei" ? "schufa_frei" : "baufi"
  const isKonsum = caseType === "konsum"
  const isSchufaFree = caseType === "schufa_frei"
  const accountCheckRestrictedReason = isKonsum
    ? getOnlinekreditAccountCheckRestrictionReason({
        purpose: data.baufi_details?.purpose,
        employmentTypes: (data.applicants ?? []).map((row) => row?.employment_type),
      })
    : null
  const previewRow = data.offer_previews?.[0] ?? null
  let previewPayload: PreviewPayload | null = null
  if (typeof previewRow?.payload === "string") {
    try {
      previewPayload = JSON.parse(previewRow.payload) as PreviewPayload
    } catch {
      previewPayload = null
    }
  } else if (previewRow?.payload && typeof previewRow.payload === "object") {
    previewPayload = previewRow.payload
  }
  const advisor = data.advisor

  const previewProviderName =
    previewRow?.provider_name ?? previewPayload?.provider?.name ?? "-"
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
  const initialTab = parseTabParam(resolvedSearchParams?.tab)
  const forceExpanded = parseBoolParam(resolvedSearchParams?.open)
  const missingSummary: MissingSummaryResp | null = missingRes && missingRes.ok ? await missingRes.json() : null
  const signatureData: SignatureResp | null = signaturesRes && signaturesRes.ok ? await signaturesRes.json() : null
  const schufaData: {
    details?: SchufaDetails | null
    applicant?: CaseApplicant | null
    sync?: SchufaSync | null
    invoice?: SchufaInvoice | null
    pushEvents?: SchufaPushEvent[]
    skagDocuments?: Array<{ local_document_id?: string | null; upload_status?: string | null; last_error?: string | null }>
  } | null = schufaRes && schufaRes.ok ? await schufaRes.json() : null
  const signatureItems = signatureData?.items ?? []
  const provisionInvoice = schufaData?.invoice ?? null
  const provisionPaid = isSchufaFreeProvisionPaid(provisionInvoice?.status ?? null)
  const documentCount = (data.documents ?? []).length
  const requestCount = (data.document_requests ?? []).length
  const requestedVariant = `${formatEUR(schufaData?.details?.loan_amount_requested ?? null)} / ${schufaData?.details?.term_months ?? "-"} Monate`
  const nextCustomerStep = !provisionInvoice?.id
    ? "Unterlagen vollständig halten"
    : !provisionPaid
      ? "Vorauszahlung überweisen"
      : signatureItems.length === 0
        ? "Vertrag wird vorbereitet"
        : !String(schufaData?.sync?.postident_url ?? "").trim()
          ? "PostIdent wird vorbereitet"
          : "PostIdent abschließen"
  const nextCustomerHint = !provisionInvoice?.id
    ? "Sobald alle Unterlagen vollständig geprüft sind, erscheint hier die nächste Freigabe."
    : !provisionPaid
      ? "Der Vertrag wird freigeschaltet, sobald die Vorauszahlung bei uns eingegangen ist."
      : signatureItems.length === 0
        ? "Dein Berater stellt nun den Vertrag für die digitale Unterschrift bereit."
        : !String(schufaData?.sync?.postident_url ?? "").trim()
          ? "Nach dem Vertrag folgt noch dein persönlicher PostIdent-Link."
          : "Dein Link ist hinterlegt. Danach geht der Fall in Richtung Auszahlung weiter."
  const bankCaseDocuments = (data.documents ?? []).filter((document) => isImportedBankDocumentPath(document.file_path))
  const documentPin = getOnlinekreditDocumentPin(data.europace?.vorgangsnummer)
  const privatkreditJourney = isKonsum
    ? derivePrivatkreditJourney({
        caseId: c.id,
        meta: data.europace ?? null,
        missingCount: missingSummary?.missingCount ?? 0,
        firstMissingTab: missingSummary?.firstTab ?? null,
        offers: data.europace_offers ?? [],
        documents: data.europace_documents ?? [],
        uploadTargets: data.europace_upload_targets ?? [],
        signatureRequests: signatureItems,
        flowSummary: data.europace_flow ?? null,
      })
    : null
  const customerOfferLocked =
    isKonsum &&
    Boolean(
      privatkreditJourney?.hasAcceptedOffer || privatkreditJourney?.hasRunningApplicationJob || privatkreditJourney?.hasApplication
    )
  const privatkreditStepStateById = new Map(privatkreditJourney?.steps.map((step) => [step.id, step.state]) ?? [])
  const getPrivatkreditStepState = (id: "data" | "offers" | "documents" | "signature" | "status") =>
    privatkreditStepStateById.get(id) ?? "upcoming"

  if (isSchufaFree) {
    return (
      <div className="w-full overflow-x-clip space-y-6">
        <ClearSignatureHash />
        <div className="rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.15),transparent_32%),radial-gradient(circle_at_right,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,#f8fafc,#ffffff)] p-5 shadow-sm sm:rounded-[36px] sm:p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <div className="max-w-3xl">
              <Link href="/app/faelle?product=schufa_frei" className="text-sm font-medium text-slate-900 underline underline-offset-4">
                {"<-"} Zurück zum Schufa-frei Bereich
              </Link>
              <div className="mt-4 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
                Kundenbereich · Kredit ohne Schufa
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Dein Antrag mit klarem nächsten Schritt.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Hier siehst du auf einen Blick, was bereits erledigt ist und welcher Schritt als Nächstes ansteht.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SchufaFreeHeroMetric
                label="Aktueller Status"
                value={translateCaseStatus(c.status_display ?? c.status)}
                hint="Die detaillierten Schritte findest du direkt darunter im Dashboard."
                tone="dark"
              />
              <SchufaFreeHeroMetric
                label="Antrag"
                value={c.case_ref || "Kredit ohne Schufa"}
                hint={`Erstellt am ${dt(c.created_at)}`}
                tone="accent"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <SchufaFreeHeroMetric
              label="Nächster Schritt"
              value={nextCustomerStep}
              hint={nextCustomerHint}
              tone="accent"
            />
            <SchufaFreeHeroMetric
              label="Variante"
              value={requestedVariant}
              hint={`${documentCount} Unterlagen hochgeladen · ${requestCount} Anforderungen`}
            />
            <SchufaFreeHeroMetric
              label="Betreuung"
              value={advisor?.display_name ?? "Berater wird zugeordnet"}
              hint={advisor?.phone ?? advisor?.email ?? "Die Kontaktdaten stehen dir direkt darunter zur Verfügung."}
            />
          </div>
        </div>

        <SchufaFreeWorkspaceOverview
          mode="customer"
          caseRef={c.case_ref}
          caseStatus={c.status_display ?? c.status}
          sync={schufaData?.sync ?? null}
          invoice={provisionInvoice}
          pushEvents={schufaData?.pushEvents ?? []}
          requests={data.document_requests ?? []}
          documents={data.documents ?? []}
          signatures={signatureItems}
          chatCount={(data.chat ?? []).length}
          counterpartName={advisor?.display_name ?? null}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          {advisor ? (
            <AdvisorCard
              displayName={advisor.display_name}
              bio={advisor.bio}
              phone={advisor.phone}
              email={advisor.email}
              languages={advisor.languages ?? []}
              avatarUrl={advisorAvatar}
            />
          ) : (
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Beratung</div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Dein Berater wird zugeordnet</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Sobald dein Fall final zugeordnet ist, siehst du hier die direkten Kontaktdaten.
              </p>
            </div>
          )}

          <CaseAppointmentPanel caseId={c.id} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] 2xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
          <div className="space-y-8">
            <section id="schufa-dokumente" className="space-y-3">
              <SchufaFreeIntroCard
                eyebrow="Unterlagen"
                title="Dokumente und Nachweise hochladen"
                description="Lade fehlende Unterlagen direkt hier hoch. Den aktuellen Übertragungsstatus siehst du pro Datei."
                tone="slate"
              />
              <DocumentPanel
                caseId={c.id}
                requests={data.document_requests ?? []}
                documents={data.documents ?? []}
                europaceDocuments={[]}
                europaceUploadTargets={[]}
                skagDocuments={schufaData?.skagDocuments ?? []}
                documentPin={null}
                caseType={caseType}
                canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
                caseCustomerId={c.customer_id ?? null}
                caseAdvisorId={c.assigned_advisor_id ?? null}
                hideTechnicalBranding
              />
            </section>

            <section id="schufa-vorauszahlung" className="space-y-3">
              <SchufaFreeIntroCard
                eyebrow="Vorauszahlung"
                title="Vorauszahlung vor dem Vertrag"
                description="Nach vollständiger Unterlagenprüfung erhältst du hier die Vorauszahlungsrechnung. Es geht erst weiter, wenn die Zahlung bei uns eingegangen ist."
                tone="cyan"
              />
              <SchufaFreeProvisionPanel
                mode="customer"
                caseRef={c.case_ref}
                loanAmount={schufaData?.details?.loan_amount_requested ?? null}
                invoice={provisionInvoice}
              />
            </section>

            <section id="schufa-signatur" className="space-y-3">
              <SchufaFreeIntroCard
                eyebrow="Vertrag & Signatur"
                title="Kreditvertrag prüfen und unterschreiben"
                description="Sobald dein Berater den Vertrag vorbereitet hat, erscheint er hier für die digitale Prüfung und Unterschrift."
                tone="emerald"
              />
              {!provisionPaid ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Noch gesperrt</div>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900">
                    Der Vertrag wird erst freigeschaltet, wenn deine Vorauszahlung bei uns eingegangen ist.
                  </p>
                </div>
              ) : signatureItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Noch nicht freigegeben</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Der Vertrag wird aktuell vorbereitet. Sobald die Unterschrift möglich ist, erscheint das Dokument direkt in diesem Bereich.
                  </p>
                </div>
              ) : null}
              {provisionPaid ? <SignaturePanel caseId={c.id} canEdit={false} fixedProviderName="SIGMA Kreditbank AG" /> : null}
            </section>

            <section id="schufa-postident" className="space-y-3">
              <SchufaFreeIntroCard
                eyebrow="PostIdent"
                title="Legitimation nach dem Vertrag"
                description="Nach der Vertragsunterschrift findest du hier deinen PostIdent-Link. Sobald die Legitimation erledigt ist, folgt als nächster Schritt die Auszahlung."
                tone="slate"
              />
              <SchufaFreePostIdentPanel
                mode="customer"
                postidentUrl={schufaData?.sync?.postident_url ?? null}
                postidentAddedAt={schufaData?.sync?.postident_added_at ?? null}
                postidentNotifiedAt={schufaData?.sync?.postident_notified_at ?? null}
                statusAlias={schufaData?.sync?.last_status_alias ?? schufaData?.pushEvents?.[0]?.status_alias ?? null}
              />
            </section>

            <section id="schufa-chat" className="space-y-3">
              <SchufaFreeIntroCard
                eyebrow="Direkter Austausch"
                title="Chat mit deinem Berater"
                description="Nutze den Chat für Rückfragen zu Unterlagen, Vertrag, PostIdent oder dem aktuellen Bearbeitungsstand."
                tone="slate"
              />
              <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
            </section>
          </div>

          <aside className="space-y-6 self-start xl:sticky xl:top-6">
            <SchufaFreeStatusOverview
              caseStatus={c.status_display ?? c.status}
              sync={schufaData?.sync ?? null}
              pushEvents={schufaData?.pushEvents ?? []}
              documentCount={(data.documents ?? []).length}
              requestCount={(data.document_requests ?? []).length}
            />

            <SchufaFreeDetailsOverview applicant={schufaData?.applicant ?? data.applicants?.[0] ?? null} details={schufaData?.details ?? null} />

            <RecommendedByCard recommendedBy={data.recommended_by} />
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-clip space-y-6">
      <ClearSignatureHash />
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/app/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              {"<-"} Zurück zu Fälle
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

      <RecommendedByCard recommendedBy={data.recommended_by} />

      {isKonsum && privatkreditJourney ? (
        <PrivatkreditJourneyPanel caseId={c.id} summary={privatkreditJourney} meta={data.europace ?? null} />
      ) : null}

      {isKonsum ? (
        <section id="privatkredit-angaben" className="scroll-mt-24 space-y-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getJourneyStepBadgeClass(getPrivatkreditStepState("data"))}`}
                >
                  {getJourneyStepBadgeLabel(1, getPrivatkreditStepState("data"))}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Angaben vervollstaendigen</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Erfasse hier alle Daten fuer deinen Privatkredit. Mit dem Speichern werden die Angaben direkt mit
                  deiner Angebots- und Antragsstrecke uebernommen.
                </p>
              </div>
              {privatkreditJourney?.missingCount ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {privatkreditJourney.missingCount === 1
                    ? "1 Pflichtfeld noch offen"
                    : `${privatkreditJourney.missingCount} Pflichtfelder noch offen`}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Angaben fuer die Angebotsberechnung komplett
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <LiveCasePanel
        caseId={c.id}
        caseRef={c.case_ref ?? null}
        defaultCollapsed={!isKonsum}
        initialTab={initialTab}
        forceExpanded={forceExpanded}
        hideKonsumExpenseFields={customerOfferLocked}
      />
      <CaseAppointmentPanel caseId={c.id} />

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
      ) : null}

      {isKonsum ? (
        <section id="privatkredit-angebote" className="scroll-mt-24 space-y-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getJourneyStepBadgeClass(getPrivatkreditStepState("offers"))}`}
                >
                  {getJourneyStepBadgeLabel(2, getPrivatkreditStepState("offers"))}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {privatkreditJourney?.hasRunningApplicationJob
                    ? "Ausgewähltes Angebot wird verarbeitet"
                    : customerOfferLocked
                      ? "Ausgewähltes Angebot"
                      : "Live-Angebot wählen"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {privatkreditJourney?.hasRunningApplicationJob
                    ? "Du hast bereits ein Angebot ausgewählt. Wir erstellen gerade deinen Antrag und zeigen dir hier nur noch dieses Angebot."
                    : customerOfferLocked
                      ? "Dein ausgewähltes Angebot bleibt hier sichtbar. Weitere Varianten blenden wir in deiner Kundensicht bewusst aus."
                      : "Berechne hier deine aktuellen Live-Angebote und wähle anschließend das passende Angebot aus."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {customerOfferLocked ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                    {privatkreditJourney?.hasRunningApplicationJob
                      ? "Antrag wird erstellt"
                      : privatkreditJourney?.hasApplication
                        ? "Weiter im Antrag"
                        : "Angebot ausgewählt"}
                  </span>
                ) : (
                  <>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
                      Angebote: {privatkreditJourney?.offerCount ?? 0}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                      Online abschließbar: {accountCheckRestrictedReason ? 0 : privatkreditJourney?.onlineOfferCount ?? 0}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <EuropaceCustomerOffersCard
            caseId={c.id}
            initialOffers={data.europace_offers ?? []}
            initialMeta={data.europace ?? null}
            accountCheckRestrictedReason={accountCheckRestrictedReason}
            contactPhone={advisor?.phone ?? null}
          />
        </section>
      ) : (
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Finale Angebote</div>
          <p className="mt-1 text-xs text-slate-600">
            Diese Angebote werden vom Berater freigegeben. Wichtig: Es ist nur eine Angebotsannahme möglich.
          </p>
          <OfferList
            offers={data.offers ?? []}
            canManage={data.viewer_role === "advisor" || data.viewer_role === "admin"}
            canRespond={data.viewer_role === "customer"}
            filterStatuses={["sent", "accepted", "rejected"]}
            caseType={caseType}
          />
        </div>
      )}

      {isKonsum ? (
        <section id="privatkredit-unterlagen" className="scroll-mt-24 space-y-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getJourneyStepBadgeClass(getPrivatkreditStepState("documents"))}`}
                >
                  {getJourneyStepBadgeLabel(3, getPrivatkreditStepState("documents"))}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {privatkreditJourney?.shouldHideUploads ? "Direkt bei der Bank fortsetzen" : "Unterlagen hochladen"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {privatkreditJourney?.shouldHideUploads
                    ? privatkreditJourney.isCompleted
                      ? "Dein Kontocheck-Direktabschluss ist erledigt. SEPANA zeigt hier bewusst keinen Upload mehr an."
                      : "Für diesen Kontocheck-Direktabschluss gibt es hier bewusst keinen Upload. Die nächsten Schritte laufen direkt bei der Bank."
                    : "Nach der Angebotsauswahl zeigen wir dir direkt, welche Unterlagen für den Antrag noch benötigt werden."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                {privatkreditJourney?.shouldHideUploads
                  ? privatkreditJourney.isCompleted
                    ? "Abgeschlossen"
                    : privatkreditJourney.bankContinuationReady
                      ? "Bank-Fortsetzung bereit"
                      : "Wird vorbereitet"
                  : privatkreditJourney?.requiredDocumentCount
                    ? `${privatkreditJourney.uploadedDocumentCount}/${privatkreditJourney.requiredDocumentCount} Upload-Ziele erledigt`
                    : privatkreditJourney?.hasApplication
                      ? "Noch keine konkreten Unterlagen"
                      : "Wird nach Angebotsannahme sichtbar"}
              </div>
            </div>
          </div>
          {privatkreditJourney?.shouldHideUploads ? (
            <div className="rounded-3xl border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,1))] p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Kontocheck-Direktabschluss</div>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {privatkreditJourney.isCompleted
                  ? "Geschafft. Dein Antrag ist digital abgeschlossen."
                  : privatkreditJourney.bankContinuationReady
                    ? "Jetzt nur noch Online-Legitimation und digitale Signatur bei der Bank."
                    : "Die Bank-Fortsetzung wird noch vorbereitet."}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {privatkreditJourney.isCompleted
                  ? "SEPANA hat den Kontocheck-Direktabschluss übernommen. Es gibt hier keinen Upload mehr. Die fertigen Bankdokumente liegen jetzt direkt im Fall."
                  : privatkreditJourney.bankContinuationReady
                    ? "Für dieses Angebot läuft alles weitere direkt bei der Bank. Bitte schließe dort die Online-Legitimation und digitale Signatur vollständig ab."
                    : "Sobald die Bank die nächsten Schritte zurückmeldet, siehst du sie unten im Status. Ein Upload über SEPANA ist für diese Strecke nicht vorgesehen."}
              </p>
              {documentPin ? (
                <div className="mt-5 rounded-2xl border border-cyan-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">PIN für Bankunterlagen</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        Falls die Bank beim Öffnen des Kreditvertrags nach einer PIN fragt, nutze bitte diesen Code.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold tracking-[0.22em] text-white">
                      {documentPin}
                    </div>
                  </div>
                </div>
              ) : null}
              {bankCaseDocuments.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {bankCaseDocuments.map((document) => (
                    <a
                      key={document.id}
                      href={caseDocumentDownloadHref(document.file_path, document.file_name)}
                      className={`rounded-2xl border bg-white px-4 py-4 text-sm text-slate-900 shadow-sm transition ${
                        bankDocumentKindLabel(document.file_name) === "Kreditvertrag"
                          ? "border-slate-900/15 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.98))] hover:border-slate-900/30"
                          : "border-emerald-200 hover:border-emerald-300"
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "text-slate-700" : "text-emerald-700"
                        }`}
                      >
                        {bankDocumentKindLabel(document.file_name)}
                      </div>
                      <div className="mt-2 font-semibold">{document.file_name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {bankDocumentKindLabel(document.file_name) === "Kreditvertrag" ? "Kreditvertrag jetzt öffnen" : "Jetzt herunterladen"}
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <DocumentPanel
              caseId={c.id}
              requests={data.document_requests ?? []}
              documents={data.documents ?? []}
              europaceDocuments={data.europace_documents ?? []}
              europaceUploadTargets={data.europace_upload_targets ?? []}
              documentPin={documentPin}
              caseType={caseType}
              canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
              caseCustomerId={c.customer_id ?? null}
              caseAdvisorId={c.assigned_advisor_id ?? null}
              hideTechnicalBranding
            />
          )}
        </section>
      ) : (
        <DocumentPanel
          caseId={c.id}
          requests={data.document_requests ?? []}
          documents={data.documents ?? []}
          europaceDocuments={data.europace_documents ?? []}
          europaceUploadTargets={data.europace_upload_targets ?? []}
          documentPin={documentPin}
          caseType={caseType}
          canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
          caseCustomerId={c.customer_id ?? null}
          caseAdvisorId={c.assigned_advisor_id ?? null}
        />
      )}

      {isKonsum ? (
        <section id="privatkredit-unterschrift" className="scroll-mt-24 space-y-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getJourneyStepBadgeClass(getPrivatkreditStepState("signature"))}`}
                >
                  {getJourneyStepBadgeLabel(4, getPrivatkreditStepState("signature"))}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {privatkreditJourney?.shouldHideSignatures ? "Digitale Bank-Fortsetzung" : "Vertrag und Unterschrift"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {privatkreditJourney?.shouldHideSignatures
                    ? "Für diesen Kontocheck-Direktabschluss unterschreibst und legitimierst du dich direkt bei der Bank. SEPANA zeigt hier bewusst keinen separaten Signatur-Workflow."
                    : "Sobald dein Vertragsdokument bereit ist, kannst du es hier direkt digital unterzeichnen oder das Dokument für den manuellen Ablauf sehen."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                {privatkreditJourney?.shouldHideSignatures
                  ? privatkreditJourney.isCompleted
                    ? "Erledigt"
                    : privatkreditJourney.bankContinuationReady
                      ? "Bei der Bank offen"
                      : "Wird vorbereitet"
                  : privatkreditJourney?.signatureRequestCount
                    ? `${privatkreditJourney.completedSignatureCount}/${privatkreditJourney.signatureRequestCount} Dokumente abgeschlossen`
                    : "Wird vorbereitet"}
              </div>
            </div>
          </div>
          {!privatkreditJourney?.shouldHideSignatures && bankCaseDocuments.length > 0 && signatureItems.length === 0 ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Vorbereitung läuft</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                Die Bankunterlagen sind schon im Fall, der signierbare Vertrag folgt separat.
              </div>
              <p className="mt-2 leading-relaxed">
                Du kannst Kreditvertrag und Datenschutzhinweise bereits im Dokumentenbereich einsehen. Dein Berater
                übernimmt den Kreditvertrag anschließend in den Signaturbereich und schickt dir dann die finale Version
                zur Unterschrift.
              </p>
            </div>
          ) : null}
          {privatkreditJourney?.shouldHideSignatures ? (
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm text-sm text-slate-600">
              Der weitere Abschluss läuft jetzt direkt bei der Bank. Im Status siehst du, ob die Bank-Fortsetzung
              bereits bereit ist oder ob der Antrag schon abgeschlossen wurde.
            </div>
          ) : (
            <div id="unterschriften" className="scroll-mt-24">
              <SignaturePanel caseId={c.id} canEdit={false} />
            </div>
          )}
        </section>
      ) : (
        <div id="unterschriften" className="scroll-mt-24">
          <SignaturePanel caseId={c.id} canEdit={false} />
        </div>
      )}

      {isKonsum ? (
        <section id="privatkredit-status" className="scroll-mt-24 space-y-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getJourneyStepBadgeClass(getPrivatkreditStepState("status"))}`}
                >
                  {getJourneyStepBadgeLabel(5, getPrivatkreditStepState("status"))}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Antrag und Verlauf</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Hier verfolgst du den aktuellen Antragsstatus, Freigaben und den weiteren Verlauf deines Privatkredits.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                {data.europace?.antragsnummer ? `Antrag ${data.europace.antragsnummer}` : "Noch kein Antrag vorhanden"}
              </div>
            </div>
          </div>
          <EuropaceStatusCard
            caseId={c.id}
            endpoint="/api/app/privatkredit/europace/status"
            initialMeta={data.europace ?? null}
            initialApplications={data.europace_applications ?? []}
            initialFlow={data.europace_flow ?? null}
            hideTechnicalBranding
          />
        </section>
      ) : null}

      <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
    </div>
  )
}




