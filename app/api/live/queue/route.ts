import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  if (role !== "advisor" && role !== "admin") {
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const { data: tickets } = await admin
    .from("live_queue_tickets")
    .select("id,case_id,customer_id,status,created_at")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })

  const ids = (tickets ?? []).map((t: any) => t.case_id).filter(Boolean)
  if (!ids.length) return NextResponse.json({ ok: true, items: [] })

  const { data: cases } = await admin
    .from("cases")
    .select("id,case_ref,case_type,created_at,assigned_advisor_id,entry_channel,language")
    .in("id", ids)
  const byCase = new Map((cases ?? []).map((c: any) => [c.id, c]))

  const { data: baufi } = await admin
    .from("case_baufi_details")
    .select("*")
    .in("case_id", ids)
  const byBaufi = new Map((baufi ?? []).map((b: any) => [b.case_id, b]))

  const { data: applicants } = await admin
    .from("case_applicants")
    .select(
      "case_id,role,first_name,last_name,email,phone,birth_date,nationality,marital_status,address_street,address_zip,address_city,housing_status,employment_type,employment_status,employer_name,net_income_monthly,other_income_monthly,expenses_monthly,existing_loans_monthly"
    )
    .in("case_id", ids)
  const primaryByCase = new Map(
    (applicants ?? [])
      .filter((a: any) => a.role === "primary")
      .map((a: any) => [a.case_id, a])
  )
  const coByCase = new Map(
    (applicants ?? [])
      .filter((a: any) => a.role === "co")
      .map((a: any) => [a.case_id, a])
  )

  const items = (tickets ?? []).map((t: any) => {
    const c = byCase.get(t.case_id) as any
    const b = byBaufi.get(t.case_id) as any
    const a = primaryByCase.get(t.case_id) as any
    const name = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim()
    return {
      id: t.id,
      case_id: t.case_id,
      created_at: t.created_at,
      case_ref: c?.case_ref ?? null,
      case_type: c?.case_type ?? null,
      assigned_advisor_id: c?.assigned_advisor_id ?? null,
      entry_channel: c?.entry_channel ?? null,
      language: c?.language ?? null,
      applicant_name: name || null,
      applicant: a ?? null,
      co_applicant: coByCase.get(t.case_id) ?? null,
      baufi: b ?? null,
    }
  })

  const seen = new Set<string>()
  const unique = items.filter((item: any) => {
    if (!item.case_id) return true
    if (seen.has(item.case_id)) return false
    seen.add(item.case_id)
    return true
  })

  return NextResponse.json({ ok: true, items: unique })
}
