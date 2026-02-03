import { requireCustomer } from "@/lib/app/requireCustomer"
import CustomerHeader from "./ui/CustomerHeader"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireCustomer()

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-white text-slate-900">
      <CustomerHeader initialEmail={user.email ?? null} />
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
