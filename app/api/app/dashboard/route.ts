// app/api/app/dashboard/route.ts
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  return NextResponse.json({
    openCases: 0,
    assignedAdvisorEmail: null,
    tip: "Halten Sie Ihre Unterlagen bereit – das beschleunigt die Zusage.",
  })
}
