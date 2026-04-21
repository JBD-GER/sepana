import Link from "next/link"
import { notFound } from "next/navigation"
import { translateCaseStatus } from "@/lib/caseStatus"
import { requireInsurance } from "@/lib/insurance/requireInsurance"
import {
  buildInsuranceInvoicePaymentReference,
  extractInsurancePartnerCode,
  formatEuro,
  getInsuranceRouteSourceLabel,
  getInsuranceRouteStatusLabel,
} from "@/lib/insurance/invoice"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import InsuranceCaseNotesPanel from "../../ui/InsuranceCaseNotesPanel"
import InsuranceCaseStatusPanel from "../../ui/InsuranceCaseStatusPanel"
import InsuranceDataTabs from "../../ui/InsuranceDataTabs"
import InsuranceInvoicePanel from "../../ui/InsuranceInvoicePanel"

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function formatDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(raw))
}

function detailLine(label: string, value: string | number | null | undefined) {
  const normalized = value == null || String(value).trim() === "" ? "-" : String(value)
  return { label, value: normalized }
}

function formatDocumentSize(value: unknown) {
  const bytes = Number(value ?? 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return "-"
  return `${Math.round(bytes / 1024)} KB`
}

function isImageMimeType(value: unknown) {
  return String(value ?? "").trim().toLowerCase().startsWith("image/")
}

function getDocumentTypeLabel(value: unknown) {
  const mime = String(value ?? "").trim().toLowerCase()
  if (mime === "application/pdf") return "PDF"
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase()
  return mime || "Datei"
}

export default async function InsuranceCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: caseId } = await params
  const { user, role } = await requireInsurance()
  const admin = supabaseAdmin()

  const access = await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) notFound()

  const [routeResult, caseResult, applicantResult, detailsResult, documentsResult, notesResult, invoiceResult] = await Promise.all([
    admin.from("case_insurance_routes").select("*").eq("case_id", caseId).maybeSingle(),
    admin
      .from("cases")
      .select("id,case_ref,status,created_at,assigned_advisor_id,advisor_private_note")
      .eq("id", caseId)
      .maybeSingle(),
    admin.from("case_applicants").select("*").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    admin.from("case_schufa_free_details").select("*").eq("case_id", caseId).maybeSingle(),
    admin
      .from("documents")
      .select("id,file_name,file_path,mime_type,size_bytes,created_at,uploaded_by")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    admin
      .from("case_insurance_notes")
      .select("id,author_id,author_role,body,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    admin
      .from("case_invoices")
      .select("*")
      .eq("case_id", caseId)
      .eq("invoice_type", "insurance_partner_commission")
      .maybeSingle(),
  ])

  const route = routeResult.data
  const caseRow = caseResult.data
  const applicant = applicantResult.data as Record<string, any> | null
  const details = detailsResult.data as Record<string, any> | null
  const documents = (documentsResult.data ?? []) as Array<Record<string, any>>
  const invoice = invoiceResult.data as {
    id: string
    created_by?: string | null
    invoice_number?: string | null
    status?: string | null
    amount_total?: number | null
    created_at?: string | null
    description?: string | null
  } | null

  if (!route || !caseRow) notFound()

  const notes = (notesResult.data ?? []) as Array<{
    id: string
    author_id: string
    author_role: string
    body: string
    created_at: string
  }>

  const insuranceAuthorIds = Array.from(
    new Set(notes.filter((note) => note.author_role === "insurance").map((note) => note.author_id))
  )
  const partnerProfileUserId = role === "insurance" ? user.id : String(invoice?.created_by ?? "").trim() || null

  const [{ data: profile }, { data: advisor }, { data: insuranceAuthorProfiles }] = await Promise.all([
    partnerProfileUserId
      ? admin
          .from("insurance_partner_profiles")
          .select("partner_code,company_name,display_name,email")
          .eq("user_id", partnerProfileUserId)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    caseRow.assigned_advisor_id
      ? admin
          .from("advisor_profiles")
          .select("display_name,phone")
          .eq("user_id", caseRow.assigned_advisor_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    insuranceAuthorIds.length
      ? admin
          .from("insurance_partner_profiles")
          .select("user_id,partner_code,company_name,display_name")
          .in("user_id", insuranceAuthorIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const insuranceAuthorById = new Map<string, string>()
  for (const row of insuranceAuthorProfiles ?? []) {
    insuranceAuthorById.set(
      row.user_id,
      row.company_name ?? row.display_name ?? row.partner_code ?? row.user_id.slice(0, 8)
    )
  }

  const noteItems = notes.map((note) => ({
    id: note.id,
    body: note.body,
    created_at: note.created_at,
    author_label: note.author_role === "admin" ? "Admin" : insuranceAuthorById.get(note.author_id) ?? "Versicherung",
  }))

  const customerName = [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ").trim() || "-"
  const customerEmail = String(details?.email ?? applicant?.email ?? "").trim() || "-"
  const customerPhone = String(details?.phone_primary ?? applicant?.phone ?? "").trim() || "-"
  const customerPhoneSecondary = String(details?.phone_secondary ?? "").trim() || "-"
  const partnerCode = profile?.partner_code ?? extractInsurancePartnerCode(invoice?.description)
  const paymentReference = buildInsuranceInvoicePaymentReference(partnerCode, caseRow.case_ref ?? null)
  const mainStatusLabel = translateCaseStatus(caseRow.status)

  const dataSections = [
    {
      id: "person",
      label: "Person & Haushalt",
      description: "Persoenliche Daten, Kontakt und Wohnsituation aus dem Antrag.",
      items: [
        detailLine("Vorname", applicant?.first_name ?? "-"),
        detailLine("Nachname", applicant?.last_name ?? "-"),
        detailLine("E-Mail", customerEmail),
        detailLine("Telefon", customerPhone),
        detailLine("Telefon 2", customerPhoneSecondary),
        detailLine("Geburtsname", details?.birth_name ?? "-"),
        detailLine("Geburtsdatum", formatDate(details?.date_of_birth)),
        detailLine("Geburtsort", details?.place_of_birth ?? "-"),
        detailLine("Staatsangehoerigkeit", details?.nationality ?? "-"),
        detailLine("Familienstand", details?.family_situation ?? "-"),
        detailLine("Kinder", details?.dependent_children_count ?? 0),
        detailLine("Kinderalter", details?.children_ages_csv ?? "-"),
        detailLine("Kinderfreibetrag", details?.tax_child ?? "-"),
        detailLine("Strasse", details?.street ?? "-"),
        detailLine("Hausnummer", details?.house_number ?? "-"),
        detailLine("PLZ", details?.zipcode ?? "-"),
        detailLine("Ort", details?.city ?? "-"),
        detailLine("Wohnsituation", details?.residence_type ?? "-"),
        detailLine("Warmmiete", formatEuro(details?.rent_monthly ?? 0)),
        detailLine("Wohnhaft seit", formatDate(details?.resident_since)),
      ],
    },
    {
      id: "income",
      label: "Beruf & Einkommen",
      description: "Arbeitsdaten, Einkommen und Arbeitgeberangaben.",
      items: [
        detailLine("Steuerklasse", details?.tax_class ?? "-"),
        detailLine("Beruf", details?.profession ?? "-"),
        detailLine("Im Beruf seit", formatDate(details?.profession_begin_date)),
        detailLine("Arbeitgeber", details?.employer_name ?? "-"),
        detailLine("Arbeitgeber Strasse", details?.employer_street ?? "-"),
        detailLine("Arbeitgeber Hausnr.", details?.employer_house ?? "-"),
        detailLine("Arbeitgeber PLZ", details?.employer_zipcode ?? "-"),
        detailLine("Arbeitgeber Ort", details?.employer_city ?? "-"),
        detailLine("Arbeitgeber Telefon", details?.employer_phone ?? "-"),
        detailLine("Arbeitgeber E-Mail", details?.employer_email ?? "-"),
        detailLine("Nettoeinkommen", formatEuro(details?.net_income_monthly ?? 0)),
        detailLine("Zusatzeinkommen", formatEuro(details?.additional_income_monthly ?? 0)),
        detailLine("Zusatzeinkommen seit", formatDate(details?.additional_income_begin_date)),
        detailLine("Arbeitsverhaeltnis befristet", details?.employment_relationship_limited ? "Ja" : "Nein"),
        detailLine("Lohnabtretung / Pfaendung", details?.wage_garnishment_assignment ? "Ja" : "Nein"),
      ],
    },
    {
      id: "banking",
      label: "Bank & Abschluss",
      description: "Bankdaten, Ehepartner und Einreichungsstatus.",
      items: [
        detailLine("Kontoinhaber / Bank", details?.bank_name ?? "-"),
        detailLine("IBAN", details?.iban ?? "-"),
        detailLine("Ehepartner Vorname", details?.spouse_first_name ?? "-"),
        detailLine("Ehepartner Geburtsdatum", formatDate(details?.spouse_birth_date)),
        detailLine("Ehepartner Geburtsname", details?.spouse_birth_name ?? "-"),
        detailLine("Ehepartner Einkommen", formatEuro(details?.spouse_income_monthly ?? 0)),
        detailLine("Ratenschutz", details?.ratenschutz_opt_in || details?.ratenschutz_opt_in_at ? "Ja" : "Nein"),
        detailLine("Vollantrag abgeschlossen", formatDateTime(details?.completed_application_at)),
        detailLine("An SEPANA uebermittelt", formatDateTime(details?.submitted_to_skag_at)),
        detailLine("Fall angelegt", formatDateTime(caseRow.created_at)),
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_34%),linear-gradient(135deg,#ffffff,#f8fafc)] p-6 shadow-sm">
        <Link href="/versicherung" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          {"<-"} Zurueck zum Dashboard
        </Link>

        <div className="mt-5 grid gap-4 xl:items-start xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Versicherungsfall</div>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">{customerName}</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Fall {caseRow.case_ref ?? caseRow.id.slice(0, 8)} / Ursprung: Kredit ohne Schufa
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  Hauptstatus: {mainStatusLabel}
                </span>
                <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900">
                  Versicherungsstatus: {getInsuranceRouteStatusLabel(route.route_status)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-12">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 lg:col-span-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">E-Mail</div>
                <div className="mt-2 break-all text-sm font-medium text-slate-900">{customerEmail}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 lg:col-span-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Telefon</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{customerPhone}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 lg:col-span-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Berater</div>
                <div className="mt-2 text-sm font-medium text-slate-900">{advisor?.display_name ?? "-"}</div>
                <div className="mt-1 text-xs text-slate-500">{advisor?.phone ?? "-"}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Uebergabe</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{getInsuranceRouteSourceLabel(route.route_source)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Uebergeben am</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(route.routed_at)}</div>
              </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Interner Partner</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{partnerCode ?? "-"}</div>
                </div>
            </div>
          </div>

          <div className="grid gap-4 self-start">
            <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Kreditkern</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kreditbetrag</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatEuro(details?.loan_amount_requested ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Laufzeit</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{details?.term_months ?? "-"} Monate</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Unterlagen</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{documents.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Vollantrag</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(details?.completed_application_at)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Abrechnung</div>
              <div className="mt-2 text-sm text-slate-600">Partner-ID und Verwendungszweck fuer die interne Versicherungsprovision.</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Partner-ID</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{partnerCode ?? "-"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Verwendungszweck</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{paymentReference || "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InsuranceDataTabs sections={dataSections} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Interne Hinweise</div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Beraterkontext und Routing-Stand</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Aktuelle Beraternotiz</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {String(caseRow.advisor_private_note ?? "").trim() || "Keine aktuelle Beraternotiz hinterlegt."}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Snapshot bei Uebergabe</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {String(route.advisor_private_note_snapshot ?? "").trim() || "Beim Routing war keine Notiz gespeichert."}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unterlagen</div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Dokumente des Kreditfalls</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Der Versicherungsberater hat hier direkten Download-Zugriff auf alle hochgeladenen Unterlagen.
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200/70">
                    <th className="px-4 py-3 font-medium text-slate-700">Vorschau</th>
                    <th className="px-4 py-3 font-medium text-slate-700">Typ</th>
                    <th className="px-4 py-3 font-medium text-slate-700">Groesse</th>
                    <th className="px-4 py-3 font-medium text-slate-700">Datum</th>
                    <th className="px-4 py-3 font-medium text-slate-700">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <a
                          href={`/api/insurance/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}?download=1`}
                          className="group flex items-center gap-3"
                        >
                          {isImageMimeType(document.mime_type) ? (
                            <img
                              src={`/api/insurance/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}`}
                              alt={document.file_name ?? "Dokument"}
                              className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
                            />
                          ) : (
                            <div className="grid h-20 w-20 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-center shadow-sm">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {getDocumentTypeLabel(document.mime_type)}
                                </div>
                                <div className="mt-2 text-xs font-medium text-slate-700">Vorschau</div>
                              </div>
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-700">
                              {document.file_name ?? "-"}
                            </div>
                          </div>
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{getDocumentTypeLabel(document.mime_type)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDocumentSize(document.size_bytes)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDateTime(document.created_at)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/insurance/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(document.id)}?download=1`}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        Noch keine Dokumente vorhanden.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <InsuranceCaseNotesPanel caseId={caseId} notes={noteItems} />
        </div>

        <div className="space-y-6">
          <InsuranceCaseStatusPanel caseId={caseId} value={route.route_status ?? null} />
          <InsuranceInvoicePanel
            caseId={caseId}
            caseRef={caseRow.case_ref ?? null}
            partnerCode={partnerCode}
            invoice={invoice}
            editable={role === "insurance"}
          />
        </div>
      </div>
    </div>
  )
}
