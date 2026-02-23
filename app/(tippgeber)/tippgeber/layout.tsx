import { requireTippgeber } from "@/lib/tippgeber/requireTippgeber"
import TippgeberHeader from "./ui/TippgeberHeader"

export default async function TippgeberLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireTippgeber()

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 text-slate-900">
      <TippgeberHeader initialEmail={user.email ?? null} />
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
