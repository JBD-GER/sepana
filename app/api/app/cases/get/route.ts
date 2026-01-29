export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { data: c, error: caseErr } = await supabase
    .from("cases")
    .select("id,case_ref,status,created_at,updated_at,case_type,customer_id,assigned_advisor_id")
    .eq("id", id)
    .single()

  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 400 })
  if (!c || c.customer_id !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const [{ data: details }, { data: applicants }, { data: previews }, { data: offers }, { data: docs }] =
    await Promise.all([
      supabase.from("case_baufi_details").select("*").eq("case_id", id).maybeSingle(),
      supabase.from("case_applicants").select("*").eq("case_id", id).order("created_at", { ascending: true }),
      supabase
        .from("case_offer_previews")
        .select("id,case_id,provider_id,product_type,payload,created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("case_offers")
        .select("id,case_id,provider_id,product_type,status,loan_amount,rate_monthly,interest_nominal,apr_effective,term_months,zinsbindung_years,special_repayment,created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("documents")
        .select("id,case_id,file_name,file_path,mime_type,size_bytes,created_at")
        .eq("case_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
    ])

  return NextResponse.json({
    case: c,
    baufi_details: details ?? null,
    applicants: applicants ?? [],
    offer_previews: previews ?? [],
    offers: offers ?? [],
    documents: docs ?? [],
  })
}
