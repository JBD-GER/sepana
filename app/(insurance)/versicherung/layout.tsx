import { requireInsurance } from "@/lib/insurance/requireInsurance"
import InsuranceHeader from "./ui/InsuranceHeader"

export default async function InsuranceLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireInsurance()

  return (
    <div className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_55%,#ecfeff_100%)] text-slate-900">
      <InsuranceHeader initialEmail={user.email ?? null} />
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
