import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const leadId = String(body?.leadId ?? "").trim()
    const advisorIdRaw = String(body?.advisorId ?? "").trim()
    const advisorId = advisorIdRaw || null

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId fehlt" }, { status: 400 })
    }

    const { data: existingLead } = await admin
      .from("webhook_leads")
      .select("id")
      .eq("id", leadId)
      .maybeSingle()
    if (!existingLead) {
      return NextResponse.json({ ok: false, error: "Lead nicht gefunden" }, { status: 404 })
    }

    if (advisorId) {
      const { data: advisorProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", advisorId)
        .eq("role", "advisor")
        .maybeSingle()

      if (!advisorProfile) {
        return NextResponse.json({ ok: false, error: "Berater nicht gefunden" }, { status: 400 })
      }
    }

    const { error } = await admin
      .from("webhook_leads")
      .update({
        assigned_advisor_id: advisorId,
        assigned_at: advisorId ? new Date().toISOString() : null,
      })
      .eq("id", leadId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
