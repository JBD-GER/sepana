export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { buildEmailHtml, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function normalizeSiteUrl(raw: string | undefined, fallbackOrigin: string) {
  const input = String(raw ?? "").trim()
  if (!input) return fallbackOrigin
  try {
    return new URL(input).origin
  } catch {
    return fallbackOrigin
  }
}

function resolveInviteRedirect(req: Request) {
  const fallbackOrigin = new URL(req.url).origin
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, fallbackOrigin)
  return `${base}/einladung?mode=invite`
}

async function generatePasswordActionLink(
  admin: ReturnType<typeof supabaseAdmin>,
  email: string,
  redirectTo: string
) {
  const tries: Array<"invite" | "recovery"> = ["invite", "recovery"]
  for (const type of tries) {
    const { data, error } = await admin.auth.admin.generateLink({
      type,
      email,
      options: { redirectTo },
    })
    if (error) continue
    const link = data?.properties?.action_link ?? null
    if (link) return link
  }
  return null
}

function buildPasswordInviteEmailHtml(actionLink: string, firstName?: string | null) {
  const greeting = String(firstName ?? "").trim()
  const intro = greeting
    ? `Hallo ${greeting}, bitte legen Sie jetzt Ihr Passwort fest, um Ihren Zugang abzuschliessen.`
    : "Bitte legen Sie jetzt Ihr Passwort fest, um Ihren Zugang abzuschliessen."

  return buildEmailHtml({
    title: "Passwort fuer Ihr SEPANA-Konto festlegen",
    intro,
    steps: [
      "Klicken Sie auf den Button und vergeben Sie ein sicheres Passwort.",
      "Danach koennen Sie sich direkt im Kundenportal anmelden.",
    ],
    ctaLabel: "Passwort festlegen",
    ctaUrl: actionLink,
    eyebrow: "SEPANA - Einladung",
    preheader: "Bitte Passwort festlegen und Zugang aktivieren.",
  })
}

export async function POST(req: Request) {
  try {
    const { supabase, user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    if (role !== "advisor" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const caseId = String(body?.caseId ?? "").trim()
    if (!caseId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }

    const { data: caseRow } = await supabase
      .from("cases")
      .select("id,case_ref,customer_id,assigned_advisor_id")
      .eq("id", caseId)
      .maybeSingle()

    if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })
    if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    if (!caseRow.customer_id) {
      return NextResponse.json({ ok: false, error: "customer_missing" }, { status: 409 })
    }

    const admin = supabaseAdmin()
    const [{ data: customerAuth, error: customerErr }, { data: profile }, { data: applicant }] = await Promise.all([
      admin.auth.admin.getUserById(caseRow.customer_id),
      admin.from("profiles").select("password_set_at").eq("user_id", caseRow.customer_id).maybeSingle(),
      admin.from("case_applicants").select("first_name").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    ])

    const email = customerAuth?.user?.email?.trim().toLowerCase() ?? ""
    if (customerErr || !email) {
      return NextResponse.json({ ok: false, error: "customer_email_missing" }, { status: 409 })
    }

    if (profile?.password_set_at) {
      return NextResponse.json({ ok: true, sent: false, reason: "already_active" })
    }

    const redirectTo = resolveInviteRedirect(req)
    const actionLink = await generatePasswordActionLink(admin, email, redirectTo)
    if (!actionLink) {
      return NextResponse.json({ ok: false, error: "link_failed" }, { status: 500 })
    }

    const html = buildPasswordInviteEmailHtml(actionLink, applicant?.first_name ?? null)
    const mail = await sendEmail({
      to: email,
      subject: "Passwort fuer Ihren SEPANA-Zugang festlegen",
      html,
    })

    if (!mail.ok) {
      return NextResponse.json(
        { ok: false, error: mail.error === "missing_resend_env" ? "mail_not_configured" : "mail_send_failed" },
        { status: 500 }
      )
    }

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "customer_invite_resent",
      title: "Einladung erneut versendet",
      body: caseRow.case_ref
        ? `Die Einladung zur Passwortvergabe wurde fuer Fall ${caseRow.case_ref} erneut versendet.`
        : "Die Einladung zur Passwortvergabe wurde erneut versendet.",
      notifyCustomer: false,
    })

    return NextResponse.json({ ok: true, sent: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
