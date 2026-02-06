import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"

export const runtime = "nodejs"

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

async function nextCaseRef(admin: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await admin.from("case_ref_seq").insert({}).select("id").single()
  if (error) throw error
  const id = Number(data.id ?? 0)
  return `BF-${String(id).padStart(6, "0")}`
}

async function getProfile(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("role,password_set_at")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { role?: string | null; password_set_at?: string | null } | null) ?? null
}

async function generatePasswordActionLink(admin: ReturnType<typeof supabaseAdmin>, email: string, redirectTo: string) {
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
    const language = String(body?.language ?? "de").trim() || "de"

    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const inviteRedirectTo = resolveInviteRedirect(req)

    let userId = await findUserIdByEmail(admin, email)
    let existingAccount = !!userId
    let invited = false
    let passwordInviteSent = false

    if (!userId) {
      const invite = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteRedirectTo,
        data: { source: "live_landing" },
      })
      if (invite.error) {
        const again = await findUserIdByEmail(admin, email)
        if (again) {
          userId = again
          existingAccount = true
        } else {
          return NextResponse.json({ ok: false, error: invite.error.message }, { status: 400 })
        }
      } else {
        userId = invite.data.user?.id ?? null
        if (!userId) return NextResponse.json({ ok: false, error: "user_create_failed" }, { status: 500 })
        invited = true
        existingAccount = false
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "user_missing" }, { status: 500 })
    }

    const profile = await getProfile(admin, userId)
    if (profile?.role && profile.role !== "customer") {
      return NextResponse.json({ ok: false, error: "email_in_use" }, { status: 409 })
    }

    await admin.from("profiles").upsert({ user_id: userId, role: "customer" }, { onConflict: "user_id" })

    const needsPasswordSetup = !profile?.password_set_at
    if (needsPasswordSetup) {
      const actionLink = await generatePasswordActionLink(admin, email, inviteRedirectTo)
      if (actionLink) {
        const html = buildPasswordInviteEmailHtml(actionLink)
        const mail = await sendEmail({
          to: email,
          subject: "Passwort fuer Ihren SEPANA-Zugang festlegen",
          html,
        })
        passwordInviteSent = !!mail.ok
      }
    }

    const caseRef = await nextCaseRef(admin)
    const { data: createdCase, error: caseErr } = await admin
      .from("cases")
      .insert({
        case_type: "baufi",
        status: "draft",
        customer_id: userId,
        assigned_advisor_id: null,
        entry_channel: "live_landing",
        language,
        is_email_verified: false,
        case_ref: caseRef,
      })
      .select("id")
      .single()
    if (caseErr) return NextResponse.json({ ok: false, error: caseErr.message }, { status: 500 })
    const caseId = String(createdCase.id)

    const { error: applicantErr } = await admin.from("case_applicants").insert({
      case_id: caseId,
      role: "primary",
      email,
    })
    if (applicantErr) {
      return NextResponse.json({ ok: false, error: applicantErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      caseId,
      caseRef,
      existingAccount,
      invited,
      passwordInviteSent,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
