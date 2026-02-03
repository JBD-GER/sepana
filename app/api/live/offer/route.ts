import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

export const runtime = "nodejs"

function num(v: any) {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: Request) {
  const { supabase, user, role } = await getUserAndRole()

  const { searchParams } = new URL(req.url)
  const caseId = String(searchParams.get("caseId") ?? "").trim()
  const ticketId = String(searchParams.get("ticketId") ?? "").trim()
  const guestToken = String(searchParams.get("guestToken") ?? "").trim() || null
  const includeHistory = String(searchParams.get("includeHistory") ?? "") === "1"
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (user) {
    const allowed =
      role === "admin" ||
      caseRow.customer_id === user.id ||
      (caseRow.assigned_advisor_id && caseRow.assigned_advisor_id === user.id)
    if (!allowed) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  } else {
    if (!guestToken) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    const baseQuery = admin
      .from("live_queue_tickets")
      .select("id,case_id,guest_token")
      .in("status", ["waiting", "active", "ended"])
    const { data: ticket } = await (ticketId
      ? baseQuery.eq("id", ticketId).maybeSingle()
      : baseQuery.eq("case_id", caseId).eq("guest_token", guestToken).maybeSingle())

    if (!ticket || ticket.case_id !== caseId) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }

    if (ticketId && guestToken) {
      if (!ticket.guest_token) {
        await admin.from("live_queue_tickets").update({ guest_token: guestToken }).eq("id", ticket.id)
      } else if (ticket.guest_token !== guestToken) {
        return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
      }
    }
  }

  const readClient = admin
  const selectFields =
    "id,status,bank_status,provider_id,loan_amount,rate_monthly,apr_effective,interest_nominal,term_months,zinsbindung_years,tilgung_pct,special_repayment,notes_for_customer,created_at"

  if (includeHistory) {
    const { data: offers } = await readClient
      .from("case_offers")
      .select(selectFields)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
    return NextResponse.json({ ok: true, offer: null, offers: offers ?? [] })
  }

  const { data: offer } = await readClient
    .from("case_offers")
    .select(selectFields)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ ok: true, offer: offer ?? null })
}

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const providerId = String(body?.providerId ?? "").trim()
  if (!caseId || !providerId) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id,assigned_advisor_id,customer_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (role !== "admin" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_assigned" }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from("case_offers")
    .select("id,status")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing && ["draft", "sent", "accepted"].includes(existing.status)) {
    return NextResponse.json({ ok: false, error: "offer_exists" }, { status: 409 })
  }

  const insertPayload = {
    case_id: caseId,
    provider_id: providerId,
    product_type: "baufi",
    status: "draft",
    loan_amount: num(body?.loanAmount),
    rate_monthly: num(body?.rateMonthly),
    apr_effective: num(body?.aprEffective),
    interest_nominal: num(body?.interestNominal),
    term_months: num(body?.termMonths),
    zinsbindung_years: num(body?.zinsbindungYears),
    tilgung_pct: num(body?.tilgungPct),
    special_repayment: body?.specialRepayment ? String(body.specialRepayment).trim() : null,
    notes_for_customer: body?.notes ? String(body.notes).trim() : null,
  }

  const { data: created, error } = await supabase
    .from("case_offers")
    .insert(insertPayload)
    .select("id,status")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await logCaseEvent({
    caseId,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "offer_created",
    title: "Finales Angebot erstellt",
    body: "Ein finales Angebot wurde erstellt.",
  })

  return NextResponse.json({ ok: true, offer: created })
}
