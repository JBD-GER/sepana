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

type AdvisorCardMeta = {
  display_name: string | null
  email: string | null
  phone: string | null
  bio: string | null
  languages: string[]
  photo_path: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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

function cleanText(value: unknown) {
  return String(value ?? "").trim()
}

function fallbackAdvisorName(email: string | null) {
  const mail = cleanText(email)
  if (!mail.includes("@")) return "Ihr Ansprechpartner"
  return mail.split("@")[0] || "Ihr Ansprechpartner"
}

async function getAdvisorCardMeta(advisorId: string): Promise<AdvisorCardMeta> {
  const admin = supabaseAdmin()
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("advisor_profiles")
      .select("display_name,bio,languages,photo_path,phone")
      .eq("user_id", advisorId)
      .maybeSingle(),
    admin.auth.admin.getUserById(advisorId),
  ])

  const meta = authUser?.user?.user_metadata ?? {}
  const displayName =
    cleanText(profile?.display_name) ||
    cleanText([meta?.first_name, meta?.last_name].filter(Boolean).join(" ")) ||
    cleanText(meta?.full_name) ||
    fallbackAdvisorName(authUser?.user?.email ?? null)

  const langsRaw = Array.isArray(profile?.languages)
    ? profile.languages
    : Array.isArray(meta?.languages)
      ? meta.languages
      : []
  const languages = langsRaw.map((x: any) => cleanText(x)).filter(Boolean).slice(0, 8)

  return {
    display_name: displayName || null,
    email: authUser?.user?.email ?? null,
    phone: cleanText(profile?.phone) || cleanText(meta?.phone) || null,
    bio: cleanText(profile?.bio) || cleanText(meta?.bio) || null,
    languages,
    photo_path: cleanText(profile?.photo_path) || cleanText(meta?.photo_path) || null,
  }
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
  steps?: string[]
  ctaLabel?: string
  ctaUrl?: string
  preheader?: string
  eyebrow?: string
  supportNote?: string
  sideNote?: string
  bodyHtml?: string
}) {
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const title = escapeHtml(opts.title)
  const intro = escapeHtml(opts.intro)
  const eyebrow = escapeHtml(opts.eyebrow ?? "SEPANA - Service-Update")
  const preheader = escapeHtml(opts.preheader ?? opts.title)
  const supportNote = escapeHtml(opts.supportNote ?? "Falls Sie diese Nachricht nicht erwarten, koennen Sie diese E-Mail ignorieren.")
  const sideNote = escapeHtml(opts.sideNote ?? "Sicherheitshinweis: Link ist nur fuer Sie bestimmt.")
  const ctaUrl = String(opts.ctaUrl ?? "").trim()
  const ctaLabel = ctaUrl ? escapeHtml(opts.ctaLabel ?? "Zum Portal") : ""

  const steps = (opts.steps ?? [])
    .filter((step) => String(step ?? "").trim().length > 0)
    .map((s) => `<li style="margin:0 0 8px 0;">${escapeHtml(String(s))}</li>`)
    .join("")

  const stepsBlock = steps
    ? `
                    <tr>
                      <td style="padding:0 26px 8px 26px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                          style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
                          <tr>
                            <td style="padding:14px 16px 12px 16px; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:8px;">
                                Naechste Schritte
                              </div>
                              <ul style="padding-left:18px; margin:0; font-size:13px; line-height:20px; color:#334155;">
                                ${steps}
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
      `
    : ""

  const ctaBlock = ctaUrl
    ? `
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 10px 0;">
                          <tr>
                            <td align="left">
                              <a
                                href="${escapeHtml(ctaUrl)}"
                                style="display:inline-block; background:#0f172a; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; line-height:1; padding:14px 18px; border-radius:14px; border:1px solid #0f172a; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;"
                              >
                                ${ctaLabel}
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:12px 0 0 0; font-size:13px; line-height:20px; color:#475569;">
                          Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:
                        </p>
                        <p style="margin:8px 0 0 0; font-size:12px; line-height:18px; word-break:break-all;">
                          <a href="${escapeHtml(ctaUrl)}" style="color:#0f172a; text-decoration:underline;">
                            ${escapeHtml(ctaUrl)}
                          </a>
                        </p>
      `
    : ""

  const bodyHtmlBlock = String(opts.bodyHtml ?? "").trim()

  return `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <title>${title}</title>
    <style>
      @media (max-width: 600px) {
        .container { width: 100% !important; }
        .px { padding-left: 18px !important; padding-right: 18px !important; }
        .card { border-radius: 18px !important; }
        .h1 { font-size: 22px !important; line-height: 30px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f6f8fc;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
      ${preheader}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fc;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="container" style="width:640px; max-width:640px;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="padding:0 8px;">
                      <img
                        alt="SEPANA"
                        width="160"
                        height="48"
                        style="display:block; height:32px; width:auto;"
                        src="${siteUrl}/_next/image?url=%2Fog.png&w=640&q=75"
                      />
                    </td>
                    <td align="right" style="padding:0 8px; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:12px; color:#475569;">
                      ${sideNote}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:0 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card"
                  style="background:#ffffff; border-radius:22px; overflow:hidden; border:1px solid #e6eaf2;">
                  <tr>
                    <td style="background:#0f172a; padding:26px 26px 22px 26px;">
                      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#ffffff;">
                        <div style="font-size:12px; letter-spacing:.12em; text-transform:uppercase; opacity:.85;">
                          ${eyebrow}
                        </div>
                        <div class="h1" style="margin-top:10px; font-size:26px; line-height:34px; font-weight:700;">
                          ${title}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 26px 8px 26px;">
                      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#0f172a;">
                        <p style="margin:0 0 14px 0; font-size:15px; line-height:24px; color:#0f172a;">
                          ${intro}
                        </p>
                        ${bodyHtmlBlock}
                        ${ctaBlock}
                      </div>
                    </td>
                  </tr>
                  ${stepsBlock}
                  <tr>
                    <td style="padding:18px 26px 0 26px;">
                      <div style="height:1px; background:#e6eaf2; line-height:1px; font-size:1px;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 26px 22px 26px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:13px; line-height:20px; color:#475569;">
                            ${supportNote}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top:12px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td
                                  valign="top"
                                  style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:14px; line-height:22px; color:#0f172a; font-weight:600;"
                                >
                                  Ihr Team
                                </td>
                                <td
                                  align="right"
                                  valign="top"
                                  style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:12px; line-height:18px; color:#475569; min-width:220px;"
                                >
                                  <span style="white-space:nowrap;">
                                    Telefon:
                                    <span style="color:#0f172a; font-weight:700; white-space:nowrap;">05035&nbsp;3169996</span>
                                  </span>
                                  <br />
                                  <span style="white-space:nowrap;">
                                    E-Mail:
                                    <a
                                      href="mailto:info@sepana.de"
                                      style="color:#0f172a; text-decoration:underline; font-weight:700; white-space:nowrap;"
                                    >info@sepana.de</a>
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="px" style="padding:14px 8px 0 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                  style="background:#ffffff; border:1px solid #e6eaf2; border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                      <div style="font-size:12px; line-height:18px; color:#475569;">
                        <strong style="color:#0f172a;">Register- und Erlaubnisangaben</strong><br />
                        Umsatzsteuer-Identifikationsnummer gemaess Paragraf 27 a UStG: <span style="color:#0f172a; font-weight:700;">DE352217621</span><br />
                        Registrierungsnummer: <span style="color:#0f172a; font-weight:700;">D-W-133-TNSL-07</span><br />
                        Registrierung gemaess Paragraf 34i Abs. 1 Satz 1 GewO<br />
                        Erlaubnis gemaess Paragraf 34c Abs. 1 GewO<br />
                        Erlaubnis gemaess Paragraf 34i Abs. 1 GewO
                      </div>
                      <div style="margin-top:10px; font-size:11px; line-height:16px; color:#94a3b8;">
                        (c) SEPANA - Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht direkt auf diese Nachricht.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:18px; font-size:1px; line-height:1px;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `
}

