import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  const admin = supabaseAdmin()

  const { data: online } = await admin.from("advisor_profiles").select("user_id").eq("is_online", true)
  const onlineIds = (online ?? []).map((x: any) => x.user_id).filter(Boolean)
  const onlineCount = onlineIds.length

  const { data: active } = await admin.from("live_queue_tickets").select("advisor_id").eq("status", "active")
  const busy = new Set((active ?? []).map((x: any) => x.advisor_id).filter(Boolean))
  const availableCount = onlineIds.filter((id) => !busy.has(id)).length

  const waitMinutes = onlineCount > 0 && availableCount === 0 ? 15 : 0

  return NextResponse.json({ ok: true, onlineCount, availableCount, waitMinutes })
}
