import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"
import { buildEmailHtml, getCaseMeta, sendEmail } from "@/lib/notifications/notify"
import {
  calculateTippgeberCommission,
  formatEuro,
  toMoney,
  type TippgeberBankOutcome,
} from "@/lib/tippgeber/commission"

export type TippgeberProfileRow = {
  user_id: string
  company_name: string
  address_street: string
  address_house_number: string
  address_zip: string
  address_city: string
  phone: string | null
  email: string | null
  logo_path: string | null
  is_active: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export type TippgeberReferralRow = {
  id: string
  tippgeber_user_id: string
  status: string
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string
  expose_file_path: string | null
  expose_file_name: string | null
  expose_mime_type: string | null
  expose_size_bytes: number | null
  manual_purchase_price: number | null
  manual_broker_commission_percent: number | null
  property_street: string | null
  property_house_number: string | null
  property_zip: string | null
  property_city: string | null
  assigned_advisor_id: string | null
  assigned_at: string | null
  linked_lead_id: string | null
  linked_case_id: string | null
  linked_offer_id: string | null
  bank_outcome: string | null
  bank_decided_at: string | null
  commission_status: string
  commission_base_amount: number | null
  commission_percent_rate: number | null
  commission_fixed_net_amount: number | null
  commission_net_amount: number | null
  commission_vat_rate: number | null
  commission_vat_amount: number | null
  commission_gross_amount: number | null
  commission_reason: string | null
  commission_calculated_at: string | null
  payout_credit_note_path: string | null
  payout_credit_note_file_name: string | null
  payout_credit_note_mime_type: string | null
  payout_credit_note_size_bytes: number | null
  payout_credit_note_uploaded_at: string | null
  payout_released_at: string | null
  admin_internal_note: string | null
  created_at: string
  updated_at: string
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

function trimOrNull(value: unknown) {
  const s = String(value ?? "").trim()
  return s ? s : null
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim())
}

export function isPhone(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits.length >= 6
}

export function safeFileName(name: string) {
  return String(name ?? "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 160) || "file"
}

export async function getTippgeberProfileByUserId(userId: string) {
  const admin = supabaseAdmin()
  const { data } = await admin
    .from("tippgeber_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as TippgeberProfileRow | null) ?? null
}

export async function getTippgeberBrandForCase(caseId: string) {
  const admin = supabaseAdmin()
  const { data: referral } = await admin
    .from("tippgeber_referrals")
    .select("id,tippgeber_user_id")
    .eq("linked_case_id", caseId)
    .maybeSingle()
  if (!referral?.tippgeber_user_id) return null

  const { data: profile } = await admin
    .from("tippgeber_profiles")
    .select("company_name,logo_path")
    .eq("user_id", referral.tippgeber_user_id)
    .maybeSingle()

  if (!profile) return null
  return {
    referral_id: String(referral.id),
    company_name: String((profile as any).company_name ?? "").trim() || "Tippgeber",
    logo_path: trimOrNull((profile as any).logo_path),
  }
}

export async function listTippgeberReferralsForUser(userId: string) {
  const admin = supabaseAdmin()
  const { data } = await admin
    .from("tippgeber_referrals")
    .select("*")
    .eq("tippgeber_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as TippgeberReferralRow[]
}

export async function listAllTippgeberReferrals(limit = 500) {
  const admin = supabaseAdmin()
  const { data } = await admin
    .from("tippgeber_referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as TippgeberReferralRow[]
}

export function computeTippgeberYtdMetrics(referrals: TippgeberReferralRow[], now = new Date()) {
  const year = now.getFullYear()
  const start = new Date(year, 0, 1).getTime()
  const end = new Date(year + 1, 0, 1).getTime()

  let totalTips = 0
  let openCommissionGross = 0
  let paidCommissionGross = 0

  for (const r of referrals) {
    const createdAtTs = new Date(r.created_at).getTime()
    if (Number.isFinite(createdAtTs) && createdAtTs >= start && createdAtTs < end) totalTips += 1

    const gross = Number(r.commission_gross_amount ?? 0)
    const calcTs = r.commission_calculated_at ? new Date(r.commission_calculated_at).getTime() : NaN
    const paidTs = r.payout_released_at ? new Date(r.payout_released_at).getTime() : NaN

    if (r.commission_status === "open" && Number.isFinite(calcTs) && calcTs >= start && calcTs < end) {
      openCommissionGross += gross
    }
    if (r.commission_status === "paid" && Number.isFinite(paidTs) && paidTs >= start && paidTs < end) {
      paidCommissionGross += gross
    }
  }

  return {
    totalTipsYtd: totalTips,
    openCommissionGrossYtd: Math.round((openCommissionGross + Number.EPSILON) * 100) / 100,
    paidCommissionGrossYtd: Math.round((paidCommissionGross + Number.EPSILON) * 100) / 100,
  }
}

async function resolveCommissionBaseAmount(opts: {
  admin: ReturnType<typeof supabaseAdmin>
  caseId: string
  offerId?: string | null
}) {
  const { admin, caseId, offerId } = opts

  if (offerId) {
    const { data: currentOffer } = await admin
      .from("case_offers")
      .select("bank_commission_amount")
      .eq("id", offerId)
      .maybeSingle()
    const currentAmount = Number((currentOffer as { bank_commission_amount?: number | null } | null)?.bank_commission_amount ?? 0)
    if (Number.isFinite(currentAmount) && currentAmount > 0) return currentAmount
  }

  const { data: acceptedOffer } = await admin
    .from("case_offers")
    .select("bank_commission_amount")
    .eq("case_id", caseId)
    .eq("bank_status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const acceptedAmount = Number((acceptedOffer as { bank_commission_amount?: number | null } | null)?.bank_commission_amount ?? 0)
  if (Number.isFinite(acceptedAmount) && acceptedAmount > 0) return acceptedAmount

  return 0
}

async function getTippgeberEmail(userId: string) {
  const admin = supabaseAdmin()
  const authUser = await admin.auth.admin.getUserById(userId)
  return String(authUser.data?.user?.email ?? "").trim().toLowerCase() || null
}

export async function sendTippgeberBankOutcomeEmail(opts: {
  referral: TippgeberReferralRow
  profile: TippgeberProfileRow | null
  caseId: string
  outcome: TippgeberBankOutcome
}) {
  const email = (opts.profile?.email && isEmail(opts.profile.email)) ? opts.profile.email.toLowerCase() : await getTippgeberEmail(opts.referral.tippgeber_user_id)
  if (!email) return { ok: false as const, error: "missing_tippgeber_email" }

  const caseMeta = await getCaseMeta(opts.caseId)
  const approved = opts.outcome === "approved"
  const subject =
    approved
      ? "Bankstatus: Angenommen (Tippgeber-Provision offen)"
      : "Bankstatus: Abgelehnt (keine Tippgeber-Provision)"

  const grossText = formatEuro(opts.referral.commission_gross_amount)
  const netText = formatEuro(opts.referral.commission_net_amount)

  const html = buildEmailHtml({
    title: approved ? "Bankstatus: Angenommen" : "Bankstatus: Abgelehnt",
    intro:
      opts.outcome === "approved"
        ? "Für einen von Ihnen empfohlenen Fall wurde der Bankstatus auf angenommen gesetzt."
        : "Für einen von Ihnen empfohlenen Fall wurde der Bankstatus auf abgelehnt gesetzt.",
    steps: approved
      ? [
          `Ihre Provision wurde vorgemerkt (${grossText} brutto / ${netText} netto).`,
          "Die Auszahlung erfolgt nach interner Freigabe.",
        ]
      : [
          "Bei Bankablehnung wird keine Tippgeber-Provision vorgemerkt.",
          "Eine Provision entsteht nur bei Bankzusage.",
        ],
    bodyHtml: `
      <div style="font-size:13px; line-height:22px; color:#334155;">
        <div><strong style="color:#0f172a;">Tipp-ID:</strong> ${opts.referral.id}</div>
        <div><strong style="color:#0f172a;">Fall:</strong> ${caseMeta?.case_ref ?? opts.caseId}</div>
        <div><strong style="color:#0f172a;">Status:</strong> ${approved ? "Angenommen" : "Abgelehnt"}</div>
      </div>
    `,
    eyebrow: "SEPANA - Tippgeber",
    preheader: subject,
  })

  return sendEmail({ to: email, subject, html })
}

export async function sendTippgeberCreditNoteEmail(opts: {
  referral: TippgeberReferralRow
  profile: TippgeberProfileRow | null
  downloadUrl: string
}) {
  const email = (opts.profile?.email && isEmail(opts.profile.email)) ? opts.profile.email.toLowerCase() : await getTippgeberEmail(opts.referral.tippgeber_user_id)
  if (!email) return { ok: false as const, error: "missing_tippgeber_email" }

  const subject = "Neue Gutschrift verfügbar"
  const html = buildEmailHtml({
    title: "Neue Gutschrift verfügbar",
    intro: "Für einen Ihrer Tipps wurde eine Gutschrift hochgeladen.",
    steps: [
      "Über den Button können Sie die Gutschrift herunterladen.",
      "Die Auszahlung erfolgt gemäß Freigabestatus im System.",
    ],
    ctaLabel: "Gutschrift herunterladen",
    ctaUrl: opts.downloadUrl,
    bodyHtml: `
      <div style="font-size:13px; line-height:22px; color:#334155;">
        <div><strong style="color:#0f172a;">Tipp-ID:</strong> ${opts.referral.id}</div>
        <div><strong style="color:#0f172a;">Provision brutto:</strong> ${formatEuro(opts.referral.commission_gross_amount)}</div>
      </div>
    `,
    eyebrow: "SEPANA - Tippgeber",
    preheader: subject,
  })

  return sendEmail({ to: email, subject, html })
}

export async function applyReferralBankOutcomeAndCommission(opts: {
  caseId: string
  offerId?: string | null
  outcome: TippgeberBankOutcome
  approvedCommissionBaseAmount?: number | null
  sourceActorRole?: string | null
}) {
  const admin = supabaseAdmin()
  const { data: referralRaw } = await admin
    .from("tippgeber_referrals")
    .select("*")
    .eq("linked_case_id", opts.caseId)
    .maybeSingle()

  const referral = (referralRaw as TippgeberReferralRow | null) ?? null
  if (!referral) {
    return { ok: true as const, skipped: true as const, reason: "no_referral" as const }
  }

  let baseAmount = 0
  if (opts.outcome === "approved") {
    const explicitBase = toMoney(opts.approvedCommissionBaseAmount ?? 0)
    baseAmount =
      explicitBase > 0
        ? explicitBase
        : await resolveCommissionBaseAmount({
            admin,
            caseId: opts.caseId,
            offerId: opts.offerId ?? null,
          })

    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return { ok: false as const, error: "approved_commission_base_missing" as const }
    }
  }

  const calc = calculateTippgeberCommission(opts.outcome, baseAmount)
  const nowIso = new Date().toISOString()

  const hasCommission = opts.outcome === "approved" && calc.grossAmount > 0
  const nextStatus = hasCommission ? "commission_open" : opts.outcome === "declined" ? "bank_declined" : "bank_approved"
  const updatePayload = {
    linked_offer_id: opts.offerId ?? referral.linked_offer_id ?? null,
    bank_outcome: opts.outcome,
    bank_decided_at: nowIso,
    commission_status: hasCommission ? "open" : "none",
    commission_base_amount: calc.baseAmount,
    commission_percent_rate: calc.percentRate,
    commission_fixed_net_amount: calc.fixedNetAmount,
    commission_net_amount: calc.netAmount,
    commission_vat_rate: calc.vatRate,
    commission_vat_amount: calc.vatAmount,
    commission_gross_amount: calc.grossAmount,
    commission_reason: calc.reason,
    commission_calculated_at: nowIso,
    status: nextStatus,
    updated_at: nowIso,
  }

  const previousOutcome = String(referral.bank_outcome ?? "").toLowerCase() || null
  const previousGross = Number(referral.commission_gross_amount ?? 0)

  const { error: updateError } = await admin.from("tippgeber_referrals").update(updatePayload).eq("id", referral.id)
  if (updateError) {
    return { ok: false as const, error: updateError.message }
  }

  const { data: profileRaw } = await admin
    .from("tippgeber_profiles")
    .select("*")
    .eq("user_id", referral.tippgeber_user_id)
    .maybeSingle()
  const profile = (profileRaw as TippgeberProfileRow | null) ?? null

  const outcomeChanged = previousOutcome !== opts.outcome
  const grossChanged = Math.round(previousGross * 100) !== Math.round(calc.grossAmount * 100)
  if (outcomeChanged || grossChanged) {
    await sendTippgeberBankOutcomeEmail({
      referral: { ...referral, ...updatePayload } as TippgeberReferralRow,
      profile,
      caseId: opts.caseId,
      outcome: opts.outcome,
    }).catch(() => null)
  }

  return {
    ok: true as const,
    skipped: false as const,
    referralId: referral.id,
    commission: calc,
  }
}

export async function markReferralCommissionPaid(opts: {
  referralId: string
}) {
  const admin = supabaseAdmin()
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from("tippgeber_referrals")
    .update({
      commission_status: "paid",
      status: "paid",
      payout_released_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", opts.referralId)
    .select("*")
    .single()

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, referral: data as TippgeberReferralRow }
}

export function buildTippgeberCreditNoteDownloadUrl(opts: { referralId: string }) {
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
  return `${base}/api/tippgeber/files?referralId=${encodeURIComponent(opts.referralId)}&kind=credit_note&download=1`
}