export async function sendAdvisorAssignedEmail(opts: { caseId: string }) {
  const caseMeta = await getCaseMeta(opts.caseId)
  if (!caseMeta?.customer_email || !caseMeta.advisor_id) {
    return { ok: false, error: "missing_customer_or_advisor" as const }
  }

  const advisor = await getAdvisorCardMeta(caseMeta.advisor_id)
  const advisorName = advisor.display_name ?? caseMeta.advisor_name ?? "Ihr Ansprechpartner"
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const portalUrl = `${siteUrl}/app/faelle/${caseMeta.case_id}`
  const photoUrl = advisor.photo_path
    ? `${siteUrl}/api/baufi/logo?bucket=advisor_avatars&width=320&height=320&quality=100&resize=cover&path=${encodeURIComponent(advisor.photo_path)}`
    : null
  const languageText = advisor.languages.length ? advisor.languages.join(", ") : null

  const contactRows = [
    advisor.email
      ? `<div style="margin-top:6px; font-size:13px; color:#334155;"><strong style="color:#0f172a;">E-Mail:</strong> <a href="mailto:${escapeHtml(advisor.email)}" style="color:#0f172a; text-decoration:underline;">${escapeHtml(advisor.email)}</a></div>`
      : "",
    advisor.phone
      ? `<div style="margin-top:6px; font-size:13px; color:#334155;"><strong style="color:#0f172a;">Telefon:</strong> ${escapeHtml(advisor.phone)}</div>`
      : "",
    languageText
      ? `<div style="margin-top:6px; font-size:13px; color:#334155;"><strong style="color:#0f172a;">Sprachen:</strong> ${escapeHtml(languageText)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  const cardHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 2px 0;">
      <tr>
        <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${
                photoUrl
                  ? `<td valign="top" width="76" style="padding-right:12px;">
                      <img
                        src="${escapeHtml(photoUrl)}"
                        alt="${escapeHtml(advisorName)}"
                        width="64"
                        height="64"
                        style="display:block; width:64px; height:64px; border-radius:14px; object-fit:cover; border:1px solid #e2e8f0;"
                      />
                    </td>`
                  : ""
              }
              <td valign="top">
                <div style="font-size:12px; color:#64748b; letter-spacing:.08em; text-transform:uppercase;">Ihr Berater</div>
                <div style="margin-top:3px; font-size:18px; line-height:24px; font-weight:700; color:#0f172a;">${escapeHtml(advisorName)}</div>
                ${
                  advisor.bio
                    ? `<div style="margin-top:7px; font-size:13px; line-height:20px; color:#334155;">${escapeHtml(advisor.bio)}</div>`
                    : ""
                }
                ${contactRows}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  const html = buildEmailHtml({
    title: "Ihr Ansprechpartner wurde zugewiesen",
    intro: caseMeta.case_ref
      ? `Fuer Ihren Fall ${caseMeta.case_ref} steht jetzt ein fester Ansprechpartner bereit.`
      : "Fuer Ihren Fall steht jetzt ein fester Ansprechpartner bereit.",
    bodyHtml: cardHtml,
    steps: [
      "Sie koennen Unterlagen direkt im Portal hochladen.",
      "Bei Rueckfragen erreichen Sie Ihren Ansprechpartner ueber die angegebenen Kontaktdaten.",
    ],
    ctaLabel: "Zum Kundenportal",
    ctaUrl: portalUrl,
    preheader: "Ihr persoenlicher Ansprechpartner bei SEPANA ist jetzt verfuegbar.",
    eyebrow: "SEPANA - Ansprechpartner",
  })

  return sendEmail({
    to: caseMeta.customer_email,
    subject: "Ihr Ansprechpartner bei SEPANA",
    html,
  })
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
