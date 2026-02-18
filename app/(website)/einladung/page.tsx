"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import AuthShell from "../components/AuthShell"
import { createBrowserClient } from "@supabase/ssr"
import { Alert, Button, Icon, Input, PasswordStrength } from "../components/auth/ui"

function normalizeError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("expired") || m.includes("invalid")) return "Der Link ist ungültig oder abgelaufen."
  return message || "Fehler"
}

function normalizeResendError(message: string) {
  const m = (message || "").toLowerCase()
  if (m.includes("invalid_email")) return "Bitte eine gültige E-Mail-Adresse eingeben."
  if (m.includes("mail_not_configured")) return "E-Mail-Versand ist noch nicht konfiguriert."
  if (m.includes("mail_send_failed")) return "E-Mail konnte nicht gesendet werden."
  if (m.includes("link_failed")) return "Einladungslink konnte nicht erstellt werden."
  if (m.includes("too many") || m.includes("rate")) return "Zu viele Versuche. Bitte später erneut probieren."
  return normalizeError(message)
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function InvitationOrResetPageContent() {
  const supabase = useMemo(
    () =>
      createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { detectSessionInUrl: false },
      }),
    []
  )

  const router = useRouter()
  const sp = useSearchParams()

  const mode = sp.get("mode") || "invite"
  const title = mode === "reset" ? "Neues Passwort setzen" : "Einladung annehmen"
  const subtitle =
    mode === "reset"
      ? "Setzen Sie ein neues Passwort für Ihr Konto."
      : "Setzen Sie ein Passwort, um Ihren Zugang zu aktivieren."

  const [loading, setLoading] = useState(true)
  const [hasUser, setHasUser] = useState(false)

  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [errors, setErrors] = useState<{ p1?: string; p2?: string }>({})

  const [resendEmail, setResendEmail] = useState(() => sp.get("email") || "")
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const timeout = setTimeout(() => {
      if (ignore) return
      setMsg({ type: "err", text: "Zeitüberschreitung beim Laden. Bitte Link erneut öffnen." })
      setHasUser(false)
      setLoading(false)
    }, 6000)

    void (async () => {
      try {
        let sessionError: Error | null = null
        let hadHash = false

        if (typeof window !== "undefined" && window.location.hash) {
          hadHash = true
          const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
          const access_token = params.get("access_token")
          const refresh_token = params.get("refresh_token")

          if (access_token && refresh_token) {
            try {
              const { error } = await supabase.auth.setSession({ access_token, refresh_token })
              if (error) sessionError = new Error(error.message)
            } catch (error: unknown) {
              if (error instanceof Error) sessionError = error
            }
          }
        }

        let userId: string | null = null
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          userId = sessionData?.session?.user?.id ?? null
        } catch (error: unknown) {
          if (!(error instanceof Error) || error.name !== "AuthSessionMissingError") {
            // ignore only missing-session cases
          }
        }

        if (sessionError && !userId) {
          if (ignore) return
          setMsg({ type: "err", text: "Der Link ist ungültig oder abgelaufen. Bitte neuen Link anfordern." })
          setHasUser(false)
          return
        }

        if (ignore) return
        setHasUser(Boolean(userId))

        if (hadHash) {
          try {
            window.history.replaceState(null, "", window.location.pathname + window.location.search)
          } catch {
            // ignore
          }
        }
      } finally {
        clearTimeout(timeout)
        if (!ignore) setLoading(false)
      }
    })()

    return () => {
      ignore = true
      clearTimeout(timeout)
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

      const { data: sessionDataAfter } = await supabase.auth.getSession()
      const userId = sessionDataAfter?.session?.user?.id ?? null
      const accessToken = sessionDataAfter?.session?.access_token ?? null
      let shouldNotifyInviteAccepted = false

      if (userId) {
        if (mode === "invite") {
          const { data: profileBefore } = await supabase
            .from("profiles")
            .select("password_set_at")
            .eq("user_id", userId)
            .maybeSingle()
          shouldNotifyInviteAccepted = !profileBefore?.password_set_at
        }

        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            password_set_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )

        if (shouldNotifyInviteAccepted) {
          void fetch("/api/auth/invite-accepted", {
            method: "POST",
            keepalive: true,
            headers: {
              "content-type": "application/json",
              ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ mode, firstPasswordSet: true }),
          }).catch(() => null)
        }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        setMsg({ type: "ok", text: "Passwort gesetzt. Bitte jetzt einloggen." })
        setTimeout(() => router.replace("/login"), 650)
        return
      }

      setMsg({ type: "ok", text: "Passwort gesetzt. Sie werden weitergeleitet..." })
      router.refresh()
      setTimeout(() => router.replace("/app"), 650)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ""
      setMsg({ type: "err", text: normalizeError(message) })
    } finally {
      setBusy(false)
    }
  }

  async function resendInvite() {
    setResendMsg(null)
    const normalized = resendEmail.trim().toLowerCase()
    if (!isEmail(normalized)) {
      setResendError("Bitte eine gültige E-Mail-Adresse eingeben.")
      return
    }
    setResendError(null)
    setResendBusy(true)
    try {
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "resend_failed")

      if (json?.reason === "already_active") {
        setResendMsg({ type: "ok", text: "Konto ist bereits aktiv. Bitte direkt einloggen." })
      } else {
        setResendMsg({
          type: "ok",
          text: "Wenn ein passendes Konto existiert, wurde ein neuer Einladungslink gesendet.",
        })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Fehler"
      setResendMsg({ type: "err", text: normalizeResendError(message) })
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <AuthShell title={title} subtitle={subtitle}>
      {loading ? (
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          Lade Zugangsdaten...
        </div>
      ) : !hasUser ? (
        <div className="grid gap-4">
          <Alert type="err" title="Link ungültig oder abgelaufen">
            Bitte fordern Sie einen neuen Link an oder gehen Sie zum Login zurück.
          </Alert>

          {mode === "invite" ? (
            <div className="grid gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-4 py-4">
              <div className="text-xs text-slate-500">
                Einladungslink erneut zusenden. Bitte geben Sie Ihre E-Mail-Adresse ein.
              </div>
              <Input
                error={resendError}
                leftIcon={<Icon name="mail" />}
                placeholder="E-Mail für den Einladungslink"
                type="email"
                value={resendEmail}
                onChange={(e) => {
                  setResendEmail(e.target.value)
                  if (resendError) setResendError(null)
                  if (resendMsg) setResendMsg(null)
                }}
                autoComplete="email"
              />
              {resendMsg ? <Alert type={resendMsg.type}>{resendMsg.text}</Alert> : null}
              <Button className="w-full" type="button" loading={resendBusy} onClick={resendInvite}>
                Einladungslink erneut senden <Icon name="arrow" className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/passwort-vergessen" className="block">
              <Button className="w-full" type="button">
                Passwort-Link anfordern <Icon name="arrow" className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button className="w-full" type="button" variant="soft">
                Login
              </Button>
            </Link>
          </div>

          <p className="text-xs text-slate-500">Aus Sicherheitsgründen laufen Links nach einer gewissen Zeit ab.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Neues Passwort</label>
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
                  className="rounded-xl px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  <Icon name={showPw ? "eyeOff" : "eye"} />
                </button>
              }
            />
            <div className="-mt-1">
              <PasswordStrength value={password} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Passwort wiederholen</label>
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
                  className="rounded-xl px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPw2 ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  <Icon name={showPw2 ? "eyeOff" : "eye"} />
                </button>
              }
            />
          </div>

          {msg ? <Alert type={msg.type}>{msg.text}</Alert> : null}

          <Button loading={busy} type="submit">
            Passwort setzen <Icon name="spark" className="h-4 w-4" />
          </Button>

          <p className="text-xs text-slate-500">Nach dem Setzen werden Sie automatisch weitergeleitet.</p>
        </form>
      )}
    </AuthShell>
  )
}

export default function InvitationOrResetPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Einladung annehmen" subtitle="Setzen Sie ein Passwort, um Ihren Zugang zu aktivieren.">
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Lade Zugangsdaten...
          </div>
        </AuthShell>
      }
    >
      <InvitationOrResetPageContent />
    </Suspense>
  )
}
