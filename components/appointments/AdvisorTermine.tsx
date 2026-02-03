"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  buildSlots,
  formatDate,
  formatTime,
  isSameDay,
  toDateInputValue,
  type AppointmentLike,
  type AvailabilityDay,
} from "@/components/appointments/utils"

const REASONS = [
  "Erstberatung Baufinanzierung",
  "Finanzierungsangebot besprechen",
  "Unterlagen & Nachweise",
  "Zinsbindung / Konditionen",
  "Nächste Schritte & Abschluss",
]

const DAYS = [
  { day: 1, label: "Montag" },
  { day: 2, label: "Dienstag" },
  { day: 3, label: "Mittwoch" },
  { day: 4, label: "Donnerstag" },
  { day: 5, label: "Freitag" },
  { day: 6, label: "Samstag" },
  { day: 0, label: "Sonntag" },
]

type AppointmentItem = {
  id: string
  case_id: string
  case_ref?: string | null
  customer_name?: string | null
  start_at: string
  end_at: string
  reason?: string | null
  status?: string | null
  advisor_waiting_at?: string | null
  customer_waiting_at?: string | null
}

type CustomerItem = {
  case_id: string
  case_ref?: string | null
  customer_id: string
  customer_name?: string | null
}

type AvailabilityApiRow = {
  day_of_week?: number | string | null
  is_active?: boolean | null
  start_time?: string | null
  end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
}

