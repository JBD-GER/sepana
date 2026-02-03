// app/api/app/dashboard/route.ts
import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  const { user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (role !== "customer") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const admin = supabaseAdmin()

  const [{ count: openCasesCount }, { data: latestAssigned }] = await Promise.all([
    admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .eq("case_type", "baufi")
      .neq("status", "closed"),
    admin
      .from("cases")
      .select("assigned_advisor_id")
      .eq("customer_id", user.id)
      .not("assigned_advisor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let assignedAdvisorEmail: string | null = null
  const assignedAdvisorId = latestAssigned?.assigned_advisor_id ?? null
  if (assignedAdvisorId) {
    const { data: advisorUser } = await admin.auth.admin.getUserById(assignedAdvisorId)
    assignedAdvisorEmail = advisorUser.user?.email ?? null
  }

  const openCases = openCasesCount ?? 0
  const tip =
    openCases > 0
      ? "Halten Sie Gehaltsnachweise, Kontoauszüge und Eigenkapital-Nachweise griffbereit."
      : "Starten Sie Ihren nächsten Vergleich direkt im Bereich Fälle."

  return NextResponse.json({
    openCases,
    assignedAdvisorEmail,
    tip,
  })
}
