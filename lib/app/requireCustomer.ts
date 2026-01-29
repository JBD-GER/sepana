import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function requireCustomer() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) redirect("/login")

  // Optional: wenn du wirklich nur customers erlauben willst:
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .single()

  if (!profile) redirect("/login")
  if (profile.role !== "customer") redirect("/dashboard") // oder "/"

  return { supabase, session }
}
