import { requireCustomer } from "@/lib/app/requireCustomer"
import CustomerTermine from "@/components/appointments/CustomerTermine"

export default async function TerminePage() {
  await requireCustomer()

  return <CustomerTermine />
}
