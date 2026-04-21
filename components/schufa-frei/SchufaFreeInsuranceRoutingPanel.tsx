"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getInsuranceRouteSourceLabel, getInsuranceRouteStatusLabel } from "@/lib/insurance/invoice"

type InsuranceRoute = {
  route_source?: string | null
  route_status?: string | null
  routed_at?: string | null
}

function formatDateTime(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

export default function SchufaFreeInsuranceRoutingPanel({
  caseId,
  route,
}: {
  caseId: string
  route: InsuranceRoute | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function forwardCase() {
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch("/api/app/cases/schufa-frei/insurance-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, action: "forward" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Weiterleitung fehlgeschlagen.")
      setMessage("Fall wurde intern an den Versicherungsbereich uebergeben.")
      router.refresh()
    } catch (error: any) {
      setMessage(error?.message ?? "Weiterleitung fehlgeschlagen.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="text-sm font-semibold text-slate-900">Versicherungsbereich</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Negative Vorpruefungen werden nach dem Versand der Absage automatisch uebernommen. Darueber hinaus kann
            der Berater jeden Fall spaeter manuell in den internen Versicherungsbereich geben.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Aktueller Stand</div>
          <div className="mt-3 space-y-2">
            <div>
              Quelle:{" "}
              <span className="font-medium text-slate-900">
                {route ? getInsuranceRouteSourceLabel(route.route_source) : "Noch nicht uebergeben"}
              </span>
            </div>
            <div>
              Status:{" "}
              <span className="font-medium text-slate-900">
                {route ? getInsuranceRouteStatusLabel(route.route_status) : "-"}
              </span>
            </div>
            <div>
              Uebergeben am:{" "}
              <span className="font-medium text-slate-900">{route ? formatDateTime(route.routed_at) : "-"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={forwardCase}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Leite weiter..." : route ? "Erneut intern markieren" : "An Versicherungsbereich uebergeben"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
    </div>
  )
}
