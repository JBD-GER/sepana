import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export async function requireAdvisor() {
  const { supabase, user, role, passwordSetAt } = await getUserAndRole()
  if (!user) redirect("/login")

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  if (role !== "advisor" && role !== "admin") {
    redirect("/app")
  }

  if (role === "advisor") {
    const { data: profile } = await supabase
      .from("advisor_profiles")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle()
    if (profile && profile.is_active === false) {
      redirect("/login?error=inactive")
    }
  }

  return { supabase, user, role, passwordSetAt }
}
