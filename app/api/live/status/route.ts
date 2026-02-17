import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  const admin = supabaseAdmin()

  const { data: onlineProfiles } = await admin
    .from("advisor_profiles")
    .select("user_id,display_name")
    .eq("is_online", true)

  const onlineRows = (onlineProfiles ?? []).filter((x: any) => !!x?.user_id)
  const onlineIds = onlineRows.map((x: any) => x.user_id as string)
  const onlineCount = onlineIds.length

  const { data: active } = await admin.from("live_queue_tickets").select("advisor_id").eq("status", "active")
  const busy = new Set((active ?? []).map((x: any) => x.advisor_id).filter(Boolean))

  const availableRows = onlineRows.filter((row: any) => !busy.has(row.user_id))
  const availableCount = availableRows.length

  const waitMinutes = onlineCount > 0 && availableCount === 0 ? 15 : 0

  const sortedAvailable = availableRows
    .map((row: any) => ({
      id: String(row.user_id),
      name: String(row.display_name ?? "").trim(),
    }))
    .sort((a, b) => {
      const aLabel = a.name || a.id
      const bLabel = b.name || b.id
      return aLabel.localeCompare(bLabel, "de")
    })

  const firstAvailable = sortedAvailable[0] ?? null
  const availableAdvisorName = firstAvailable?.name || null
  const availableAdvisorId = firstAvailable?.id || null

  return NextResponse.json({
    ok: true,
    onlineCount,
    availableCount,
    waitMinutes,
    availableAdvisorName,
    availableAdvisorId,
  })
}
