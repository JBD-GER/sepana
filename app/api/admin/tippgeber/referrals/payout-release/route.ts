export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { markReferralCommissionPaid } from "@/lib/tippgeber/service"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)
    const referralId = String(body?.referralId ?? "").trim()
    if (!referralId) {
      return NextResponse.json({ ok: false, error: "referralId fehlt" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: referral } = await admin
      .from("tippgeber_referrals")
      .select("id,commission_status,payout_credit_note_path")
      .eq("id", referralId)
      .maybeSingle()
    if (!referral) return NextResponse.json({ ok: false, error: "Tipp nicht gefunden" }, { status: 404 })
    const commissionStatus = String(referral.commission_status ?? "")
    if (commissionStatus === "paid") {
      return NextResponse.json({ ok: true, alreadyPaid: true })
    }
    if (commissionStatus !== "open") {
      return NextResponse.json(
        { ok: false, error: "Keine offene Provision zur Freigabe (Provision nur bei Bankzusage)." },
        { status: 409 }
      )
    }
    if (!referral.payout_credit_note_path) {
      return NextResponse.json({ ok: false, error: "Bitte zuerst Gutschrift hochladen." }, { status: 409 })
    }

    const result = await markReferralCommissionPaid({ referralId })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
