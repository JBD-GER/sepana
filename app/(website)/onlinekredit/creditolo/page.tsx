import Link from "next/link"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const dynamic = "force-dynamic"
export default async function CreditoloStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; caseRef?: string; access?: string }>
}) {
  const p = await searchParams
  const admin = supabaseAdmin()
  const access = await resolvePublicOnlinekreditCaseAccess(admin, {
    caseId: p.caseId ?? "",
    caseRef: p.caseRef ?? "",
    accessToken: p.access ?? "",
    expectedCaseType: "konsum",
  })
  if (!access.ok)
    return <div className="mx-auto max-w-2xl p-8">Dieser Antragslink ist ungültig oder abgelaufen.</div>
  const { data, error } = await admin
    .from("creditolo_deliveries")
    .select("status,login_url")
    .eq("case_id", p.caseId)
    .maybeSingle()
  const delivered = !error && data?.status === "delivered"
  const message = delivered
    ? "Ihre Kreditanfrage wurde erfolgreich an Creditolo übermittelt. Creditolo übernimmt die weitere Bearbeitung."
    : data?.status === "failed"
      ? "Ihre Anfrage ist bei SEPANA gespeichert. Creditolo hat die Übermittlung nicht bestätigt. Ihr Berater prüft den Vorgang."
      : "Ihre Anfrage ist bei SEPANA gespeichert. Die Weiterleitung an Creditolo wird geprüft."
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">
        {delivered ? "Anfrage übermittelt" : "Anfrage eingegangen"}
      </h1>
      <p className="mt-4 text-slate-600">{message}</p>
      {delivered && data.login_url && (
        <a
          href={data.login_url}
          rel="noreferrer"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-white"
        >
          Zum Creditolo-Kundenbereich
        </a>
      )}
      <p className="mt-6">
        <Link className="underline" href="/app">
          Zum SEPANA-Kundenbereich
        </Link>
      </p>
    </div>
  )
}
