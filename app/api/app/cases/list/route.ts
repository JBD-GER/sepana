export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: cases, error } = await supabase
    .from("cases")
    .select("id,case_ref,status,created_at,assigned_advisor_id")
    .eq("case_type", "baufi")
    .eq("customer_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const caseIds = (cases ?? []).map((c) => c.id)

  const [{ data: docs }, { data: offers }, { data: previews }] = await Promise.all([
    caseIds.length
      ? supabase.from("documents").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? supabase.from("case_offers").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
    caseIds.length
      ? supabase.from("case_offer_previews").select("id,case_id").in("case_id", caseIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const docsCountByCase = new Map<string, number>()
  for (const d of docs ?? []) docsCountByCase.set(d.case_id, (docsCountByCase.get(d.case_id) ?? 0) + 1)

  const offersCountByCase = new Map<string, number>()
  for (const o of offers ?? []) offersCountByCase.set(o.case_id, (offersCountByCase.get(o.case_id) ?? 0) + 1)

  const previewsCountByCase = new Map<string, number>()
  for (const p of previews ?? []) previewsCountByCase.set(p.case_id, (previewsCountByCase.get(p.case_id) ?? 0) + 1)

  return NextResponse.json({
    cases: (cases ?? []).map((c) => ({
      ...c,
      docsCount: docsCountByCase.get(c.id) ?? 0,
      offersCount: offersCountByCase.get(c.id) ?? 0,
      previewsCount: previewsCountByCase.get(c.id) ?? 0,
    })),
  })
}
