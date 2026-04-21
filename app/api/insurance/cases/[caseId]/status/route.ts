import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { INSURANCE_ROUTE_STATUS_OPTIONS } from "@/lib/insurance/invoice"
import { canAccessInsuranceCase } from "@/lib/insurance/routing"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

const ALLOWED_STATUSES = new Set<string>(INSURANCE_ROUTE_STATUS_OPTIONS.map((entry) => entry.value))

export async function POST(req: Request, context: { params: Promise<{ caseId: string }> }) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "insurance" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const { caseId } = await context.params
  const body = await req.json().catch(() => null)
  const status = String(body?.status ?? "").trim().toLowerCase()
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "Ungueltiger Status" }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access = await canAccessInsuranceCase(admin, { caseId, userId: user.id, role })
  if (!access.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const now = new Date().toISOString()
  const { data: route, error } = await admin
    .from("case_insurance_routes")
    .update({ route_status: status, last_status_at: now, updated_at: now })
    .eq("case_id", caseId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role,
    type: "insurance_route_status_updated",
    title: "Versicherungsstatus aktualisiert",
    body: `Der interne Versicherungsstatus wurde auf ${status} gesetzt.`,
    meta: { insurance_status: status },
    notifyCustomer: false,
    notifyAdvisor: false,
  })

  return NextResponse.json({ ok: true, route })
}
