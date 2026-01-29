"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import AuthShell from "../components/AuthShell"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Alert, Button, Icon, Input, PasswordStrength } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("expired") || m.includes("invalid")) return "Der Link ist ungültig oder abgelaufen."
  if (m.includes("password")) return "Passwort entspricht nicht den Anforderungen."
  return message || "Fehler"
}

export default function InvitationOrResetPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const router = useRouter()
  const sp = useSearchParams()

  const mode = sp.get("mode") || "invite" // invite | reset
  const title = mode === "reset" ? "Neues Passwort setzen" : "Einladung annehmen"
  const subtitle =
    mode === "reset"
      ? "Setzen Sie ein neues Passwort für Ihr Konto."
      : "Setzen Sie ein Passwort, um den Zugang zu aktivieren."

  const [loading, setLoading] = useState(true)
  const [hasUser, setHasUser] = useState(false)

  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!alive) return
      setHasUser(!!data.user)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  function validate() {
    const e: typeof errors = {}
    if (password.length < 8) e.p1 = "Mindestens 8 Zeichen."
    if (password2.length < 8) e.p2 = "Bitte wiederholen."
    if (password && password2 && password !== password2) e.p2 = "Passwörter stimmen nicht überein."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (!hasUser) {
      setMsg({ type: "err", text: "Der Link ist ungültig oder abgelaufen. Bitte neuen Link anfordern." })
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMsg({ type: "ok", text: "Passwort gesetzt. Sie werden weitergeleitet…" })
      router.refresh()
      setTimeout(() => router.replace("/app"), 650)
    } catch (err: any) {
      setMsg({ type: "err", text: normalizeError(err?.message ?? "") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {loading ? (
        <div className="text-sm text-slate-600">Lade…</div>
      ) : !hasUser ? (
        <div className="grid gap-4">
          <Alert type="err" title="Link ungültig oder abgelaufen">
            Bitte fordern Sie einen neuen Link an oder gehen Sie zurück zum Login.
          </Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/passwort-vergessen" className="flex-1">
              <Button className="w-full" type="button">
                Passwort-Link anfordern <Icon name="arrow" className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="flex-1">
              <Button className="w-full" type="button" variant="soft">
                Login
              </Button>
            </Link>
          </div>

          <div className="text-xs text-slate-500">Hinweis: Aus Sicherheitsgründen laufen Links nach einiger Zeit ab.</div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Input
            error={errors.p1 ?? null}
            leftIcon={<Icon name="lock" />}
            placeholder="Neues Passwort (mind. 8 Zeichen)"
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
          <div className="-mt-1">
            <PasswordStrength value={password} />
          </div>

          <Input
            error={errors.p2 ?? null}
            leftIcon={<Icon name="lock" />}
            placeholder="Passwort wiederholen"
            type={showPw2 ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPw2((v) => !v)}
                className="rounded-xl px-2 py-1 text-slate-600 hover:bg-slate-50"
                aria-label={showPw2 ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                <Icon name={showPw2 ? "eyeOff" : "eye"} />
              </button>
            }
          />

          {msg && <Alert type={msg.type}>{msg.text}</Alert>}

          <Button loading={busy} type="submit">
            Passwort setzen <Icon name="spark" className="h-4 w-4" />
          </Button>

          <div className="text-xs text-slate-500">Nach dem Setzen werden Sie automatisch weitergeleitet.</div>
        </form>
      )}
    </AuthShell>
  )
}
