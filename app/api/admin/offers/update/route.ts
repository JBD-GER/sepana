// app/api/admin/offers/update/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

export const runtime = "nodejs"

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected"] as const
const ALLOWED_BANK_STATUS = ["submitted", "approved", "declined"] as const

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const offerId = body?.offerId as string | undefined
    if (!offerId) return NextResponse.json({ ok: false, error: "offerId fehlt" }, { status: 400 })

    const patch: any = {}
    const status = typeof body?.status === "string" ? String(body.status).trim().toLowerCase() : null
    const bankStatus =
      typeof body?.bank_status === "string" ? String(body.bank_status).trim().toLowerCase() : null

    if (status) {
      if (!ALLOWED_STATUSES.includes(status as any)) {
        return NextResponse.json({ ok: false, error: "Ungueltiger Status" }, { status: 400 })
      }
      patch.status = status
    }

    if (bankStatus) {
      if (!ALLOWED_BANK_STATUS.includes(bankStatus as any)) {
        return NextResponse.json({ ok: false, error: "Ungueltiger Bank-Status" }, { status: 400 })
      }
      patch.bank_status = bankStatus
      patch.bank_confirmed_at = bankStatus === "approved" ? new Date().toISOString() : null
    }

    if (body?.loan_amount === null || typeof body?.loan_amount === "number") patch.loan_amount = body.loan_amount

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Kein Patch uebergeben" }, { status: 400 })
    }

    const { data: offer } = await admin
      .from("case_offers")
      .select("id,case_id,status,bank_status")
      .eq("id", offerId)
      .maybeSingle()
    if (!offer) return NextResponse.json({ ok: false, error: "Offer nicht gefunden" }, { status: 404 })

    const effectiveStatus = patch.status ?? offer.status
    if (patch.bank_status && effectiveStatus !== "accepted") {
      return NextResponse.json({ ok: false, error: "Bank-Status nur bei akzeptiertem Angebot" }, { status: 409 })
    }

    if (patch.status === "accepted" && !offer.bank_status && !patch.bank_status) {
      patch.bank_status = "submitted"
      patch.bank_confirmed_at = null
    }

    const { error } = await admin.from("case_offers").update(patch).eq("id", offerId)
    if (error) throw error

    if (patch.status) {
      await logCaseEvent({
        caseId: offer.case_id,
        actorId: null,
        actorRole: "admin",
        type: "offer_status",
        title: "Angebotsstatus aktualisiert",
        body: `Status: ${patch.status}`,
      })
    }

    if (patch.bank_status) {
      await logCaseEvent({
        caseId: offer.case_id,
        actorId: null,
        actorRole: "admin",
        type: "offer_bank_status",
        title: "Bankrueckmeldung aktualisiert",
        body: patch.bank_status === "approved" ? "Die Bank hat das Angebot angenommen." : "Die Bank hat das Angebot abgelehnt.",
      })

      if (patch.bank_status === "approved" || patch.bank_status === "declined") {
        const meta = await getCaseMeta(offer.case_id)
        if (meta?.customer_email) {
          const subject =
            patch.bank_status === "approved" ? "Bank hat das Angebot angenommen" : "Bank hat das Angebot abgelehnt"
          const html = buildEmailHtml({
            title: subject,
            intro:
              patch.bank_status === "approved"
                ? "Gute Nachrichten: die Bank hat Ihr Angebot angenommen."
                : "Die Bank hat das Angebot leider abgelehnt.",
            steps: [
              "Ihr Berater meldet sich zeitnah mit den naechsten Schritten.",
              "Bei Fragen koennen Sie direkt im Portal eine Nachricht senden.",
            ],
          })
          await sendEmail({ to: meta.customer_email, subject, html })
        }
      }
    }

    if (patch.status === "accepted") {
      await admin.from("cases").update({ status: "offer_accepted" }).eq("id", offer.case_id)
      const meta = await getCaseMeta(offer.case_id)
      if (meta?.customer_email) {
        const html = buildEmailHtml({
          title: "Angebot bei der Bank eingereicht",
          intro: "Ihr finales Angebot wurde bei der Bank eingereicht.",
          steps: [
            "Wir informieren Sie, sobald eine Rueckmeldung der Bank vorliegt.",
            "Bei Rueckfragen melden wir uns direkt bei Ihnen.",
          ],
        })
        await sendEmail({ to: meta.customer_email, subject: "Angebot eingereicht", html })
      }
    } else if (patch.status === "rejected") {
      await admin.from("cases").update({ status: "offer_rejected" }).eq("id", offer.case_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
