import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) redirect("/login")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .single()

  if (error || !profile) redirect("/login")
  if (profile.role !== "admin") redirect("/dashboard")

  return { supabase, session }
}
