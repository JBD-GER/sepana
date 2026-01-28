// app/api/baufi/check-email/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

async function findUserIdByEmail(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  // Supabase Docs zeigen keine getUserByEmail in allen Umgebungen → robust via listUsers
  const target = email.trim().toLowerCase()
  const perPage = 1000
  const maxPages = 50 // Schutz (bis 50k User)

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users ?? []
    const hit = users.find((u: any) => (u?.email ?? "").toLowerCase() === target)
    if (hit?.id) return hit.id as string

    // wenn weniger als perPage zurückkommt: keine weiteren Seiten
    if (users.length < perPage) break
  }

  return null
}

export async function GET(req: Request) {
  const sb = supabaseAdmin()

  try {
    const url = new URL(req.url)
    const email = (url.searchParams.get("email") || "").trim().toLowerCase()

    if (!email || !isEmail(email)) {
      return NextResponse.json({ ok: true, exists: false })
    }

    const userId = await findUserIdByEmail(sb, email)
    return NextResponse.json({ ok: true, exists: !!userId })
  } catch (e: any) {
    // lieber “exists:false” als hart failen (UI soll nicht blockieren)
    return NextResponse.json({ ok: true, exists: false, softError: e?.message ?? "check failed" })
  }
}
