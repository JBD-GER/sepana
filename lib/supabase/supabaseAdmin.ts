// lib/supabase/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js"

function must(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * Service-Role Supabase Client (Server only!)
 * -> Zugriff auf auth.admin.* und DB ohne RLS
 */
export function supabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE

  return createClient(
    must("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)", url),
    must("SUPABASE_SERVICE_ROLE_KEY", key),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
