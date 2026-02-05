export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type InviteAcceptedPayload = {
  mode?: string
  firstPasswordSet?: boolean
}

function normalizeSiteUrl(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = String(raw ?? "").trim()
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function parseBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function resolveNotifyRecipient() {
  const configured = String(process.env.INVITE_ACCEPTED_NOTIFY_TO ?? "")
    .split(",")[0]
    .trim()
  if (configured.includes("@")) return configured
  return "info@sepana.de"
}

function resolveDisplayName(user: any) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const first = String(meta.first_name ?? "").trim()
  const last = String(meta.last_name ?? "").trim()
  const full = `${first} ${last}`.trim()
  if (full) return full
  const fromMeta = String(meta.full_name ?? "").trim()
  if (fromMeta) return fromMeta
  return String(user?.email ?? "").trim() || "Unbekannt"
}

function toRoleLabel(role: string | null | undefined) {
  if (role === "advisor") return "Berater"
  if (role === "admin") return "Admin"
  return "Kunde"
}

async function resolveActor(req: Request) {
  const token = parseBearerToken(req)
  if (token) {
    const admin = supabaseAdmin()
    const { data, error } = await admin.auth.getUser(token)
    if (!error && data?.user) {
      const { data: profile } = await admin.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle()
      return {
        user: data.user,
        role: String((profile as { role?: string | null } | null)?.role ?? "customer"),
      }
    }
  }

  const { user, role } = await getUserAndRole()
  return { user, role: role ?? "customer" }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as InviteAcceptedPayload
  if (body.mode && body.mode !== "invite") {
    return NextResponse.json({ ok: true, skipped: true, reason: "mode_not_invite" })
  }
  if (body.firstPasswordSet === false) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_activated" })
  }

  const { user, role } = await resolveActor(req)
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  }

  const recipient = resolveNotifyRecipient()
  const email = String(user.email ?? "").trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ ok: false, error: "email_missing" }, { status: 409 })
  }

  const displayName = resolveDisplayName(user)
  const roleLabel = toRoleLabel(role)
  const acceptedAtIso = new Date().toISOString()
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const adminUrl = `${siteUrl}/admin`

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <div style="font-size:13px; line-height:20px; color:#334155;">
            <div><strong style="color:#0f172a;">Name:</strong> ${escapeHtml(displayName)}</div>
            <div style="margin-top:6px;"><strong style="color:#0f172a;">E-Mail:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#0f172a; text-decoration:underline;">${escapeHtml(email)}</a></div>
            <div style="margin-top:6px;"><strong style="color:#0f172a;">Rolle:</strong> ${escapeHtml(roleLabel)}</div>
            <div style="margin-top:6px;"><strong style="color:#0f172a;">Zeitpunkt:</strong> ${escapeHtml(acceptedAtIso)}</div>
            <div style="margin-top:6px;"><strong style="color:#0f172a;">User-ID:</strong> ${escapeHtml(user.id)}</div>
          </div>
        </td>
      </tr>
    </table>
  `

  const html = buildEmailHtml({
    title: "Einladung angenommen",
    intro: `${displayName} hat die Einladung angenommen und ein Konto aktiviert.`,
    bodyHtml,
    ctaLabel: "Zum Admin-Bereich",
    ctaUrl: adminUrl,
    eyebrow: "SEPANA - Konto aktiviert",
    preheader: `Einladung angenommen: ${email}`,
  })

  const mail = await sendEmail({
    to: recipient,
    subject: `Einladung angenommen: ${email}`,
    html,
  })

  if (!mail.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: mail.error === "missing_resend_env" ? "mail_not_configured" : "mail_send_failed",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
