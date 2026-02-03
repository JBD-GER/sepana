// app/api/baufi/submit/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { logCaseEvent, buildEmailHtml, sendEmail } from "@/lib/notifications/notify"

type Payload = {
  baufi?: {
    purpose?: string
    property_type?: string
    purchase_price?: string
  }
  primary: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    birth_date?: string
    nationality?: string
    marital_status?: string
    address_street?: string
    address_zip?: string
    address_city?: string
    housing_status?: string
    employment_type?: string
    employment_status?: string
    employer_name?: string
    net_income_monthly?: string
    other_income_monthly?: string
    expenses_monthly?: string
    existing_loans_monthly?: string
  }
  co: Array<{
    first_name: string
    last_name: string
    birth_date?: string
    employment_status?: string
    net_income_monthly?: string
  }>
  redirectTo?: string
  language?: string
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function isPhone(v?: string) {
  const digits = String(v ?? "").replace(/\D/g, "")
  return digits.length >= 6
}

/**
 * ✅ robust: "3.200 €" => 3200, "3.200" => 3200, "3,200" => 3.2 (falls wirklich so gemeint)
 * In DE ist Komma Dezimaltrennzeichen, Punkt Tausender
 */
function numOrNull(v?: string) {
  if (v === undefined || v === null) return null
  const raw = String(v).trim()
  if (!raw) return null

  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  let normalized = cleaned

  if (normalized.includes(",")) {
    // DE: Punkt tausender, Komma dezimal
    normalized = normalized.replace(/\./g, "").replace(",", ".")
  } else {
    // kein Komma => Punkte sind sehr wahrscheinlich tausender
    normalized = normalized.replace(/\./g, "")
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

async function nextCaseRef(sb: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await sb.from("case_ref_seq").insert({}).select("id").single()
  if (error) throw error
  const id = data.id as number
  const padded = String(id).padStart(6, "0")
  return `BF-${padded}`
}

async function findUserIdByEmail(sb: ReturnType<typeof supabaseAdmin>, email: string) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  const maxPages = 50 // Schutz (bis 50k User)

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = (data?.users ?? []) as Array<{ id?: string | null; email?: string | null }>
    const hit = users.find((u) => (u?.email ?? "").toLowerCase() === target)
    if (hit?.id) return hit.id as string

    if (users.length < perPage) break
  }

  return null
}

async function pickRandomAdvisorId(sb: ReturnType<typeof supabaseAdmin>) {
  const { data } = await sb.from("advisor_profiles").select("user_id").eq("is_active", true)
  const rows = (data ?? []) as Array<{ user_id?: string | null }>
  const ids = rows.map((x) => x.user_id).filter((v): v is string => Boolean(v))
  if (!ids.length) return null
  const idx = Math.floor(Math.random() * ids.length)
  return ids[idx] as string
}

