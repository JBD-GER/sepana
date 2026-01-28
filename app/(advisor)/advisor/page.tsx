import LogoutButton from '@/components/LogoutButton'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AdvisorDashboard() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Berater-Dashboard</h1>
      <p>Eingeloggt als: {session?.user.email}</p>
      <LogoutButton />
    </div>
  )
}
