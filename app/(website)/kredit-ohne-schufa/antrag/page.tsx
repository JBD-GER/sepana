import type { Metadata } from "next"
import Link from "next/link"
import SchufaFreeApplicationClient from "@/components/schufa-frei/SchufaFreeApplicationClient"
import SchufaFreeDetailsOverview from "@/components/schufa-frei/SchufaFreeDetailsOverview"
import SchufaFreeStatusOverview from "@/components/schufa-frei/SchufaFreeStatusOverview"
import {
  getSchufaFreeFamilyLabel,
  getSchufaFreeProfessionLabel,
} from "@/lib/schufa-frei/application"
import { normalizeSchufaFreeDocumentRequest } from "@/lib/schufa-frei/documentRecommendations"
import { hasDedicatedSkagVariantCredentials } from "@/lib/skag/config"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const metadata: Metadata = {
  title: "Kredit ohne Schufa Antrag | SEPANA",
  robots: { index: false, follow: false },
}

type PageSearchParams = {
  caseId?: string
  caseRef?: string
  access?: string
  existing?: string
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseBoolParam(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

export default async function SchufaFreeApplicationPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const sp = await searchParams
  const caseId = trimOrNull(sp.caseId)
  const caseRef = trimOrNull(sp.caseRef)
  const accessToken = trimOrNull(sp.access)
  const existingAccount = parseBoolParam(sp.existing)

  if (!caseId || !caseRef || !accessToken) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
          Kredit ohne Schufa
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Link ungültig</h1>
        <p className="mt-2 text-sm text-slate-600">Für diese Seite fehlt der öffentliche Fallzugriff.</p>
        <Link
          href="/kredit-ohne-schufa"
          className="mt-4 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Neu starten
        </Link>
      </div>
    )
  }

  const admin = supabaseAdmin()
  const access = await resolvePublicOnlinekreditCaseAccess(admin, {
    caseId,
    caseRef,
    accessToken,
    expectedCaseType: "schufa_frei",
  })

  if (!access.ok) {
    return (
      <div className="rounded-[28px] border border-amber-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
          Kredit ohne Schufa
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Link ungültig oder abgelaufen
        </h1>
        <p className="mt-2 text-sm text-slate-600">Bitte starten Sie die Vorprüfung erneut.</p>
        <Link
          href="/kredit-ohne-schufa"
          className="mt-4 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Vorprüfung starten
        </Link>
      </div>
    )
  }

  const [
    caseResult,
    applicantResult,
    detailsResult,
    customerAuthResult,
    requestsResult,
    documentsResult,
    syncResult,
    pushResult,
    skagDocumentsResult,
  ] = await Promise.all([
    admin.from("cases").select("id,case_ref,status").eq("id", caseId).maybeSingle(),
    admin.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    admin.from("case_schufa_free_details").select("*").eq("case_id", caseId).maybeSingle(),
    access.caseRow.customer_id
      ? admin.auth.admin.getUserById(access.caseRow.customer_id)
      : Promise.resolve({ data: null as { user?: { email?: string | null } | null } | null }),
    admin
      .from("document_requests")
      .select("id,title,required")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("documents")
      .select("id,file_name,created_at,request_id")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    admin.from("case_skag_sync").select("*").eq("case_id", caseId).maybeSingle(),
    admin
      .from("case_skag_push_events")
      .select("status_alias,status_description,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("case_skag_documents")
      .select("local_document_id,upload_status,last_error")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ])

  const caseRow = caseResult.data ?? null
  const applicant = applicantResult.data ?? null
  const details = detailsResult.data ?? null
  const customerAuthEmail = customerAuthResult?.data?.user?.email ?? null
  const requests = (
    (requestsResult.data ?? []) as Array<{ id: string; title: string; required?: boolean | null }>
  ).map((request) => normalizeSchufaFreeDocumentRequest(request))
  const documents = (documentsResult.data ??
    []) as Array<{ id: string; file_name: string; created_at: string; request_id?: string | null }>
  const sync = syncResult.data ?? null
  const pushEvents = (pushResult.data ??
    []) as Array<{ status_alias?: string | null; status_description?: string | null; created_at?: string | null }>
  const skagDocuments = (skagDocumentsResult.data ??
    []) as Array<{ local_document_id?: string | null; upload_status?: string | null; last_error?: string | null }>
  const allowTaxClassSix = hasDedicatedSkagVariantCredentials("open")
  const hasSubmittedToSkag = Boolean(sync?.skag_credit_id)

  const initialForm = {
    firstName: applicant?.first_name ?? "",
    lastName: applicant?.last_name ?? "",
    email: customerAuthEmail ?? details?.email ?? applicant?.email ?? "",
    phonePrimary: details?.phone_primary ?? applicant?.phone ?? "",
    phoneSecondary: details?.phone_secondary ?? "",
    gender: details?.gender ?? 1,
    birthName: details?.birth_name ?? "",
    dateOfBirth: details?.date_of_birth ?? applicant?.birth_date ?? "",
    placeOfBirth: details?.place_of_birth ?? "",
    nationality: details?.nationality ?? "DE",
    familySituation: details?.family_situation ?? 1,
    familySituationLabel: getSchufaFreeFamilyLabel(details?.family_situation) ?? "Ledig",
    childrenTaxAllowance: details?.tax_child ?? "",
    numberOfChildren: details?.dependent_children_count ?? 0,
    childrenAgesCsv: details?.children_ages_csv ?? "",
    street: details?.street ?? "",
    houseNumber: details?.house_number ?? "",
    zipcode: details?.zipcode ?? "",
    city: details?.city ?? "",
    residenceType: details?.residence_type ?? 1,
    rentMonthly: details?.rent_monthly ?? "",
    residentSince: details?.resident_since ?? "",
    taxClass: details?.tax_class ?? 1,
    profession: details?.profession ?? 2,
    professionLabel: getSchufaFreeProfessionLabel(details?.profession) ?? "Angestellter",
    professionBeginDate: details?.profession_begin_date ?? "",
    employerName: details?.employer_name ?? "",
    employerStreet: details?.employer_street ?? "",
    employerHouse: details?.employer_house ?? "",
    employerZipcode: details?.employer_zipcode ?? "",
    employerCity: details?.employer_city ?? "",
    employerPhone: details?.employer_phone ?? "",
    employerEmail: details?.employer_email ?? "",
    netIncomeMonthly: details?.net_income_monthly ?? "",
    additionalIncomeMonthly: details?.additional_income_monthly ?? "",
    additionalIncomeBeginDate: details?.additional_income_begin_date ?? "",
    employmentRelationshipLimited: details?.employment_relationship_limited ?? false,
    wageGarnishmentAssignment: details?.wage_garnishment_assignment ?? false,
    bankName: details?.bank_name ?? "",
    iban: details?.iban ?? "",
    spouseFirstName: details?.spouse_first_name ?? "",
    spouseBirthDate: details?.spouse_birth_date ?? "",
    spouseBirthName: details?.spouse_birth_name ?? "",
    spouseIncomeMonthly: details?.spouse_income_monthly ?? "",
    ratenschutzOptIn: Boolean(details?.ratenschutz_opt_in || details?.ratenschutz_opt_in_at),
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-5 shadow-sm sm:rounded-[40px] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Kredit ohne Schufa · Fall {caseRow?.case_ref ?? caseId}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {hasSubmittedToSkag ? "Status, Angaben und Unterlagen" : "Antrag jetzt vollständig ausfüllen"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              {hasSubmittedToSkag
                ? "Ihr Antrag wurde übermittelt. Hier sehen Sie jetzt den aktuellen Stand, die gespeicherten Angaben und können weitere Unterlagen hochladen."
                : "Die Vorprüfung ist angelegt. Im nächsten Schritt füllen Sie bitte zuerst den Antrag vollständig aus. Die Übersicht mit Status und gespeicherten Angaben erscheint erst danach."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
            {hasSubmittedToSkag
              ? "Antrag übermittelt"
              : existingAccount
                ? "Bestehender Portalzugang erkannt"
                : "Neuer Fall angelegt"}
          </div>
        </div>
      </section>

      {hasSubmittedToSkag ? (
        <>
          <SchufaFreeStatusOverview
            caseStatus={caseRow?.status ?? null}
            sync={sync}
            pushEvents={pushEvents}
            documentCount={documents.length}
            requestCount={requests.length}
          />

          <SchufaFreeDetailsOverview applicant={applicant} details={details} />
        </>
      ) : null}

      <SchufaFreeApplicationClient
        caseId={caseId}
        caseRef={caseRef}
        accessToken={accessToken}
        initialForm={initialForm}
        requests={requests}
        documents={documents}
        skagDocuments={skagDocuments}
        hasSubmittedToSkag={hasSubmittedToSkag}
        allowTaxClassSix={allowTaxClassSix}
      />
    </div>
  )
}
