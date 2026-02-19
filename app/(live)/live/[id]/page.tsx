import { createServerSupabaseClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import LiveRoomClient from "@/components/live/LiveRoomClient"

export const runtime = "nodejs"

export default async function LiveRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ guest?: string }>
}) {
  const { id } = await params
  const sp = (searchParams ? await searchParams : undefined) as { guest?: string } | undefined
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = supabaseAdmin()
  const { data: ticket } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,customer_id,advisor_id,status,room_name,guest_token,created_at,accepted_at,ended_at")
    .eq("id", id)
    .maybeSingle()

  if (!ticket) {
    return <div className="p-6 text-sm text-white">Live-Sitzung nicht gefunden.</div>
  }

  let isCustomer = false
  let canOffer = false
  let guestToken: string | null = null

  if (user) {
    const isOwner = ticket.customer_id === user.id || ticket.advisor_id === user.id
    if (!isOwner) {
      return <div className="p-6 text-sm text-white">Kein Zugriff.</div>
    }
    isCustomer = ticket.customer_id === user.id
    canOffer = ticket.advisor_id === user.id
  } else {
    guestToken = sp?.guest ? String(sp.guest) : null
    if (!guestToken) {
      return <div className="p-6 text-sm text-white">Kein Zugriff.</div>
    }
    if (!ticket.guest_token) {
      await admin.from("live_queue_tickets").update({ guest_token: guestToken }).eq("id", ticket.id)
    } else if (ticket.guest_token !== guestToken) {
      return <div className="p-6 text-sm text-white">Kein Zugriff.</div>
    }
    isCustomer = true
    canOffer = false
  }

  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref,case_type,assigned_advisor_id,customer_id")
    .eq("id", ticket.case_id)
    .maybeSingle()
  const caseType = String(caseRow?.case_type ?? "").trim().toLowerCase() === "konsum" ? "konsum" : "baufi"

  return (
    <LiveRoomClient
      ticketId={ticket.id}
      caseId={ticket.case_id}
      caseRef={caseRow?.case_ref ?? null}
      caseType={caseType}
      canOffer={canOffer}
      isCustomer={isCustomer}
      initialStatus={ticket.status}
      initialCreatedAt={ticket.created_at ?? null}
      initialAcceptedAt={ticket.accepted_at ?? null}
      initialEndedAt={ticket.ended_at ?? null}
      guestToken={guestToken ?? undefined}
    />
  )
}
