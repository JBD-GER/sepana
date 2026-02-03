"use client"

import { useEffect, useMemo, useState } from "react"
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
  "Naechste Schritte & Abschluss",
]

type AppointmentItem = {
  id: string
  start_at: string
  end_at: string
  reason?: string | null
  status?: string | null
}

export default function CaseAppointmentPanel({ caseId }: { caseId: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [advisorName, setAdvisorName] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [reason, setReason] = useState(REASONS[0])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    setMsg(null)
    try {
      const [aRes, pRes] = await Promise.all([
        fetch(`/api/app/appointments/availability?caseId=${encodeURIComponent(caseId)}`),
        fetch(`/api/app/appointments?caseId=${encodeURIComponent(caseId)}`),
      ])
      const aJson = await aRes.json().catch(() => ({}))
      const pJson = await pRes.json().catch(() => ({}))
      if (aRes.ok) {
        setAvailability(Array.isArray(aJson.availability) ? aJson.availability : [])
        setAdvisorName(aJson?.advisor?.display_name ?? null)
      }
      if (pRes.ok) {
        setAppointments(Array.isArray(pJson.items) ? pJson.items : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!caseId) return
    loadAll()
  }, [caseId])

  useEffect(() => {
    if (!caseId) return
    const channel = supabase
      .channel(`case_appointments_${caseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_appointments", filter: `case_id=eq.${caseId}` }, () => {
        loadAll()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, caseId])

  const dateObj = new Date(`${selectedDate}T00:00:00`)
  const availabilityForDay = availability.find((d) => d.day_of_week === dateObj.getDay()) ?? null

  const slots = buildSlots({
    date: dateObj,
    availability: availabilityForDay,
    appointments: appointments as AppointmentLike[],
  })

  async function book() {
    if (!selectedSlot) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/app/appointments/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          startAt: selectedSlot.start.toISOString(),
          endAt: selectedSlot.end.toISOString(),
          reason,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(json?.error === "slot_taken" ? "Der Slot ist leider schon vergeben." : "Buchung fehlgeschlagen.")
        return
      }
      setSelectedSlot(null)
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Termin buchen</div>
          <div className="mt-1 text-xs text-slate-600">
            {advisorName ? `Berater: ${advisorName}` : "Berater wird geladen..."}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-500">Lade Verfuegbarkeiten...</div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-xs text-slate-600">
              Datum
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:w-[220px]"
              />
            </label>
            <div className="text-xs text-slate-500">
              Slots: {slots.length}
            </div>
          </div>

          {!availabilityForDay?.is_active ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              An diesem Tag sind keine Termine verfuegbar.
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Keine freien Slots verfuegbar.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.start.toISOString()}
                  type="button"
                  onClick={() => setSelectedSlot({ start: s.start, end: s.end })}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedSlot?.start.getTime() === s.start.getTime()
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {selectedSlot ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Ausgewaehlter Slot</div>
              <div className="mt-1 text-xs text-slate-600">
                {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
              </div>
              <label className="mt-3 block text-xs text-slate-600">
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
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={book}
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {busy ? "Bucht..." : "Termin buchen"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  Abbrechen
                </button>
              </div>
              {msg ? <div className="mt-2 text-xs text-rose-600">{msg}</div> : null}
            </div>
          ) : null}

          {appointments.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Deine Termine</div>
              <div className="mt-2 space-y-2 text-xs text-slate-700">
                {appointments.map((a) => {
                  const start = new Date(a.start_at)
                  const end = new Date(a.end_at)
                  const isToday = isSameDay(start, new Date())
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div>
                        {formatDate(start)} · {formatTime(start)} – {formatTime(end)}
                      </div>
                      <div className="text-[11px] text-slate-500">{a.reason || "Termin"}</div>
                      {isToday ? (
                        <div className="mt-1 text-[11px] text-emerald-600">Heute</div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
