export type AvailabilityDay = {
  day_of_week: number
  is_active: boolean
  start_time?: string | null
  end_time?: string | null
  break_start_time?: string | null
  break_end_time?: string | null
}

export type AppointmentLike = {
  start_at: string
  end_at: string
  status?: string | null
}

export type Slot = {
  start: Date
  end: Date
  label: string
}

function parseTime(timeStr: string | null | undefined) {
  if (!timeStr) return null
  const parts = String(timeStr).split(":")
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m }
}

export function timeToDate(base: Date, timeStr?: string | null) {
  const t = parseTime(timeStr)
  if (!t) return null
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), t.h, t.m, 0, 0)
}

export function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d)
}

export function formatTime(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { timeStyle: "short" }).format(d)
}

export function buildSlots(opts: {
  date: Date
  availability: AvailabilityDay | null
  appointments: AppointmentLike[]
  now?: Date
}) {
  const { date, availability, appointments, now = new Date() } = opts
  if (!availability || !availability.is_active) return [] as Slot[]

  const start = timeToDate(date, availability.start_time ?? null)
  const end = timeToDate(date, availability.end_time ?? null)
  if (!start || !end || end <= start) return [] as Slot[]

  const breakStart = timeToDate(date, availability.break_start_time ?? null)
  const breakEnd = timeToDate(date, availability.break_end_time ?? null)

  const appts = appointments
    .filter((a) => a?.status !== "cancelled")
    .map((a) => ({
      start: new Date(a.start_at),
      end: new Date(a.end_at),
    }))

  const slots: Slot[] = []
  const cursor = new Date(start)
  while (cursor < end) {
    const slotStart = new Date(cursor)
    const slotEnd = new Date(cursor.getTime() + 30 * 60000)
    if (slotEnd > end) break

    const inBreak =
      breakStart && breakEnd ? slotStart < breakEnd && slotEnd > breakStart : false

    const conflicts = appts.some((a) => slotStart < a.end && slotEnd > a.start)

    if (!inBreak && !conflicts && slotEnd > now) {
      slots.push({
        start: slotStart,
        end: slotEnd,
        label: `${formatTime(slotStart)} – ${formatTime(slotEnd)}`,
      })
    }

    cursor.setTime(cursor.getTime() + 30 * 60000)
  }

  return slots
}

export function toDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
