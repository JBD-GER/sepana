import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type AdminClient = ReturnType<typeof supabaseAdmin>

type CurrentApplicantRow = {
  case_id: string
  email: string | null
}

type CurrentDetailsRow = {
  case_id: string
  email: string | null
}

type CandidateDetailsRow = {
  case_id: string
  email: string | null
  completed_application_at: string | null
  submitted_to_skag_at: string | null
}

type CandidateCaseRow = {
  id: string
  case_ref: string | null
  case_type: string | null
}

export type SchufaFreeCompletedOtherApplication = {
  caseId: string
  caseRef: string | null
  email: string
  completedApplicationAt: string | null
  submittedToSkagAt: string | null
}

function normalizeEmail(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function completionTimestamp(value: {
  completedApplicationAt: string | null
  submittedToSkagAt: string | null
}) {
  return value.submittedToSkagAt ?? value.completedApplicationAt ?? null
}

function completionRank(value: {
  completedApplicationAt: string | null
  submittedToSkagAt: string | null
}) {
  const timestamp = completionTimestamp(value)
  if (!timestamp) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export async function getSchufaFreeCompletedOtherApplicationsByCaseIds(
  admin: AdminClient,
  caseIds: string[]
) {
  const normalizedCaseIds = Array.from(new Set(caseIds.map((caseId) => String(caseId ?? "").trim()).filter(Boolean)))
  const blockers = new Map<string, SchufaFreeCompletedOtherApplication>()
  if (!normalizedCaseIds.length) return blockers

  const [currentDetailsResult, currentApplicantsResult] = await Promise.all([
    admin.from("case_schufa_free_details").select("case_id,email").in("case_id", normalizedCaseIds),
    admin.from("case_applicants").select("case_id,email").eq("role", "primary").in("case_id", normalizedCaseIds),
  ])

  const currentDetailsRows: CurrentDetailsRow[] = Array.isArray(currentDetailsResult.data) ? currentDetailsResult.data : []
  const currentApplicantRows: CurrentApplicantRow[] = Array.isArray(currentApplicantsResult.data)
    ? currentApplicantsResult.data
    : []

  const currentEmailByCaseId = new Map<string, string>()
  const candidateQueryEmails = new Set<string>()

  for (const row of currentDetailsRows) {
    const normalizedEmail = normalizeEmail(row.email)
    if (!normalizedEmail) continue
    currentEmailByCaseId.set(row.case_id, normalizedEmail)
    candidateQueryEmails.add(normalizedEmail)
    const rawEmail = String(row.email ?? "").trim()
    if (rawEmail) candidateQueryEmails.add(rawEmail)
  }

  for (const row of currentApplicantRows) {
    const normalizedEmail = normalizeEmail(row.email)
    if (!normalizedEmail || currentEmailByCaseId.has(row.case_id)) continue
    currentEmailByCaseId.set(row.case_id, normalizedEmail)
    candidateQueryEmails.add(normalizedEmail)
    const rawEmail = String(row.email ?? "").trim()
    if (rawEmail) candidateQueryEmails.add(rawEmail)
  }

  const emailFilters = Array.from(candidateQueryEmails).filter(Boolean)
  if (!emailFilters.length) return blockers

  const [candidateDetailsResult, candidateApplicantsResult] = await Promise.all([
    admin
      .from("case_schufa_free_details")
      .select("case_id,email,completed_application_at,submitted_to_skag_at")
      .in("email", emailFilters),
    admin.from("case_applicants").select("case_id,email").eq("role", "primary").in("email", emailFilters),
  ])

  const candidateDetailsRows: CandidateDetailsRow[] = Array.isArray(candidateDetailsResult.data)
    ? candidateDetailsResult.data
    : []
  const candidateApplicantRows: CurrentApplicantRow[] = Array.isArray(candidateApplicantsResult.data)
    ? candidateApplicantsResult.data
    : []

  const candidateCaseIds = Array.from(
    new Set([...candidateDetailsRows.map((row) => row.case_id), ...candidateApplicantRows.map((row) => row.case_id)].filter(Boolean))
  )
  if (!candidateCaseIds.length) return blockers

  const [candidateCasesResult, candidateCompletionDetailsResult] = await Promise.all([
    admin.from("cases").select("id,case_ref,case_type").in("id", candidateCaseIds),
    admin
      .from("case_schufa_free_details")
      .select("case_id,email,completed_application_at,submitted_to_skag_at")
      .in("case_id", candidateCaseIds),
  ])

  const candidateCases: CandidateCaseRow[] = Array.isArray(candidateCasesResult.data) ? candidateCasesResult.data : []
  const candidateCompletionDetailsRows: CandidateDetailsRow[] = Array.isArray(candidateCompletionDetailsResult.data)
    ? candidateCompletionDetailsResult.data
    : []
  const candidateCaseById = new Map<string, CandidateCaseRow>()
  for (const row of candidateCases) {
    candidateCaseById.set(row.id, row)
  }

  const candidateEmailByCaseId = new Map<string, string>()
  for (const row of candidateCompletionDetailsRows) {
    const normalizedEmail = normalizeEmail(row.email)
    if (!normalizedEmail) continue
    candidateEmailByCaseId.set(row.case_id, normalizedEmail)
  }
  for (const row of candidateApplicantRows) {
    const normalizedEmail = normalizeEmail(row.email)
    if (!normalizedEmail || candidateEmailByCaseId.has(row.case_id)) continue
    candidateEmailByCaseId.set(row.case_id, normalizedEmail)
  }

  const completedByEmail = new Map<string, SchufaFreeCompletedOtherApplication[]>()
  for (const row of candidateCompletionDetailsRows) {
    const email = candidateEmailByCaseId.get(row.case_id)
    const caseMeta = candidateCaseById.get(row.case_id)
    if (!email || !caseMeta) continue
    if (String(caseMeta.case_type ?? "").trim().toLowerCase() !== "schufa_frei") continue
    if (!row.completed_application_at && !row.submitted_to_skag_at) continue

    const bucket = completedByEmail.get(email) ?? []
    bucket.push({
      caseId: row.case_id,
      caseRef: caseMeta.case_ref ?? null,
      email,
      completedApplicationAt: row.completed_application_at ?? null,
      submittedToSkagAt: row.submitted_to_skag_at ?? null,
    })
    completedByEmail.set(email, bucket)
  }

  for (const [email, bucket] of completedByEmail) {
    bucket.sort((a, b) => completionRank(b) - completionRank(a))
    completedByEmail.set(email, bucket)
  }

  for (const caseId of normalizedCaseIds) {
    const email = currentEmailByCaseId.get(caseId)
    if (!email) continue
    const otherCompletedApplication = (completedByEmail.get(email) ?? []).find((entry) => entry.caseId !== caseId)
    if (!otherCompletedApplication) continue
    blockers.set(caseId, otherCompletedApplication)
  }

  return blockers
}
