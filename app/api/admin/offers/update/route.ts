// app/api/admin/offers/update/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, logCaseEvent, sendEmail } from "@/lib/notifications/notify"
import { applyReferralBankOutcomeAndCommission } from "@/lib/tippgeber/service"

export const runtime = "nodejs"

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected"] as const
const ALLOWED_BANK_STATUS = ["submitted", "precheck", "documents", "approved", "declined", "questions"] as const

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

function parseOptionalMoneyInput(value: unknown) {
  if (value == null || value === "") return { ok: true as const, value: null as number | null }
  const num = Number(value)
  if (!Number.isFinite(num)) return { ok: false as const, error: "Ungültige Provisionshöhe" }
  if (num < 0) return { ok: false as const, error: "Provisionshöhe darf nicht negativ sein" }
  return { ok: true as const, value: Math.round((num + Number.EPSILON) * 100) / 100 }
}

function isMissingBankCommissionAmountColumnError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code !== "42703") return false
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("bank_commission_amount")
}

async function syncCaseOfferStatus(admin: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: offers } = await admin.from("case_offers").select("status").eq("case_id", caseId)
  const statuses = (offers ?? []).map((row: any) => String(row?.status ?? "").toLowerCase())
  const hasAccepted = statuses.includes("accepted")
  const hasOpen = statuses.includes("sent") || statuses.includes("draft")
  const nextCaseStatus = hasAccepted ? "offer_accepted" : hasOpen ? "offer_sent" : "offer_rejected"
  await admin.from("cases").update({ status: nextCaseStatus }).eq("id", caseId)
}

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
    const bankFeedbackNoteRaw = body?.bank_feedback_note ?? body?.bankFeedbackNote
    const bankCommissionAmountRaw = body?.bank_commission_amount ?? body?.bankCommissionAmount
    const bankFeedbackNote =
      typeof bankFeedbackNoteRaw === "string" && bankFeedbackNoteRaw.trim()
        ? bankFeedbackNoteRaw.trim()
        : null
    const hasBankCommissionAmount = bankCommissionAmountRaw !== undefined
    const parsedBankCommissionAmount = parseOptionalMoneyInput(bankCommissionAmountRaw)
    if (!parsedBankCommissionAmount.ok) {
      return NextResponse.json({ ok: false, error: parsedBankCommissionAmount.error }, { status: 400 })
    }

    if (status) {
      if (!ALLOWED_STATUSES.includes(status as any)) {
        return NextResponse.json({ ok: false, error: "Ungültiger Status" }, { status: 400 })
      }
      patch.status = status
    }

    if (bankStatus) {
      if (!ALLOWED_BANK_STATUS.includes(bankStatus as any)) {
        return NextResponse.json({ ok: false, error: "Ungültiger Bank-Status" }, { status: 400 })
      }
      patch.bank_status = bankStatus
      patch.bank_confirmed_at = bankStatus === "approved" ? new Date().toISOString() : null
      patch.bank_feedback_note = bankStatus === "questions" ? bankFeedbackNote : null
      if (hasBankCommissionAmount) patch.bank_commission_amount = parsedBankCommissionAmount.value
      if (bankStatus === "questions" && !bankFeedbackNote) {
        return NextResponse.json({ ok: false, error: "Rückfragen-Text fehlt" }, { status: 400 })
      }
    }

    if (!bankStatus && hasBankCommissionAmount) {
      patch.bank_commission_amount = parsedBankCommissionAmount.value
    }

    if (body?.loan_amount === null || typeof body?.loan_amount === "number") patch.loan_amount = body.loan_amount

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Kein Patch übergeben" }, { status: 400 })
    }

    let bankCommissionColumnAvailable = true
    let {
      data: offer,
      error: offerErr,
    } = await admin
      .from("case_offers")
      .select("id,case_id,status,bank_status,bank_commission_amount")
      .eq("id", offerId)
      .maybeSingle()
    if (offerErr && isMissingBankCommissionAmountColumnError(offerErr)) {
      bankCommissionColumnAvailable = false
      const fallback = await admin
        .from("case_offers")
        .select("id,case_id,status,bank_status")
        .eq("id", offerId)
        .maybeSingle()
      offerErr = fallback.error ?? null
      offer = fallback.data ? ({ ...fallback.data, bank_commission_amount: null } as any) : null
    }
    if (offerErr) throw offerErr
    if (!offer) return NextResponse.json({ ok: false, error: "Offer nicht gefunden" }, { status: 404 })

    const offerBankCommissionAmount =
      (offer as { bank_commission_amount?: number | null }).bank_commission_amount ?? null
    const effectiveBankCommissionAmount =
      (Object.prototype.hasOwnProperty.call(patch, "bank_commission_amount")
        ? patch.bank_commission_amount
        : offerBankCommissionAmount) ?? null

    if (Object.prototype.hasOwnProperty.call(patch, "bank_commission_amount") && !bankCommissionColumnAvailable) {
      return NextResponse.json(
        { ok: false, error: "DB-Spalte 'bank_commission_amount' fehlt. Bitte Migration ausführen." },
        { status: 409 }
      )
    }

    const effectiveStatus = patch.status ?? offer.status
    if (patch.bank_status && effectiveStatus !== "accepted" && effectiveStatus !== "sent") {
      return NextResponse.json({ ok: false, error: "Bank-Status nur bei abgeschicktem oder akzeptiertem Angebot" }, { status: 409 })
    }
    if (patch.bank_status === "approved" && (effectiveBankCommissionAmount == null || Number(effectiveBankCommissionAmount) <= 0)) {
      return NextResponse.json(
        { ok: false, error: "Bitte interne Provision inkl. MwSt. (Bank-/SEPANA-Provision) für 'Angenommen' erfassen." },
        { status: 400 }
      )
    }

    if (patch.status === "accepted" && !offer.bank_status && !patch.bank_status) {
      patch.bank_status = "documents"
      patch.bank_confirmed_at = null
    }

    if (patch.status === "accepted") {
      const { data: acceptedOffer } = await admin
        .from("case_offers")
        .select("id")
        .eq("case_id", offer.case_id)
        .eq("status", "accepted")
        .neq("id", offerId)
        .limit(1)
        .maybeSingle()
      if (acceptedOffer) {
        return NextResponse.json({ ok: false, error: "Es wurde bereits ein anderes Angebot angenommen." }, { status: 409 })
      }
    }

    if (patch.status === "sent") {
      const { data: acceptedOffer } = await admin
        .from("case_offers")
        .select("id")
        .eq("case_id", offer.case_id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle()
      if (acceptedOffer) {
        return NextResponse.json({ ok: false, error: "Fall hat bereits ein angenommenes Angebot." }, { status: 409 })
      }
    }

    const { error } = await admin.from("case_offers").update(patch).eq("id", offerId)
    if (error) throw error
    if (patch.status === "accepted") {
      await admin
        .from("case_offers")
        .update({ status: "rejected" })
        .eq("case_id", offer.case_id)
        .neq("id", offerId)
        .in("status", ["draft", "sent"])
    }

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
    await syncCaseOfferStatus(admin, offer.case_id)

    if (patch.status === "sent" && offer.status !== "sent") {
      const meta = await getCaseMeta(offer.case_id)
      if (meta?.customer_email) {
        const advisorName = pickAdvisorName(meta)
        const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
        const html = buildEmailHtml({
          title: "Neues finales Angebot verfügbar",
          intro: `${advisorName} hat für Ihren Fall ein finales Angebot freigegeben.`,
          steps: [
            "Bitte prüfen Sie das Angebot im Kundenportal.",
            "Sie können das Angebot annehmen oder ablehnen.",
            "Wichtig: Es ist nur eine Angebotsannahme pro Fall möglich.",
          ],
          ctaLabel: "Angebot jetzt prüfen",
          ctaUrl: `${siteUrl}/app/faelle/${offer.case_id}`,
        })
        await sendEmail({ to: meta.customer_email, subject: "Finales Angebot zur Entscheidung", html })
      }
    }

    if (patch.bank_status) {
      const bankStatusBody =
        patch.bank_status === "approved"
          ? "\u{1F389} Die Bank hat das Angebot angenommen."
          : patch.bank_status === "precheck"
            ? "Die Bank befindet sich in der Vorprüfung."
          : patch.bank_status === "declined"
            ? "Die Bank hat das Angebot abgelehnt."
            : patch.bank_status === "documents"
              ? "Bitte alle Unterlagen im Bereich Dokumente hochladen."
            : `Die Bank hat Rückfragen: ${patch.bank_feedback_note}`

      await logCaseEvent({
        caseId: offer.case_id,
        actorId: null,
        actorRole: "admin",
        type: "offer_bank_status",
        title: "Bankrückmeldung der Bank",
        body: bankStatusBody,
      })

      if (
        patch.bank_status === "approved" ||
        patch.bank_status === "declined" ||
        patch.bank_status === "questions" ||
        patch.bank_status === "documents" ||
        patch.bank_status === "precheck"
      ) {
        const meta = await getCaseMeta(offer.case_id)
        if (meta?.customer_email) {
          const advisorName = pickAdvisorName(meta)
          const subject =
            patch.bank_status === "approved"
              ? "\u{1F389} Bank hat das Angebot angenommen"
              : patch.bank_status === "precheck"
                ? "Bankstatus: Vorprüfung"
              : patch.bank_status === "declined"
                ? "Bank hat das Angebot abgelehnt"
                : patch.bank_status === "questions"
                  ? "Bank hat Rückfragen"
                  : "Unterlagen benötigt"
          const html = buildEmailHtml({
            title: subject,
            intro:
              patch.bank_status === "approved"
                ? "\u{1F389} Gute Nachrichten: die Bank hat Ihr Angebot angenommen."
                : patch.bank_status === "precheck"
                  ? "Die Bank hat die Vorprüfung Ihres Angebots gestartet."
                : patch.bank_status === "declined"
                  ? "Die Bank hat das Angebot leider abgelehnt."
                  : patch.bank_status === "questions"
                    ? `Die Bank hat Rückfragen. Bitte melden Sie sich bei ${advisorName}.`
                    : "Bitte laden Sie alle benötigten Unterlagen im Bereich Dokumente hoch.",
            steps:
              patch.bank_status === "questions"
                ? [
                    `Rückfragen der Bank: ${patch.bank_feedback_note}`,
                    `Bitte kontaktieren Sie Ihren Kundenberater ${advisorName}.`,
                  ]
                : patch.bank_status === "precheck"
                  ? [
                      "Die Bank befindet sich aktuell in der Vorprüfung.",
                      "Aktuell ist keine Aktion von Ihnen erforderlich.",
                      "Ihr Berater informiert Sie, sobald es Neuigkeiten gibt.",
                    ]
                : patch.bank_status === "documents"
                  ? [
                      "Bitte öffnen Sie Ihren Fall im Kundenportal.",
                      "Laden Sie alle benötigten Dokumente im Bereich Dokumente hoch.",
                    ]
                : [
                    "Ihr Berater meldet sich zeitnah mit den nächsten Schritten.",
                    "Bei Fragen können Sie direkt im Portal eine Nachricht senden.",
                  ],
          })
          await sendEmail({ to: meta.customer_email, subject, html })
        }
      }

      if (patch.bank_status === "approved" || patch.bank_status === "declined") {
        await applyReferralBankOutcomeAndCommission({
          caseId: offer.case_id,
          offerId,
          outcome: patch.bank_status === "approved" ? "approved" : "declined",
          approvedCommissionBaseAmount:
            patch.bank_status === "approved" ? Number(effectiveBankCommissionAmount ?? 0) : undefined,
          sourceActorRole: "admin",
        }).catch(() => null)
      }
    }

    if (patch.status === "accepted") {
      const meta = await getCaseMeta(offer.case_id)
      if (meta?.customer_email) {
        const html = buildEmailHtml({
          title: "Bitte Unterlagen hochladen",
          intro: "Ihr finales Angebot wurde angenommen. Bitte laden Sie nun alle benötigten Unterlagen hoch.",
          steps: [
            "Öffnen Sie den Bereich Dokumente in Ihrem Fall.",
            "Laden Sie dort alle benötigten Unterlagen vollständig hoch.",
          ],
        })
        await sendEmail({ to: meta.customer_email, subject: "Unterlagen für Ihre Finanzierung hochladen", html })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}


