import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"

export const runtime = "nodejs"

const DEFAULT_ALERT_RECIPIENT = "c.pfad@flaaq.com"

function parseAlertRecipients() {
  const input = String(process.env.LIVE_QUEUE_ALERT_TO ?? "").trim()
  const raw = input || DEFAULT_ALERT_RECIPIENT
  const unique = new Set(
    raw
      .split(/[;,\s]+/g)
      .map((x) => x.trim().replace(/^["'<]+|[>"']+$/g, ""))
      .filter((x) => x.includes("@"))
  )
  return Array.from(unique)
}

function normalizeSiteUrl(raw: string | undefined) {
  const fallback = "https://www.sepana.de"
  const input = String(raw ?? "").trim()
  if (!input) return fallback
  try {
    return new URL(input).origin
  } catch {
    return fallback
  }
}

function caseTypeLabel(value: string | null | undefined) {
  const v = String(value ?? "").toLowerCase()
  if (v === "baufi") return "Baufinanzierung"
  if (v === "konsum") return "Privatkredit"
  return value || "-"
}

function baufiPurposeLabel(value: string | null | undefined) {
  const v = String(value ?? "").toLowerCase()
  if (v === "buy") return "Kauf Immobilie / Grundstueck"
  if (v === "build") return "Eigenes Bauvorhaben"
  if (v === "refi") return "Anschlussfinanzierung / Umschuldung"
  if (v === "modernize") return "Umbau / Modernisierung"
  if (v === "equity_release") return "Kapitalbeschaffung"
  return value || "-"
}

function esc(value: unknown) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function sendQueueAlert(opts: {
  caseId: string
  caseRef: string | null
  caseType: string | null
  customerId: string | null
  ticketId: string
  waitMinutes: number
  onlineCount: number
  availableCount: number
}) {
  const recipients = parseAlertRecipients()
  if (!recipients.length) return { ok: false as const, error: "missing_recipients" as const }

  const admin = supabaseAdmin()
  const [primaryRes, baufiRes, customerAuthRes] = await Promise.all([
    admin
      .from("case_applicants")
      .select("first_name,last_name,email,phone")
      .eq("case_id", opts.caseId)
      .eq("role", "primary")
      .maybeSingle(),
    admin
      .from("case_baufi_details")
      .select("purpose")
      .eq("case_id", opts.caseId)
      .maybeSingle(),
    opts.customerId ? admin.auth.admin.getUserById(opts.customerId) : Promise.resolve({ data: { user: null as any } }),
  ])

  const primary = primaryRes.data
  const customerAuthEmail = customerAuthRes?.data?.user?.email ?? null
  const customerEmail = primary?.email ?? customerAuthEmail ?? "-"
  const customerName = [primary?.first_name, primary?.last_name].filter(Boolean).join(" ").trim() || "-"
  const financingType = caseTypeLabel(opts.caseType)
  const purpose = baufiPurposeLabel(baufiRes?.data?.purpose)
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const advisorUrl = `${siteUrl}/advisor`

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <div style="font-size:13px; line-height:22px; color:#334155;">
            <div><strong style="color:#0f172a;">Fall:</strong> ${esc(opts.caseRef || opts.caseId)}</div>
            <div><strong style="color:#0f172a;">Finanzierungsart:</strong> ${esc(financingType)}</div>
            <div><strong style="color:#0f172a;">Zweck:</strong> ${esc(purpose)}</div>
            <div><strong style="color:#0f172a;">Kunde:</strong> ${esc(customerName)}</div>
            <div><strong style="color:#0f172a;">E-Mail:</strong> ${esc(customerEmail)}</div>
            <div><strong style="color:#0f172a;">Telefon:</strong> ${esc(primary?.phone || "-")}</div>
            <div><strong style="color:#0f172a;">Ticket-ID:</strong> ${esc(opts.ticketId)}</div>
            <div><strong style="color:#0f172a;">Wartezeit (ca.):</strong> ${esc(opts.waitMinutes)} Minuten</div>
            <div><strong style="color:#0f172a;">Berater online/verfuegbar:</strong> ${esc(opts.onlineCount)}/${esc(opts.availableCount)}</div>
          </div>
        </td>
      </tr>
    </table>
  `

  const html = buildEmailHtml({
    title: "Neuer Kunde im Live-Wartebereich",
    intro: "Es wartet ein neuer Kunde in der Live-Warteschlange. Bitte zeitnah uebernehmen.",
    bodyHtml,
    ctaLabel: "Zum Advisor Dashboard",
    ctaUrl: advisorUrl,
    preheader: "Neuer Kunde wartet in der Live-Warteschlange.",
    eyebrow: "SEPANA - Live Queue Alert",
  })

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Live-Warteschlange: Neuer Kunde ${opts.caseRef ? `(${opts.caseRef})` : ""}`.trim(),
        html,
      })
    )
  )

  const successCount = results.filter((r: any) => r?.ok).length
  return {
    ok: successCount > 0,
    successCount,
    attempted: recipients.length,
    results,
  }
}

