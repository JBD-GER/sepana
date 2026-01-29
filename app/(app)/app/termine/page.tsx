import { requireCustomer } from "@/lib/app/requireCustomer"

export default async function TerminePage() {
  await requireCustomer()

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Termine</h1>
        <p className="mt-1 text-sm text-slate-600">Dieser Bereich kommt als nächstes.</p>
      </div>
    </div>
  )
}
