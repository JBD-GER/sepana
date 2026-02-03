import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent, buildEmailHtml, sendEmail, getCaseMeta } from "@/lib/notifications/notify"

export const runtime = "nodejs"

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected"] as const
const ALLOWED_BANK_STATUS = ["submitted", "approved", "declined"] as const

export async function POST(req: Request) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "admin" && role !== "advisor") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const offerId = String(body?.offerId ?? "").trim()
  const status = body?.status ? String(body.status).trim().toLowerCase() : null
  const bankStatus = body?.bankStatus ? String(body.bankStatus).trim().toLowerCase() : null
  if (!offerId || (!status && !bankStatus)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }
  if (status && !ALLOWED_STATUSES.includes(status as any)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 })
  }
  if (bankStatus && !ALLOWED_BANK_STATUS.includes(bankStatus as any)) {
    return NextResponse.json({ ok: false, error: "invalid_bank_status" }, { status: 400 })
  }

  const { data: offer } = await supabase
    .from("case_offers")
    .select("id,case_id,status,bank_status")
    .eq("id", offerId)
    .maybeSingle()
  if (!offer) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })

  const { data: caseRow } = await supabase
    .from("cases")
    .select("id,assigned_advisor_id")
    .eq("id", offer.case_id)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })

  if (role !== "admin" && caseRow.assigned_advisor_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  if (bankStatus) {
    if (offer.status !== "accepted") {
      return NextResponse.json({ ok: false, error: "bank_status_not_allowed" }, { status: 409 })
    }
    const { error } = await supabase.from("case_offers").update({ bank_status: bankStatus }).eq("id", offerId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const meta = await logCaseEvent({
      caseId: offer.case_id,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "offer_bank_status",
      title: "Bankrueckmeldung aktualisiert",
      body: bankStatus === "approved" ? "Die Bank hat das Angebot angenommen." : "Die Bank hat das Angebot abgelehnt.",
    })

    if (bankStatus === "approved" || bankStatus === "declined") {
      const caseMeta = meta ?? (await getCaseMeta(offer.case_id))
      if (caseMeta?.customer_email) {
        const subject =
          bankStatus === "approved" ? "Bank hat das Angebot angenommen" : "Bank hat das Angebot abgelehnt"
        const html = buildEmailHtml({
          title: subject,
          intro:
            bankStatus === "approved"
              ? "Gute Nachrichten: die Bank hat Ihr Angebot angenommen."
              : "Die Bank hat das Angebot leider abgelehnt.",
          steps: [
            "Ihr Berater meldet sich zeitnah mit den naechsten Schritten.",
            "Bei Fragen koennen Sie direkt im Portal eine Nachricht senden.",
          ],
        })
        await sendEmail({ to: caseMeta.customer_email, subject, html })
      }
    }

    return NextResponse.json({ ok: true })
  }

  const patch: any = { status }
  if (status === "accepted" && !offer.bank_status) {
    patch.bank_status = "submitted"
  }
  const { error } = await supabase.from("case_offers").update(patch).eq("id", offerId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await logCaseEvent({
    caseId: offer.case_id,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "offer_status",
    title: "Angebotsstatus aktualisiert",
    body: `Status: ${status}`,
  })

  if (status === "accepted") {
    await supabase.from("cases").update({ status: "offer_accepted" }).eq("id", offer.case_id)
    const caseMeta = await getCaseMeta(offer.case_id)
    if (caseMeta?.customer_email) {
      const html = buildEmailHtml({
        title: "Angebot bei der Bank eingereicht",
        intro: "Ihr finales Angebot wurde bei der Bank eingereicht.",
        steps: [
          "Wir informieren Sie, sobald eine Rueckmeldung der Bank vorliegt.",
          "Bei Rueckfragen melden wir uns direkt bei Ihnen.",
        ],
      })
      await sendEmail({ to: caseMeta.customer_email, subject: "Angebot eingereicht", html })
    }
  }

  return NextResponse.json({ ok: true })
}
