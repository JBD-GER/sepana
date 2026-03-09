export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import {
  buildTippgeberCreditNoteDownloadUrl,
  getTippgeberProfileByUserId,
  safeFileName,
  sendTippgeberCreditNoteEmail,
  type TippgeberReferralRow,
} from "@/lib/tippgeber/service"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const url = new URL(req.url)
    const referralId = String(url.searchParams.get("referralId") ?? "").trim()
    if (!referralId) {
      return NextResponse.json({ ok: false, error: "referralId fehlt" }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Datei fehlt" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: referralRaw } = await admin
      .from("tippgeber_referrals")
      .select("*")
      .eq("id", referralId)
      .single()
    if (!referralRaw) {
      return NextResponse.json({ ok: false, error: "Tipp nicht gefunden" }, { status: 404 })
    }
    const referral = referralRaw as TippgeberReferralRow
    const commissionStatus = String(referral.commission_status ?? "")
    if (commissionStatus !== "open" && commissionStatus !== "paid") {
      return NextResponse.json(
        { ok: false, error: "Gutschrift-Upload nur für Provisionen nach Bankzusage." },
        { status: 409 }
      )
    }

    const path = `credit-notes/${referralId}/${Date.now()}_${safeFileName(file.name || "gutschrift.pdf")}`
    const upload = await admin.storage
      .from("tipgeber_files")
      .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" })
    if (upload.error) throw upload.error

    const now = new Date().toISOString()
    const { data: updatedRaw, error: updateErr } = await admin
      .from("tippgeber_referrals")
      .update({
        payout_credit_note_path: path,
        payout_credit_note_file_name: file.name || "Gutschrift",
        payout_credit_note_mime_type: file.type || null,
        payout_credit_note_size_bytes: Number(file.size || 0) || null,
        payout_credit_note_uploaded_at: now,
        updated_at: now,
      })
      .eq("id", referralId)
      .select("*")
      .single()
    if (updateErr) throw updateErr

    const updated = updatedRaw as TippgeberReferralRow
    const profile = await getTippgeberProfileByUserId(updated.tippgeber_user_id)
    const downloadUrl = buildTippgeberCreditNoteDownloadUrl({ referralId: updated.id })
    await sendTippgeberCreditNoteEmail({ referral: updated, profile, downloadUrl }).catch(() => null)

    return NextResponse.json({ ok: true, path })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}

