import { NextResponse } from "next/server"
import { getSandboxIbanDemo, looksLikeIban, normalizeIbanInput } from "@/lib/banking/iban"

export const runtime = "nodejs"

type OpenIbanResponse = {
  valid?: boolean
  messages?: string[]
  bankData?: {
    bic?: string | null
    name?: string | null
    bankCode?: string | null
    city?: string | null
    zip?: string | null
  } | null
}

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const iban = normalizeIbanInput(searchParams.get("iban"))
    const sandboxDemo = getSandboxIbanDemo(iban)

    if (!looksLikeIban(iban)) {
      return NextResponse.json({ ok: false, error: "Bitte zuerst eine gültige IBAN eingeben." }, { status: 400 })
    }

    if (sandboxDemo) {
      return NextResponse.json({
        ok: true,
        iban,
        bic: sandboxDemo.bic,
        bankName: sandboxDemo.bankName,
        bankCode: sandboxDemo.bankCode,
        city: null,
        zip: null,
      })
    }

    const response = await fetch(
      `https://openiban.com/validate/${encodeURIComponent(iban)}?getBIC=true&validateBankCode=true`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }
    )

    const json = (await response.json().catch(() => null)) as OpenIbanResponse | null
    if (!response.ok || !json) {
      return NextResponse.json({ ok: false, error: "BIC-Lookup ist aktuell nicht verfügbar." }, { status: 502 })
    }

    if (!json.valid) {
      const message = Array.isArray(json.messages) ? json.messages.join(" ") : "IBAN konnte nicht validiert werden."
      return NextResponse.json({ ok: false, error: message }, { status: 400 })
    }

    const bic = trimOrNull(json.bankData?.bic)?.toUpperCase() ?? null
    if (!bic) {
      return NextResponse.json(
        { ok: false, error: "Für diese IBAN konnte keine BIC automatisch ermittelt werden." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      iban,
      bic,
      bankName: trimOrNull(json.bankData?.name),
      bankCode: trimOrNull(json.bankData?.bankCode),
      city: trimOrNull(json.bankData?.city),
      zip: trimOrNull(json.bankData?.zip),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "BIC-Lookup ist fehlgeschlagen." },
      { status: 500 }
    )
  }
}
