import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    if (role !== "admin") return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    const admin = supabaseAdmin()
    const { id: userId } = await params

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
    if (userErr || !userData?.user?.email) {
      return NextResponse.json({ ok: false, error: "User nicht gefunden" }, { status: 404 })
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const redirectTo = `${origin}/einladung?mode=invite`
    const email = userData.user.email

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (!inviteErr) {
      return NextResponse.json({ ok: true, sent: true })
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    })

    const actionLink = linkData?.properties?.action_link ?? null
    if (linkErr || !actionLink) {
      return NextResponse.json({ ok: false, error: inviteErr.message || "Invite fehlgeschlagen" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sent: false, link: actionLink })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
