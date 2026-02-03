import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export const runtime = "nodejs"

export async function GET() {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from("advisor_profiles")
    .select("is_online")
    .eq("user_id", user.id)
    .maybeSingle()
  const isOnline = profile?.is_online === true

  const { data: active } = await supabase
    .from("live_queue_tickets")
    .select("id")
    .eq("advisor_id", user.id)
    .eq("status", "active")
  const busy = (active ?? []).length > 0

  return NextResponse.json({ ok: true, isOnline, busy })
}
