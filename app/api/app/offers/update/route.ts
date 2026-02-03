import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { logCaseEvent, buildEmailHtml, sendEmail, getCaseMeta } from "@/lib/notifications/notify"

export const runtime = "nodejs"

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected"] as const
const ALLOWED_BANK_STATUS = ["submitted", "documents", "approved", "declined", "questions"] as const

function normalizeSiteUrl(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = String(raw ?? "").trim()
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function pickAdvisorName(meta: Awaited<ReturnType<typeof getCaseMeta>>) {
  const fromProfile = String(meta?.advisor_name ?? "").trim()
  if (fromProfile) return fromProfile
  const email = String(meta?.advisor_email ?? "").trim()
  if (!email.includes("@")) return "Ihr Berater"
  return email.split("@")[0] || "Ihr Berater"
}

async function syncCaseOfferStatus(supabase: any, caseId: string) {
  const { data: offers } = await supabase.from("case_offers").select("status").eq("case_id", caseId)
  const statuses = (offers ?? []).map((row: any) => String(row?.status ?? "").toLowerCase())
  const hasAccepted = statuses.includes("accepted")
  const hasOpen = statuses.includes("sent") || statuses.includes("draft")
  const nextCaseStatus = hasAccepted ? "offer_accepted" : hasOpen ? "offer_sent" : "offer_rejected"
  await supabase.from("cases").update({ status: nextCaseStatus }).eq("id", caseId)
}

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
  const bankFeedbackNoteRaw = body?.bankFeedbackNote ?? body?.bank_feedback_note
  const bankFeedbackNote =
    typeof bankFeedbackNoteRaw === "string" && bankFeedbackNoteRaw.trim()
      ? bankFeedbackNoteRaw.trim()
      : null
  if (!offerId || (!status && !bankStatus)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }
  if (status && !ALLOWED_STATUSES.includes(status as any)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 })
  }
  if (bankStatus && !ALLOWED_BANK_STATUS.includes(bankStatus as any)) {
    return NextResponse.json({ ok: false, error: "invalid_bank_status" }, { status: 400 })
  }
  if (bankStatus === "questions" && !bankFeedbackNote) {
    return NextResponse.json({ ok: false, error: "bank_feedback_note_required" }, { status: 400 })
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
    const bankConfirmedAt = bankStatus === "approved" ? new Date().toISOString() : null
    const { error } = await supabase
      .from("case_offers")
      .update({
        bank_status: bankStatus,
        bank_confirmed_at: bankConfirmedAt,
        bank_feedback_note: bankStatus === "questions" ? bankFeedbackNote : null,
      })
      .eq("id", offerId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const bankStatusBody =
      bankStatus === "approved"
        ? "\u{1F389} Die Bank hat das Angebot angenommen."
        : bankStatus === "declined"
          ? "Die Bank hat das Angebot abgelehnt."
          : bankStatus === "documents"
            ? "Bitte alle Unterlagen im Bereich Dokumente hochladen."
          : `Die Bank hat Rueckfragen: ${bankFeedbackNote}`

    const meta = await logCaseEvent({
      caseId: offer.case_id,
      actorId: user.id,
      actorRole: role ?? "advisor",
      type: "offer_bank_status",
      title: "Bankrueckmeldung der Bank",
      body: bankStatusBody,
    })

    if (bankStatus === "approved" || bankStatus === "declined" || bankStatus === "questions" || bankStatus === "documents") {
      const caseMeta = meta ?? (await getCaseMeta(offer.case_id))
      if (caseMeta?.customer_email) {
        const advisorName = pickAdvisorName(caseMeta)
        const subject =
          bankStatus === "approved"
            ? "\u{1F389} Bank hat das Angebot angenommen"
            : bankStatus === "declined"
              ? "Bank hat das Angebot abgelehnt"
              : bankStatus === "questions"
                ? "Bank hat Rueckfragen"
                : "Unterlagen benoetigt"
        const html = buildEmailHtml({
          title: subject,
          intro:
            bankStatus === "approved"
              ? "\u{1F389} Gute Nachrichten: die Bank hat Ihr Angebot angenommen."
              : bankStatus === "declined"
                ? "Die Bank hat das Angebot leider abgelehnt."
                : bankStatus === "questions"
                  ? `Die Bank hat Rueckfragen. Bitte melden Sie sich bei ${advisorName}.`
                  : "Bitte laden Sie alle benoetigten Unterlagen im Bereich Dokumente hoch.",
          steps:
            bankStatus === "questions"
              ? [
                  `Rueckfragen der Bank: ${bankFeedbackNote}`,
                  `Bitte kontaktieren Sie Ihren Kundenberater ${advisorName}.`,
                ]
              : bankStatus === "documents"
                ? [
                    "Bitte oeffnen Sie Ihren Fall im Kundenportal.",
                    "Laden Sie alle benoetigten Dokumente im Bereich Dokumente hoch.",
                  ]
              : [
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
  if (status === "accepted") {
    const { data: acceptedOffer } = await supabase
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
  if (status === "sent") {
    const { data: acceptedOffer } = await supabase
      .from("case_offers")
      .select("id")
      .eq("case_id", offer.case_id)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle()
    if (acceptedOffer) {
      return NextResponse.json({ ok: false, error: "already_accepted" }, { status: 409 })
    }
  }
  if (status === "accepted" && !offer.bank_status) {
    patch.bank_status = "documents"
    patch.bank_confirmed_at = null
  }
  const { error } = await supabase.from("case_offers").update(patch).eq("id", offerId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (status === "accepted") {
    // Pro Fall nur eine Angebotsannahme: offene Alternativen werden geschlossen.
    await supabase
      .from("case_offers")
      .update({ status: "rejected" })
      .eq("case_id", offer.case_id)
      .neq("id", offerId)
      .in("status", ["draft", "sent"])
  }

  await logCaseEvent({
    caseId: offer.case_id,
    actorId: user.id,
    actorRole: role ?? "advisor",
    type: "offer_status",
    title: "Angebotsstatus aktualisiert",
    body: `Status: ${status}`,
  })
  await syncCaseOfferStatus(supabase, offer.case_id)

  if (status === "sent" && offer.status !== "sent") {
    const caseMeta = await getCaseMeta(offer.case_id)
    if (caseMeta?.customer_email) {
      const advisorName = pickAdvisorName(caseMeta)
      const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
      const html = buildEmailHtml({
        title: "Neues finales Angebot verfuegbar",
        intro: `${advisorName} hat fuer Ihren Fall ein finales Angebot freigegeben.`,
        steps: [
          "Bitte pruefen Sie das Angebot im Kundenportal.",
          "Sie koennen das Angebot annehmen oder ablehnen.",
          "Wichtig: Es ist nur eine Angebotsannahme pro Fall moeglich.",
        ],
        ctaLabel: "Angebot jetzt pruefen",
        ctaUrl: `${siteUrl}/app/faelle/${offer.case_id}`,
      })
      await sendEmail({ to: caseMeta.customer_email, subject: "Finales Angebot zur Entscheidung", html })
    }
  }

  if (status === "accepted") {
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
  }

  return NextResponse.json({ ok: true })
}
