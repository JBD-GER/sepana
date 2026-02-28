"use client"

import { useState } from "react"

type Msg = { type: "ok" | "err"; text: string } | null

export default function ResendCustomerInviteButton({
  caseId,
  disabled,
}: {
  caseId: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  async function resend() {
    setMsg(null)
    setBusy(true)
    try {
      const res = await fetch("/api/app/cases/resend-customer-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          json?.error === "customer_email_missing"
            ? "Keine Kunden-E-Mail hinterlegt."
            : json?.error === "mail_not_configured"
              ? "Mailversand ist nicht konfiguriert."
              : json?.error === "mail_send_failed"
                ? "Einladung konnte nicht versendet werden."
                : json?.error || "Einladung konnte nicht versendet werden."
        )
      }

      if (json?.sent) {
        setMsg({ type: "ok", text: "Einladung erneut versendet." })
      } else if (json?.reason === "already_active") {
        setMsg({ type: "err", text: "Kunde hat bereits ein Passwort gesetzt." })
      } else {
        setMsg({ type: "err", text: "Einladung wurde nicht versendet." })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Fehler"
      setMsg({ type: "err", text: message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={resend}
        disabled={disabled || busy}
        className="w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Versende..." : "Einladung neu senden"}
      </button>
      {msg ? (
        <div className={`mt-1 text-[11px] ${msg.type === "ok" ? "text-emerald-700" : "text-slate-600"}`}>
          {msg.text}
        </div>
      ) : null}
    </div>
  )
}
