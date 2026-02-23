export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { safeFileName } from "@/lib/tippgeber/service"

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt." }, { status: 401 })
    if (role !== "tipgeber" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 })
    }

    const url = new URL(req.url)
    const tempId = String(url.searchParams.get("tempId") ?? "").trim()
    const referralId = String(url.searchParams.get("referralId") ?? "").trim()
    if (!tempId && !referralId) {
      return NextResponse.json({ ok: false, error: "tempId oder referralId fehlt." }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Datei fehlt." }, { status: 400 })
    }

    const base = referralId ? `referrals/${referralId}` : `temp/${user.id}/${tempId}`
    const path = `${base}/${Date.now()}_${safeFileName(file.name || "expose.pdf")}`

    const admin = supabaseAdmin()
    const { error } = await admin.storage
      .from("tipgeber_files")
      .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      path,
      file_name: file.name || "Expose",
      mime_type: file.type || null,
      size_bytes: Number(file.size || 0) || null,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
