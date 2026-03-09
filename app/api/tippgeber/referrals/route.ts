export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { getUserAndRole } from "@/lib/auth/getUserAndRole"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, sendEmail } from "@/lib/notifications/notify"
import { isEmail, isPhone } from "@/lib/tippgeber/service"
import { normalizeTippgeberKind, tippgeberKindLabel } from "@/lib/tippgeber/kinds"

type ReferralKind = "classic" | "private_credit"

type RequestBody = {
  customerFirstName?: string
  customerLastName?: string
  customerEmail?: string
  customerPhone?: string
  privateCreditVolume?: number | string | null
  expose?: {
    path?: string
    file_name?: string
    mime_type?: string | null
    size_bytes?: number | null
  } | null
  manual?: {
    purchasePrice?: number | string | null
    brokerCommissionPercent?: number | string | null
    street?: string | null
    houseNumber?: string | null
    zip?: string | null
    city?: string | null
  } | null
}

type TippgeberProfileLite = {
  is_active?: boolean | null
  tippgeber_kind?: unknown
  company_name?: string | null
}

function trimOrNull(value: unknown) {
  const s = String(value ?? "").trim()
  return s ? s : null
}

function parseAmount(value: unknown) {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const raw = String(value).trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/\./g, "")
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function isMissingPrivateReferralColumnsError(error: unknown) {
  const anyError = error as { code?: string; message?: string } | null
  if (!anyError) return false
  if (anyError.code === "42703") return true
  const msg = String(anyError.message ?? "").toLowerCase()
  return msg.includes("referral_kind") || msg.includes("private_credit_volume")
}

function parseRecipients() {
  const configured = [
    process.env.ADMIN_NOTIFY_TO,
    process.env.INVITE_ACCEPTED_NOTIFY_TO,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ")

  const set = new Set(
    (`${configured} info@sepana.de`)
      .split(/[;,\s]+/g)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.includes("@"))
  )
  return Array.from(set)
}

function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sepana.de").replace(/\/$/, "")
}

function formatEuroAmount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value))
}

async function notifyAdminNewReferral(opts: {
  companyName: string
  customerName: string
  customerEmail: string
  customerPhone: string
  referralId: string
  referralKind: ReferralKind
  privateCreditVolume: number | null
  hasExpose: boolean
}) {
  const recipients = parseRecipients()
  if (!recipients.length) return
  const base = siteBaseUrl()
  const productLabel = tippgeberKindLabel(opts.referralKind)

  const detailsHtml =
    opts.referralKind === "private_credit"
      ? `<div><strong style="color:#0f172a;">Kreditvolumen:</strong> ${formatEuroAmount(opts.privateCreditVolume)}</div>`
      : `<div><strong style="color:#0f172a;">Exposé:</strong> ${opts.hasExpose ? "Ja" : "Nein"}</div>`

  const html = buildEmailHtml({
    title: "Neuer Tippgeber-Tipp eingegangen",
    intro: "Ein neuer Tipp wurde über das Tippgeber-Dashboard eingereicht.",
    bodyHtml: `
      <div style="font-size:13px; line-height:22px; color:#334155;">
        <div><strong style="color:#0f172a;">Tipp-ID:</strong> ${opts.referralId}</div>
        <div><strong style="color:#0f172a;">Empfohlen von:</strong> ${opts.companyName}</div>
        <div><strong style="color:#0f172a;">Kontakt:</strong> ${opts.customerName}</div>
        <div><strong style="color:#0f172a;">E-Mail:</strong> ${opts.customerEmail}</div>
        <div><strong style="color:#0f172a;">Telefon:</strong> ${opts.customerPhone}</div>
        <div><strong style="color:#0f172a;">Produkt:</strong> ${productLabel}</div>
        ${detailsHtml}
      </div>
    `,
    ctaLabel: "Zum Tippgeber-Bereich",
    ctaUrl: `${base}/admin/tippgeber`,
    eyebrow: "SEPANA - Tippgeber",
  })

  await Promise.all(
    recipients.map((to) => sendEmail({ to, subject: "Neuer Tippgeber-Tipp", html }).catch(() => null))
  )
}