export async function POST(req: Request) {
  const { user, role } = await getUserAndRole()

  const body = await req.json().catch(() => null)
  const caseId = String(body?.caseId ?? "").trim()
  const forceGuest = body?.guest === true
  if (!caseId) return NextResponse.json({ ok: false, error: "missing_case" }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: caseRow } = await admin
    .from("cases")
    .select("id,case_ref,customer_id,case_type")
    .eq("id", caseId)
    .maybeSingle()
  if (!caseRow) {
    return NextResponse.json({ ok: false, error: "case_not_found" }, { status: 404 })
  }

  let customerId: string | null = caseRow.customer_id ?? null
  let guestToken: string | null = null

  if (user && !forceGuest) {
    if (role !== "customer") {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    if (caseRow.customer_id !== user.id) {
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })
    }
    customerId = user.id
  } else {
    guestToken = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`
  }

  const { data: existingList } = await admin
    .from("live_queue_tickets")
    .select("id,status,created_at,room_name,guest_token")
    .eq("case_id", caseId)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false })

  const list = Array.isArray(existingList) ? existingList : []
  const activeTicket = list.find((t: any) => t.status === "active") ?? null
  const waitingTickets = list.filter((t: any) => t.status === "waiting")

  const { data: online } = await admin.from("advisor_profiles").select("user_id").eq("is_online", true)
  const onlineIds = (online ?? []).map((x: any) => x.user_id).filter(Boolean)
  const onlineCount = onlineIds.length
  const { data: active } = await admin.from("live_queue_tickets").select("advisor_id").eq("status", "active")
  const busy = new Set((active ?? []).map((x: any) => x.advisor_id).filter(Boolean))
  const availableCount = onlineIds.filter((id) => !busy.has(id)).length
  const waitMinutes = onlineCount > 0 && availableCount === 0 ? 15 : 0

  if (activeTicket) {
    const dropIds = waitingTickets.map((x: any) => x.id).filter(Boolean)
    if (dropIds.length) {
      await admin
        .from("live_queue_tickets")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .in("id", dropIds)
    }
    let tokenToReturn = activeTicket.guest_token ?? null
    if (!user && !tokenToReturn) {
      tokenToReturn = guestToken
      await admin.from("live_queue_tickets").update({ guest_token: tokenToReturn }).eq("id", activeTicket.id)
    }
    return NextResponse.json({
      ok: true,
      ticket: activeTicket,
      guestToken: tokenToReturn,
      waitMinutes,
      onlineCount,
      availableCount,
    })
  }

  if (waitingTickets.length) {
    const keep = waitingTickets[0]
    const dropIds = waitingTickets.slice(1).map((x: any) => x.id).filter(Boolean)
    if (dropIds.length) {
      await admin
        .from("live_queue_tickets")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .in("id", dropIds)
    }
    let tokenToReturn = keep.guest_token ?? null
    if (!user && !tokenToReturn) {
      tokenToReturn = guestToken
      await admin.from("live_queue_tickets").update({ guest_token: tokenToReturn }).eq("id", keep.id)
    }

    return NextResponse.json({
      ok: true,
      ticket: keep,
      guestToken: tokenToReturn,
      waitMinutes,
      onlineCount,
      availableCount,
    })
  }

  const { data: created, error } = await admin
    .from("live_queue_tickets")
    .insert({
      case_id: caseId,
      customer_id: customerId,
      status: "waiting",
      ...(guestToken ? { guest_token: guestToken } : {}),
    })
    .select("id,status,created_at,room_name,guest_token")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let effectiveTicket = created
  let shouldSendAlert = true

  const { data: waitingNow } = await admin
    .from("live_queue_tickets")
    .select("id,status,created_at,room_name,guest_token")
    .eq("case_id", caseId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })

  const waitingList = Array.isArray(waitingNow) ? waitingNow : []
  if (waitingList.length > 1) {
    const keep = waitingList[0]
    const dropIds = waitingList.slice(1).map((x: any) => x.id).filter(Boolean)
    if (dropIds.length) {
      await admin
        .from("live_queue_tickets")
        .update({ status: "cancelled", ended_at: new Date().toISOString() })
        .in("id", dropIds)
    }
    effectiveTicket = keep
    shouldSendAlert = keep.id === created.id
  }

  let tokenToReturn = effectiveTicket?.guest_token ?? guestToken
  if (!user && !tokenToReturn && effectiveTicket?.id) {
    tokenToReturn = guestToken
    await admin.from("live_queue_tickets").update({ guest_token: tokenToReturn }).eq("id", effectiveTicket.id)
  }

  if (shouldSendAlert) {
    try {
      const alert = await sendQueueAlert({
        caseId,
        caseRef: caseRow.case_ref ?? null,
        caseType: caseRow.case_type ?? null,
        customerId,
        ticketId: effectiveTicket.id,
        waitMinutes,
        onlineCount,
        availableCount,
      })
      if (!alert?.ok) {
        console.warn("[live-queue-alert] no mail sent for new waiting ticket", alert)
      }
    } catch (mailError) {
      console.error("[live-queue-alert] failed", mailError)
    }
  }

  return NextResponse.json({
    ok: true,
    ticket: effectiveTicket,
    guestToken: tokenToReturn,
    waitMinutes,
    onlineCount,
    availableCount,
  })
}
