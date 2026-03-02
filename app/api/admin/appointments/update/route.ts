// app/api/admin/appointments/update/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent } from "@/lib/notifications/notify"

export const runtime = "nodejs"

const ALLOWED_STATUS = ["booked", "cancelled"] as const
const ISO_WITH_TIME_RE = /^\d{4}-\d{2}-\d{2}T/
const ISO_WITH_ZONE_RE = /(Z|[+-]\d{2}:\d{2})$/i

function formatAppointmentForLog(value: string) {
  const raw = String(value ?? "").trim()
  const date =
    ISO_WITH_TIME_RE.test(raw) && !ISO_WITH_ZONE_RE.test(raw) ? new Date(`${raw}Z`) : new Date(raw)
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(date)
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const appointmentId = String(body?.appointmentId ?? "").trim()
    const status = String(body?.status ?? "").trim().toLowerCase()

    if (!appointmentId || !ALLOWED_STATUS.includes(status as any)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }

    const { data: appt } = await admin
      .from("case_appointments")
      .select("id,case_id,start_at")
      .eq("id", appointmentId)
      .maybeSingle()
    if (!appt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })

    const patch: any = { status }
    if (status === "cancelled") {
      patch.advisor_waiting_at = null
      patch.customer_waiting_at = null
    }

    const { error } = await admin.from("case_appointments").update(patch).eq("id", appointmentId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    if (status === "cancelled") {
      await logCaseEvent({
        caseId: appt.case_id,
        actorId: null,
        actorRole: "admin",
        type: "appointment_cancelled",
        title: "Termin abgesagt",
        body: `Termin am ${formatAppointmentForLog(appt.start_at)} wurde abgesagt.`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
