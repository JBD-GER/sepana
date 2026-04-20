import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { autoAcceptWaitingLiveTicket } from "@/lib/live/matchmaking"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const online = !!body?.online

  const admin = supabaseAdmin()
  const { error } = await admin.from("advisor_profiles").upsert(
    {
      user_id: user.id,
      is_online: online,
      online_since: online ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let matchedTicket = null
  if (online) {
    const accepted = await autoAcceptWaitingLiveTicket(admin, { advisorId: user.id })
    if (accepted.ok) {
      matchedTicket = accepted.ticket
    }
  }

  return NextResponse.json({ ok: true, isOnline: online, ticket: matchedTicket })
}
