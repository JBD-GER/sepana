// app/api/baufi/recommendation/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Recommendation = {
  recommended: "online" | "live"
  confidence: number // 0..1
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

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
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
      : "Empfehlung: Online-Vergleich (günstig & schnell)",
    reasoning: tight
      ? [
          "Ihre Haushaltsrechnung wirkt knapp – Banken unterscheiden sich hier stark.",
          "In der Beratung können wir Stellschrauben prüfen (Laufzeit, Tilgung, Nebenkostenpuffer).",
          "So vermeiden Sie unnötige Ablehnungen und sparen Zeit.",
        ]
      : [
          "Ihr Puffer wirkt solide – ideal für einen schnellen, günstigen Vergleich.",
          "Online können Sie mehrere Konditionen transparent vergleichen.",
          "Bei Fragen können Sie jederzeit auf Live-Beratung wechseln.",
        ],
    risk_flags,
    transparency_note:
      "Hinweis: Das ist eine Einschätzung auf Basis Ihrer Angaben. Verbindliche Konditionen ergeben sich erst aus Bankprüfung (Bonität, Objekt, Unterlagen).",
  }
}

// Nur im Graubereich AI callen (Kosten sparen)
function shouldUseAI(calc: { surplus: number; ratio: number; income: number }) {
  if (calc.income <= 0) return false
  if (calc.surplus <= 0) return false // dann eh live
  // “Graubereich” – hier kann AI Nuancen liefern
  return calc.ratio >= 0.10 && calc.ratio <= 0.16
}

async function callOpenAI(input: unknown): Promise<Recommendation | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions:
        "Du bist ein Finanzierungs-Routing-Assistent. Du gibst KEINE verbindlichen Zinsen/Bankzusagen. " +
        "Du entscheidest transparent zwischen 'online' (günstig & schnell) und 'live' (wenn knapp/komplex). " +
        "Wenn Haushaltsrechnung knapp ist: klar zu Live raten. " +
        "Gib ausschließlich JSON nach Schema zurück, ohne zusätzlichen Text.",
      input: [
        {
          role: "user",
          content:
            "Entscheide zwischen Online-Vergleich und Live-Beratung anhand der Zahlen. Gib JSON exakt nach Schema zurück.",
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "baufi_recommendation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              recommended: { type: "string", enum: ["online", "live"] },
              confidence: { type: "number" },
              headline: { type: "string" },
              reasoning: { type: "array", items: { type: "string" } },
              risk_flags: { type: "array", items: { type: "string" } },
              transparency_note: { type: "string" },
            },
            required: ["recommended", "confidence", "headline", "reasoning", "risk_flags", "transparency_note"],
          },
        },
      },
    }),
  })

  if (!res.ok) return null

  const json: any = await res.json().catch(() => null)
  if (!json) return null

  // robustes Extrahieren (je nach API/SDK-Form)
  const text: string | null =
    json.output_text ??
    json?.output?.[0]?.content?.[0]?.text ??
    json?.output?.[0]?.content?.[0]?.output_text ??
    null

  if (!text) return null

  try {
    const parsed = JSON.parse(text) as Recommendation

    // Minimale Validierung/Absicherung
    if (parsed.recommended !== "online" && parsed.recommended !== "live") return null
    if (!Array.isArray(parsed.reasoning) || !Array.isArray(parsed.risk_flags)) return null
    if (typeof parsed.headline !== "string" || typeof parsed.transparency_note !== "string") return null

    return {
      ...parsed,
      confidence: clamp01(typeof parsed.confidence === "number" ? parsed.confidence : 0.75),
    }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const sb = supabaseAdmin()
  const url = new URL(req.url)

  const caseId = url.searchParams.get("caseId") || ""
  const caseRef = url.searchParams.get("caseRef") || ""

  if (!caseId) return NextResponse.json({ error: "caseId fehlt" }, { status: 400 })

  // Minimaler Zugriffsschutz via caseRef (wenn vorhanden)
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

  const baseRec = heuristic({ surplus, ratio, income, out })

  const aiInput = {
    income_monthly: income,
    out_monthly: out,
    surplus_monthly: surplus,
    surplus_ratio: ratio,
    base_recommendation: baseRec,
  }

  const ai = shouldUseAI({ surplus, ratio, income }) ? await callOpenAI(aiInput) : null

  const finalRec = ai
    ? {
        ...ai,
        confidence: clamp01(typeof ai.confidence === "number" ? ai.confidence : baseRec.confidence),
        // Safety: wenn AI “online” empfiehlt aber Zahlen tight sind → override auf live (keine falsche Guidance)
        recommended: surplus <= 0 || ratio < 0.1 ? "live" : ai.recommended,
      }
    : baseRec

  return NextResponse.json({
    ok: true,
    caseId,
    recommendation: finalRec,
    meta: {
      income_monthly: income,
      out_monthly: out,
      surplus_monthly: surplus,
      surplus_ratio: ratio,
      used_ai: !!ai,
    },
  })
}
