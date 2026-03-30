export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { logCaseEvent } from "@/lib/notifications/notify"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type OfferRow = {
  angebot_id: string
  angebot_snapshot?: {
    ratenkredit?: {
      produktanbieter?: {
        name?: string | null
      } | null
      produktbezeichnung?: string | null
    } | null
  } | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

async function wasSelectionNotificationAlreadyLogged(
  admin: ReturnType<typeof supabaseAdmin>,
  input: { caseId: string; angebotId: string }
) {
  const { data, error } = await admin
    .from("notification_log")
    .select("id,meta")
    .eq("case_id", input.caseId)
    .eq("recipient_role", "advisor")
    .eq("type", "onlinekredit_guided_offer_selected")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw error

  const rows = (data ?? []) as Array<{ meta?: { angebot_id?: string | null } | null }>
  return rows.some((row) => trimOrNull(row.meta?.angebot_id) === input.angebotId)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          caseId?: string | null
          caseRef?: string | null
          access?: string | null
          angebotId?: string | null
        }
      | null

    const caseId = trimOrNull(body?.caseId)
    const caseRef = trimOrNull(body?.caseRef)
    const accessToken = trimOrNull(body?.access)
    const angebotId = trimOrNull(body?.angebotId)

    if (!caseId || !caseRef || !accessToken || !angebotId) {
      return NextResponse.json({ ok: false, error: "caseId, caseRef, access oder angebotId fehlt." }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const access = await resolvePublicOnlinekreditCaseAccess(admin, {
      caseId,
      caseRef,
      accessToken,
      expectedCaseType: "konsum",
    })

    if (!access.ok) {
      const error =
        access.error === "case_type_not_supported"
          ? "Diese Strecke ist nur fuer Privatkredit vorgesehen."
          : "Der Onlinekredit-Link ist ungueltig oder abgelaufen."
      return NextResponse.json({ ok: false, error }, { status: access.status })
    }

    if (!access.caseRow.assigned_advisor_id) {
      return NextResponse.json({ ok: true, skipped: "no_assigned_advisor" })
    }

    if (
      await wasSelectionNotificationAlreadyLogged(admin, {
        caseId,
        angebotId,
      })
    ) {
      return NextResponse.json({ ok: true, skipped: "already_logged" })
    }

    const { data: offerRow, error: offerError } = await admin
      .from("case_europace_offers")
      .select("angebot_id,angebot_snapshot")
      .eq("case_id", caseId)
      .eq("angebot_id", angebotId)
      .maybeSingle()

    if (offerError) throw offerError

    const offer = (offerRow ?? null) as OfferRow | null
    if (!offer?.angebot_id) {
      return NextResponse.json({ ok: false, error: "Ausgewaehltes Angebot wurde nicht gefunden." }, { status: 404 })
    }

    const providerName = trimOrNull(offer.angebot_snapshot?.ratenkredit?.produktanbieter?.name) ?? "SEPANA-Angebot"
    const productName = trimOrNull(offer.angebot_snapshot?.ratenkredit?.produktbezeichnung)

    await logCaseEvent({
      caseId,
      actorId: access.caseRow.customer_id ?? null,
      actorRole: "customer",
      type: "onlinekredit_guided_offer_selected",
      title: "Kunde hat ein SEPANA-Angebot ausgewaehlt",
      body: productName
        ? `${providerName} - ${productName} wurde fuer die begleitete SEPANA-Strecke ausgewaehlt.`
        : `${providerName} wurde fuer die begleitete SEPANA-Strecke ausgewaehlt.`,
      meta: {
        angebot_id: angebotId,
        provider_name: providerName,
        product_name: productName,
        source: "onlinekredit",
        stage: "guided_offer_selection",
      },
      notifyCustomer: false,
      notifyAdvisor: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Berater-Benachrichtigung konnte nicht erstellt werden.",
      },
      { status: 500 }
    )
  }
}
