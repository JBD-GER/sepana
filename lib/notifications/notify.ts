import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type NotificationInput = {
  recipient_id: string
  recipient_role: string
  actor_id?: string | null
  actor_role?: string | null
  case_id?: string | null
  type: string
  title: string
  body: string
  meta?: any
}

type CaseMeta = {
  case_id: string
  case_ref: string | null
  customer_id: string | null
  advisor_id: string | null
  customer_name: string | null
  advisor_name: string | null
  customer_email: string | null
  advisor_email: string | null
}

function buildName(row: any) {
  const first = String(row?.first_name || "").trim()
  const last = String(row?.last_name || "").trim()
  const full = `${first} ${last}`.trim()
  return full || null
}

export async function getCaseMeta(caseId: string): Promise<CaseMeta | null> {
  const admin = supabaseAdmin()
  const { data: c } = await admin
    .from("cases")
    .select("id,case_ref,customer_id,assigned_advisor_id")
    .eq("id", caseId)
    .maybeSingle()
  if (!c) return null

  const [{ data: applicant }, { data: advisorProfile }] = await Promise.all([
    admin.from("case_applicants").select("first_name,last_name").eq("case_id", caseId).eq("role", "primary").maybeSingle(),
    c.assigned_advisor_id
      ? admin.from("advisor_profiles").select("display_name").eq("user_id", c.assigned_advisor_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  const [customerAuth, advisorAuth] = await Promise.all([
    c.customer_id ? admin.auth.admin.getUserById(c.customer_id) : Promise.resolve({ data: null as any }),
    c.assigned_advisor_id ? admin.auth.admin.getUserById(c.assigned_advisor_id) : Promise.resolve({ data: null as any }),
  ])

  return {
    case_id: c.id,
    case_ref: c.case_ref ?? null,
    customer_id: c.customer_id ?? null,
    advisor_id: c.assigned_advisor_id ?? null,
    customer_name: buildName(applicant),
    advisor_name: advisorProfile?.display_name ?? null,
    customer_email: customerAuth?.data?.user?.email ?? null,
    advisor_email: advisorAuth?.data?.user?.email ?? null,
  }
}

export async function logNotifications(rows: NotificationInput[]) {
  if (!rows.length) return
  const admin = supabaseAdmin()
  await admin.from("notification_log").insert(rows)
}

export async function logCaseEvent(opts: {
  caseId: string
  actorId?: string | null
  actorRole?: string | null
  type: string
  title: string
  body: string
  meta?: any
  notifyCustomer?: boolean
  notifyAdvisor?: boolean
}) {
  const meta = await getCaseMeta(opts.caseId)
  if (!meta) return null

  const rows: NotificationInput[] = []
  if (opts.notifyCustomer !== false && meta.customer_id) {
    rows.push({
      recipient_id: meta.customer_id,
      recipient_role: "customer",
      actor_id: opts.actorId ?? null,
      actor_role: opts.actorRole ?? null,
      case_id: meta.case_id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      meta: opts.meta ?? null,
    })
  }
  if (opts.notifyAdvisor !== false && meta.advisor_id) {
    rows.push({
      recipient_id: meta.advisor_id,
      recipient_role: "advisor",
      actor_id: opts.actorId ?? null,
      actor_role: opts.actorRole ?? null,
      case_id: meta.case_id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      meta: opts.meta ?? null,
    })
  }

  if (rows.length) {
    await logNotifications(rows)
  }

  return meta
}

export function buildEmailHtml(opts: {
  title: string
  intro: string
  steps: string[]
}) {
  const steps = opts.steps
    .map((s) => `<li style="margin:0 0 6px 0;">${s}</li>`)
    .join("")

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#94a3b8;">SEPANA</div>
      <h1 style="font-size:22px;margin:8px 0 12px 0;">${opts.title}</h1>
      <p style="font-size:14px;margin:0 0 16px 0;color:#334155;">${opts.intro}</p>
      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#f8fafc;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:#0f172a;">Naechste Schritte</div>
        <ul style="padding-left:18px;margin:0;font-size:13px;color:#334155;">
          ${steps}
        </ul>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Diese E-Mail wurde automatisch erstellt.</p>
    </div>
  </div>
  `
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!key || !from) return { ok: false, error: "missing_resend_env" }

  const fromEmailMatch = String(from).match(/<([^>]+)>/)
  const fromEmail = (fromEmailMatch?.[1] ?? String(from)).trim()
  const normalizedFrom = `SEPANA <${fromEmail}>`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: normalizedFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    return { ok: false, error: txt || `http_${res.status}` }
  }
  return { ok: true }
}
