import { requireCustomer } from "@/lib/app/requireCustomer"
import CustomerTermine from "@/components/appointments/CustomerTermine"

export default async function TerminePage() {
  await requireCustomer()

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6">
        <CustomerTermine />
      </div>
    </div>
  )
}
