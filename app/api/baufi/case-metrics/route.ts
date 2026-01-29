// app/api/baufi/case-metrics/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type CaseApplicantRow = {
  role: "primary" | "co" | string
  net_income_monthly: number | null
  other_income_monthly: number | null
  expenses_monthly: number | null
  existing_loans_monthly: number | null
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: Request) {
  const sb = supabaseAdmin()
  const url = new URL(req.url)

  const caseId = url.searchParams.get("caseId") || ""
  const caseRef = url.searchParams.get("caseRef") || ""

  if (!caseId) return NextResponse.json({ ok: false, error: "caseId fehlt" }, { status: 400 })

  try {
    // minimaler Zugriffsschutz via case_ref (wie bei dir)
    const { data: c, error: cErr } = await sb.from("cases").select("id, case_ref").eq("id", caseId).maybeSingle()
    if (cErr) throw cErr
    if (!c) return NextResponse.json({ ok: false, error: "Case nicht gefunden" }, { status: 404 })
    if (c.case_ref && caseRef && c.case_ref !== caseRef) {
      return NextResponse.json({ ok: false, error: "Ungültiger Zugriff" }, { status: 403 })
    }

    const { data: appsRaw, error: aErr } = await sb
      .from("case_applicants")
      .select("role, net_income_monthly, other_income_monthly, expenses_monthly, existing_loans_monthly")
      .eq("case_id", caseId)

    if (aErr) throw aErr
    const apps = (appsRaw || []) as CaseApplicantRow[]

    const primary =
      apps.find((x) => x.role === "primary") ??
      ({
        role: "primary",
        net_income_monthly: null,
        other_income_monthly: null,
        expenses_monthly: null,
        existing_loans_monthly: null,
      } as CaseApplicantRow)

    const co = apps.filter((x) => x.role === "co")

    const net = num(primary.net_income_monthly)
    const other = num(primary.other_income_monthly)
    const exp = num(primary.expenses_monthly)
    const loans = num(primary.existing_loans_monthly)
    const coIncome = co.reduce((s, x) => s + num(x.net_income_monthly), 0)

    const income = net + other + coIncome
    const out = exp + loans
    const surplus = income - out
    const ratio = income > 0 ? surplus / income : -1

    return NextResponse.json({
      ok: true,
      caseId,
      caseRef: c.case_ref || caseRef || null,
      metrics: {
        income_monthly: income,
        out_monthly: out,
        surplus_monthly: surplus,
        surplus_ratio: ratio,
        co_applicants: co.length,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