export default function AdvisorTermine() {
  const router = useRouter()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [selectedCase, setSelectedCase] = useState("")
  const [reason, setReason] = useState(REASONS[0])
  const [busy, setBusy] = useState(false)
  const [startBusyId, setStartBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadAvailability = useCallback(async () => {
    const res = await fetch("/api/app/appointments/availability")
    const json = await res.json().catch(() => ({}))
    const rows: AvailabilityApiRow[] = Array.isArray(json.availability) ? json.availability : []
    const normalized = DAYS.map((d) => {
      const row = rows.find((r) => Number(r.day_of_week) === d.day)
      return {
        day_of_week: d.day,
        is_active: row?.is_active ?? false,
        start_time: row?.start_time ?? "09:00",
        end_time: row?.end_time ?? "17:00",
        break_start_time: row?.break_start_time ?? null,
        break_end_time: row?.break_end_time ?? null,
      }
    })
    setAvailability(normalized)
  }, [])

  const loadAppointments = useCallback(async () => {
    const res = await fetch("/api/app/appointments?upcoming=1&limit=200")
    const json = await res.json().catch(() => ({}))
    if (res.ok) setAppointments(Array.isArray(json.items) ? json.items : [])
  }, [])

  const loadCustomers = useCallback(async () => {
    const res = await fetch("/api/app/appointments/customers")
    const json = await res.json().catch(() => ({}))
    if (res.ok) setCustomers(Array.isArray(json.items) ? json.items : [])
  }, [])

  useEffect(() => {
    void Promise.all([loadAvailability(), loadAppointments(), loadCustomers()])
  }, [loadAvailability, loadAppointments, loadCustomers])

  useEffect(() => {
    const channel = supabase
      .channel("case_appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "case_appointments" }, () => {
        void loadAppointments()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadAppointments])

  const dateObj = new Date(`${selectedDate}T00:00:00`)
  const availabilityForDay = availability.find((d) => d.day_of_week === dateObj.getDay()) ?? null

  const slots = buildSlots({
    date: dateObj,
    availability: availabilityForDay,
    appointments: appointments as AppointmentLike[],
  })

  const today = new Date()
  const todayAppointments = appointments.filter((a) => isSameDay(new Date(a.start_at), today))
  const waitingToday = todayAppointments.filter((a) => !!a.customer_waiting_at && a.status !== "cancelled").length
  const upcomingCount = appointments.filter((a) => a.status !== "cancelled").length
  const selectedCustomer = customers.find((c) => c.case_id === selectedCase) ?? null
  const isErrorMsg = !!msg && /(fehlgeschlagen|bitte|vergeben)/i.test(msg)

  async function saveAvailability() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/appointments/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          days: availability.map((d) => ({
            day: d.day_of_week,
            is_active: d.is_active,
            start_time: d.start_time,
            end_time: d.end_time,
            break_start_time: d.break_start_time,
            break_end_time: d.break_end_time,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(json?.error === "invalid_break" ? "Pause darf maximal 60 Minuten dauern." : "Speichern fehlgeschlagen.")
      } else {
        setMsg("Verfügbarkeit gespeichert.")
      }
    } finally {
      setSaving(false)
    }
  }

  async function book() {
    if (!selectedSlot || !selectedCase) {
      setMsg("Bitte Slot und Kundenfall wählen.")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/appointments/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase,
          startAt: selectedSlot.start.toISOString(),
          endAt: selectedSlot.end.toISOString(),
          reason,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(json?.error === "slot_taken" ? "Slot ist bereits vergeben." : "Buchung fehlgeschlagen.")
        return
      }
      setSelectedSlot(null)
      setMsg("Termin erfolgreich gebucht.")
      await loadAppointments()
    } finally {
      setBusy(false)
    }
  }

  async function startLive(appointmentId: string) {
    if (startBusyId) return
    setStartBusyId(appointmentId)
    try {
      const res = await fetch("/api/app/appointments/live/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error === "busy" ? "Du bist bereits in einem Live-Gespräch." : "Live-Start fehlgeschlagen.")
        return
      }
      if (json?.ticket?.id) {
        router.push(`/live/${json.ticket.id}`)
        return
      }
      await loadAppointments()
    } finally {
      setStartBusyId(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-[0_24px_64px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-4 h-44 w-44 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/80">Termine</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Verfügbarkeit & Planung</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
              Planen Sie freie Slots, buchen Sie Termine und starten Sie Live-Sitzungen direkt aus einer Oberfläche.
            </p>
          </div>
          <button
            onClick={saveAvailability}
            disabled={saving}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Speichere..." : "Verfügbarkeit speichern"}
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-200/80">Anstehend</div>
            <div className="mt-1 text-2xl font-semibold">{upcomingCount}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-200/80">Heute</div>
            <div className="mt-1 text-2xl font-semibold">{todayAppointments.length}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-200/80">Warten im Raum</div>
            <div className="mt-1 text-2xl font-semibold">{waitingToday}</div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Wochenplan</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Verfügbare Zeiten</div>
          <div className="mt-1 text-sm text-slate-600">30-Minuten-Slots, optional eine Pause (max. 60 Minuten).</div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {DAYS.map((d) => {
            const row = availability.find((r) => r.day_of_week === d.day)
            const isActive = row?.is_active ?? false

            return (
              <div key={d.day} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">{d.label}</div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((p) => (p.day_of_week === d.day ? { ...p, is_active: e.target.checked } : p))
                        )
                      }
                      className="h-4 w-4"
                    />
                    Aktiv
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <label>
                    Von
                    <input
                      type="time"
                      value={row?.start_time ?? ""}
                      disabled={!isActive}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((p) => (p.day_of_week === d.day ? { ...p, start_time: e.target.value } : p))
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                  <label>
                    Bis
                    <input
                      type="time"
                      value={row?.end_time ?? ""}
                      disabled={!isActive}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((p) => (p.day_of_week === d.day ? { ...p, end_time: e.target.value } : p))
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                  <label>
                    Pause von
                    <input
                      type="time"
                      value={row?.break_start_time ?? ""}
                      disabled={!isActive}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((p) =>
                            p.day_of_week === d.day ? { ...p, break_start_time: e.target.value || null } : p
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                  <label>
                    Pause bis
                    <input
                      type="time"
                      value={row?.break_end_time ?? ""}
                      disabled={!isActive}
                      onChange={(e) =>
                        setAvailability((prev) =>
                          prev.map((p) =>
                            p.day_of_week === d.day ? { ...p, break_end_time: e.target.value || null } : p
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Buchung</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Termin manuell eintragen</div>
          <div className="mt-1 text-sm text-slate-600">Wählen Sie Datum, Slot, Kundenfall und Grund aus.</div>

          <div className="mt-4 space-y-4">
            <label className="block text-xs text-slate-600">
              Datum
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:max-w-[220px]"
              />
            </label>

            {!availabilityForDay?.is_active ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                An diesem Tag sind keine Termine verfügbar.
              </div>
            ) : slots.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Keine freien Slots verfügbar.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s.start.toISOString()}
                    type="button"
                    onClick={() => setSelectedSlot({ start: s.start, end: s.end })}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      selectedSlot?.start.getTime() === s.start.getTime()
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                Kundenfall
                <select
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                >
                  <option value="">Bitte wählen</option>
                  {customers.map((c) => (
                    <option key={c.case_id} value={c.case_id}>
                      {(c.customer_name || "Kunde") + " - " + (c.case_ref || c.case_id.slice(0, 8))}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Grund
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={book}
              disabled={busy}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Buche..." : "Termin buchen"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Auswahl</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">Aktueller Slot</div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
            {selectedSlot ? (
              <>
                <div className="font-semibold text-slate-900">{formatDate(selectedSlot.start)}</div>
                <div className="mt-1">
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                </div>
              </>
            ) : (
              "Noch kein Slot ausgewählt."
            )}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
            {selectedCustomer ? (
              <>
                <div className="font-semibold text-slate-900">{selectedCustomer.customer_name || "Kunde"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Fall {selectedCustomer.case_ref || selectedCustomer.case_id.slice(0, 8)}
                </div>
              </>
            ) : (
              "Noch kein Kundenfall ausgewählt."
            )}
          </div>

          {msg ? (
            <div
              className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${
                isErrorMsg
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {msg}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Kalender</div>
        <div className="text-lg font-semibold text-slate-900">Nächste Termine</div>
        {appointments.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">Noch keine Termine gebucht.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {appointments.map((a) => {
              const start = new Date(a.start_at)
              const end = new Date(a.end_at)
              const isToday = isSameDay(start, new Date())
              const customerWaits = !!a.customer_waiting_at
              const isCancelled = a.status === "cancelled"

              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {(a.customer_name || "Kunde") + " - " + (a.case_ref || a.case_id.slice(0, 8))}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>
                      {formatDate(start)} | {formatTime(start)} - {formatTime(end)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        isCancelled
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isCancelled ? "Abgesagt" : "Geplant"}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">{a.reason || "Termin"}</div>

                  {isToday && customerWaits ? (
                    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Kunde wartet bereits im Warteraum.
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isToday ? (
                      <button
                        type="button"
                        onClick={() => startLive(a.id)}
                        disabled={startBusyId === a.id || isCancelled}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCancelled ? "Abgesagt" : startBusyId === a.id ? "Starte..." : "Live starten"}
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-500">Live-Start am Termin-Tag verfügbar.</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
