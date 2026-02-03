"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import AuthShell from "../components/AuthShell"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Alert, Button, Icon, Input } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch."
  if (m.includes("email not confirmed")) return "Bitte bestaetigen Sie zuerst Ihre E-Mail."
  if (m.includes("too many requests")) return "Zu viele Versuche. Bitte kurz warten und erneut probieren."
  return message || "Login fehlgeschlagen."
}

function safeNext(next?: string | null) {
  if (!next) return null
  if (!next.startsWith("/")) return null
  if (next.startsWith("/login")) return null
  return next
}

export default function LoginPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const router = useRouter()
  const sp = useSearchParams()

  const next = safeNext(sp.get("next")) || "/app"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email.trim()) e.email = "Bitte E-Mail eingeben."
    if (!password.trim()) e.password = "Bitte Passwort eingeben."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setMsg(null)
    if (!validate()) return

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      router.refresh()
      router.replace(next)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ""
      setMsg({ type: "err", text: normalizeError(message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Login" subtitle="Melden Sie sich an und setzen Sie Ihren Baufinanzierungsprozess nahtlos fort.">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">E-Mail</label>
          <Input
            error={errors.email}
            leftIcon={<Icon name="mail" />}
            placeholder="name@firma.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Passwort</label>
          <Input
            error={errors.password}
            leftIcon={<Icon name="lock" />}
            placeholder="••••••••"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="rounded-xl px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                <Icon name={showPw ? "eyeOff" : "eye"} />
              </button>
            }
          />
        </div>

        {msg ? <Alert type={msg.type}>{msg.text}</Alert> : null}

        <Button loading={busy} type="submit">
          Einloggen <Icon name="arrow" className="h-4 w-4" />
        </Button>

        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 text-sm text-slate-600">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link className="font-medium text-slate-700 underline underline-offset-2 transition hover:text-slate-900" href="/passwort-vergessen">
              Passwort vergessen?
            </Link>
            <Link className="font-medium text-slate-700 underline underline-offset-2 transition hover:text-slate-900" href="/registrieren">
              Konto erstellen
            </Link>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">Tipp: Nutzen Sie Ihr Portal fuer Uploads und Status statt langer Mailverlaeufe.</p>
      </form>
    </AuthShell>
  )
}
