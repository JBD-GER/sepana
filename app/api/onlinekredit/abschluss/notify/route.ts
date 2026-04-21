import { NextResponse } from "next/server"
import { flattenEuropaceAvailableAssignments, listEuropaceAvailableAssignments } from "@/lib/europace/documents"
import { firstEuropaceApplication } from "@/lib/europace/status"
import type { EuropaceExportResult } from "@/lib/europace/types"
import { deriveConcreteUploadRequirements } from "@/lib/europace/uploadRequirements"
import { getOnlinekreditAccountCheckRestrictionReason } from "@/lib/onlinekredit/accountCheckPolicy"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

type AcceptedOfferRow = {
  angebot_snapshot?: {
    sofortkredit?: boolean | null
    digitalisierungsmerkmale?: {
      accountCheck?: {
        modus?: string | null
      } | null
    } | null
  } | null
} | null

type DocumentRequestRow = {
  id: string
  title: string
  created_at?: string | null
  required?: boolean | null
}

type DocumentRow = {
  id: string
  request_id?: string | null
}

type EuropaceDocumentRow = {
  local_document_id?: string | null
  category?: string | null
  assignment_id?: string | null
}

type BankContinuationStep = {
  applicantName: string | null
  referenceNumber: string | null
  videoLegitUrl: string | null
  qesUrl: string | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderMailLinkButton(input: { href: string; label: string; variant?: "primary" | "secondary" }) {
  const background = input.variant === "secondary" ? "#f0fdf4" : "#0f172a"
  const border = input.variant === "secondary" ? "#bbf7d0" : "#0f172a"
  const color = input.variant === "secondary" ? "#166534" : "#ffffff"
  return `
    <a
      href="${escapeHtml(input.href)}"
      style="display:inline-block; background:${background}; color:${color}; text-decoration:none; font-weight:700; font-size:14px; line-height:1; padding:12px 16px; border-radius:14px; border:1px solid ${border}; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;"
    >
      ${escapeHtml(input.label)}
    </a>
  `
}

function normalizeSiteUrl(raw: string | undefined, fallbackOrigin: string) {
  const input = String(raw ?? "").trim()
  if (!input) return fallbackOrigin
  try {
    return new URL(input).origin
  } catch {
    return fallbackOrigin
  }
}

function parseBool(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "on"].includes(normalized)
}

function normalizeMailCopy(value: string) {
  return value
    .replaceAll("Ã„", "Ä")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¤", "ä")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã¼", "ü")
    .replaceAll("ÃŸ", "ß")
}

function accountCheckStep(mode: string | null | undefined) {
  const normalized = String(mode ?? "").trim().toUpperCase()
  if (normalized === "REQUIRED") {
    return "Den Kontocheck für dieses Angebot führst du als separaten Online-Schritt direkt im Browser durch."
  }
  if (normalized === "OPTIONAL") {
    return "Falls der Anbieter einen Kontocheck nutzt, erfolgt er ebenfalls als separater Online-Schritt direkt im Browser."
  }
  return null
}

function hasRequiredAccountCheckMode(mode: string | null | undefined) {
  return String(mode ?? "").trim().toUpperCase() === "REQUIRED"
}

function getBankContinuationSteps(snapshot: EuropaceExportResult | null | undefined) {
  const application = firstEuropaceApplication(snapshot)
  if (!application) return [] as BankContinuationStep[]

  const candidates = [application.identifikationAntragsteller1, application.identifikationAntragsteller2]
  const seen = new Set<string>()

  return candidates
    .map((item) => {
      const applicantName = trimOrNull(item?.antragstellername)
      const referenceNumber = trimOrNull(item?.referenznummer)
      const videoLegitUrl = trimOrNull(item?.videolegitimationUrl)
      const qesUrl = trimOrNull(item?.qesUrl)
      if (!videoLegitUrl && !qesUrl) return null
      const dedupeKey = [applicantName, referenceNumber, videoLegitUrl, qesUrl].filter(Boolean).join("|")
      if (dedupeKey && seen.has(dedupeKey)) return null
      if (dedupeKey) seen.add(dedupeKey)
      return {
        applicantName,
        referenceNumber,
        videoLegitUrl,
        qesUrl,
      } satisfies BankContinuationStep
    })
    .filter((value): value is BankContinuationStep => Boolean(value))
}

async function wasAlreadySent(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data, error } = await admin
    .from("case_europace_sync_events")
    .select("case_id")
    .eq("case_id", caseId)
    .eq("operation", "onlinekreditBestaetigungMail")
    .eq("success", true)
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

