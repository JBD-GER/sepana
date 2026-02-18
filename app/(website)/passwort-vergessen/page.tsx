"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import AuthShell from "../components/AuthShell"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Alert, Button, Icon, Input } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("rate limit")) return "Zu viele Anfragen. Bitte kurz warten."
  return message || "Fehler"
}

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [errorEmail, setErrorEmail] = useState<string | null>(null)

  function validate() {
    if (!email.trim()) {
      setErrorEmail("Bitte E-Mail eingeben.")
      return false
    }
    setErrorEmail(null)
    return true
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!validate()) return

    setBusy(true)
    try {
      const origin = window.location.origin
      const redirectTo = `${origin}/auth/confirm?mode=reset`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error

      setMsg({ type: "ok", text: "E-Mail wurde versendet. Bitte Postfach prüfen." })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ""
      setMsg({ type: "err", text: normalizeError(message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Passwort vergessen" subtitle="Wir senden Ihnen einen sicheren Link zum Zurücksetzen.">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">E-Mail</label>
          <Input
            error={errorEmail}
            leftIcon={<Icon name="mail" />}
            placeholder="name@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        {msg ? (
          <Alert type={msg.type}>
            {msg.text}
            {msg.type === "ok" ? (
              <div className="mt-1 text-xs opacity-80">Wenn nichts ankommt: Spam prüfen oder nach 2 Minuten erneut versuchen.</div>
            ) : null}
          </Alert>
        ) : null}

        <Button loading={busy} type="submit">
          Link senden <Icon name="arrow" className="h-4 w-4" />
        </Button>

        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 text-sm text-slate-600">
          <Link className="font-medium text-slate-700 underline underline-offset-2 transition hover:text-slate-900" href="/login">
            Zurück zum Login
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
