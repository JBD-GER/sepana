import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export async function requireInsurance() {
  const { supabase, user, role, passwordSetAt } = await getUserAndRole()
  if (!user) redirect("/login?next=/versicherung")

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  if (role !== "insurance" && role !== "admin") {
    if (role === "advisor") redirect("/advisor")
    if (role === "tipgeber") redirect("/tippgeber")
    redirect("/app")
  }

  if (role === "insurance") {
    const { data: profile } = await supabase
      .from("insurance_partner_profiles")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profile && profile.is_active === false) {
      redirect("/login?error=inactive")
    }
  }

  return { supabase, user, role, passwordSetAt }
}
