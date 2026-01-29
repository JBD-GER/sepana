"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import AuthShell from "../components/AuthShell"
import { Alert, Button, Icon, Input } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch."
  if (m.includes("email not confirmed")) return "Bitte bestätigen Sie zuerst Ihre E-Mail."
  if (m.includes("too many requests")) return "Zu viele Versuche. Bitte kurz warten und erneut versuchen."
  return message || "Fehler"
}

function safeNext(next?: string | null) {
  if (!next) return null
  if (!next.startsWith("/")) return null
  if (next.startsWith("/login")) return null
  return next
}

export default function LoginPage() {
  const sp = useSearchParams()
  const next = safeNext(sp.get("next"))

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
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Login fehlgeschlagen")
      }

      // ✅ jetzt existieren HttpOnly Cookies -> Proxy erkennt user -> /app klappt
      window.location.href = next || "/app"
    } catch (err: any) {
      setMsg({ type: "err", text: normalizeError(err?.message ?? "") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Login" subtitle="Melden Sie sich an, um Ihren Vorgang sicher zu verwalten.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Input
          error={errors.email}
          leftIcon={<Icon name="mail" />}
          placeholder="name@firma.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />

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
              className="rounded-xl px-2 py-1 text-slate-600 hover:bg-slate-50"
              aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              <Icon name={showPw ? "eyeOff" : "eye"} />
            </button>
          }
        />

        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <Button loading={busy} type="submit">
          Einloggen <Icon name="arrow" className="h-4 w-4" />
        </Button>

        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link className="text-slate-600 hover:text-slate-900" href="/passwort-vergessen">
            Passwort vergessen?
          </Link>
          <Link className="text-slate-600 hover:text-slate-900" href="/registrieren">
            Konto erstellen
          </Link>
        </div>

        <div className="pt-2 text-xs text-slate-500">
          Tipp: Nutzen Sie Ihr Portal für Uploads & Status — keine unübersichtlichen E-Mail-Verläufe.
        </div>
      </form>
    </AuthShell>
  )
}
