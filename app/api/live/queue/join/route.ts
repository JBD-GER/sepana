import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const forceGuest = body?.guest === true
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,customer_id,case_type")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })
  }

  let customerId: string | null = caseRow.customer_id ?? null
  let guestToken: string | null = null

  if (user && !forceGuest) {
    if (role !== "customer") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    if (caseRow.customer_id !== user.id) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    customerId = user.id
  } else {
    guestToken = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`
  }

  const { data: existingList } = await admin
    .from("live_queue_tickets")
    .select("id,status,created_at,room_name,guest_token")
    .eq("case_id", caseId)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false })

  const list = Array.isArray(existingList) ? existingList : []
  const activeTicket = list.find((t: any) => t.status === "active") ?? null
  const waitingTickets = list.filter((t: any) => t.status === "waiting")

  const { data: online } = await admin.from("advisor_profiles").select("user_id").eq("is_online", true)
  const onlineIds = (online ?? []).map((x: any) => x.user_id).filter(Boolean)
  const onlineCount = onlineIds.length
  const { data: active } = await admin.from("live_queue_tickets").select("advisor_id").eq("status", "active")
  const busy = new Set((active ?? []).map((x: any) => x.advisor_id).filter(Boolean))
  const availableCount = onlineIds.filter((id) => !busy.has(id)).length
  const waitMinutes = onlineCount > 0 && availableCount === 0 ? 15 : 0

  if (activeTicket) {
    const dropIds = waitingTickets.map((x: any) => x.id).filter(Boolean)
    if (dropIds.length) {
      await admin
        .from("live_queue_tickets")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .in("id", dropIds)
    }
    let tokenToReturn = activeTicket.guest_token ?? null
    if (!user && !tokenToReturn) {
      tokenToReturn = guestToken
      await admin.from("live_queue_tickets").update({ guest_token: tokenToReturn }).eq("id", activeTicket.id)
    }
    return NextResponse.json({
      ok: true,
      ticket: activeTicket,
      guestToken: tokenToReturn,
      waitMinutes,
      onlineCount,
      availableCount,
    })
  }

  if (waitingTickets.length) {
    const keep = waitingTickets[0]
    const dropIds = waitingTickets.slice(1).map((x: any) => x.id).filter(Boolean)
    if (dropIds.length) {
      await admin
        .from("live_queue_tickets")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .in("id", dropIds)
    }
    let tokenToReturn = keep.guest_token ?? null
    if (!user && !tokenToReturn) {
      tokenToReturn = guestToken
      await admin.from("live_queue_tickets").update({ guest_token: tokenToReturn }).eq("id", keep.id)
    }
    return NextResponse.json({
      ok: true,
      ticket: keep,
      guestToken: tokenToReturn,
      waitMinutes,
      onlineCount,
      availableCount,
    })
  }

  const { data: created, error } = await admin
    .from("live_queue_tickets")
    .insert({
      case_id: caseId,
      customer_id: customerId,
      status: "waiting",
      ...(guestToken ? { guest_token: guestToken } : {}),
    })
    .select("id,status,created_at,room_name,guest_token")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    ticket: created,
    guestToken: created?.guest_token ?? guestToken,
    waitMinutes,
    onlineCount,
    availableCount,
  })
}