import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, logCaseEvent, sendAdvisorAssignedEmail, sendEmail } from "@/lib/notifications/notify"

export const runtime = "nodejs"

type LeadRow = {
  id: string
  linked_case_id: string | null
  external_lead_id: number
  assigned_advisor_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  phone_work: string | null
  birth_date: string | null
  marital_status: string | null
  employment_status: string | null
  address_street: string | null
  address_zip: string | null
  address_city: string | null
  product_name: string | null
  notes: string | null
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function inferCaseTypeFromProduct(productName: string | null) {
  const value = String(productName ?? "").trim().toLowerCase()
  if (!value) return null
  if (value.includes("baufi") || value.includes("darlehen")) return "baufi" as const
  return null
}

function resolveInviteRedirect(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "")
  const fallbackOrigin = new URL(req.url).origin
  const base = configured || fallbackOrigin
  return `${new URL(base).origin}/einladung?mode=invite`
}

async function nextCaseRef(admin: ReturnType<typeof supabaseAdmin>) {
  const { data, error } = await admin.from("case_ref_seq").insert({}).select("id").single()
  if (error) throw error
  const id = Number(data.id ?? 0)
  return `BF-${String(id).padStart(6, "0")}`
}

async function findUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  const maxPages = 50

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = (data?.users ?? []) as Array<{ id?: string | null; email?: string | null }>
    const hit = users.find((u) => (u?.email ?? "").toLowerCase() === target)
    if (hit?.id) return hit.id
    if (users.length < perPage) break
  }

  return null
}

async function getPasswordSetAt(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("password_set_at")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { password_set_at?: string | null } | null)?.password_set_at ?? null
}

async function generatePasswordActionLink(
  admin: ReturnType<typeof supabaseAdmin>,
  email: string,
  redirectTo: string
) {
  const tries: Array<"invite" | "recovery"> = ["invite", "recovery"]
  for (const type of tries) {
    const { data, error } = await admin.auth.admin.generateLink({
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

function buildPasswordInviteEmailHtml(actionLink: string, firstName?: string | null) {
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

async function ensureCustomerAccount(opts: {
  admin: ReturnType<typeof supabaseAdmin>
  req: Request
  email: string
  firstName?: string | null
  lastName?: string | null
}) {
  const { admin, req, firstName, lastName } = opts
  const email = opts.email.trim().toLowerCase()
  if (!isEmail(email)) throw new Error("Lead hat keine gueltige E-Mail.")

  const redirectTo = resolveInviteRedirect(req)

  let userId = await findUserIdByEmail(admin, email)
  let existingAccount = !!userId
  let invited = false
  let passwordInviteSent = false

  if (!userId) {
    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        first_name: firstName ?? undefined,
        last_name: lastName ?? undefined,
        source: "webhook_lead",
      },
    })

    if (invite.error) {
      const again = await findUserIdByEmail(admin, email)
      if (again) {
        userId = again
        existingAccount = true
      } else {
        throw new Error(invite.error.message)
      }
    } else {
      userId = invite.data.user?.id ?? null
      if (!userId) throw new Error("User konnte nicht erstellt werden.")
      invited = true
      existingAccount = false
    }
  }

  if (!userId) throw new Error("User konnte nicht aufgeloest werden.")

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()

  const existingRole = String((existingProfile as { role?: string } | null)?.role ?? "").trim()
  if (existingRole && existingRole !== "customer") {
    throw new Error(`E-Mail gehoert bereits zu einer ${existingRole}-Rolle.`)
  }

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      role: "customer",
    },
    { onConflict: "user_id" }
  )
  if (upsertError) throw upsertError

  const passwordSetAt = await getPasswordSetAt(admin, userId)
  const needsPasswordSetup = !passwordSetAt
  if (needsPasswordSetup) {
    const actionLink = await generatePasswordActionLink(admin, email, redirectTo)
    if (actionLink) {
      const inviteHtml = buildPasswordInviteEmailHtml(actionLink, firstName)
      const mail = await sendEmail({
        to: email,
        subject: "Passwort fuer Ihren SEPANA-Zugang festlegen",
        html: inviteHtml,
      })
      passwordInviteSent = !!mail.ok
    }
  }

  return {
    userId,
    email,
    existingAccount,
    invited,
    needsPasswordSetup,
    passwordInviteSent,
  }
}

