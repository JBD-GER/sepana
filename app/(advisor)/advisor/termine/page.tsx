import { requireAdvisor } from "@/lib/advisor/requireAdvisor"
import AdvisorTermine from "@/components/appointments/AdvisorTermine"

export default async function AdvisorTerminePage() {
  await requireAdvisor()

  return <AdvisorTermine />
}
