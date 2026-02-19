import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, logCaseEvent, sendEmail } from "@/lib/notifications/notify"

export type CaseType = "baufi" | "konsum"

export type LeadRow = {
  id: string
  linked_case_id: string | null
  external_lead_id: number
  assigned_advisor_id: string | null
  lead_case_type?: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  phone_work: string | null
  birth_date: string | null
  marital_status: string | null
  employment_status: string | null
  employment_type: string | null
  net_income_monthly: number | null
  address_street: string | null
  address_zip: string | null
  address_city: string | null
  product_name: string | null
  product_price: number | null
  loan_purpose: string | null
  loan_amount_total: number | null
  property_zip: string | null
  property_city: string | null
  property_type: string | null
  property_purchase_price: number | null
  notes: string | null
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function inferCaseTypeFromProduct(productName: string | null) {
  const value = String(productName ?? "").trim().toLowerCase()
  if (!value) return null

  if (value.includes("privatkredit") || value.includes("ratenkredit") || value.includes("konsum")) {
    return "konsum" as const
  }

  if (
    value.includes("baufi") ||
    value.includes("baufinanz") ||
    value.includes("immobil") ||
    value.includes("darlehen") ||
    value.includes("hypothek")
  ) {
    return "baufi" as const
  }

  return null
}

export function resolveInviteRedirect(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "")
  const fallbackOrigin = new URL(req.url).origin
  const base = configured || fallbackOrigin
  return `${new URL(base).origin}/einladung?mode=invite`
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function caseRefPrefix(caseType: CaseType) {
  return caseType === "konsum" ? "PK" : "BF"
}

export async function nextCaseRef(admin: ReturnType<typeof supabaseAdmin>, caseType: CaseType = "baufi") {
  const { data, error } = await admin.from("case_ref_seq").insert({}).select("id").single()
  if (error) throw error
  const id = Number(data.id ?? 0)
  return `${caseRefPrefix(caseType)}-${String(id).padStart(6, "0")}`
}

export async function findUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string) {
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

export async function pickStickyAdvisorId(admin: ReturnType<typeof supabaseAdmin>, customerId: string) {
  const { data: priorCases } = await admin
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
    const { data: randomAdvisors } = await admin.from("advisor_profiles").select("user_id").eq("is_active", true)
    const ids = (randomAdvisors ?? [])
      .map((row: { user_id?: string | null }) => row.user_id)
      .filter((value: string | null | undefined): value is string => typeof value === "string" && value.length > 0)
    if (!ids.length) return null
    const idx = Math.floor(Math.random() * ids.length)
    return ids[idx]
  }

  const { data: activeRows } = await admin
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
  return sticky ?? null
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

export async function ensureCustomerAccount(opts: {
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

export async function createCaseFromLead(opts: {
  admin: ReturnType<typeof supabaseAdmin>
  lead: LeadRow
  customerId: string
  advisorId?: string | null
  caseType: CaseType
  entryChannel?: string
  language?: string
  initialStatus?: string
}) {
  const {
    admin,
    lead,
    customerId,
    advisorId = null,
    caseType,
    entryChannel = "webhook",
    language = "de",
    initialStatus = "comparison_ready",
  } = opts

  const caseRef = await nextCaseRef(admin, caseType)

  const { data: createdCase, error: caseErr } = await admin
    .from("cases")
    .insert({
      case_type: caseType,
      status: initialStatus,
      customer_id: customerId,
      assigned_advisor_id: advisorId,
      entry_channel: entryChannel,
      language,
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
    first_name: trimOrNull(lead.first_name),
    last_name: trimOrNull(lead.last_name),
    email: trimOrNull(lead.email)?.toLowerCase() ?? null,
    phone: trimOrNull(lead.phone_mobile) || trimOrNull(lead.phone) || trimOrNull(lead.phone_work) || null,
    birth_date: lead.birth_date ?? null,
    marital_status: trimOrNull(lead.marital_status),
    employment_status: trimOrNull(lead.employment_status),
    employment_type: trimOrNull(lead.employment_type),
    net_income_monthly: numberOrNull(lead.net_income_monthly),
    address_street: trimOrNull(lead.address_street),
    address_zip: trimOrNull(lead.address_zip),
    address_city: trimOrNull(lead.address_city),
    created_by: null,
  }
  const { error: applicantErr } = await admin.from("case_applicants").insert(primaryApplicant)
  if (applicantErr) throw applicantErr

  const baseLoanAmount = numberOrNull(lead.loan_amount_total ?? lead.product_price)
  const detailsForCase =
    caseType === "konsum"
      ? {
          case_id: caseId,
          purpose: trimOrNull(lead.loan_purpose) ?? trimOrNull(lead.product_name),
          loan_amount_requested: baseLoanAmount,
        }
      : {
          case_id: caseId,
          purpose: trimOrNull(lead.loan_purpose),
          property_type: trimOrNull(lead.property_type),
          purchase_price: numberOrNull(lead.property_purchase_price),
          loan_amount_requested: baseLoanAmount,
          property_zip: trimOrNull(lead.property_zip),
          property_city: trimOrNull(lead.property_city),
        }

  const hasDetails = Object.entries(detailsForCase).some(
    ([key, value]) => key !== "case_id" && value !== null && value !== ""
  )
  if (hasDetails) {
    const { error: detailsErr } = await admin.from("case_baufi_details").insert(detailsForCase)
    if (detailsErr) throw detailsErr
  }

  let { data: templates } = await admin
    .from("document_templates")
    .select("title,required")
    .eq("case_type", caseType)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if ((templates ?? []).length === 0 && caseType === "konsum") {
    const fallback = await admin
      .from("document_templates")
      .select("title,required")
      .eq("case_type", "baufi")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
    templates = fallback.data ?? []
  }

  if ((templates ?? []).length > 0) {
    const rows = (templates ?? []).map((t: any) => ({
      case_id: caseId,
      title: t.title,
      required: !!t.required,
      created_by: advisorId ?? customerId,
    }))
    const { error: requestErr } = await admin.from("document_requests").insert(rows)
    if (requestErr) throw requestErr
  }

  const productLabel = caseType === "konsum" ? "Privatkredit" : "Baufinanzierung"
  await logCaseEvent({
    caseId,
    actorRole: "admin",
    type: "lead_imported",
    title: "Lead uebernommen",
    body: `Lead #${lead.external_lead_id} wurde als ${productLabel}-Fall uebernommen.`,
  })

  return { caseId, caseRef }
}
