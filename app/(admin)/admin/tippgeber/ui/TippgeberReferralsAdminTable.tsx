"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

type AdvisorOption = { id: string; label: string }

type ReferralRow = {
  id: string
  status: string
  created_at: string
  updated_at: string
  tippgeber_user_id: string
  tippgeber_company_name: string
  tippgeber_logo_path: string | null
  tippgeber_email: string | null
  tippgeber_phone: string | null
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string
  expose_file_path: string | null
  manual_purchase_price: number | null
  manual_broker_commission_percent: number | null
  property_street: string | null
  property_house_number: string | null
  property_zip: string | null
  property_city: string | null
  assigned_advisor_id: string | null
  assigned_at: string | null
  linked_case_id: string | null
  linked_case_ref: string | null
  linked_case_status: string | null
  bank_outcome: string | null
  commission_status: string
  commission_gross_amount: number | null
  commission_net_amount: number | null
  payout_credit_note_path: string | null
  payout_released_at: string | null
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function dt(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function eur(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value))
}

function statusLabel(value: string | null | undefined) {
  const v = String(value ?? "").trim().toLowerCase()
  switch (v) {
    case "new":
      return "Neu"
    case "assigned":
      return "Berater zugewiesen"
    case "case_created":
      return "Fall erstellt"
    case "commission_open":
      return "Provision offen"
    case "paid":
      return "Ausgezahlt"
    default:
      return v || "-"
  }
}

