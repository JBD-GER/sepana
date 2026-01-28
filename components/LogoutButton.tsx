'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

export default function LogoutButton() {
  const supabase = createBrowserSupabaseClient()

  return (
    <button
      className="border rounded p-2"
      onClick={async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }}
    >
      Logout
    </button>
  )
}
