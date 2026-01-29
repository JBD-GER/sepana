"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import AuthShell from "../components/AuthShell"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Alert, Button, Checkbox, Icon, Input, PasswordStrength } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("user already registered")) return "Diese E-Mail ist bereits registriert. Bitte einloggen."
  if (m.includes("password")) return "Passwort ist zu schwach oder entspricht nicht den Anforderungen."
  return message || "Fehler"
}

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

export default function RegisterPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)

  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptAgb, setAcceptAgb] = useState(false)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [errors, setErrors] = useState<{ email?: string; password?: string; consents?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email.trim()) e.email = "Bitte E-Mail eingeben."
    if (password.length < 8) e.password = "Mindestens 8 Zeichen."
    if (!acceptPrivacy || !acceptAgb) e.consents = "Bitte Datenschutz und AGB akzeptieren."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setMsg(null)
    if (!validate()) return

    setBusy(true)
    try {
      const siteUrl = getSiteUrl()

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // ✅ falls Email-Confirm aktiv ist -> Link geht hierhin
          emailRedirectTo: `${siteUrl}/auth/confirm?mode=signup`,
          data: {
            accept_privacy: true,
            accept_agb: true,
            accepted_at: new Date().toISOString(),
          },
        },
      })
      if (error) throw error

      setMsg({ type: "ok", text: "Konto erstellt. Bitte ggf. E-Mail bestätigen und dann einloggen." })
    } catch (err: any) {
      setMsg({ type: "err", text: normalizeError(err?.message ?? "") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Konto erstellen" subtitle="Für Vergleich, Status & Uploads – bitte Zustimmung bestätigen.">
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

        <div>
          <Input
            error={errors.password}
            leftIcon={<Icon name="lock" />}
            placeholder="mind. 8 Zeichen"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          <PasswordStrength value={password} />
        </div>

        <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
          <Checkbox checked={acceptPrivacy} onChange={setAcceptPrivacy}>
            Ich akzeptiere die{" "}
            <Link className="underline hover:text-slate-900" href="/datenschutz">
              Datenschutzerklärung
            </Link>
            .
          </Checkbox>
          <Checkbox checked={acceptAgb} onChange={setAcceptAgb}>
            Ich akzeptiere die{" "}
            <Link className="underline hover:text-slate-900" href="/agb">
              AGB
            </Link>
            .
          </Checkbox>
          {errors.consents ? <p className="text-xs text-rose-700">{errors.consents}</p> : null}
          <p className="text-xs text-slate-500">Ihre Zustimmung wird bei der Registrierung gespeichert.</p>
        </div>

        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <Button loading={busy} type="submit">
          Registrieren <Icon name="spark" className="h-4 w-4" />
        </Button>

        <div className="pt-1 text-sm text-slate-600">
          Bereits ein Konto?{" "}
          <Link className="underline hover:text-slate-900" href="/login">
            Zum Login
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