async function notifyTippgeberReferralConfirmation(opts: {
  toEmail: string | null | undefined
  companyName: string
  customerName: string
  referralId: string
  referralKind: ReferralKind
  privateCreditVolume: number | null
  hasExpose: boolean
}) {
  const to = String(opts.toEmail ?? "").trim().toLowerCase()
  if (!isEmail(to)) return

  const base = siteBaseUrl()
  const productLabel = tippgeberKindLabel(opts.referralKind)

  const detailsHtml =
    opts.referralKind === "private_credit"
      ? `<div><strong style="color:#0f172a;">Kreditvolumen:</strong> ${formatEuroAmount(opts.privateCreditVolume)}</div>`
      : `<div><strong style="color:#0f172a;">Exposé hochgeladen:</strong> ${opts.hasExpose ? "Ja" : "Nein"}</div>`

  const html = buildEmailHtml({
    title: "Bestätigung: Kundenanfrage eingereicht",
    intro: "Ihre Kundenanfrage wurde erfolgreich im Tippgeber-Dashboard eingereicht.",
    steps: [
      "SEPANA wurde automatisch informiert.",
      "Sie sehen den Eintrag ab sofort in Ihrer Tipp-Übersicht im Dashboard.",
      "Status-Änderungen erhalten Sie zusätzlich per E-Mail.",
    ],
    bodyHtml: `
      <div style="font-size:13px; line-height:22px; color:#334155;">
        <div><strong style="color:#0f172a;">Tipp-ID:</strong> ${opts.referralId}</div>
        <div><strong style="color:#0f172a;">Tippgeber:</strong> ${opts.companyName}</div>
        <div><strong style="color:#0f172a;">Kunde:</strong> ${opts.customerName}</div>
        <div><strong style="color:#0f172a;">Produkt:</strong> ${productLabel}</div>
        ${detailsHtml}
      </div>
    `,
    ctaLabel: "Zum Tippgeber-Dashboard",
    ctaUrl: `${base}/tippgeber`,
    eyebrow: "SEPANA - Tippgeber",
  })

  await sendEmail({ to, subject: "Bestätigung Ihrer Kundenanfrage", html }).catch(() => null)
}

