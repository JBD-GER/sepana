// app/api/admin/advisors/[id]/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Body = {
  display_name?: string | null
  bio?: string | null
  languages?: string[] | null
  photo_path?: string | null
  is_active?: boolean | null
  phone?: string | null
}

function normalizeLanguages(v: unknown) {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 20)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

    const body = (await req.json().catch(() => ({}))) as Body

    const display_name = body.display_name ? String(body.display_name).trim() : null
    const bio = body.bio ? String(body.bio).trim() : null
    const languages = normalizeLanguages(body.languages ?? [])
    const photo_path = body.photo_path ? String(body.photo_path).trim() : null
    const is_active = typeof body.is_active === "boolean" ? body.is_active : null
    const phone = body.phone ? String(body.phone).trim() : null

    const admin = supabaseAdmin()

    const { error } = await admin.from("advisor_profiles").upsert(
      {
        user_id: id,
        display_name,
        bio,
        languages,
        photo_path,
        phone,
        ...(is_active === null ? {} : { is_active }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })

    const admin = supabaseAdmin()

    // Remove advisor profile and downgrade role to customer to avoid FK issues.
    const { error: profErr } = await admin.from("advisor_profiles").delete().eq("user_id", id)
    if (profErr) throw profErr

    const { error: roleErr } = await admin.from("profiles").update({ role: "customer" }).eq("user_id", id)
    if (roleErr) throw roleErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
