// app/(app)/advisor/faelle/[id]/page.tsx
import Link from "next/link"
import { getAdvisorCaseStatusSet } from "@/lib/advisor/caseStatusOptions"
import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
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
import AdvisorFinancialAnalysisPanel from "@/components/financial-analysis/AdvisorFinancialAnalysisPanel"
import RecommendedByCard from "@/components/case/RecommendedByCard"
import ResendCustomerInviteButton from "@/components/case/ResendCustomerInviteButton"
import type { FinancialAnalysisDocumentRow, FinancialAnalysisServiceRow } from "@/lib/financial-analysis/service"
import { isImportedBankDocumentPath, type EuropaceFlowSummary } from "@/lib/europace/flow"
import AdvisorCaseRefEditor from "./ui/AdvisorCaseRefEditor"
import AdvisorPrivateNoteEditor from "./ui/AdvisorPrivateNoteEditor"
import EuropaceDocumentsCard from "./ui/EuropaceDocumentsCard"
import EuropaceOffersCard from "./ui/EuropaceOffersCard"
import EuropaceSyncCard from "./ui/EuropaceSyncCard"
import AdvisorCaseStatusSelect from "../ui/AdvisorCaseStatusSelect"
import SchufaFreeStatusOverview from "@/components/schufa-frei/SchufaFreeStatusOverview"
import SchufaFreeDetailsOverview from "@/components/schufa-frei/SchufaFreeDetailsOverview"
import SchufaFreePrecheckDecisionPanel from "@/components/schufa-frei/SchufaFreePrecheckDecisionPanel"
import SchufaFreePostIdentPanel from "@/components/schufa-frei/SchufaFreePostIdentPanel"
import SchufaFreeInsuranceRoutingPanel from "@/components/schufa-frei/SchufaFreeInsuranceRoutingPanel"
import SchufaFreeServiceFeePanel from "@/components/schufa-frei/SchufaFreeServiceFeePanel"
import SchufaFreeWorkspaceOverview from "@/components/schufa-frei/SchufaFreeWorkspaceOverview"
import SchufaFreeApplicationReminderCard from "@/components/schufa-frei/SchufaFreeApplicationReminderCard"
import { getSchufaFreeCompletedOtherApplicationsByCaseIds } from "@/lib/schufa-frei/applicationReminder"
import { getSchufaFreeSignatureRequestMeta, isSignatureRequestComplete } from "@/lib/schufa-frei/contractPackage"
import { isSchufaFreeProvisionPaid } from "@/lib/schufa-frei/provisionInvoice"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

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
  completed_application_at?: string | null
  submitted_to_skag_at?: string | null
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
  invoice_type?: string | null
  invoice_number?: string | null
  status?: string | null
  amount_total?: number | null
  created_at?: string | null
  sent_at?: string | null
  paid_at?: string | null
  refunded_at?: string | null
}

