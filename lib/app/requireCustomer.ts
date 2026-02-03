// lib/app/requireCustomer.ts
import { redirect } from "next/navigation"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import type { Role } from "@/lib/auth/roles"

export async function requireCustomer() {
  const { supabase, user, role, passwordSetAt } = await getUserAndRole()
  if (!user) redirect("/login?next=/app")

  if (!passwordSetAt) {
    redirect("/einladung?mode=invite")
  }

  if (role !== "customer") {
    const dest = roleHome(role)
    redirect(dest)
  }

  return { supabase, user, role, passwordSetAt }
}

function roleHome(role: Role | null) {
  if (role === "admin") return "/admin"
  if (role === "advisor") return "/advisor"
  return "/app"
}
