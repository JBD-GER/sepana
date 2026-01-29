import { requireCustomer } from "@/lib/app/requireCustomer"

type CaseRow = {
  id: string
  case_ref: string | null
  status: string
  created_at: string
  assigned_advisor_id: string | null
}

type CaseListResp = {
  cases: Array<CaseRow & { docsCount: number; offersCount: number }>
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

export default async function CasesPage() {
  await requireCustomer()

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/app/cases/list`, {
    cache: "no-store",
    headers: { "x-internal": "1" },
  }).catch(() => null)

  const data: CaseListResp = res && res.ok ? await res.json() : { cases: [] }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Fälle</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hier sehen Sie Ihre Baufinanzierungs-Fälle und den Bearbeitungsstatus.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-900">Ihre Fälle</div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 backdrop-blur">
              <tr className="border-b border-slate-200/70">
                <th className="px-4 py-3 font-medium text-slate-700">Fall</th>
                <th className="px-4 py-3 font-medium text-slate-700">Status</th>
                <th className="px-4 py-3 font-medium text-slate-700">Unterlagen</th>
                <th className="px-4 py-3 font-medium text-slate-700">Angebote</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((c) => (
                <tr key={c.id} className="border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-500">{dt(c.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.status}</td>
                  <td className="px-4 py-3 text-slate-700">{c.docsCount}</td>
                  <td className="px-4 py-3 text-slate-700">{c.offersCount}</td>
                </tr>
              ))}
              {data.cases.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Noch keine Fälle vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Hinweis: Detailseiten (pro Fall) können wir als nächsten Schritt bauen (Dokumente, Verlauf, Angebote).
        </div>
      </div>
    </div>
  )
}
