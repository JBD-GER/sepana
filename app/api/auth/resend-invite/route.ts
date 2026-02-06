export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
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

function resolveInviteRedirect(req: Request) {
  const fallbackOrigin = new URL(req.url).origin
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, fallbackOrigin)
  return `${base}/einladung?mode=invite`
}

async function findUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  const maxPages = 50

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = (data?.users ?? []) as Array<{ id?: string | null; email?: string | null }>
    const hit = users.find((u) => (u?.email ?? "").toLowerCase() === target)
    if (hit?.id) return hit.id as string
    if (users.length < perPage) break
  }

  return null
}

async function getProfile(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("password_set_at")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { password_set_at?: string | null } | null) ?? null
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

function buildPasswordInviteEmailHtml(actionLink: string) {
  return buildEmailHtml({
    title: "Passwort fuer Ihr SEPANA-Konto festlegen",
    intro: "Bitte legen Sie jetzt Ihr Passwort fest, um Ihren Zugang abzuschliessen.",
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
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? "").trim().toLowerCase()

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const userId = await findUserIdByEmail(admin, email)
    if (!userId) {
      return NextResponse.json({ ok: true, sent: false })
    }

    const profile = await getProfile(admin, userId)
    if (profile?.password_set_at) {
      return NextResponse.json({ ok: true, sent: false, reason: "already_active" })
    }

    const redirectTo = resolveInviteRedirect(req)
    const actionLink = await generatePasswordActionLink(admin, email, redirectTo)
    if (!actionLink) {
      return NextResponse.json({ ok: false, error: "link_failed" }, { status: 500 })
    }

    const html = buildPasswordInviteEmailHtml(actionLink)
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

    return NextResponse.json({ ok: true, sent: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
