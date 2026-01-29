// lib/admin/requireAdmin.ts
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Role = "customer" | "advisor" | "admin"

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (error || !profile) redirect("/login")

  const role = (profile.role ?? "customer") as Role

  if (role !== "admin") {
    if (role === "advisor") redirect("/advisor")
    redirect("/app")
  }

  return { supabase, user, role }
}
