import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { ensureInsuranceRoute } from "@/lib/insurance/routing"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const action = String(body?.action ?? "").trim().toLowerCase()
  if (!caseId) return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
  if (action !== "forward") return NextResponse.json({ ok: false, error: "Ungueltige Aktion" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: caseRow, error: caseError } = await admin
    .from("cases")
    .select("id,case_type,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()

  if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 400 })
  if (!caseRow) return NextResponse.json({ ok: false, error: "Fall nicht gefunden" }, { status: 404 })
  if (String(caseRow.case_type ?? "").trim().toLowerCase() !== "schufa_frei") {
    return NextResponse.json({ ok: false, error: "case_type_not_supported" }, { status: 409 })
  }
  if (role === "advisor" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const route = await ensureInsuranceRoute(admin, {
      caseId,
      source: "advisor_manual",
      actorId: user.id,
    })

    await logCaseEvent({
      caseId,
      actorId: user.id,
      actorRole: role,
      type: "insurance_route_forwarded_manual",
      title: "Versicherungsbereich aktiviert",
      body: "Der Fall wurde manuell an den internen Versicherungsbereich uebergeben.",
      meta: {
        route_status: route.route_status ?? null,
        route_source: route.route_source ?? null,
      },
      notifyCustomer: false,
      notifyAdvisor: false,
    })

    return NextResponse.json({ ok: true, route })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "routing_failed" },
      { status: 400 }
    )
  }
}