async function pickStickyAdvisorId(sb: ReturnType<typeof supabaseAdmin>, customerId: string) {
  const { data: priorCases } = await sb
    .from("cases")
    .select("assigned_advisor_id")
    .eq("customer_id", customerId)
    .not("assigned_advisor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50)

  const candidateRows = (priorCases ?? []) as Array<{ assigned_advisor_id?: string | null }>
  const candidateIds = Array.from(
    new Set(
      candidateRows
        .map((row) => row.assigned_advisor_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  )

  if (!candidateIds.length) {
    return pickRandomAdvisorId(sb)
  }

  const { data: activeRows } = await sb
    .from("advisor_profiles")
    .select("user_id")
    .in("user_id", candidateIds)
    .eq("is_active", true)

  const activeRowsTyped = (activeRows ?? []) as Array<{ user_id?: string | null }>
  const activeSet = new Set(
    activeRowsTyped
      .map((row) => row.user_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  )

  const sticky = candidateIds.find((id) => activeSet.has(id))
  if (sticky) return sticky

  return pickRandomAdvisorId(sb)
}

function resolveInviteRedirect(req: Request, preferred?: string) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "")
  const fallbackOrigin = new URL(req.url).origin
  const base = configured || fallbackOrigin
  const baseOrigin = new URL(base).origin
  const input = String(preferred ?? "").trim()

  if (!input) return `${baseOrigin}/einladung?mode=invite`

  try {
    const parsed = new URL(input, baseOrigin)
    if (parsed.pathname === "/set-password") {
      return `${baseOrigin}/einladung?mode=invite`
    }
    if (parsed.origin !== baseOrigin) {
      return `${baseOrigin}/einladung?mode=invite`
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`
  } catch {
    return `${baseOrigin}/einladung?mode=invite`
  }
}

async function getPasswordSetAt(sb: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data } = await sb
    .from("profiles")
    .select("password_set_at")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { password_set_at?: string | null } | null)?.password_set_at ?? null
}

async function generatePasswordActionLink(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
  redirectTo: string
) {
  const tries: Array<"invite" | "recovery"> = ["invite", "recovery"]
  for (const type of tries) {
    const { data, error } = await sb.auth.admin.generateLink({
      type,
      email,
      options: { redirectTo },
    })
    if (error) continue
    const link = data?.properties?.action_link ?? null
    if (link) return link
  }
  return null
}

function buildPasswordInviteEmailHtml(actionLink: string, firstName?: string) {
  const safeName = String(firstName ?? "").trim()
  return buildEmailHtml({
    title: "Passwort fuer Ihr SEPANA-Konto festlegen",
    intro: safeName
      ? `Hallo ${safeName}, bitte legen Sie jetzt Ihr Passwort fest, um Ihren Zugang abzuschliessen.`
      : "Bitte legen Sie jetzt Ihr Passwort fest, um Ihren Zugang abzuschliessen.",
    steps: [
      "Klicken Sie auf den Button und vergeben Sie ein sicheres Passwort.",
      "Danach koennen Sie sich direkt im Kundenportal anmelden.",
    ],
    ctaLabel: "Passwort festlegen",
    ctaUrl: actionLink,
    eyebrow: "SEPANA - Einladung",
    preheader: "Bitte Passwort festlegen und Zugang aktivieren.",
  })
}

export async function POST(req: Request) {
  const sb = supabaseAdmin()

  try {
    const body = (await req.json()) as Payload

    if (
      !body?.primary?.first_name?.trim() ||
      !body?.primary?.last_name?.trim() ||
      !body?.primary?.email?.trim() ||
      !body?.primary?.phone?.trim() ||
      !body?.primary?.birth_date?.trim() ||
      !body?.primary?.marital_status?.trim()
    ) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 })
    }
    if (!isEmail(body.primary.email)) {
      return NextResponse.json({ error: "Ungültige E-Mail." }, { status: 400 })
    }
    if (!isPhone(body.primary.phone)) {
      return NextResponse.json({ error: "Ungültige Telefonnummer." }, { status: 400 })
    }

    const email = body.primary.email.trim().toLowerCase()
    const inviteRedirectTo = resolveInviteRedirect(req, body.redirectTo)

    // 1) Existiert Konto bereits?
    let userId = await findUserIdByEmail(sb, email)
    let existingAccount = !!userId
    let invited = false
    let passwordInviteSent = false

    // 2) Wenn nicht: Invite senden / Konto erstellen
    if (!userId) {
      const invite = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteRedirectTo,
        data: {
          first_name: body.primary.first_name,
          last_name: body.primary.last_name,
          source: "baufi_funnel",
        },
      })

      if (invite.error) {
        const again = await findUserIdByEmail(sb, email)
        if (again) {
          userId = again
          existingAccount = true
          invited = false
        } else {
          return NextResponse.json({ error: invite.error.message }, { status: 400 })
        }
      } else {
        userId = invite.data.user?.id || null
        if (!userId) return NextResponse.json({ error: "User konnte nicht erstellt werden." }, { status: 500 })
        invited = true
        existingAccount = false
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "User konnte nicht aufgeloest werden." }, { status: 500 })
    }

    // 3) profiles upsert (auch bei existing)
    await sb.from("profiles").upsert({
      user_id: userId,
      role: "customer",
    })
    const passwordSetAt = await getPasswordSetAt(sb, userId)
    const needsPasswordSetup = !passwordSetAt

    if (needsPasswordSetup) {
      const actionLink = await generatePasswordActionLink(sb, email, inviteRedirectTo)
      if (actionLink) {
        const inviteEmailHtml = buildPasswordInviteEmailHtml(actionLink, body.primary.first_name)
        const inviteEmail = await sendEmail({
          to: email,
          subject: "Passwort fuer Ihren SEPANA-Zugang festlegen",
          html: inviteEmailHtml,
        })
        passwordInviteSent = !!inviteEmail.ok
      }
    }

    // 4) Case anlegen
    const caseRef = await nextCaseRef(sb)
    const assignedAdvisorId = await pickStickyAdvisorId(sb, userId)

    const { data: createdCase, error: caseErr } = await sb
      .from("cases")
      .insert({
        case_type: "baufi",
        status: "comparison_ready",
        customer_id: userId,
        assigned_advisor_id: assignedAdvisorId,
        entry_channel: "funnel",
        language: body.language || "de",
        is_email_verified: false,
        case_ref: caseRef,
      })
      .select("id")
      .single()

    if (caseErr) throw caseErr
    const caseId = createdCase.id as string

    // 4.5) Baufi Eckdaten speichern (aus BaufiStart)
    const { error: baufiErr } = await sb
      .from("case_baufi_details")
      .upsert(
        {
          case_id: caseId,
          purpose: body?.baufi?.purpose ?? null,
          property_type: body?.baufi?.property_type ?? null,
          purchase_price: numOrNull(body?.baufi?.purchase_price),
        },
        { onConflict: "case_id" }
      )
    if (baufiErr) throw baufiErr

    // 5) Applicants speichern (✅ korrekt normalisiert)
    const primaryRow = {
      case_id: caseId,
      role: "primary",
      first_name: body.primary.first_name ?? null,
      last_name: body.primary.last_name ?? null,
      email: email,
      phone: body.primary.phone ?? null,
      birth_date: body.primary.birth_date || null,
      nationality: body.primary.nationality ?? null,
      marital_status: body.primary.marital_status ?? null,
      address_street: body.primary.address_street ?? null,
      address_zip: body.primary.address_zip ?? null,
      address_city: body.primary.address_city ?? null,
      housing_status: body.primary.housing_status ?? null,
      employment_type: body.primary.employment_type ?? null,
      employment_status: body.primary.employment_status ?? null,
      employer_name: body.primary.employer_name ?? null,
      net_income_monthly: numOrNull(body.primary.net_income_monthly),
      other_income_monthly: numOrNull(body.primary.other_income_monthly),
      expenses_monthly: numOrNull(body.primary.expenses_monthly),
      existing_loans_monthly: numOrNull(body.primary.existing_loans_monthly),
      created_by: null,
    }

    const coRows = (body.co || [])
      .filter((c) => (c.first_name || c.last_name || c.net_income_monthly || c.birth_date || c.employment_status))
      .map((c) => ({
        case_id: caseId,
        role: "co",
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        birth_date: c.birth_date || null,
        employment_status: c.employment_status ?? null,
        net_income_monthly: numOrNull(c.net_income_monthly),
        created_by: null,
      }))

    const { error: appErr } = await sb.from("case_applicants").insert([primaryRow, ...coRows])
    if (appErr) throw appErr

    // 6) Dokumenten-Requests automatisch aus Templates (baufi)
    const { data: templates } = await sb
      .from("document_templates")
      .select("title,required,sort_order")
      .eq("case_type", "baufi")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    const createdBy = assignedAdvisorId || userId
    if (templates?.length) {
      const rows = templates.map((t) => ({
        case_id: caseId,
        title: t.title,
        required: t.required,
        created_by: createdBy,
      }))
      const { error: reqErr } = await sb.from("document_requests").insert(rows)
      if (reqErr) throw reqErr
    }

    await logCaseEvent({
      caseId,
      actorId: userId,
      actorRole: "customer",
      type: "bank_selected",
      title: "Bankauswahl bestaetigt",
      body: "Der Kunde hat seine Bankauswahl bestaetigt.",
      meta: { case_ref: caseRef },
    })

    const html = buildEmailHtml({
      title: "Auswahl bestaetigt",
      intro: "Vielen Dank. Ihre Auswahl wurde bestaetigt.",
      steps: [
        "Ein Berater meldet sich in Kuerze bei Ihnen.",
        "Sie koennen jederzeit Unterlagen im Portal hochladen.",
        "Bei Fragen nutzen Sie bitte den Chat im Fall.",
      ],
    })
    if (email) {
      await sendEmail({ to: email, subject: "Naechste Schritte zur Baufinanzierung", html })
    }

    return NextResponse.json({
      ok: true,
      caseId,
      caseRef,
      existingAccount,
      invited,
      passwordInviteSent,
      message: existingAccount
        ? needsPasswordSetup
          ? "Konto existiert bereits – Passwort-Link wurde erneut gesendet."
          : "Konto existiert bereits – Vergleich wurde im Portal hinterlegt."
        : "Konto erstellt – Invite wurde gesendet.",
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Serverfehler."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