async function logMailEvent(
  admin: ReturnType<typeof supabaseAdmin>,
  input: {
    caseId: string
    success: boolean
    requestPayload: unknown
    responsePayload?: unknown
    errorMessage?: string | null
  }
) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: "outbound",
    operation: "onlinekreditBestaetigungMail",
    request_payload: input.requestPayload,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const caseId = trimOrNull(body?.caseId)
    const caseRef = trimOrNull(body?.caseRef)
    const accessToken = trimOrNull(body?.access)
    const existingAccount = parseBool(body?.existing)

    if (!caseId || !caseRef || !accessToken) {
      return NextResponse.json({ ok: false, error: "caseId, caseRef oder access fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "konsum",
    })

    if (!access.ok) {
      const error =
        access.error === "case_type_not_supported"
          ? "Diese Strecke ist nur für Privatkredit vorgesehen."
          : "Der Onlinekredit-Link ist ungueltig oder abgelaufen."
      return NextResponse.json({ ok: false, error }, { status: access.status })
    }

    if (await wasAlreadySent(admin, caseId)) {
      return NextResponse.json({ ok: true, sent: false, skipped: true })
    }

    const [
      { data: applicant },
      { data: europace },
      { data: acceptedOffer },
      { data: documentRequests },
      { data: documents },
      { data: europaceDocuments },
      { data: policyApplicants },
      { data: policyBaufi },
    ] = await Promise.all([
      admin
        .from("case_applicants")
        .select("first_name,email")
        .eq("case_id", caseId)
        .eq("role", "primary")
        .maybeSingle(),
      admin
        .from("case_europace")
        .select("vorgangsnummer,antragsnummer,produktanbieterantragsnummer,last_export_snapshot")
        .eq("case_id", caseId)
        .maybeSingle(),
      admin
        .from("case_europace_offers")
        .select("angebot_snapshot")
        .eq("case_id", caseId)
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("document_requests")
        .select("id,title,created_at,required")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true }),
      admin
        .from("documents")
        .select("id,request_id")
        .eq("case_id", caseId),
      admin
        .from("case_europace_documents")
        .select("local_document_id,category,assignment_id")
        .eq("case_id", caseId),
      admin.from("case_applicants").select("employment_type").eq("case_id", caseId),
      admin.from("case_baufi_details").select("purpose").eq("case_id", caseId).maybeSingle(),
    ])

    const email = trimOrNull((applicant as { email?: string | null } | null)?.email)?.toLowerCase() ?? null
    const firstName = trimOrNull((applicant as { first_name?: string | null } | null)?.first_name)
    const vorgangsnummer = trimOrNull((europace as { vorgangsnummer?: string | null } | null)?.vorgangsnummer)
    const antragsnummer = trimOrNull((europace as { antragsnummer?: string | null } | null)?.antragsnummer)
    const produktanbieterantragsnummer = trimOrNull(
      (europace as { produktanbieterantragsnummer?: string | null } | null)?.produktanbieterantragsnummer
    )
    const exportSnapshot = ((europace as { last_export_snapshot?: unknown } | null)?.last_export_snapshot ??
      null) as EuropaceExportResult | null
    const bankContinuationSteps = getBankContinuationSteps(exportSnapshot)
    const bankContinuationReady = bankContinuationSteps.length > 0
    const accountCheckRestrictedReason = getOnlinekreditAccountCheckRestrictionReason({
      purpose: (policyBaufi as { purpose?: string | null } | null)?.purpose,
      employmentTypes: ((policyApplicants as Array<{ employment_type?: string | null }> | null) ?? []).map(
        (row) => row.employment_type
      ),
    })
    const accountCheckMode = trimOrNull(
      (acceptedOffer as AcceptedOfferRow)?.angebot_snapshot?.digitalisierungsmerkmale?.accountCheck?.modus
    )
    const acceptedOfferIsOnline =
      Boolean((acceptedOffer as AcceptedOfferRow)?.angebot_snapshot?.sofortkredit) && !accountCheckRestrictedReason

    if (!email) {
      return NextResponse.json({ ok: true, sent: false, skipped: true, reason: "missing_email" })
    }

    if (!antragsnummer) {
      return NextResponse.json(
        { ok: false, error: "Die finale Anfrage ist noch nicht vollständig angelegt." },
        { status: 409 }
      )
    }

    const titles = await (async () => {
      if (!vorgangsnummer) return [] as string[]

      try {
        const assignments = await listEuropaceAvailableAssignments(admin, {
          caseId,
          vorgangsnummer,
          antragsnummer,
        })

        const uploadTargets = flattenEuropaceAvailableAssignments(assignments).map((target) => ({
          key: target.key,
          title: target.title,
          category_id: target.categoryId,
          category_name: target.categoryName,
          category_description: target.categoryDescription,
          assignment_id: target.assignmentId,
          assignment_name: target.assignmentName,
          assignment_role_name: target.assignmentRoleName,
        }))

        return deriveConcreteUploadRequirements({
          requests: ((documentRequests ?? []) as DocumentRequestRow[]) ?? [],
          uploadTargets,
          documents: ((documents ?? []) as DocumentRow[]) ?? [],
          europaceDocuments: ((europaceDocuments ?? []) as EuropaceDocumentRow[]) ?? [],
        })
          .map((target) => trimOrNull(target.title))
          .filter((value): value is string => Boolean(value))
          .slice(0, 8)
      } catch {
        return [] as string[]
      }
    })()

    const fallbackOrigin = new URL(req.url).origin
    const baseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, fallbackOrigin)
    const params = new URLSearchParams({
      caseId,
      caseRef,
      access: accessToken,
    })
    if (existingAccount) params.set("existing", "1")
    const confirmationUrl = `${baseUrl}/onlinekredit/bestaetigung?${params.toString()}`

    const accountCheckMailStep = accountCheckRestrictedReason ? null : accountCheckStep(accountCheckMode)
    const directOnlineBankCompletionFlow = acceptedOfferIsOnline && hasRequiredAccountCheckMode(accountCheckMode)
    const steps = directOnlineBankCompletionFlow
        ? [
          bankContinuationReady
            ? "Die nächsten Direktlinks der Bank sind bereits auf deiner SEPANA-Bestätigungsseite hinterlegt."
            : "Die Bank-Fortsetzung wird gerade vorbereitet. Öffne deine SEPANA-Bestätigungsseite erneut, sobald die Links da sind.",
          "Führe die Online-Legitimation vollständig durch.",
          "Signiere den Vertrag digital. Weitere Unterlagen sind aktuell nicht nötig.",
          "Falls die Bank später doch noch individuelle Unterlagen anfordert, zeigen wir sie dir automatisch im Vorgang an.",
          produktanbieterantragsnummer
            ? `Die aktuelle Referenz des Anbieters lautet: ${produktanbieterantragsnummer}.`
            : `Deine Antragsnummer bei SEPANA lautet: ${antragsnummer}.`,
        ].filter((value): value is string => Boolean(value))
      : [
          existingAccount
            ? "Melde dich jetzt in deinem SEPANA-Portal an und öffne deinen Privatkredit-Vorgang."
            : "Prüfe jetzt dein Postfach und aktiviere deinen SEPANA-Zugang über den Einladungslink.",
          accountCheckMailStep,
          titles.length
            ? "Lade anschließend nur die konkret angeforderten Unterlagen hoch."
            : "Prüfe anschließend die nächsten Schritte direkt in deinem Vorgang.",
          produktanbieterantragsnummer
            ? `Die aktuelle Referenz des Anbieters lautet: ${produktanbieterantragsnummer}.`
            : `Deine Antragsnummer bei SEPANA lautet: ${antragsnummer}.`,
        ].filter((value): value is string => Boolean(value))

    const bankContinuationHtml =
      directOnlineBankCompletionFlow && bankContinuationReady
        ? `
          <div style="margin:18px 0 0 0;">
            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:10px;">
              Direktlinks der Bank
            </div>
            ${bankContinuationSteps
              .map((step, index) => {
                const title = step.applicantName
                  ? `Weiter für ${escapeHtml(step.applicantName)}`
                  : `Weiter bei der Bank ${index + 1}`
                const reference = step.referenceNumber
                  ? `<div style="margin:8px 0 0 0; font-size:12px; line-height:18px; color:#64748b;">Referenz: ${escapeHtml(step.referenceNumber)}</div>`
                  : ""
                const buttons = [
                  step.videoLegitUrl
                    ? renderMailLinkButton({
                        href: step.videoLegitUrl,
                        label: "Online-Legitimation starten",
                        variant: "primary",
                      })
                    : "",
                  step.qesUrl
                    ? renderMailLinkButton({
                        href: step.qesUrl,
                        label: "Digital signieren",
                        variant: "secondary",
                      })
                    : "",
                ]
                  .filter(Boolean)
                  .join("&nbsp;")

                return `
                  <div style="margin:0 0 12px 0; border:1px solid #d1fae5; background:#ffffff; border-radius:18px; padding:16px;">
                    <div style="font-size:14px; font-weight:700; color:#0f172a;">${title}</div>
                    <div style="margin:8px 0 0 0; font-size:13px; line-height:20px; color:#475569;">
                      Starte jetzt zuerst die Legitimation und danach die digitale Signatur direkt über die Bank.
                    </div>
                    ${reference}
                    <div style="margin:14px 0 0 0;">${buttons}</div>
                  </div>
                `
              })
              .join("")}
          </div>
        `
        : ""

    const bodyHtml = directOnlineBankCompletionFlow
      ? `
          ${bankContinuationHtml}
          <div style="margin:18px 0 0 0; border:1px solid #bbf7d0; background:#f0fdf4; border-radius:18px; padding:16px;">
            <div style="font-size:14px; font-weight:700; color:#166534; margin-bottom:8px;">
              Jetzt nur noch bei der Bank fortsetzen
            </div>
            <div style="font-size:13px; line-height:20px; color:#166534;">
              Für diesen Direkt-online-Fall sind aktuell keine weiteren Unterlagen über SEPANA nötig. ${
                bankContinuationReady
                  ? "Auf deiner SEPANA-Bestätigungsseite findest du jetzt die direkten Buttons für Legitimation und digitale Signatur."
                  : "Sobald Europace die Bank-Fortsetzung bereitstellt, erscheinen die direkten Buttons für Legitimation und digitale Signatur automatisch auf deiner SEPANA-Bestätigungsseite."
              }
            </div>
          </div>
        `
      : titles.length
      ? `
          <div style="margin:18px 0 0 0;">
            <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:8px;">
              Aktuell konkrete Unterlagen
            </div>
            <ul style="padding-left:18px; margin:0; font-size:13px; line-height:20px; color:#334155;">
              ${titles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}
            </ul>
          </div>
        `
      : ""

    const mailTitle = directOnlineBankCompletionFlow
      ? "Jetzt nur noch legitimieren und digital signieren"
      : "Deine finale SEPANA-Anfrage ist eingegangen"
    const mailIntro = directOnlineBankCompletionFlow
      ? `${firstName ? `Hallo ${firstName},` : "Hallo,"} dein Direkt-online-Abschluss läuft jetzt direkt bei der Bank weiter.`
      : `${firstName ? `Hallo ${firstName},` : "Hallo,"} deine finale Anfrage wurde erfolgreich übernommen.`
    const mailPreheader = directOnlineBankCompletionFlow
      ? "Jetzt geht es direkt über die Bank mit Legitimation und digitaler Signatur weiter."
      : "Deine finale Anfrage wurde bestätigt."
    const mailEyebrow = directOnlineBankCompletionFlow ? "SEPANA | Direkt-online-Abschluss" : "SEPANA | Bestätigung"
    const mailSubject = directOnlineBankCompletionFlow
      ? "Jetzt nur noch legitimieren und digital signieren"
      : "Deine finale SEPANA-Anfrage ist eingegangen"

    const html = normalizeMailCopy(buildEmailHtml({
      title: mailTitle,
      intro: mailIntro,
      steps,
      ctaLabel: "Zu deinen nächsten Schritten",
      ctaUrl: confirmationUrl,
      preheader: mailPreheader,
      eyebrow: mailEyebrow,
      bodyHtml,
    }))

    const result = await sendEmail({
      to: email,
      subject: mailSubject,
      html,
    })

    await logMailEvent(admin, {
      caseId,
      success: Boolean(result?.ok),
      requestPayload: {
        email,
        existingAccount,
        antragsnummer,
        produktanbieterantragsnummer,
        accountCheckMode,
        accountCheckRestrictedReason,
        acceptedOfferIsOnline,
        directOnlineBankCompletionFlow,
        bankContinuationReady,
        titleCount: titles.length,
      },
      responsePayload: { ok: Boolean(result?.ok) },
      errorMessage: result?.ok ? null : String((result as { error?: unknown } | null)?.error ?? "mail_send_failed"),
    })

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: String((result as { error?: unknown } | null)?.error ?? "mail_send_failed") },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, sent: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bestätigungs-E-Mail konnte nicht versendet werden." },
      { status: 500 }
    )
  }
}
