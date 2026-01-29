// lib/app/requireCustomer.ts
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function requireCustomer() {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) redirect("/login?next=/app")

  return { supabase, user }
}
