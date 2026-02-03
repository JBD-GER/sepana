export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type CaseApplicantRow = {
  id?: string | null
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

function numOrNull(v: unknown) {
  if (v === null || v === undefined) return null
  const raw = String(v).trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  let normalized = cleaned
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".")
  else normalized = normalized.replace(/\./g, "")

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

async function resolveCase(caseId: string, caseRef: string | null) {
  const sb = supabaseAdmin()
  const { data: c, error } = await sb.from("cases").select("id,case_ref").eq("id", caseId).maybeSingle()
  if (error) throw error
  if (!c) return { ok: false as const, status: 404, error: "case_not_found" as const }
  if (caseRef && c.case_ref && c.case_ref !== caseRef) {
    return { ok: false as const, status: 403, error: "case_ref_mismatch" as const }
  }
  return { ok: true as const, sb, c }
}

async function loadMetrics(sb: ReturnType<typeof supabaseAdmin>, caseId: string) {
  const { data: appsRaw, error } = await sb
    .from("case_applicants")
    .select("id,role,net_income_monthly,other_income_monthly,expenses_monthly,existing_loans_monthly")
    .eq("case_id", caseId)
  if (error) throw error

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
  const coIncome = co.reduce((sum, x) => sum + num(x.net_income_monthly), 0)

  const income = net + other + coIncome
  const out = exp + loans
  const surplus = income - out
  const ratio = income > 0 ? surplus / income : -1

  return {
    metrics: {
      income_monthly: income,
      out_monthly: out,
      surplus_monthly: surplus,
      surplus_ratio: ratio,
      co_applicants: co.length,
    },
    primary: {
      net_income_monthly: net,
      other_income_monthly: other,
      expenses_monthly: exp,
      existing_loans_monthly: loans,
      co_income_monthly: coIncome,
    },
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const caseId = String(url.searchParams.get("caseId") ?? "").trim()
  const caseRef = String(url.searchParams.get("caseRef") ?? "").trim() || null
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  try {
    const resolved = await resolveCase(caseId, caseRef)
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status })
    }

    const { sb, c } = resolved
    const payload = await loadMetrics(sb, caseId)

    return NextResponse.json({
      ok: true,
      caseId,
      caseRef: c.case_ref || caseRef || null,
      ...payload,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "server_error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const caseRef = String(body?.caseRef ?? "").trim()
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })
  if (!caseRef) return NextResponse.json({ ok: false, error: "missing_case_ref" }, { status: 400 })

  try {
    const resolved = await resolveCase(caseId, caseRef)
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status })
    }

    const incoming = body?.primary ?? {}
    const patch: Record<string, number | null> = {}
    ;(["net_income_monthly", "other_income_monthly", "expenses_monthly", "existing_loans_monthly"] as const).forEach(
      (field) => {
        if (incoming[field] !== undefined) patch[field] = numOrNull(incoming[field])
      }
    )

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 })
    }

    const { sb, c } = resolved
    const { data: primary } = await sb
      .from("case_applicants")
      .select("id")
      .eq("case_id", caseId)
      .eq("role", "primary")
      .maybeSingle()

    if (primary?.id) {
      const { error } = await sb.from("case_applicants").update(patch).eq("id", primary.id)
      if (error) throw error
    } else {
      const { error } = await sb.from("case_applicants").insert({ case_id: caseId, role: "primary", ...patch })
      if (error) throw error
    }

    const payload = await loadMetrics(sb, caseId)
    return NextResponse.json({
      ok: true,
      caseId,
      caseRef: c.case_ref || caseRef || null,
      ...payload,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "server_error" }, { status: 500 })
  }
}
