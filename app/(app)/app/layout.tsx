import { requireCustomer } from "@/lib/app/requireCustomer"
import CustomerHeader from "./ui/CustomerHeader"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer()

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-white">
      <CustomerHeader />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  )
}
