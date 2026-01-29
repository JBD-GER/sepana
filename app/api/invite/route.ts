import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Role = "customer" | "advisor" | "admin"

function isRole(x: any): x is Role {
  return x === "customer" || x === "advisor" || x === "admin"
}

function siteUrlFromReq(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, "")
  const u = new URL(req.url)
  return u.origin
}

// ✅ A) Auth-Guard über eingeloggten User (admin/advisor)
async function allowByRole(allowed: Role[]) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  const role = (profile?.role ?? null) as Role | null
  if (!role || !allowed.includes(role)) return { ok: false as const }

  return { ok: true as const, actorUserId: user.id, actorRole: role }
}

// ✅ B) System-Guard über Secret Header (optional)
function allowBySecret(req: Request) {
  const secret = process.env.INVITE_API_SECRET
  if (!secret) return false
  const got = req.headers.get("x-invite-secret")
  return got === secret
}

export async function POST(req: Request) {
  // ---- Guard: entweder eingeloggter admin/advisor ODER secret header
  const bySecret = allowBySecret(req)
  const byRole = await allowByRole(["admin", "advisor"])

  if (!bySecret && !byRole.ok) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? "").trim().toLowerCase()
  const role = body?.role
  const caseId = body?.caseId ? String(body.caseId) : null // optional, falls du es in Metadaten willst

  if (!email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 })
  if (!isRole(role)) return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 })

  const admin = supabaseAdmin()
  const siteUrl = siteUrlFromReq(req)

  try {
    // ✅ Invite Link -> /auth/confirm exchange -> redirect -> /einladung?mode=invite
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?mode=invite`,
      data: {
        role,
        case_id: caseId ?? undefined,
      },
    })
    if (error) throw error

    const invitedUserId = data.user?.id ?? null

    // ✅ Rolle in profiles upserten (sehr wichtig für deine Middleware role checks / rpc get_my_role)
    if (invitedUserId) {
      const { error: upsertErr } = await admin
        .from("profiles")
        .upsert({ user_id: invitedUserId, role }, { onConflict: "user_id" })

      if (upsertErr) throw upsertErr
    }

    return NextResponse.json({ ok: true, userId: invitedUserId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "invite_failed" }, { status: 500 })
  }
}
