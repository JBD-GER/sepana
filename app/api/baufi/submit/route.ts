// app/api/baufi/submit/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

type Payload = {
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

function numOrNull(v?: string) {
  if (!v) return null
  const x = String(v).replace(",", ".").trim()
  if (x === "") return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
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

    const users = data?.users ?? []
    const hit = users.find((u: any) => (u?.email ?? "").toLowerCase() === target)
    if (hit?.id) return hit.id as string

    if (users.length < perPage) break
  }

  return null
}

export async function POST(req: Request) {
  const sb = supabaseAdmin()

  try {
    const body = (await req.json()) as Payload

    if (!body?.primary?.first_name?.trim() || !body?.primary?.last_name?.trim() || !body?.primary?.email?.trim()) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 })
    }
    if (!isEmail(body.primary.email)) {
      return NextResponse.json({ error: "Ungültige E-Mail." }, { status: 400 })
    }

    const email = body.primary.email.trim().toLowerCase()

    // 1) Existiert Konto bereits?
    let userId = await findUserIdByEmail(sb, email)
    let existingAccount = !!userId
    let invited = false

    // 2) Wenn nicht: Invite senden / Konto erstellen
    if (!userId) {
      const invite = await sb.auth.admin.inviteUserByEmail(email, {
        redirectTo: body.redirectTo || undefined,
        data: {
          first_name: body.primary.first_name,
          last_name: body.primary.last_name,
          source: "baufi_funnel",
        },
      })

      // Falls Supabase hier "already registered" o.ä. wirft → dann als existing behandeln
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

    // 3) profiles upsert (auch bei existing)
    await sb.from("profiles").upsert({
  id: userId,
  email,
  role: "customer",
})


    // 4) Case anlegen (Vergleich immer im Portal speichern)
    const caseRef = await nextCaseRef(sb)

    const { data: createdCase, error: caseErr } = await sb
      .from("cases")
      .insert({
        case_type: "baufi",
        status: "comparison_ready",
        customer_id: userId,
        entry_channel: "funnel",
        language: body.language || "de",
        is_email_verified: false,
        case_ref: caseRef,
      })
      .select("id")
      .single()

    if (caseErr) throw caseErr
    const caseId = createdCase.id as string

    // 5) Applicants speichern
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

    return NextResponse.json({
      ok: true,
      caseId,
      caseRef,
      existingAccount,
      invited,
      message: existingAccount
        ? "Konto existiert bereits – Vergleich wurde im Portal hinterlegt."
        : "Konto erstellt – Invite wurde gesendet.",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Serverfehler." }, { status: 500 })
  }
}
