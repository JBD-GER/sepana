import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export async function requireTippgeber() {
  const { supabase, user, role, passwordSetAt } = await getUserAndRole()
  if (!user) redirect("/login?next=/tippgeber")

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  if (role !== "tipgeber" && role !== "admin") {
    if (role === "advisor") redirect("/advisor")
    redirect("/app")
  }

  if (role === "tipgeber") {
    const { data: profile } = await supabase
      .from("tippgeber_profiles")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle()

    if (profile && profile.is_active === false) {
      redirect("/login?error=inactive")
    }
  }

  return { supabase, user, role, passwordSetAt }
}
