import Link from "next/link"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const dynamic = "force-dynamic"
const labels: Record<string, string> = {
  awaiting_data: "Angaben / Einwilligung fehlen",
  pending: "Zur Übermittlung vorgemerkt",
  sending: "Wird übermittelt",
  delivered: "Übermittelt",
  failed: "Creditolo-Rückmeldung prüfen",
  unknown: "Übermittlung unklar – vor erneutem Versand prüfen",
  test_ok: "Test erfolgreich",
}
export default async function CreditoloAdminPage() {
  const { data, error } = await supabaseAdmin()
    .from("creditolo_deliveries")
    .select("case_id,variant,status,response_code,client_id,last_error,updated_at,cases(case_ref)")
    .order("updated_at", { ascending: false })
    .limit(200)
  return (
    <section>
      <h1 className="text-2xl font-semibold">Creditolo-Weiterleitungen</h1>
      <p className="mt-2 text-sm text-slate-600">
        Neue Privatkreditanträge werden nach vollständigen Angaben und Einwilligung an Creditolo gesendet. Bei
        unklarer Übermittlung zuerst im Partnerkonto prüfen; ein erneuter Versand erfolgt nicht automatisch.
      </p>
      {error ? (
        <p className="mt-4 text-rose-700">Status konnte nicht geladen werden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["Fall", "Produkt", "Status", "Antwortcode", "Kundennummer", "Aktualisiert"].map((h) => (
                  <th key={h} className="border-b p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.case_id}>
                  <td className="border-b p-3">
                    <Link className="underline" href={`/admin/leads`}>
                      {(row.cases as unknown as { case_ref?: string } | null)?.case_ref ?? row.case_id}
                    </Link>
                  </td>
                  <td className="border-b p-3">Privatkredit</td>
                  <td className="border-b p-3">
                    {labels[row.status] ?? row.status}
                    {row.last_error && (
                      <span className="mt-1 block text-xs text-slate-500">{row.last_error}</span>
                    )}
                  </td>
                  <td className="border-b p-3">{row.response_code ?? "–"}</td>
                  <td className="border-b p-3">{row.client_id ?? "–"}</td>
                  <td className="border-b p-3">
                    {new Date(row.updated_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.length && <p className="p-3 text-slate-600">Noch keine Weiterleitungen.</p>}
        </div>
      )}
    </section>
  )
}
