import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Role } from "@/lib/auth/roles"

export async function getUserAndRole() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, role: null as Role | null }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,password_set_at")
    .eq("user_id", user.id)
    .maybeSingle()

  const role = (profile?.role ?? "customer") as Role
  const passwordSetAt = (profile as any)?.password_set_at ?? null
  return { supabase, user, role, passwordSetAt }
}
