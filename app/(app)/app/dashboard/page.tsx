export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

const TIPS = [
  "Ein vollständiger Unterlagensatz beschleunigt die Bankprüfung deutlich.",
  "Kontoauszüge der letzten 2–3 Monate sind fast immer ein Must-have.",
  "Eigenkapital-Nachweise frühzeitig bereitstellen – spart Rückfragen.",
  "Wenn möglich: Arbeitsvertrag + letzte Gehaltsabrechnungen als PDF bereithalten.",
]

function pickTip() {
  const i = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % TIPS.length
  return TIPS[i]
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Nur Baufi Fälle
  const { data: cases, error } = await supabase
    .from("cases")
    .select("id,status,assigned_advisor_id")
    .eq("case_type", "baufi")
    .eq("customer_id", session.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const openCases = (cases ?? []).filter((c) => c.status !== "closed").length

  // Advisor Email (über Service Role, aber streng scoped)
  const latestWithAdvisor = (cases ?? []).find((c) => !!c.assigned_advisor_id)
  let assignedAdvisorEmail: string | null = null

  if (latestWithAdvisor?.assigned_advisor_id) {
    const admin = supabaseAdmin()
    const { data } = await admin.auth.admin.getUserById(latestWithAdvisor.assigned_advisor_id)
    assignedAdvisorEmail = data.user?.email ?? null
  }

  return NextResponse.json({
    openCases,
    assignedAdvisorEmail,
    tip: pickTip(),
  })
}