export async function POST(req: Request) {
  try {
    const { user, role } = await getUserAndRole()
    if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt." }, { status: 401 })
    if (role !== "tipgeber" && role !== "admin") {
      return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 })
    }

    const admin = supabaseAdmin()
    const { data: tgProfile } = await admin
      .from("tippgeber_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!tgProfile) {
      return NextResponse.json({ ok: false, error: "Tippgeber-Profil nicht gefunden." }, { status: 404 })
    }
    const profile = tgProfile as TippgeberProfileLite
    if (profile.is_active === false) {
      return NextResponse.json({ ok: false, error: "Tippgeber ist deaktiviert." }, { status: 403 })
    }

    const referralKind = normalizeTippgeberKind(profile.tippgeber_kind)

    const body = (await req.json().catch(() => null)) as RequestBody | null
    if (!body) return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 })

    const customerFirstName = trimOrNull(body.customerFirstName)
    const customerLastName = trimOrNull(body.customerLastName)
    const customerEmail = trimOrNull(body.customerEmail)?.toLowerCase() ?? null
    const customerPhone = trimOrNull(body.customerPhone)

    const exposePath = trimOrNull(body.expose?.path)
    const exposeFileName = trimOrNull(body.expose?.file_name)
    const exposeMimeType = trimOrNull(body.expose?.mime_type)
    const exposeSizeBytes =
      body.expose?.size_bytes != null && Number.isFinite(Number(body.expose.size_bytes))
        ? Number(body.expose.size_bytes)
        : null

    const privateCreditVolume = parseAmount(body.privateCreditVolume)
    const manualPurchasePrice = parseAmount(body.manual?.purchasePrice)
    const manualBrokerCommissionPercent = parseAmount(body.manual?.brokerCommissionPercent) ?? 0
    const propertyStreet = trimOrNull(body.manual?.street)
    const propertyHouseNumber = trimOrNull(body.manual?.houseNumber)
    const propertyZip = trimOrNull(body.manual?.zip)
    const propertyCity = trimOrNull(body.manual?.city)

    if (!customerFirstName || !customerLastName || !customerEmail || !customerPhone) {
      return NextResponse.json({ ok: false, error: "Bitte Kontaktdaten vollständig angeben." }, { status: 400 })
    }
    if (!isEmail(customerEmail)) {
      return NextResponse.json({ ok: false, error: "Ungültige E-Mail." }, { status: 400 })
    }
    if (!isPhone(customerPhone)) {
      return NextResponse.json({ ok: false, error: "Ungültige Telefonnummer." }, { status: 400 })
    }

    if (referralKind === "private_credit") {
      if (!privateCreditVolume || privateCreditVolume <= 0) {
        return NextResponse.json(
          { ok: false, error: "Bitte Kreditvolumen für den Privatkredit angeben." },
          { status: 400 }
        )
      }
    } else {
      const hasManual = Boolean(manualPurchasePrice || propertyStreet || propertyZip || propertyCity)
      if (!exposePath && !hasManual) {
        return NextResponse.json(
          { ok: false, error: "Bitte Exposé hochladen oder manuelle Objektdaten eingeben." },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      tippgeber_user_id: user.id,
      referral_kind: referralKind,
      status: "new",
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      private_credit_volume: referralKind === "private_credit" ? privateCreditVolume : null,
      expose_file_path: referralKind === "classic" ? exposePath : null,
      expose_file_name: referralKind === "classic" ? exposeFileName : null,
      expose_mime_type: referralKind === "classic" ? exposeMimeType : null,
      expose_size_bytes: referralKind === "classic" ? exposeSizeBytes : null,
      manual_purchase_price: referralKind === "classic" ? manualPurchasePrice : null,
      manual_broker_commission_percent: referralKind === "classic" ? manualBrokerCommissionPercent : 0,
      property_street: referralKind === "classic" ? propertyStreet : null,
      property_house_number: referralKind === "classic" ? propertyHouseNumber : null,
      property_zip: referralKind === "classic" ? propertyZip : null,
      property_city: referralKind === "classic" ? propertyCity : null,
      created_at: now,
      updated_at: now,
    }

    let created: { id: string } | null = null
    const primaryInsert = await admin
      .from("tippgeber_referrals")
      .insert(insertPayload)
      .select("id")
      .single()

    if (primaryInsert.error && isMissingPrivateReferralColumnsError(primaryInsert.error)) {
      if (referralKind === "private_credit") {
        return NextResponse.json(
          { ok: false, error: "DB-Update für Tippgeber Privat fehlt. Bitte Migration ausführen." },
          { status: 409 }
        )
      }
      delete insertPayload.referral_kind
      delete insertPayload.private_credit_volume
      const fallbackInsert = await admin
        .from("tippgeber_referrals")
        .insert(insertPayload)
        .select("id")
        .single()
      if (fallbackInsert.error) throw fallbackInsert.error
      created = fallbackInsert.data ? { id: String(fallbackInsert.data.id) } : null
    } else if (primaryInsert.error) {
      throw primaryInsert.error
    } else {
      created = primaryInsert.data ? { id: String(primaryInsert.data.id) } : null
    }

    if (!created) throw new Error("Tipp konnte nicht erstellt werden.")

    const companyName = String(profile.company_name ?? "Tippgeber")
    const customerName = `${customerFirstName} ${customerLastName}`.trim()
    const referralId = String(created.id)
    const hasExpose = referralKind === "classic" && Boolean(exposePath)

    await Promise.all([
      notifyAdminNewReferral({
        companyName,
        customerName,
        customerEmail,
        customerPhone,
        referralId,
        referralKind,
        privateCreditVolume,
        hasExpose,
      }),
      notifyTippgeberReferralConfirmation({
        toEmail: user.email ?? null,
        companyName,
        customerName,
        referralId,
        referralKind,
        privateCreditVolume,
        hasExpose,
      }),
    ]).catch(() => null)

    return NextResponse.json({ ok: true, referralId })
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : "Serverfehler"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}