function statusClass(referral: ReferralRow) {
  const commission = String(referral.commission_status ?? "").toLowerCase()
  if (commission === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (commission === "open") return "border-amber-200 bg-amber-50 text-amber-800"
  if (String(referral.status ?? "").toLowerCase() === "new") return "border-sky-200 bg-sky-50 text-sky-800"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function advisorLabel(advisorId: string | null | undefined, advisorOptions: AdvisorOption[]) {
  if (!advisorId) return "Nicht zugewiesen"
  return advisorOptions.find((a) => a.id === advisorId)?.label ?? advisorId
}

function tippgeberLogoUrl(path: string | null | undefined) {
  const clean = String(path ?? "").trim()
  if (!clean) return null
  return `/api/baufi/logo?bucket=tipgeber_logos&width=96&height=96&resize=contain&path=${encodeURIComponent(clean)}`
}

export type AdminTippgeberReferralRow = ReferralRow

export default function TippgeberReferralsAdminTable({
  referrals,
  advisorOptions,
}: {
  referrals: ReferralRow[]
  advisorOptions: AdvisorOption[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [assignValues, setAssignValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(referrals.map((r) => [r.id, r.assigned_advisor_id ?? ""]))
  )
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "new" | "open" | "paid">("all")

  const filteredReferrals = useMemo(() => {
    if (filter === "all") return referrals
    if (filter === "new") return referrals.filter((r) => String(r.status ?? "").toLowerCase() === "new")
    if (filter === "open") return referrals.filter((r) => String(r.commission_status ?? "").toLowerCase() === "open")
    if (filter === "paid") return referrals.filter((r) => String(r.commission_status ?? "").toLowerCase() === "paid")
    return referrals
  }, [filter, referrals])

  function setRowMessage(referralId: string, message: string) {
    setMessages((prev) => ({ ...prev, [referralId]: message }))
  }

  async function assignAdvisor(referralId: string) {
    const advisorId = String(assignValues[referralId] ?? "").trim()
    if (!advisorId) {
      setRowMessage(referralId, "Bitte Berater auswählen.")
      return
    }
    setBusyKey(`assign:${referralId}`)
    setRowMessage(referralId, "")
    try {
      const res = await fetch("/api/admin/tippgeber/referrals/assign-advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referralId, advisorId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Zuweisung fehlgeschlagen")
      setRowMessage(referralId, "Berater zugewiesen.")
      router.refresh()
    } catch (e: unknown) {
      setRowMessage(referralId, errorMessage(e, "Fehler"))
    } finally {
      setBusyKey(null)
    }
  }

  async function uploadCreditNote(referralId: string, file: File) {
    setBusyKey(`credit:${referralId}`)
    setRowMessage(referralId, "")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/admin/tippgeber/referrals/upload-credit-note?referralId=${encodeURIComponent(referralId)}`, {
        method: "POST",
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Upload fehlgeschlagen")
      setRowMessage(referralId, "Gutschrift hochgeladen und E-Mail versendet.")
      router.refresh()
    } catch (e: unknown) {
      setRowMessage(referralId, errorMessage(e, "Fehler"))
    } finally {
      setBusyKey(null)
    }
  }

  async function releasePayout(referralId: string) {
    setBusyKey(`pay:${referralId}`)
    setRowMessage(referralId, "")
    try {
      const res = await fetch("/api/admin/tippgeber/referrals/payout-release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referralId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Freigabe fehlgeschlagen")
      setRowMessage(referralId, json?.alreadyPaid ? "Bereits freigegeben." : "Auszahlung freigegeben.")
      router.refresh()
    } catch (e: unknown) {
      setRowMessage(referralId, errorMessage(e, "Fehler"))
    } finally {
      setBusyKey(null)
    }
  }

  const counts = {
    all: referrals.length,
    new: referrals.filter((r) => String(r.status ?? "").toLowerCase() === "new").length,
    open: referrals.filter((r) => String(r.commission_status ?? "").toLowerCase() === "open").length,
    paid: referrals.filter((r) => String(r.commission_status ?? "").toLowerCase() === "paid").length,
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tipps</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Eingereichte Empfehlungen</h2>
          <p className="mt-1 text-sm text-slate-600">
            Zuweisung an Berater, Fallanlage, Provisionsstatus, Gutschrift-Upload und Auszahlungsfreigabe.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `Alle (${counts.all})`],
              ["new", `Neu (${counts.new})`],
              ["open", `Provision offen (${counts.open})`],
              ["paid", `Ausgezahlt (${counts.paid})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                filter === key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-white">
            <tr className="border-b border-slate-200/70">
              <th className="px-4 py-3 font-medium text-slate-700">Tipp / Tippgeber</th>
              <th className="px-4 py-3 font-medium text-slate-700">Kunde / Objekt</th>
              <th className="px-4 py-3 font-medium text-slate-700">Zuweisung / Fall</th>
              <th className="px-4 py-3 font-medium text-slate-700">Provision</th>
              <th className="px-4 py-3 font-medium text-slate-700">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredReferrals.map((r) => {
              const customerName = `${r.customer_first_name} ${r.customer_last_name}`.trim()
              const propertyLine = [
                [r.property_street, r.property_house_number].filter(Boolean).join(" "),
                [r.property_zip, r.property_city].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(", ")
              const logoUrl = tippgeberLogoUrl(r.tippgeber_logo_path)
              const rowBusy = busyKey?.endsWith(r.id)
              const rowMessage = messages[r.id]
              const canRelease =
                String(r.commission_status ?? "").toLowerCase() === "open" && Boolean(r.payout_credit_note_path)

              return (
                <tr key={r.id} className="border-b border-slate-200/60 align-top last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-[10px] text-slate-400">Logo</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{r.tippgeber_company_name}</div>
                        <div className="text-xs text-slate-600">Tipp-ID: {r.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">Eingang: {dt(r.created_at)}</div>
                        {r.tippgeber_email ? <div className="text-xs text-slate-500">{r.tippgeber_email}</div> : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{customerName}</div>
                    <div className="text-xs text-slate-600">{r.customer_email}</div>
                    <div className="text-xs text-slate-600">{r.customer_phone}</div>
                    {propertyLine ? <div className="mt-1 text-xs text-slate-500">{propertyLine}</div> : null}
                    {r.manual_purchase_price != null ? (
                      <div className="text-xs text-slate-500">
                        Kaufpreis: {eur(r.manual_purchase_price)} · Maklerprov.: {Number(r.manual_broker_commission_percent ?? 0).toFixed(2)} %
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(r)}`}>
                        {statusLabel(r.status)}
                      </span>
                      {r.bank_outcome ? (
                        <span className="ml-2 text-xs text-slate-600">
                          Bank: {r.bank_outcome === "approved" ? "Angenommen" : "Abgelehnt"}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-500">Berater</div>
                    <div className="text-sm text-slate-900">{advisorLabel(r.assigned_advisor_id, advisorOptions)}</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <select
                        value={assignValues[r.id] ?? ""}
                        onChange={(e) => setAssignValues((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-slate-900"
                      >
                        <option value="">Berater wählen...</option>
                        {advisorOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void assignAdvisor(r.id)}
                        disabled={rowBusy}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {r.linked_case_id ? "Berater/Fall aktualisieren" : "Berater zuweisen + Fall anlegen"}
                      </button>
                    </div>

                    {r.linked_case_id ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <div>
                          Fall:{" "}
                          <Link href={`/admin/faelle/${r.linked_case_id}`} className="font-semibold text-slate-900 underline underline-offset-4">
                            {r.linked_case_ref || r.linked_case_id.slice(0, 8)}
                          </Link>
                        </div>
                        {r.linked_case_status ? <div>Status: {r.linked_case_status}</div> : null}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{eur(r.commission_gross_amount)}</div>
                    <div className="text-xs text-slate-600">Netto: {eur(r.commission_net_amount)}</div>
                    <div className="text-xs text-slate-600">
                      Provisionsstatus: {r.commission_status === "paid" ? "Bezahlt" : r.commission_status === "open" ? "Offen" : "Keine"}
                    </div>
                    {r.payout_released_at ? <div className="mt-1 text-xs text-emerald-700">Freigegeben: {dt(r.payout_released_at)}</div> : null}
                  </td>

                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      {r.expose_file_path ? (
                        <a
                          href={`/api/tippgeber/files?referralId=${encodeURIComponent(r.id)}&kind=expose&download=1`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-300"
                        >
                          Exposé herunterladen
                        </a>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Kein Exposé
                        </div>
                      )}

                      <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-300">
                        Gutschrift hochladen
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          disabled={rowBusy}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void uploadCreditNote(r.id, file)
                            e.currentTarget.value = ""
                          }}
                        />
                      </label>

                      {r.payout_credit_note_path ? (
                        <a
                          href={`/api/tippgeber/files?referralId=${encodeURIComponent(r.id)}&kind=credit_note&download=1`}
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm hover:border-emerald-300"
                        >
                          Gutschrift öffnen
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void releasePayout(r.id)}
                        disabled={!canRelease || rowBusy}
                        className={cn(
                          "rounded-lg px-3 py-2 text-xs font-semibold shadow-sm",
                          canRelease && !rowBusy
                            ? "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        )}
                      >
                        Auszahlung freigeben
                      </button>

                      {rowMessage ? <div className="text-xs text-slate-600">{rowMessage}</div> : null}
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredReferrals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Keine Tipps im aktuellen Filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
