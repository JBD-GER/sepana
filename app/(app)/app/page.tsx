import Link from "next/link"
import { requireCustomer } from "@/lib/app/requireCustomer"
import { authFetch } from "@/lib/app/authFetch"

type DashboardResp = {
  openCases: number
  assignedAdvisorEmail: string | null
  tip: string
}

export default async function CustomerDashboard() {
  await requireCustomer()

  const res = await authFetch("/api/app/dashboard").catch(() => null)

  const data: DashboardResp =
    res && res.ok
      ? await res.json()
      : {
          openCases: 0,
          assignedAdvisorEmail: null,
          tip: "Halten Sie Ihre Unterlagen bereit – das beschleunigt die Zusage.",
        }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Kundenportal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fokus: <span className="font-medium text-slate-900">Baufinanzierung</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Offene Fälle</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{data.openCases}</div>
          <div className="mt-3">
            <Link
              href="/app/faelle"
              className="inline-flex rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
            >
              Fälle ansehen
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Zugewiesener Berater</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {data.assignedAdvisorEmail ? data.assignedAdvisorEmail : "Noch nicht zugewiesen"}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            {data.assignedAdvisorEmail
              ? "Sie können uns jederzeit Unterlagen über die Online Filiale hochladen."
              : "Sobald ein Berater zugewiesen ist, erscheint er hier."}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">Tipp</div>
          <div className="mt-2 text-sm text-slate-800 leading-relaxed">{data.tip}</div>
          <div className="mt-3">
            <Link
              href="/app/online-filiale"
              className="inline-flex rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300"
            >
              Online Filiale öffnen
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
