export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Recommendation = {
  recommended: "online" | "live"
  confidence: number
  headline: string
  reasoning: string[]
  risk_flags: string[]
  transparency_note: string
}

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

function heuristic(calc: { surplus: number; ratio: number; income: number; out: number }): Recommendation {
  const risk_flags: string[] = []

  if (calc.income <= 0) risk_flags.push("Keine Einnahmen angegeben.")
  if (calc.surplus <= 0) risk_flags.push("Haushaltsrechnung negativ oder ohne Puffer.")
  if (calc.ratio < 0.08) risk_flags.push("Sehr geringer finanzieller Puffer.")
  if (calc.income > 0 && calc.out > calc.income * 0.85) risk_flags.push("Hohe Fixkostenquote.")

  const tight = calc.surplus <= 0 || calc.ratio < 0.10
  const recommended: "online" | "live" = tight ? "live" : "online"

  return {
    recommended,
    confidence: tight ? 0.82 : 0.74,
    headline: tight
      ? "Empfehlung: Live-Beratung (damit es wirklich passt)"
      : "Empfehlung: Online (Bank auswählen & Abschluss starten)",
    reasoning: tight
      ? [
          "Ihre Haushaltsrechnung wirkt knapp – Banken unterscheiden sich hier stark.",
          "Live sparen Sie Zeit und vermeiden unnötige Ablehnungen.",
          "Danach können Sie immer noch in den Online-Abschluss wechseln.",
        ]
      : [
          "Ihr Puffer wirkt solide – Sie können direkt eine Bank auswählen.",
          "Online ist schnell und transparent.",
          "Bei Unsicherheit wechseln Sie jederzeit zur Live-Beratung.",
        ],
    risk_flags,
    transparency_note:
      "Hinweis: Einschätzung auf Basis Ihrer Angaben. Verbindliche Konditionen ergeben sich erst aus Bankprüfung (Bonität, Objekt, Unterlagen).",
  }
}

export async function GET(req: Request) {
  const sb = supabaseAdmin()
  const url = new URL(req.url)

  const caseId = url.searchParams.get("caseId") || ""
  const caseRef = url.searchParams.get("caseRef") || ""

  if (!caseId) return NextResponse.json({ error: "caseId fehlt" }, { status: 400 })

  const { data: c, error: cErr } = await sb.from("cases").select("id, case_ref").eq("id", caseId).maybeSingle()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (!c) return NextResponse.json({ error: "Case nicht gefunden" }, { status: 404 })
  if (c.case_ref && caseRef && c.case_ref !== caseRef) {
    return NextResponse.json({ error: "Ungültiger Zugriff" }, { status: 403 })
  }

  const { data: appsRaw, error: aErr } = await sb
    .from("case_applicants")
    .select("role, net_income_monthly, other_income_monthly, expenses_monthly, existing_loans_monthly")
    .eq("case_id", caseId)

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

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

  const rec = heuristic({ surplus, ratio, income, out })

  return NextResponse.json({
    ok: true,
    caseId,
    recommendation: rec,
    meta: {
      income_monthly: income,
      out_monthly: out,
      surplus_monthly: surplus,
      surplus_ratio: ratio,
      used_ai: false,
    },
  })
}
