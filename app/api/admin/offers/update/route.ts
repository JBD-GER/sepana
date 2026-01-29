// app/api/admin/offers/update/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const offerId = body?.offerId as string | undefined
    if (!offerId) return NextResponse.json({ ok: false, error: "offerId fehlt" }, { status: 400 })

    const patch: any = {}
    if (typeof body?.status === "string") patch.status = body.status
    if (body?.loan_amount === null || typeof body?.loan_amount === "number") patch.loan_amount = body.loan_amount

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Kein Patch übergeben" }, { status: 400 })
    }

    const { error } = await admin.from("case_offers").update(patch).eq("id", offerId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