type Resp = {
  case: {
    id: string
    case_ref: string | null
    advisor_case_ref: string | null
    advisor_private_note: string | null
    advisor_status: string | null
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

// OK Status-Übersetzung (Case)

// OK Status-Übersetzung (Offer)

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdvisor()
  const { id } = await params

  const [res, schufaRes, signaturesRes] = await Promise.all([
    authFetch(`/api/app/cases/get?id=${encodeURIComponent(id)}`).catch(() => null),
    authFetch(`/api/app/cases/schufa-frei?caseId=${encodeURIComponent(id)}`).catch(() => null),
    authFetch(`/api/app/signatures?caseId=${encodeURIComponent(id)}`).catch(() => null),
  ])
  const data: Resp | null = res && res.ok ? await res.json() : null
  const schufaData: {
    details?: SchufaDetails | null
    applicant?: CaseApplicant | null
    sync?: SchufaSync | null
    serviceFeeInvoiceCreated?: boolean
    contractSigningUnlocked?: boolean
    invoice?: SchufaInvoice | null
    cancellationInvoice?: SchufaInvoice | null
    insuranceRoute?: {
      route_source?: string | null
      route_status?: string | null
      routed_at?: string | null
    } | null
    pushEvents?: SchufaPushEvent[]
    skagDocuments?: Array<{ local_document_id?: string | null; upload_status?: string | null; last_error?: string | null }>
    financialAnalysis?: {
      service?: FinancialAnalysisServiceRow | null
      documents?: FinancialAnalysisDocumentRow[]
    } | null
  } | null = schufaRes && schufaRes.ok ? await schufaRes.json() : null
  const signatureData: SignatureResp | null = signaturesRes && signaturesRes.ok ? await signaturesRes.json() : null

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-600">Fall konnte nicht geladen werden.</div>
          <Link href="/advisor/faelle" className="mt-3 inline-flex text-slate-900 underline underline-offset-4">
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
  const otherCompletedApplication = isSchufaFree
    ? (await getSchufaFreeCompletedOtherApplicationsByCaseIds(supabaseAdmin(), [c.id])).get(c.id) ?? null
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
  const advisorStatus = (() => {
    const statusSet = getAdvisorCaseStatusSet(caseType)
    const raw = String(c.advisor_status ?? "").trim().toLowerCase()
    if (raw && statusSet.has(raw)) return raw
    const caseStatus = String(c.status ?? "").trim().toLowerCase()
    if (caseStatus === "closed" || caseStatus === "completed") return "abgeschlossen"
    return "neu"
  })()

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
  const bankCaseDocuments = (data.documents ?? []).filter((document) => isImportedBankDocumentPath(document.file_path))
  const signatureItems = signatureData?.items ?? []
  const leadApplicant = schufaData?.applicant ?? data.applicants?.[0] ?? null
  const counterpartName =
    [leadApplicant?.first_name, leadApplicant?.last_name].filter((value) => String(value ?? "").trim()).join(" ").trim() ||
    leadApplicant?.email ||
    null
  const serviceFeeInvoice = schufaData?.invoice ?? null
  const serviceFeePaid = isSchufaFreeProvisionPaid(serviceFeeInvoice?.status ?? null)
  const serviceFeeCreated = schufaData?.serviceFeeInvoiceCreated ?? Boolean(serviceFeeInvoice?.id)
  const contractSigningUnlocked = schufaData?.contractSigningUnlocked ?? serviceFeeCreated
  const hasContractRequest = signatureItems.some((item) =>
    getSchufaFreeSignatureRequestMeta({
      title: item.title,
      requiresWetSignature: Boolean(item.requires_wet_signature),
      fields: item.fields ?? [],
    }).key === "contract"
  )
  const openSignatureCount = signatureItems.filter((item) =>
    !isSignatureRequestComplete({
      fields: item.fields ?? [],
      requires_wet_signature: Boolean(item.requires_wet_signature),
      advisor_signed_at: item.advisor_signed_at,
      customer_signed_at: item.customer_signed_at,
      status: item.status,
    })
  ).length
  const normalizedSkagStatus = String(schufaData?.sync?.last_status_alias ?? schufaData?.pushEvents?.[0]?.status_alias ?? "")
    .trim()
    .toLowerCase()
  const payoutReached =
    normalizedSkagStatus === "credit_payout" || String(c.status ?? "").trim().toLowerCase() === "completed"
  const postidentLinkReady = Boolean(String(schufaData?.sync?.postident_url ?? "").trim())
  const documentCount = (data.documents ?? []).length
  const requestCount = (data.document_requests ?? []).length
  const requestedVariant = `${formatEUR(schufaData?.details?.loan_amount_requested ?? null)} / ${schufaData?.details?.term_months ?? "-"} Monate`
  const advisorFocus = !contractSigningUnlocked
    ? "Rechnung anlegen"
    : !hasContractRequest
      ? "Vertrag importieren"
      : openSignatureCount > 0
        ? "Signatur begleiten"
      : !postidentLinkReady
        ? "PostIdent hinterlegen"
        : !payoutReached
          ? "Auszahlung beobachten"
          : !serviceFeePaid
            ? "Servicepauschale nachhalten"
            : "Fall abschliessen"
  const advisorFocusHint = !contractSigningUnlocked
    ? "Bitte zuerst die interne Servicepauschalenrechnung anlegen. Erst danach werden gesonderter Vermittlungsauftrag und Vertragsbereich freigeschaltet."
    : !hasContractRequest
      ? "Die Rechnung ist angelegt. Der gesonderte Vermittlungsauftrag ist vorbereitet. Laden Sie jetzt den Kreditvertrag hoch und starten Sie den restlichen Signaturprozess."
      : openSignatureCount > 0
        ? "Im Signaturbereich liegen noch offene Dokumente. Begleiten Sie den Kunden jetzt durch die verbleibenden Schritte."
      : !postidentLinkReady
        ? "Nach dem Vertrag fehlt als Nächstes noch der PostIdent-Link."
        : !payoutReached
          ? "Die operativen Schritte sind angelegt, jetzt den SEPANA-Status bis zur Kreditauszahlung weiter verfolgen."
          : !serviceFeePaid
            ? "Die Servicepauschale ist jetzt fällig und kann im Fall intern als bezahlt nachgehalten werden."
            : "Vertrag, Auszahlung und Servicepauschale sind sauber dokumentiert."

  if (isSchufaFree) {
    return (
      <div className="w-full overflow-x-clip space-y-6">
        <ClearSignatureHash />
        <div className="rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.15),transparent_32%),radial-gradient(circle_at_right,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,#f8fafc,#ffffff)] p-5 shadow-sm sm:rounded-[36px] sm:p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <Link href="/advisor/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
                {"<-"} Zurück zu Fälle
              </Link>
              <div className="mt-4 inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
                Berateransicht · Kredit ohne Schufa
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Fall {c.case_ref || c.id.slice(0, 8)} klar steuern.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Alles Relevante fuer Pruefung, Dokumente, Servicepauschale, Vertrag, PostIdent und Auszahlung in einem sauberen Arbeitsbereich.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SchufaFreeHeroMetric
                label="Fallstatus"
                value={translateCaseStatus(c.status_display ?? c.status)}
                hint={`Erstellt am ${dt(c.created_at)}`}
                tone="dark"
              />
              <SchufaFreeHeroMetric
                label="Technische Referenz"
                value={c.case_ref || "Schufa-frei"}
                hint={`Fall-ID: ${c.id}`}
                tone="accent"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <SchufaFreeHeroMetric
              label="Kunde"
              value={counterpartName || "Noch ohne Namen"}
              hint={leadApplicant?.phone ?? leadApplicant?.email ?? "Kontaktdaten im Fall hinterlegt"}
            />
            <SchufaFreeHeroMetric
              label="Variante"
              value={requestedVariant}
              hint={`${documentCount} Dokumente · ${requestCount} Anforderungen`}
            />
            <SchufaFreeHeroMetric label="Nächster Fokus" value={advisorFocus} hint={advisorFocusHint} tone="accent" />
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Interne Referenz</div>
              <div className="mt-3">
                <AdvisorCaseRefEditor caseId={c.id} initialValue={c.advisor_case_ref ?? null} variant="inline" />
              </div>
            </div>
            {c.customer_id ? (
              <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Kundenzugang</div>
                <div className="mt-3">
                  <ResendCustomerInviteButton caseId={c.id} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <SchufaFreeWorkspaceOverview
          mode="advisor"
          caseRef={c.case_ref}
          caseStatus={c.status_display ?? c.status}
          sync={schufaData?.sync ?? null}
          invoice={serviceFeeInvoice}
          serviceFeeInvoiceCreated={serviceFeeCreated}
          contractSigningUnlocked={contractSigningUnlocked}
          pushEvents={schufaData?.pushEvents ?? []}
          requests={data.document_requests ?? []}
          documents={data.documents ?? []}
          signatures={signatureItems}
          chatCount={(data.chat ?? []).length}
          counterpartName={counterpartName}
        />

        <div className="space-y-6">
          <div className="rounded-[30px] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(236,254,255,0.96))] p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interner Status</div>
            <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-slate-900">Fall intern steuern</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Beratungsstatus, Priorität und der operative Fokus bleiben hier an einer zentralen Stelle gebündelt.
                </p>
              </div>
              <div className="w-full max-w-sm">
                <AdvisorCaseStatusSelect caseId={c.id} value={advisorStatus} caseType={caseType} />
              </div>
            </div>
          </div>

          <AdvisorPrivateNoteEditor caseId={c.id} initialValue={c.advisor_private_note ?? null} />

          <SchufaFreeStatusOverview
            caseStatus={c.status_display ?? c.status}
            sync={schufaData?.sync ?? null}
            pushEvents={schufaData?.pushEvents ?? []}
            documentCount={(data.documents ?? []).length}
            requestCount={(data.document_requests ?? []).length}
          />

          <SchufaFreeDetailsOverview applicant={leadApplicant} details={schufaData?.details ?? null} />

          <section id="schufa-antrag-erinnerung" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Antrag fortsetzen"
              title="Offenes Zweitformular erinnern"
              description="Wenn der Kunde nach positiver Vorprüfung das zweite Formular noch nicht abgeschlossen hat, können Sie hier direkt eine Erinnerung mit Link zum offenen Antrag versenden."
              tone="slate"
            />
            <SchufaFreeApplicationReminderCard
              caseId={c.id}
              completedApplicationAt={schufaData?.details?.completed_application_at ?? null}
              submittedToSkagAt={schufaData?.details?.submitted_to_skag_at ?? null}
              otherCompletedApplication={otherCompletedApplication}
            />
          </section>

          <section id="schufa-vorpruefung" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Vorprüfung"
              title="Rückmeldung zur Vorprüfung versenden"
              description="Versenden Sie hier direkt die positive oder negative Rückmeldung an den Kunden. Die positive Mail enthält bereits die nächsten Schritte bis Vertrag, PostIdent und Auszahlung."
              tone="slate"
            />
            <SchufaFreePrecheckDecisionPanel caseId={c.id} />
          </section>

          <section id="schufa-finanzanalyse" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Finanzanalyse"
              title="Getrennten Zusatzservice steuern"
              description="Bieten Sie die Finanzanalyse separat an, versenden Sie die Aktivierungsmail auf die externe Serviceseite, markieren Sie den Zahlungseingang und veröffentlichen Sie später die Auswertung im Kundendashboard."
              tone="emerald"
            />
            <AdvisorFinancialAnalysisPanel
              caseId={c.id}
              service={schufaData?.financialAnalysis?.service ?? null}
              documents={schufaData?.financialAnalysis?.documents ?? []}
            />
          </section>

          <section id="schufa-versicherung" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Versicherung"
              title="Versicherungsbereich intern ansteuern"
              description="Negative Vorpruefungen werden automatisch uebergeben. Darueber hinaus kann der Berater jeden Fall spaeter manuell an den internen Versicherungsbereich weiterleiten."
              tone="cyan"
            />
            <SchufaFreeInsuranceRoutingPanel caseId={c.id} route={schufaData?.insuranceRoute ?? null} />
          </section>

          <RecommendedByCard recommendedBy={data.recommended_by} />

          {advisor ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {advisorAvatar ? <img src={advisorAvatar} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Zuständiger Berater</div>
                  <div className="text-lg font-semibold text-slate-900">{advisor.display_name ?? "-"}</div>
                  <div className="mt-1 text-sm text-slate-700">{advisor.bio ?? "-"}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    {advisor.phone ? <span>Tel: {advisor.phone}</span> : null}
                    {advisor.email ? <span>E-Mail: {advisor.email}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <section id="schufa-dokumente" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Dokumente & Prüfung"
              title="Unterlagen und Nachforderungen"
              description="Fordern Sie Unterlagen gezielt an, prüfen Sie neue Uploads und behalten Sie den SEPANA-Übertragungsstatus pro Datei direkt im Blick."
              tone="slate"
            />
            <DocumentPanel
              caseId={c.id}
              requests={data.document_requests ?? []}
              documents={data.documents ?? []}
              europaceDocuments={[]}
              europaceUploadTargets={[]}
              skagDocuments={schufaData?.skagDocuments ?? []}
              caseType={caseType}
              canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
              caseCustomerId={c.customer_id ?? null}
              caseAdvisorId={c.assigned_advisor_id ?? null}
            />
          </section>

          <section id="schufa-servicepauschale" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Servicepauschale"
              title="Interne Servicepauschale verwalten"
              description="Der Berater hinterlegt hier die interne Servicepauschale mit manuellem Bruttobetrag inklusive MwSt. Mit dem Speichern wird der gesonderte Vermittlungsauftrag aktualisiert und der Vertragsbereich freigeschaltet. Fällig wird die Pauschale erst nach Kreditauszahlung."
              tone="cyan"
            />
            <SchufaFreeServiceFeePanel
              caseId={c.id}
              invoice={serviceFeeInvoice}
              cancellationInvoice={schufaData?.cancellationInvoice ?? null}
            />
          </section>

          <section id="schufa-signatur" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="Vertrag & Signatur"
              title="Kreditvertrag unterschriftsreif machen"
              description="Nach Anlage der internen Servicepauschalenrechnung laden Sie hier den vollständigen Kreditvertrag hoch. Das PDF wird automatisch in gesonderten Vermittlungsauftrag, Vertrag, Ratenschutz, Serviceprovision, ggf. Abtretung und Informationsblätter aufgeteilt."
              tone="emerald"
            />
            {bankCaseDocuments.length > 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
                Es liegen bereits importierte Bankdokumente im Fall vor. Pruefen Sie, ob der Kreditvertrag davon in
                den Signaturbereich uebernommen werden soll.
              </div>
            ) : null}
            <SignaturePanel
              caseId={c.id}
              canEdit
              fixedProviderName="SIGMA Kreditbank AG"
              providerProduct="konsum"
              uploadMode="schufaFreePackage"
              skagDocumentStatuses={schufaData?.skagDocuments ?? []}
              contractSigningUnlocked={contractSigningUnlocked}
            />
          </section>

          <section id="schufa-postident" className="space-y-3">
            <SchufaFreeIntroCard
              eyebrow="PostIdent"
              title="PostIdent-Link bereitstellen"
              description="Fügen Sie hier den Link aus dem SKAG-Partnerbereich ein. Beim Übermitteln landet er direkt im Kundendashboard und der Kunde erhält zusätzlich eine E-Mail-Benachrichtigung."
              tone="slate"
            />
            <SchufaFreePostIdentPanel
              mode="advisor"
              caseId={c.id}
              postidentUrl={schufaData?.sync?.postident_url ?? null}
              postidentAddedAt={schufaData?.sync?.postident_added_at ?? null}
              postidentNotifiedAt={schufaData?.sync?.postident_notified_at ?? null}
              statusAlias={schufaData?.sync?.last_status_alias ?? schufaData?.pushEvents?.[0]?.status_alias ?? null}
            />
          </section>
        </div>

        <section id="schufa-chat" className="space-y-3">
          <SchufaFreeIntroCard
            eyebrow="Direkter Austausch"
            title="Chat mit dem Kunden"
            description="Nutzen Sie den Chat für Rückfragen, Dokumentenhinweise und die Begleitung bis zu PostIdent und Auszahlung."
            tone="slate"
          />
          <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ClearSignatureHash />
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/advisor/faelle" className="text-sm font-medium text-slate-900 underline underline-offset-4">
              {"<-"} Zurück zu Fälle
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">Fall {c.case_ref || c.id.slice(0, 8)}</h1>
            <div className="mt-1 text-sm text-slate-600">
              Erstellt: {dt(c.created_at)} · Status:{" "}
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
        <div className="mt-4">
          <AdvisorCaseRefEditor caseId={c.id} initialValue={c.advisor_case_ref ?? null} variant="inline" />
        </div>
      </div>

      <RecommendedByCard recommendedBy={data.recommended_by} />

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Status</div>
            <div className="mt-1 text-sm text-slate-600">
              Setzen Sie den internen Beratungsstatus für diesen Fall.
            </div>
          </div>
          <div className="w-full max-w-xs">
            <AdvisorCaseStatusSelect caseId={c.id} value={advisorStatus} caseType={caseType} />
          </div>
        </div>
      </div>

      <AdvisorPrivateNoteEditor caseId={c.id} initialValue={c.advisor_private_note ?? null} />

      {isKonsum ? <EuropaceSyncCard caseId={c.id} initialMeta={data.europace ?? null} /> : null}
      {isKonsum ? (
        <EuropaceStatusCard
          caseId={c.id}
          endpoint="/api/advisor/privatkredit/europace/status"
          initialMeta={data.europace ?? null}
          initialApplications={data.europace_applications ?? []}
          initialFlow={data.europace_flow ?? null}
        />
      ) : null}
      {isKonsum ? (
        <EuropaceOffersCard
          caseId={c.id}
          initialOffers={data.europace_offers ?? []}
          initialMeta={data.europace ?? null}
          initialApplications={data.europace_applications ?? []}
        />
      ) : null}
      {isKonsum ? (
        <EuropaceDocumentsCard
          caseId={c.id}
          initialVorgangsnummer={data.europace?.vorgangsnummer ?? null}
          initialAntragsnummer={data.europace?.antragsnummer ?? null}
          localDocumentCount={(data.europace_documents ?? []).length}
        />
      ) : null}

      {advisor ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {advisorAvatar ? <img src={advisorAvatar} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Dein Berater</div>
              <div className="text-lg font-semibold text-slate-900">{advisor.display_name ?? "-"}</div>
              <div className="mt-1 text-sm text-slate-700">{advisor.bio ?? "-"}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {advisor.phone ? <span>Tel: {advisor.phone}</span> : null}
                {advisor.email ? <span>E-Mail: {advisor.email}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(advisor.languages ?? []).map((l) => (
                  <span key={l} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LiveCasePanel caseId={c.id} caseRef={c.case_ref ?? null} defaultCollapsed showMissingDataReminderButton />

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

      {!isKonsum ? <OfferEditor caseId={c.id} caseType={caseType} /> : null}
      {!isKonsum ? (
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-900">Finale Angebote</div>
          <p className="mt-1 text-xs text-slate-600">Diese Angebote werden später vom Berater erstellt und freigegeben.</p>
          <OfferList offers={data.offers ?? []} canManage caseType={caseType} />
        </div>
      ) : null}

      <DocumentPanel
        caseId={c.id}
        requests={data.document_requests ?? []}
        documents={data.documents ?? []}
        europaceDocuments={data.europace_documents ?? []}
        europaceUploadTargets={data.europace_upload_targets ?? []}
        caseType={caseType}
        canCreateRequest={data.viewer_role === "advisor" || data.viewer_role === "admin"}
        caseCustomerId={c.customer_id ?? null}
        caseAdvisorId={c.assigned_advisor_id ?? null}
      />

      {isKonsum && bankCaseDocuments.length > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Signatur-Übergabe</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Bankvorschau liegt vor, jetzt nur noch den Kreditvertrag signierbar machen
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-950">
            Kreditvertrag und Datenschutzhinweise der Bank liegen bereits im Dokumentenbereich. Übernehmen Sie jetzt
            nur noch den Kreditvertrag im Bereich Unterschriften als signierbare Version, setzen Sie die Felder für
            Kunde und Berater und schicken Sie das Dokument danach an den Kunden.
          </p>
        </div>
      ) : null}

      <div id="unterschriften" className="scroll-mt-24">
        <SignaturePanel caseId={c.id} canEdit />
      </div>

      <CaseChat caseId={c.id} currentUserId={user.id} initialMessages={data.chat ?? []} />
    </div>
  )
}






