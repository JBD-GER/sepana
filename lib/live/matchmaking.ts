import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type AdminClient = ReturnType<typeof supabaseAdmin>

const LIVE_TICKET_SELECT =
  "id,case_id,customer_id,advisor_id,status,created_at,accepted_at,ended_at,room_name,guest_token"

type OnlineAdvisorRow = {
  user_id: string
  online_since: string | null
}

type ActiveAdvisorRow = {
  advisor_id: string | null
}

type LiveTicketRow = {
  id: string
  case_id: string
  customer_id: string | null
  advisor_id: string | null
  status: string
  created_at: string | null
  accepted_at: string | null
  ended_at: string | null
  room_name: string | null
  guest_token: string | null
}

type MatchFailureCode =
  | "missing_advisor"
  | "busy"
  | "not_found"
  | "update_failed"
  | "already_taken"
  | "no_available_advisor"

type MatchFailure = {
  ok: false
  code: MatchFailureCode
  ticket?: LiveTicketRow | null
  error?: unknown
}

type MatchSuccess = {
  ok: true
  ticket: LiveTicketRow
}

type MatchResult = MatchSuccess | MatchFailure

function parseTime(value: unknown) {
  const ts = Date.parse(String(value ?? ""))
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER
}

export async function getLiveQueueCapacity(admin: AdminClient) {
  const { data: onlineProfiles } = await admin
    .from("advisor_profiles")
    .select("user_id,online_since")
    .eq("is_online", true)

  const onlineRows = Array.isArray(onlineProfiles)
    ? (onlineProfiles.filter((row) => !!row?.user_id) as OnlineAdvisorRow[])
    : []
  const onlineIds = onlineRows.map((row) => String(row.user_id))

  if (!onlineIds.length) {
    return {
      onlineCount: 0,
      availableCount: 0,
      waitMinutes: 0,
      availableAdvisorIds: [] as string[],
    }
  }

  const { data: activeTickets } = await admin
    .from("live_queue_tickets")
    .select("advisor_id")
    .eq("status", "active")
    .in("advisor_id", onlineIds)

  const busyAdvisorIds = new Set(
    ((activeTickets ?? []) as ActiveAdvisorRow[]).map((row) => String(row?.advisor_id ?? "").trim()).filter(Boolean)
  )

  const availableAdvisorIds = onlineRows
    .filter((row) => !busyAdvisorIds.has(String(row.user_id)))
    .sort((a, b) => {
      const timeDiff = parseTime(a?.online_since) - parseTime(b?.online_since)
      if (timeDiff !== 0) return timeDiff
      return String(a?.user_id ?? "").localeCompare(String(b?.user_id ?? ""), "de")
    })
    .map((row) => String(row.user_id))

  return {
    onlineCount: onlineIds.length,
    availableCount: availableAdvisorIds.length,
    waitMinutes: onlineIds.length > 0 && availableAdvisorIds.length === 0 ? 15 : 0,
    availableAdvisorIds,
  }
}

export async function getCurrentLiveTicketForCase(admin: AdminClient, caseId: string) {
  const { data: tickets } = await admin
    .from("live_queue_tickets")
    .select(LIVE_TICKET_SELECT)
    .eq("case_id", caseId)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false })

  const list = Array.isArray(tickets) ? (tickets as LiveTicketRow[]) : []
  return list.find((ticket) => ticket.status === "active") ?? list[0] ?? null
}

export async function acceptWaitingLiveTicket(
  admin: AdminClient,
  {
    advisorId,
    ticketId,
  }: {
    advisorId: string
    ticketId?: string | null
  }
): Promise<MatchResult> {
  const normalizedAdvisorId = String(advisorId ?? "").trim()
  const normalizedTicketId = String(ticketId ?? "").trim()
  if (!normalizedAdvisorId) {
    return { ok: false as const, code: "missing_advisor" as const }
  }

  const { data: existingActive } = await admin
    .from("live_queue_tickets")
    .select(LIVE_TICKET_SELECT)
    .eq("advisor_id", normalizedAdvisorId)
    .eq("status", "active")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingActive) {
    return { ok: false as const, code: "busy" as const, ticket: existingActive }
  }

  let waitingQuery = admin.from("live_queue_tickets").select(LIVE_TICKET_SELECT).eq("status", "waiting")
  waitingQuery = normalizedTicketId ? waitingQuery.eq("id", normalizedTicketId) : waitingQuery

  const { data: waitingTicket } = await waitingQuery.order("created_at", { ascending: true }).limit(1).maybeSingle()
  if (!waitingTicket) {
    return { ok: false as const, code: "not_found" as const }
  }

  const now = new Date().toISOString()
  const roomName = waitingTicket.room_name || `live_${waitingTicket.id}`
  const { data: updatedTicket, error } = await admin
    .from("live_queue_tickets")
    .update({
      status: "active",
      advisor_id: normalizedAdvisorId,
      accepted_at: now,
      room_name: roomName,
    })
    .eq("id", waitingTicket.id)
    .eq("status", "waiting")
    .select(LIVE_TICKET_SELECT)
    .maybeSingle()

  if (error) {
    return { ok: false as const, code: "update_failed" as const, error }
  }

  if (!updatedTicket) {
    const { data: currentTicket } = await admin
      .from("live_queue_tickets")
      .select(LIVE_TICKET_SELECT)
      .eq("id", waitingTicket.id)
      .maybeSingle()

    return { ok: false as const, code: "already_taken" as const, ticket: currentTicket ?? null }
  }

  await Promise.all([
    admin.from("cases").update({ assigned_advisor_id: normalizedAdvisorId }).eq("id", updatedTicket.case_id),
    admin
      .from("live_queue_tickets")
      .update({ status: "cancelled", ended_at: now })
      .eq("case_id", updatedTicket.case_id)
      .eq("status", "waiting")
      .neq("id", updatedTicket.id),
  ])

  return { ok: true as const, ticket: updatedTicket }
}

export async function autoAcceptWaitingLiveTicket(
  admin: AdminClient,
  opts: {
    advisorId?: string | null
    ticketId?: string | null
  } = {}
) {
  const advisorId = String(opts.advisorId ?? "").trim()
  const ticketId = String(opts.ticketId ?? "").trim()

  if (advisorId) {
    return acceptWaitingLiveTicket(admin, { advisorId, ticketId: ticketId || null })
  }

  const capacity = await getLiveQueueCapacity(admin)
  if (!capacity.availableAdvisorIds.length) {
    return { ok: false as const, code: "no_available_advisor" as const }
  }

  let lastAttempt: MatchResult = { ok: false, code: "no_available_advisor" }

  for (const nextAdvisorId of capacity.availableAdvisorIds) {
    const attempt = await acceptWaitingLiveTicket(admin, {
      advisorId: nextAdvisorId,
      ticketId: ticketId || null,
    })
    if (attempt.ok) return attempt
    lastAttempt = attempt

    if (attempt.code === "update_failed") return attempt
    if (ticketId && attempt.code === "not_found") return attempt
  }

  return lastAttempt ?? { ok: false as const, code: "no_available_advisor" as const }
}
