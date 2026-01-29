// app/api/admin/cases/assign-advisor/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const caseId = body?.caseId as string | undefined
    const advisorId = (body?.advisorId as string | null | undefined) ?? null

    if (!caseId) {
      return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })
    }

    const { error } = await admin
      .from("cases")
      .update({ assigned_advisor_id: advisorId })
      .eq("id", caseId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
