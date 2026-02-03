"use client"

import { useEffect, useId, useMemo, useState } from "react"

type Item = {
  id: string
  case_id?: string | null
  case_ref?: string | null
  counterpart_name?: string | null
  title: string
  body: string
  created_at: string
}

type NotificationResponse = {
  items?: Item[]
  total?: number
  totalPages?: number
  customerOptions?: Array<{ id: string; label: string }>
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(d))
}

export default function NotificationLog({
  limit = 10,
  title = "Benachrichtigungen",
  scope = "inbox",
  types = [],
  excludeTypes = [],
  enableCustomerFilter = false,
}: {
  limit?: number
  title?: string
  scope?: "inbox" | "all"
  types?: string[]
  excludeTypes?: string[]
  enableCustomerFilter?: boolean
}) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string }>>([])
  const [customerId, setCustomerId] = useState("all")
  const customerFilterId = useId()

  const typesKey = useMemo(() => types.join(","), [types])
  const excludeTypesKey = useMemo(() => excludeTypes.join(","), [excludeTypes])

  useEffect(() => {
    setPage(1)
  }, [limit, scope, typesKey, excludeTypesKey, customerId])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          page: String(page),
          scope,
        })
        if (enableCustomerFilter && customerId !== "all") params.set("customerId", customerId)
        if (typesKey) params.set("types", typesKey)
        if (excludeTypesKey) params.set("excludeTypes", excludeTypesKey)

        const res = await fetch(`/api/app/notifications?${params.toString()}`)
        const json = (await res.json().catch(() => ({}))) as NotificationResponse & { error?: string }

        if (!res.ok) {
          if (json?.error === "notification_table_missing") {
            setError("DB-Tabelle fehlt: Bitte db/notifications.sql in Supabase ausfuehren.")
          } else {
            setError("Benachrichtigungen konnten nicht geladen werden.")
          }
          setItems([])
          setTotal(0)
          setTotalPages(1)
          setCustomerOptions([])
          return
        }

        const nextItems = Array.isArray(json.items) ? json.items : []
        const nextTotal = Number.isFinite(Number(json.total)) ? Number(json.total) : nextItems.length
        const nextTotalPages = Math.max(
          1,
          Number.isFinite(Number(json.totalPages)) ? Number(json.totalPages) : Math.ceil(nextTotal / Math.max(1, limit))
        )

        if (cancelled) return

        setItems(nextItems)
        setTotal(nextTotal)
        setTotalPages(nextTotalPages)
        const nextCustomerOptions = Array.isArray(json.customerOptions) ? json.customerOptions : []
        setCustomerOptions(nextCustomerOptions)
        if (
          enableCustomerFilter &&
          customerId !== "all" &&
          !nextCustomerOptions.some((option) => option.id === customerId)
        ) {
          setCustomerId("all")
        }

        if (page > nextTotalPages) {
          setPage(nextTotalPages)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [limit, scope, typesKey, excludeTypesKey, page, enableCustomerFilter, customerId])

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">{title}</div>
        {!loading ? <div className="text-xs text-slate-500">{total} Eintraege</div> : null}
      </div>
      {enableCustomerFilter ? (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={customerFilterId} className="text-xs text-slate-600">
            Kunde
          </label>
          <select
            id={customerFilterId}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            <option value="all">Alle</option>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 text-sm text-slate-500">Lade...</div>
      ) : error ? (
        <div className="mt-3 text-sm text-rose-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-sm text-slate-500">Noch keine Benachrichtigungen vorhanden.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">{dt(item.created_at)}</div>
              {item.counterpart_name || item.case_ref ? (
                <div className="mt-1 text-[11px] text-slate-500">
                  {item.counterpart_name ? `Kontakt: ${item.counterpart_name}` : null}
                  {item.counterpart_name && item.case_ref ? " | " : ""}
                  {item.case_ref ? `Fall ${item.case_ref}` : ""}
                </div>
              ) : null}
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs text-slate-600">{item.body}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zurueck
          </button>
          <div className="text-xs text-slate-600">
            Seite {page} von {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      ) : null}
    </div>
  )
}
