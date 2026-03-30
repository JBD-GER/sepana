"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"

type EuropaceMeta = {
  vorgangsnummer: string | null
  antragsnummer: string | null
  produktanbieterantragsnummer: string | null
  sync_status: string | null
  last_sync_at: string | null
  letzte_aenderung_am: string | null
  letztes_ereignis_am: string | null
  last_error: string | null
}

type EuropaceSyncStep = {
  status?: string | null
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function labelStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim().toLowerCase()
  if (!raw) return "Noch nicht synchronisiert"
  if (raw === "synced") return "Synchronisiert"
  if (raw === "imported") return "Importiert"
  if (raw === "error") return "Fehler"
  if (raw === "pending") return "Ausstehend"
  return raw
}

export default function EuropaceSyncCard({
  caseId,
  initialMeta,
}: {
  caseId: string
  initialMeta: EuropaceMeta | null | undefined
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function syncNow() {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/advisor/privatkredit/europace/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(String(json?.error ?? "Europace-Sync fehlgeschlagen."))
        return
      }

      const europaceCaseId = String(json?.europaceCaseId ?? "").trim() || null
      const applicationNo = String(json?.application?.antragsnummer ?? "").trim() || null
      const steps = (Array.isArray(json?.steps) ? json.steps : []) as EuropaceSyncStep[]
      const appliedCount = steps.filter((step) => String(step?.status ?? "") === "applied").length
      setMessage(
        europaceCaseId
          ? `Sync erfolgreich. Vorgang ${europaceCaseId}${applicationNo ? `, Antrag ${applicationNo}` : ""}${appliedCount ? `, ${appliedCount} Schritte angewendet` : ""}.`
          : `Sync erfolgreich${appliedCount ? `, ${appliedCount} Schritte angewendet` : ""}.`
      )
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  const meta = initialMeta ?? null

  return (
    <div className="rounded-3xl border border-cyan-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Europace</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Privatkredit Sync</h2>
          <p className="mt-1 text-sm text-slate-600">
            Importiert den SEPANA-Fall in Europace, liest den aktuellen Vorgang zurueck und speichert die externe Zuordnung.
          </p>
        </div>

        <button
          type="button"
          onClick={syncNow}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Synchronisiere..." : meta?.vorgangsnummer ? "Export aktualisieren" : "Vorgang anlegen"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Vorgang</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 break-all">{meta?.vorgangsnummer || "-"}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Antrag</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 break-all">{meta?.antragsnummer || "-"}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Status</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{labelStatus(meta?.sync_status)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letzter Sync</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.last_sync_at)}</div>
        </div>
      </div>

      {(meta?.letzte_aenderung_am || meta?.letztes_ereignis_am || meta?.produktanbieterantragsnummer) ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produktanbieter-Ref</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
              {meta?.produktanbieterantragsnummer || "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letzte Aenderung</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.letzte_aenderung_am)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Letztes Ereignis</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{dt(meta?.letztes_ereignis_am)}</div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : meta?.last_error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Letzter Fehler: {meta.last_error}
        </div>
      ) : null}
    </div>
  )
}
