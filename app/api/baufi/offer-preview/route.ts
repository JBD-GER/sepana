export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type Body = {
  caseId: string
  providerId: string
  productType: "baufi" | "konsum"
  payload: any
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    if (!body.caseId || !body.providerId || !body.productType) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 })
    }

    const supabase = admin()

    // ✅ upsert (pro Case+Provider+Typ nur ein Snapshot, wird aktualisiert)
    const { error } = await supabase
      .from("case_offer_previews")
      .upsert(
        {
          case_id: body.caseId,
          provider_id: body.providerId,
          product_type: body.productType,
          payload: body.payload ?? {},
        },
        { onConflict: "case_id,provider_id,product_type" }
      )

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 })
  }
}
