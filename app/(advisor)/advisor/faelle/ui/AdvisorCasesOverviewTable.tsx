"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { getAdvisorCaseStatusLabel, type AdvisorCaseFilterValue, type AdvisorCaseStatusValue } from "@/lib/advisor/caseStatusOptions"
import AdvisorCaseStatusSelect from "./AdvisorCaseStatusSelect"
import AdvisorInsuranceForwardButton from "./AdvisorInsuranceForwardButton"

type ProductTab = "baufi" | "konsum" | "schufa_frei"

type OverviewCaseRow = {
  id: string
  case_ref: string | null
  advisor_case_ref: string | null
  advisor_status: AdvisorCaseStatusValue
  case_type: string
  customer_name?: string | null
  customer_phone?: string | null
  created_at: string
  insurance_routed_at?: string | null
  case_filter: AdvisorCaseFilterValue
  special_group_label: string | null
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d))
}

function statusLabel(value: string, product: ProductTab) {
  return getAdvisorCaseStatusLabel(value, product)
}

function specialGroupBadgeClass(value: AdvisorCaseFilterValue) {
  if (value === "lead") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  if (value === "temp_finanzanalyse") {
    return "border-cyan-200 bg-cyan-50 text-cyan-900"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

export default function AdvisorCasesOverviewTable({
  cases,
  product,
  productLabel,
  enableBulkReject,
}: {
  cases: OverviewCaseRow[]
  product: ProductTab
  productLabel: string
  enableBulkReject?: boolean
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const selectableCases = useMemo(
    () => (enableBulkReject ? cases.filter((row) => row.advisor_status !== "abgelehnt") : []),
    [cases, enableBulkReject]
  )
  const selectableIds = useMemo(() => selectableCases.map((row) => row.id), [selectableCases])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCases = useMemo(() => selectableCases.filter((row) => selectedSet.has(row.id)), [selectableCases, selectedSet])

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => selectableIds.includes(id)))
  }, [selectableIds])

  function setAllSelected(next: boolean) {
    if (!next) {
      setSelectedIds([])
      return
    }
    setSelectedIds(selectableIds)
  }

  function toggleCase(caseId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(caseId)) return current
        return [...current, caseId]
      }
      return current.filter((id) => id !== caseId)
    })
  }

  async function bulkRejectSelected() {
    if (!selectedCases.length || bulkBusy) return

    const confirmed = window.confirm(
      `${selectedCases.length} Fall/Fälle auf "Abgelehnt" setzen? Dabei werden pro Fall die Kundenbenachrichtigung, das Finanzanalyse-Angebot und das Versicherungsrouting ausgelöst.`
    )
    if (!confirmed) return

    setBulkBusy(true)
    setBulkMsg(null)
    setProgress({ done: 0, total: selectedCases.length })

    const failedIds = new Set<string>()
    const warnings: string[] = []
    let successCount = 0

    for (let index = 0; index < selectedCases.length; index += 1) {
      const currentCase = selectedCases[index]
      setProgress({ done: index, total: selectedCases.length })

      try {
        const res = await fetch("/api/app/cases/update-advisor-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ caseId: currentCase.id, advisorStatus: "abgelehnt" }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof json?.error === "string" && json.error ? json.error : "Speichern fehlgeschlagen")
        }

        successCount += 1
        if (typeof json?.warning === "string" && json.warning) {
          warnings.push(`${currentCase.case_ref ?? currentCase.id.slice(0, 8)}: ${json.warning}`)
        }
      } catch (error) {
        failedIds.add(currentCase.id)
        warnings.push(
          `${currentCase.case_ref ?? currentCase.id.slice(0, 8)}: ${error instanceof Error ? error.message : "Fehler"}`
        )
      }
    }

    setProgress({ done: selectedCases.length, total: selectedCases.length })
    setSelectedIds(Array.from(failedIds))

    if (!warnings.length) {
      setBulkMsg(`${successCount} Fall/Fälle wurden auf Abgelehnt gesetzt.`)
    } else if (successCount > 0) {
      setBulkMsg(
        `${successCount} Fall/Fälle wurden verarbeitet. Offene Hinweise: ${warnings.length}. ${warnings.slice(0, 2).join(" | ")}`
      )
    } else {
      setBulkMsg(`Keine Bulk-Änderung erfolgreich. ${warnings.slice(0, 2).join(" | ")}`)
    }

    router.refresh()
    setBulkBusy(false)
  }

  return (
    <div className="hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm lg:block">
      <div className="text-sm font-medium text-slate-900">Übersicht</div>
      {product === "schufa_frei" ? (
        <div className="mt-1 text-xs text-slate-500">
          Gruppe trennt offene Zweitformulare, bestätigte Finanzanalyse vor Zahlung und die reguläre Finanzanalyse nach
          Freischaltung. Der Select bleibt der eigentliche Bearbeitungsstatus.
        </div>
      ) : null}

      {enableBulkReject && selectableCases.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-900">Mehrfachauswahl für Ablehnung</div>
              <div className="mt-1 text-xs text-slate-500">
                Fälle im aktuellen Tab auswählen, einzelne wieder abwählen und gesammelt auf Abgelehnt setzen.
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-900">{selectedCases.length} ausgewählt</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAllSelected(true)}
              disabled={bulkBusy}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Alle im Tab auswählen
            </button>
            <button
              type="button"
              onClick={() => setAllSelected(false)}
              disabled={bulkBusy || selectedCases.length === 0}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              Auswahl leeren
            </button>
            <button
              type="button"
              onClick={bulkRejectSelected}
              disabled={bulkBusy || selectedCases.length === 0}
              className="rounded-xl border border-rose-300 bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkBusy ? "Bulk-Ablehnung läuft..." : "Auswahl auf Abgelehnt setzen"}
            </button>
          </div>

          {progress ? (
            <div className="mt-3 text-xs text-slate-500">
              Verarbeitung: {progress.done}/{progress.total}
            </div>
          ) : null}
          {bulkMsg ? <div className="mt-2 text-xs text-slate-600">{bulkMsg}</div> : null}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/80 backdrop-blur">
            <tr className="border-b border-slate-200/70">
              {enableBulkReject ? <th className="w-12 px-4 py-3 font-medium text-slate-700">Auswahl</th> : null}
              <th className="px-4 py-3 font-medium text-slate-700">Fall-ID</th>
              <th className="px-4 py-3 font-medium text-slate-700">Kunde</th>
              <th className="px-4 py-3 font-medium text-slate-700">Telefon</th>
              {product === "schufa_frei" ? <th className="px-4 py-3 font-medium text-slate-700">Gruppe</th> : null}
              <th className="px-4 py-3 font-medium text-slate-700">{product === "schufa_frei" ? "Versicherung" : "Vorgangsnummer"}</th>
              <th className="px-4 py-3 font-medium text-slate-700">{product === "schufa_frei" ? "Bearbeitung" : "Status"}</th>
            </tr>
          </thead>

          <tbody>
            {cases.map((c) => {
              const customerLabel = c.customer_name || "Kunde -"
              const customerPhone = String(c.customer_phone ?? "").trim() || "-"
              const isSelected = selectedSet.has(c.id)
              const canSelect = enableBulkReject && c.advisor_status !== "abgelehnt"

              return (
                <tr
                  key={c.id}
                  className={`border-b border-slate-200/60 last:border-0 hover:bg-slate-50/60 ${isSelected ? "bg-rose-50/50" : ""}`}
                >
                  {enableBulkReject ? (
                    <td className="px-4 py-3">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={bulkBusy}
                          onChange={(e) => toggleCase(c.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200"
                        />
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  ) : null}

                  <td className="px-4 py-3">
                    <Link href={`/advisor/faelle/${c.id}`} className="block">
                      <div className="font-medium text-slate-900">{c.case_ref || c.id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500">{dt(c.created_at)}</div>
                    </Link>
                  </td>

                  <td className="px-4 py-3 text-slate-700">{customerLabel}</td>

                  <td className="px-4 py-3 text-slate-700">{customerPhone}</td>

                  {product === "schufa_frei" ? (
                    <td className="px-4 py-3">
                      <div className="min-h-8">
                        {c.special_group_label ? (
                          <div
                            className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${specialGroupBadgeClass(c.case_filter)}`}
                          >
                            {c.special_group_label}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  ) : null}

                  <td className="px-4 py-3">
                    {product === "schufa_frei" ? (
                      <AdvisorInsuranceForwardButton caseId={c.id} initialRouted={Boolean(c.insurance_routed_at)} />
                    ) : (
                      c.advisor_case_ref || "-"
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <AdvisorCaseStatusSelect caseId={c.id} value={c.advisor_status} caseType={c.case_type} compact />
                    {!enableBulkReject ? null : (
                      <div className="mt-1 text-[10px] text-slate-400">{statusLabel(c.advisor_status, product)}</div>
                    )}
                  </td>
                </tr>
              )
            })}

            {cases.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-slate-500"
                  colSpan={product === "schufa_frei" ? (enableBulkReject ? 7 : 6) : enableBulkReject ? 6 : 5}
                >
                  Noch keine {productLabel}-Fälle in dieser Gruppe vorhanden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">Tipp: Klicken Sie auf einen Fall für Details.</div>
    </div>
  )
}
