// lib/admin/requireAdmin.ts
import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"

export async function requireAdmin() {
  const { supabase, user, role, passwordSetAt } = await getUserAndRole()

  if (!user) redirect("/login")

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  if (role !== "admin") {
    if (role === "advisor") redirect("/advisor")
    redirect("/app")
  }

  return { supabase, user, role, passwordSetAt }
}