async function createCaseFromLead(opts: {
  admin: ReturnType<typeof supabaseAdmin>
  lead: LeadRow
  customerId: string
  advisorId: string
  caseType: "baufi"
}) {
  const { admin, lead, customerId, advisorId, caseType } = opts
  const caseRef = await nextCaseRef(admin)

  const { data: createdCase, error: caseErr } = await admin
    .from("cases")
    .insert({
      case_type: caseType,
      status: "comparison_ready",
      customer_id: customerId,
      assigned_advisor_id: advisorId,
      entry_channel: "webhook",
      language: "de",
      is_email_verified: false,
      case_ref: caseRef,
    })
    .select("id")
    .single()
  if (caseErr) throw caseErr
  const caseId = String(createdCase.id)

  const primaryApplicant = {
    case_id: caseId,
    role: "primary",
    first_name: lead.first_name?.trim() || null,
    last_name: lead.last_name?.trim() || null,
    email: lead.email?.trim().toLowerCase() || null,
    phone: lead.phone_mobile?.trim() || lead.phone?.trim() || lead.phone_work?.trim() || null,
    birth_date: lead.birth_date ?? null,
    marital_status: lead.marital_status?.trim() || null,
    employment_status: lead.employment_status?.trim() || null,
    address_street: lead.address_street?.trim() || null,
    address_zip: lead.address_zip?.trim() || null,
    address_city: lead.address_city?.trim() || null,
    created_by: null,
  }
  const { error: applicantErr } = await admin.from("case_applicants").insert(primaryApplicant)
  if (applicantErr) throw applicantErr

  const { data: templates } = await admin
    .from("document_templates")
    .select("title,required")
    .eq("case_type", caseType)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if ((templates ?? []).length > 0) {
    const rows = (templates ?? []).map((t: any) => ({
      case_id: caseId,
      title: t.title,
      required: !!t.required,
      created_by: advisorId,
    }))
    const { error: requestErr } = await admin.from("document_requests").insert(rows)
    if (requestErr) throw requestErr
  }

  await logCaseEvent({
    caseId,
    actorRole: "admin",
    type: "lead_imported",
    title: "Lead uebernommen",
    body: `Webhook-Lead #${lead.external_lead_id} wurde in einen Fall uebernommen.`,
  })

  return { caseId, caseRef }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const admin = supabaseAdmin()

    const body = await req.json().catch(() => null)
    const leadId = String(body?.leadId ?? "").trim()
    const advisorIdRaw = String(body?.advisorId ?? "").trim()
    const advisorId = advisorIdRaw || null

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId fehlt" }, { status: 400 })
    }

    const { data: existingLead } = await admin
      .from("webhook_leads")
      .select("id,linked_case_id,external_lead_id,assigned_advisor_id,first_name,last_name,email,phone,phone_mobile,phone_work,birth_date,marital_status,employment_status,address_street,address_zip,address_city,product_name,notes")
      .eq("id", leadId)
      .maybeSingle()
    if (!existingLead) {
      return NextResponse.json({ ok: false, error: "Lead nicht gefunden" }, { status: 404 })
    }
    const lead = existingLead as LeadRow

    if (advisorId) {
      const { data: advisorProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("user_id", advisorId)
        .eq("role", "advisor")
        .maybeSingle()

      if (!advisorProfile) {
        return NextResponse.json({ ok: false, error: "Berater nicht gefunden" }, { status: 400 })
      }
    }

    let caseId = lead.linked_case_id
    const previousAdvisorId = lead.assigned_advisor_id ?? null
    const isAdvisorChanged = previousAdvisorId !== advisorId

    let caseCreated = false
    let invited = false
    let existingAccount = false
    let passwordInviteSent = false
    let nextStepsMailSent = false
    let advisorMailSent = false

    if (advisorId && !caseId) {
      const caseType = inferCaseTypeFromProduct(lead.product_name)
      if (!caseType) {
        await admin
          .from("webhook_leads")
          .update({
            assigned_advisor_id: advisorId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", leadId)

        return NextResponse.json({
          ok: true,
          caseCreated: false,
          message:
            "Berater wurde zugewiesen, aber kein Fall erstellt: Produkt passt aktuell nicht zum Baufi-Flow.",
        })
      }

      if (!lead.email || !isEmail(lead.email)) {
        return NextResponse.json(
          { ok: false, error: "Lead hat keine gueltige E-Mail. Konto/Einladung nicht moeglich." },
          { status: 400 }
        )
      }

      const customer = await ensureCustomerAccount({
        admin,
        req,
        email: lead.email,
        firstName: lead.first_name,
        lastName: lead.last_name,
      })
      invited = customer.invited
      existingAccount = customer.existingAccount
      passwordInviteSent = customer.passwordInviteSent

      const created = await createCaseFromLead({
        admin,
        lead,
        customerId: customer.userId,
        advisorId,
        caseType,
      })
      caseId = created.caseId
      caseCreated = true

      const nextStepsHtml = buildEmailHtml({
        title: "Naechste Schritte zu Ihrer Baufinanzierung",
        intro: "Vielen Dank. Ihre Anfrage wurde uebernommen und wir starten jetzt mit der Bearbeitung.",
        steps: [
          "Ihr Berater meldet sich zeitnah bei Ihnen.",
          "Sie koennen Unterlagen direkt im Kundenportal hochladen.",
          "Bei Rueckfragen erreichen Sie uns jederzeit per E-Mail oder Telefon.",
        ],
      })
      const nextStepsMail = await sendEmail({
        to: customer.email,
        subject: "Naechste Schritte zur Baufinanzierung",
        html: nextStepsHtml,
      })
      nextStepsMailSent = !!nextStepsMail.ok
    }

    if (caseId) {
      const { data: caseRow } = await admin
        .from("cases")
        .select("id,assigned_advisor_id")
        .eq("id", caseId)
        .maybeSingle()

      if (caseRow) {
        const caseAdvisorId = caseRow.assigned_advisor_id ?? null
        if (caseAdvisorId !== advisorId) {
          const { error: caseUpdateError } = await admin
            .from("cases")
            .update({ assigned_advisor_id: advisorId })
            .eq("id", caseId)
          if (caseUpdateError) throw caseUpdateError
        }
      }
    }

    const { error } = await admin
      .from("webhook_leads")
      .update({
        assigned_advisor_id: advisorId,
        assigned_at: advisorId ? new Date().toISOString() : null,
        linked_case_id: caseId ?? null,
      })
      .eq("id", leadId)

    if (error) throw error

    if (caseId && advisorId && isAdvisorChanged) {
      await logCaseEvent({
        caseId,
        actorRole: "admin",
        type: "advisor_assigned",
        title: "Ansprechpartner aktualisiert",
        body: "Ihr Ansprechpartner wurde aktualisiert.",
      })
      const advisorMail = await sendAdvisorAssignedEmail({ caseId })
      advisorMailSent = !!advisorMail.ok
    }

    return NextResponse.json({
      ok: true,
      leadId,
      caseId: caseId ?? null,
      caseCreated,
      invited,
      existingAccount,
      passwordInviteSent,
      nextStepsMailSent,
      advisorMailSent,
      message: caseCreated
        ? "Berater zugewiesen, Konto/Fall angelegt und Mails versendet."
        : "Beraterzuweisung gespeichert.",
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Serverfehler" }, { status: 500 })
  }
}
