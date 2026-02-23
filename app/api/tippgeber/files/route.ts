export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { safeFileName } from "@/lib/tippgeber/service"

type Kind = "expose" | "credit_note"

function asKind(value: string | null): Kind | null {
  if (value === "expose" || value === "credit_note") return value
  return null
}

export async function GET(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const referralId = String(url.searchParams.get("referralId") ?? "").trim()
    const kind = asKind(url.searchParams.get("kind"))
    const download = url.searchParams.get("download") === "1"
    if (!referralId || !kind) {
      return NextResponse.json({ ok: false, error: "referralId/kind fehlt" }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: referral } = await admin
      .from("tippgeber_referrals")
      .select(
        "id,tippgeber_user_id,assigned_advisor_id,expose_file_path,expose_file_name,expose_mime_type,payout_credit_note_path,payout_credit_note_file_name,payout_credit_note_mime_type"
      )
      .eq("id", referralId)
      .maybeSingle()

    if (!referral) {
      return NextResponse.json({ ok: false, error: "Tipp nicht gefunden" }, { status: 404 })
    }

    const isAdmin = role === "admin"
    const isOwner = referral.tippgeber_user_id === user.id
    const isAdvisor = role === "advisor" && referral.assigned_advisor_id === user.id

    if (kind === "credit_note") {
      if (!(isAdmin || isOwner)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    } else {
      if (!(isAdmin || isOwner || isAdvisor)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
      }
    }

    const path = kind === "credit_note" ? referral.payout_credit_note_path : referral.expose_file_path
    const fileName = kind === "credit_note" ? referral.payout_credit_note_file_name : referral.expose_file_name
    const mimeType = kind === "credit_note" ? referral.payout_credit_note_mime_type : referral.expose_mime_type
    if (!path) {
      return NextResponse.json({ ok: false, error: "Datei nicht vorhanden" }, { status: 404 })
    }

    const { data: blob, error } = await admin.storage.from("tipgeber_files").download(path)
    if (error || !blob) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Datei nicht gefunden" }, { status: 404 })
    }

    const arrayBuffer = await blob.arrayBuffer()
    const headers: Record<string, string> = {
      "content-type": mimeType || blob.type || "application/octet-stream",
      "cache-control": "private, no-store",
    }
    if (download) {
      headers["content-disposition"] = `attachment; filename="${safeFileName(fileName || "download")}"` 
    }
    return new NextResponse(arrayBuffer, { status: 200, headers })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
