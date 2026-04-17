import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const MAX_URL_LENGTH = 2000

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function normalizePostidentUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function resolveSiteOrigin(req: Request) {
  const configured = trimOrNull(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {}
  }
  return new URL(req.url).origin
}

function isMissingPostidentColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("postident_") && (msg.includes("column") || msg.includes("exist"))
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const rawPostidentUrl = trimOrNull(body?.postidentUrl)

  if (!caseId) {
    return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  }
  if (!rawPostidentUrl) {
    return NextResponse.json({ ok: false, error: "PostIdent-Link fehlt" }, { status: 400 })
  }
  if (rawPostidentUrl.length > MAX_URL_LENGTH) {
    return NextResponse.json({ ok: false, error: "PostIdent-Link ist zu lang" }, { status: 400 })
  }

  const postidentUrl = normalizePostidentUrl(rawPostidentUrl)
  if (!postidentUrl) {
    return NextResponse.json({ ok: false, error: "Ungültiger PostIdent-Link" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) {
    return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  }
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  }
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: syncRow, error: syncError } = await admin
    .from("case_skag_sync")
    .upsert(
      {
        case_id: caseId,
        postident_url: postidentUrl,
        postident_added_at: now,
        postident_notified_at: null,
        updated_at: now,
      },
      { onConflict: "case_id" }
    )
    .select("postident_url,postident_added_at,postident_notified_at")
    .single()

  if (syncError) {
    if (isMissingPostidentColumnError(syncError)) {
      return NextResponse.json(
        { ok: false, error: "DB-Migration fehlt: PostIdent-Felder in case_skag_sync sind noch nicht vorhanden." },
        { status: 503 }
      )
    }
    return NextResponse.json({ ok: false, error: syncError.message }, { status: 400 })
  }

  const siteOrigin = resolveSiteOrigin(req)
  const customerPortalUrl = `${siteOrigin}/app/faelle/${caseId}#schufa-postident`
  const caseMeta = await getCaseMeta(caseId)

  let emailSent = false
  let emailError: string | null = null

  if (caseMeta?.customer_email) {
    const html = buildEmailHtml({
      title: "PostIdent jetzt abschließen",
      intro: caseMeta.case_ref
        ? `Für Ihren Fall ${caseMeta.case_ref} ist Ihr PostIdent-Link jetzt bereit.`
        : "Ihr PostIdent-Link ist jetzt bereit.",
      bodyHtml: `
        <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
          Bitte öffnen Sie jetzt den bereitgestellten Link und schließen Sie die Legitimation vollständig ab.
          Den Link finden Sie zusätzlich jederzeit in Ihrem SEPANA-Kundendashboard.
        </p>
      `,
      steps: [
        "Öffnen Sie jetzt den bereitgestellten PostIdent-Link.",
        "Schließen Sie die Legitimation vollständig ab.",
        "Danach begleitet SEPANA den Fall bis zur Auszahlung weiter.",
      ],
      ctaLabel: "PostIdent öffnen",
      ctaUrl: postidentUrl,
      preheader: "Ihr PostIdent-Link ist verfügbar.",
      eyebrow: "SEPANA - PostIdent",
      supportNote: "Den Link finden Sie zusätzlich auch in Ihrem Kundendashboard.",
      sideNote: "Sicherheitshinweis: Link nur für Sie bestimmt.",
    })

    const emailResult = await sendEmail({
      to: caseMeta.customer_email,
      subject: "PostIdent für Ihren Kreditantrag",
      html,
    }).catch((error) => ({
      ok: false as const,
      error: error instanceof Error ? error.message : "mail_failed",
    }))

    emailSent = Boolean(emailResult?.ok)
    emailError = emailSent ? null : String(emailResult?.error ?? "mail_failed")

    if (emailSent) {
      const { error: notifiedError } = await admin
        .from("case_skag_sync")
        .update({ postident_notified_at: now, updated_at: now })
        .eq("case_id", caseId)

      if (notifiedError && isMissingPostidentColumnError(notifiedError)) {
        return NextResponse.json(
          { ok: false, error: "DB-Migration fehlt: PostIdent-Felder in case_skag_sync sind noch nicht vorhanden." },
          { status: 503 }
        )
      }
      if (notifiedError) {
        return NextResponse.json({ ok: false, error: notifiedError.message }, { status: 400 })
      }
    }
  } else {
    emailError = "missing_customer_email"
  }

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "schufa_free_postident_shared",
    title: "PostIdent-Link bereitgestellt",
    body: emailSent
      ? "Ihr PostIdent-Link wurde im Dashboard hinterlegt und zusätzlich per E-Mail versendet."
      : "Ihr PostIdent-Link wurde im Dashboard hinterlegt.",
    meta: {
      customer_portal_url: customerPortalUrl,
      email_sent: emailSent,
    },
    notifyAdvisor: false,
  })

  return NextResponse.json({
    ok: true,
    postident_url: syncRow?.postident_url ?? postidentUrl,
    postident_added_at: syncRow?.postident_added_at ?? now,
    postident_notified_at: emailSent ? now : null,
    customer_portal_url: customerPortalUrl,
    emailSent,
    emailError,
  })
}
