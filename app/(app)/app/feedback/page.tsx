import { requireCustomer } from "@/lib/app/requireCustomer"
import FeedbackForm from "./ui/FeedbackForm"

export default async function FeedbackPage() {
  const { supabase, user } = await requireCustomer()

  const { data: cases } = await supabase
    .from("cases")
    .select("id,case_ref,status,created_at")
    .eq("case_type", "baufi")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Feedback</h1>
        <p className="mt-1 text-sm text-slate-600">
          Schreiben Sie uns kurz, was besser sein kann – oder was Ihnen gefällt.
        </p>
      </div>

      <FeedbackForm cases={(cases ?? []).map((c) => ({ id: c.id, label: c.case_ref || c.id.slice(0, 8) }))} />
    </div>
  )
}
