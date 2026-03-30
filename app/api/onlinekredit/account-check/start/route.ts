import { NextResponse } from "next/server"
import { getSandboxIbanDemo, normalizeIbanInput } from "@/lib/banking/iban"
import { createEuropaceAccountCheckSession } from "@/lib/europace/accountCheck"
import { syncEuropaceCase } from "@/lib/europace/service"
import { getOnlinekreditAccountCheckRestrictionReason } from "@/lib/onlinekredit/accountCheckPolicy"
import { resolvePublicOnlinekreditCaseAccess } from "@/lib/onlinekredit/caseAccess"
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin"

export const runtime = "nodejs"

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

async function logAccountCheckEvent(admin: ReturnType<typeof supabaseAdmin>, input: {
  caseId: string
  success: boolean
  requestPayload: unknown
  responsePayload?: unknown
  errorMessage?: string | null
}) {
  await admin.from("case_europace_sync_events").insert({
    case_id: input.caseId,
    direction: "outbound",
    operation: "createAccountCheckSession",
    request_payload: input.requestPayload,
    response_payload: input.responsePayload ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const caseId = trimOrNull(body?.caseId)
  const caseRef = trimOrNull(body?.caseRef)
  const accessToken = trimOrNull(body?.access)

  if (!caseId || !caseRef || !accessToken) {
    return NextResponse.json({ ok: false, error: "caseId, caseRef oder access fehlt." }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const access = await resolvePublicOnlinekreditCaseAccess(admin, {
    caseId,
    caseRef,
    accessToken,
    expectedCaseType: "konsum",
  })

  if (!access.ok) {
    const error =
      access.error === "case_type_not_supported"
        ? "Diese Strecke ist nur für Privatkredit vorgesehen."
        : "Der Onlinekredit-Link ist ungültig oder abgelaufen."
    return NextResponse.json({ ok: false, error }, { status: access.status })
  }

  const [applicantsResult, baufiResult] = await Promise.all([
    admin.from("case_applicants").select("employment_type").eq("case_id", caseId),
    admin.from("case_baufi_details").select("purpose").eq("case_id", caseId).maybeSingle(),
  ])

  if (applicantsResult.error) {
    return NextResponse.json({ ok: false, error: applicantsResult.error.message }, { status: 500 })
  }
  if (baufiResult.error) {
    return NextResponse.json({ ok: false, error: baufiResult.error.message }, { status: 500 })
  }

  const accountCheckRestrictedReason = getOnlinekreditAccountCheckRestrictionReason({
    purpose: baufiResult.data?.purpose,
    employmentTypes: (applicantsResult.data ?? []).map((row) => row.employment_type),
  })
  if (accountCheckRestrictedReason) {
    return NextResponse.json({ ok: false, error: accountCheckRestrictedReason }, { status: 409 })
  }

  const { data: additionalRow, error: additionalError } = await admin
    .from("case_additional_details")
    .select("bank_iban,bank_bic")
    .eq("case_id", caseId)
    .maybeSingle()

  if (additionalError) {
    return NextResponse.json({ ok: false, error: additionalError.message }, { status: 500 })
  }

  const sandboxDemo = getSandboxIbanDemo(normalizeIbanInput(additionalRow?.bank_iban))
  if (sandboxDemo) {
    const storedBankIban = normalizeIbanInput(additionalRow?.bank_iban)
    const storedBankBic = trimOrNull(additionalRow?.bank_bic)?.toUpperCase() ?? null
    const needsSandboxNormalization = storedBankIban !== sandboxDemo.iban || storedBankBic !== sandboxDemo.bic

    if (needsSandboxNormalization) {
      const { error: bankUpdateError } = await admin.from("case_additional_details").upsert(
        {
          case_id: caseId,
          bank_iban: sandboxDemo.iban,
          bank_bic: sandboxDemo.bic,
        },
        { onConflict: "case_id" }
      )

      if (bankUpdateError) {
        return NextResponse.json({ ok: false, error: bankUpdateError.message }, { status: 500 })
      }
    }

    try {
      await syncEuropaceCase(admin, caseId)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sandbox-Kontocheck konnte vor dem Start nicht nach Europace synchronisiert werden."
      return NextResponse.json({ ok: false, error: message }, { status: 502 })
    }
  }

  const { data: europaceRow, error: europaceError } = await admin
    .from("case_europace")
    .select("vorgangsnummer")
    .eq("case_id", caseId)
    .maybeSingle()

  if (europaceError) {
    return NextResponse.json({ ok: false, error: europaceError.message }, { status: 500 })
  }

  const vorgangsnummer = trimOrNull(europaceRow?.vorgangsnummer)
  if (!vorgangsnummer) {
    return NextResponse.json(
      { ok: false, error: "Für diesen Fall liegt noch keine Europace-Vorgangsnummer vor." },
      { status: 409 }
    )
  }

  try {
    const result = await createEuropaceAccountCheckSession(vorgangsnummer)
    const wizardSessionKey = trimOrNull(result?.wizardSessionKey)

    if (!wizardSessionKey) {
      throw new Error("Kontocheck konnte nicht vorbereitet werden. Es wurde kein Browser-Schlüssel zurückgegeben.")
    }

    await logAccountCheckEvent(admin, {
      caseId,
      success: true,
      requestPayload: { vorgangsnummer },
      responsePayload: { wizardSessionKeyPresent: true },
      errorMessage: null,
    })

    return NextResponse.json({
      ok: true,
      started: true,
      wizardSessionKey,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kontocheck konnte nicht gestartet werden."

    await logAccountCheckEvent(admin, {
      caseId,
      success: false,
      requestPayload: { vorgangsnummer },
      responsePayload: null,
      errorMessage: message,
    })

    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
