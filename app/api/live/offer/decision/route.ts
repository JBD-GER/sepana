import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent, buildEmailHtml, sendEmail, getCaseMeta } from "@/lib/notifications/notify"

export const runtime = "nodejs"

async function syncCaseOfferStatus(caseId: string, client: ReturnType<typeof supabaseAdmin>) {
  const { data: offers } = await client.from("case_offers").select("status").eq("case_id", caseId)
  const statuses = (offers ?? []).map((row: any) => String(row?.status ?? "").toLowerCase())
  const hasAccepted = statuses.includes("accepted")
  const hasOpen = statuses.includes("sent") || statuses.includes("draft")
  const nextCaseStatus = hasAccepted ? "offer_accepted" : hasOpen ? "offer_sent" : "offer_rejected"
  await client.from("cases").update({ status: nextCaseStatus }).eq("id", caseId)
}

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  const admin = supabaseAdmin()

  const body = await req.json().catch(() => null)
  const offerId = String(body?.offerId ?? "").trim()
  const decision = String(body?.decision ?? "").trim()
  const guestToken = body?.guestToken ? String(body.guestToken).trim() : null
  if (!offerId || !["accept", "reject"].includes(decision)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const readClient = user ? supabase : admin
  const { data: offer } = await readClient
    .from("case_offers")
    .select("id,case_id,status")
    .eq("id", offerId)
    .maybeSingle()
  if (!offer) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
  if (offer.status && !["draft", "sent"].includes(String(offer.status))) {
    return NextResponse.json({ ok: false, error: "offer_locked" }, { status: 409 })
  }

  const { data: caseRow } = await readClient
    .from("cases")
    .select("id,customer_id")
    .eq("id", offer.case_id)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (user) {
    if (role !== "admin" && caseRow.customer_id !== user.id) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
  } else {
    if (!guestToken) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
    const { data: ticket } = await admin
      .from("live_queue_tickets")
      .select("id,case_id,guest_token")
      .eq("case_id", offer.case_id)
      .in("status", ["waiting", "active", "ended"])
      .order("created_at", { ascending: false })
      .maybeSingle()
    if (!ticket || ticket.guest_token !== guestToken) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
  }

  const nextStatus = decision === "accept" ? "accepted" : "rejected"
  if (nextStatus === "accepted") {
    const { data: acceptedOffer } = await admin
      .from("case_offers")
      .select("id")
      .eq("case_id", offer.case_id)
      .eq("status", "accepted")
      .neq("id", offerId)
      .limit(1)
      .maybeSingle()
    if (acceptedOffer) {
      return NextResponse.json({ ok: false, error: "already_accepted" }, { status: 409 })
    }
  }

  const client = user ? supabase : admin
  const patch: any = { status: nextStatus }
  if (nextStatus === "accepted") {
    patch.bank_status = "documents"
    patch.bank_confirmed_at = null
  }
  const { error } = await client.from("case_offers").update(patch).eq("id", offerId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  if (nextStatus === "accepted") {
    // Pro Fall nur eine Angebotsannahme: offene Alternativen werden geschlossen.
    await client
      .from("case_offers")
      .update({ status: "rejected" })
      .eq("case_id", offer.case_id)
      .neq("id", offerId)
      .in("status", ["draft", "sent"])

    await syncCaseOfferStatus(offer.case_id, admin)
    await logCaseEvent({
      caseId: offer.case_id,
      actorId: user?.id ?? null,
      actorRole: role ?? "customer",
      type: "offer_accepted",
      title: "Angebot angenommen",
      body: "Der Kunde hat das Angebot angenommen. Dokumente werden nun angefordert.",
    })
    const caseMeta = await getCaseMeta(offer.case_id)
    if (caseMeta?.customer_email) {
      const html = buildEmailHtml({
        title: "Bitte Unterlagen hochladen",
        intro: "Ihr finales Angebot wurde angenommen. Bitte laden Sie nun alle benoetigten Unterlagen hoch.",
        steps: [
          "Oeffnen Sie den Bereich Dokumente in Ihrem Fall.",
          "Laden Sie dort alle benoetigten Unterlagen vollstaendig hoch.",
        ],
      })
      await sendEmail({ to: caseMeta.customer_email, subject: "Unterlagen fuer Ihre Finanzierung hochladen", html })
    }
  } else {
    await syncCaseOfferStatus(offer.case_id, admin)
    await logCaseEvent({
      caseId: offer.case_id,
      actorId: user?.id ?? null,
      actorRole: role ?? "customer",
      type: "offer_rejected",
      title: "Angebot abgelehnt",
      body: "Der Kunde hat das Angebot abgelehnt.",
    })
  }

  return NextResponse.json({ ok: true })
}
