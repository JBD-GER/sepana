export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Variant = "horizontal" | "icon"

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120)
}

function isVariant(value: string): value is Variant {
  return value === "horizontal" || value === "icon"
}

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const providerId = url.searchParams.get("providerId") || ""
    const variantRaw = url.searchParams.get("variant") || ""

    if (!providerId) {
      return NextResponse.json({ ok: false, error: "Missing providerId" }, { status: 400 })
    }
    if (!isVariant(variantRaw)) {
      return NextResponse.json({ ok: false, error: "Missing/invalid variant" }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 })
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png"
    const safeName = safeFileName(file.name || `logo.${ext}`)
    const path = `${providerId}/${variantRaw}_${Date.now()}_${safeName}`

    const admin = supabaseAdmin()
    const { error: uploadErr } = await admin.storage
      .from("logo_banken")
      .upload(path, file, { upsert: true, contentType: file.type || "image/png" })

    if (uploadErr) throw uploadErr

    const patch =
      variantRaw === "horizontal"
        ? { logo_horizontal_path: path, updated_at: new Date().toISOString() }
        : { logo_icon_path: path, updated_at: new Date().toISOString() }

    const { error: updateErr } = await admin.from("providers").update(patch).eq("id", providerId)
    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true, path, variant: variantRaw })
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Serverfehler" },
      { status: 500 }
    )
  }
}
