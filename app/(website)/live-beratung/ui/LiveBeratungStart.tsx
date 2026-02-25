"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

type ProductChoice = "baufi" | "konsum"

type LiveStatus = {
  onlineCount: number
  availableCount: number
  waitMinutes: number
  availableAdvisorName: string | null
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function errorLabel(code: string | null) {
  if (!code) return "Live-Start gerade nicht möglich. Bitte erneut versuchen."
  if (code === "invalid_email") return "Bitte eine gültige E-Mail eingeben."
  if (code === "email_in_use") return "Diese E-Mail gehört bereits zu einem Beraterkonto."
  return "Live-Start gerade nicht möglich. Bitte erneut versuchen."
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function ProductButton({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        selected
          ? "border-cyan-300 bg-cyan-50 shadow-[0_10px_24px_rgba(6,182,212,0.12)]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600">{subtitle}</div>
    </button>
  )
}

function StatusDot({ online, available }: { online: boolean; available: boolean }) {
  if (!online) {
    return (
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
        <span className="absolute h-[1.5px] w-4 rotate-45 bg-slate-600" />
      </span>
    )
  }

  const dotClass = available ? "bg-emerald-500" : "bg-amber-500"
  const ringClass = available ? "bg-emerald-400/30" : "bg-amber-400/30"

  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <span className={`absolute inline-flex h-4 w-4 rounded-full ${ringClass} animate-ping`} />
      <span className={`relative h-2.5 w-2.5 rounded-full ${dotClass}`} />
    </span>
  )
}

function getBerlinMinutesNow() {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return hour * 60 + minute
}

export default function LiveBeratungStart() {
  const router = useRouter()
  const [product, setProduct] = useState<ProductChoice | null>(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)

  useEffect(() => {
    let alive = true
    let intervalId: number | null = null

    const loadStatus = async () => {
      try {
        const res = await fetch("/api/live/status", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!alive) return

        if (res.ok && json?.ok) {
          setLiveStatus({
            onlineCount: Number(json.onlineCount || 0),
            availableCount: Number(json.availableCount || 0),
            waitMinutes: Number(json.waitMinutes || 0),
            availableAdvisorName: typeof json.availableAdvisorName === "string" ? json.availableAdvisorName : null,
          })
        } else {
          setLiveStatus(null)
        }
      } catch {
        if (alive) setLiveStatus(null)
      } finally {
        if (alive) setStatusLoading(false)
      }
    }

    void loadStatus()
    intervalId = window.setInterval(() => {
      void loadStatus()
    }, 25000)

    return () => {
      alive = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  const onlineCount = liveStatus?.onlineCount ?? 0
  const availableCount = liveStatus?.availableCount ?? 0
  const waitMinutes = liveStatus?.waitMinutes ?? 0
  const canStart = onlineCount > 0
  const advisorName = String(liveStatus?.availableAdvisorName ?? "").trim() || "Ein Berater"
  const berlinMinutesNow = getBerlinMinutesNow()
  const inLiveHours = berlinMinutesNow >= 9 * 60 && berlinMinutesNow < 18 * 60

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()

    if (!product) {
      setError("Bitte wählen Sie zuerst Baufinanzierung oder Privatkredit.")
      return
    }
    if (!isEmail(trimmed)) {
      setError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (!canStart) {
      setError(
        inLiveHours
          ? "Aktuell sind alle Kundenberater im Gespräch. Bitte versuchen Sie es gleich erneut oder starten Sie eine Kreditanfrage."
          : "Aktuell ist kein Kundenberater online. Die Live-Beratung ist von 09:00 Uhr bis 18:00 Uhr verfügbar."
      )
      return
    }

    setBusy(true)
    setError(null)

    try {
      const res = await fetch("/api/live/landing/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          language: "de",
          caseType: product === "konsum" ? "konsum" : "baufi",
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(errorLabel(String(json?.error ?? null)))
        return
      }

      const caseId = String(json.caseId || "").trim()
      const caseRef = String(json.caseRef || "").trim()
      if (!caseId) {
        setError("Live-Session konnte nicht gestartet werden.")
        return
      }

      const params = new URLSearchParams()
      params.set("caseId", caseId)
      if (caseRef) params.set("caseRef", caseRef)
      if (json.existingAccount) params.set("existing", "1")

      if (product === "baufi") {
        params.set("source", "landing")
        router.push(`/baufinanzierung/auswahl/live?${params.toString()}`)
      } else {
        router.push(`/privatkredit/live?${params.toString()}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(59,130,246,0.12),transparent_34%),linear-gradient(135deg,#07162f_0%,#0b1f5e_58%,#0f3a80_100%)] p-5 text-white shadow-[0_22px_60px_rgba(2,6,23,0.35)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-12 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-blue-300/15 blur-3xl" />

        <div className="relative grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                Live-Beratung
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-100">
                <StatusDot online={canStart} available={availableCount > 0} />
                {statusLoading ? "Prüfung..." : canStart ? "Berater online" : inLiveHours ? "Im Gespräch" : "Aktuell offline"}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Schnell in die Live-Beratung starten
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
              Wenn ein Kundenberater online ist, reichen Produktwahl und E-Mail. Danach kommen Sie direkt in die Warteschlange und werden im Browser verbunden.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Einstieg</div>
                <div className="mt-1 text-sm font-semibold text-white">Produkt + E-Mail</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Verbindung</div>
                <div className="mt-1 text-sm font-semibold text-white">Direkt im Browser</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200/85">Ablauf</div>
                <div className="mt-1 text-sm font-semibold text-white">Im Warteraum: Fenster NICHT schließen</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200/85">Verfügbarkeit</div>

            {statusLoading ? (
              <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-100">
                Live-Verfügbarkeit wird geprüft...
              </div>
            ) : canStart ? (
              availableCount > 0 ? (
                <div className="mt-3 rounded-2xl border border-emerald-200/30 bg-emerald-300/10 p-4">
                  <div className="flex items-start gap-3">
                    <StatusDot online available />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Live verfügbar</div>
                      <div className="mt-1 text-base font-semibold text-white">{advisorName} ist aktuell verfügbar</div>
                      <div className="mt-1 text-sm text-slate-100/90">
                        {availableCount > 1
                          ? `+ ${availableCount - 1} weitere Berater sind gerade frei.`
                          : "Direkter Start ohne Wartezeit möglich."}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4">
                  <div className="flex items-start gap-3">
                    <StatusDot online available={false} />
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Berater online</div>
                      <div className="mt-1 text-base font-semibold text-white">Aktuell im Gespräch</div>
                      <div className="mt-1 text-sm text-slate-100/90">
                        Sie können trotzdem starten und werden in die Warteschlange aufgenommen
                        {waitMinutes ? ` (ca. ${waitMinutes} Minuten Wartezeit).` : "."}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-start gap-3">
                  <StatusDot online={false} available={false} />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                      {inLiveHours ? "Live-Zeit" : "Öffnungszeiten"}
                    </div>
                    <div className="mt-1 text-base font-semibold text-white">
                      {inLiveHours
                        ? "Aktuell sind alle Kundenberater im Gespräch"
                        : "Aktuell ist kein Kundenberater online"}
                    </div>
                    <div className="mt-1 text-sm text-slate-200/90">
                      {inLiveHours
                        ? "Bitte versuchen Sie es in wenigen Minuten erneut oder starten Sie bereits jetzt eine Kreditanfrage."
                        : "Die Live-Beratung ist von 09:00 Uhr bis 18:00 Uhr verfügbar. Sie können in der Zwischenzeit jederzeit eine Kreditanfrage starten."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProductButton
                  selected={product === "baufi"}
                  title="Baufinanzierung"
                  subtitle="Live-Einstieg für Baufinanzierung"
                  onClick={() => setProduct("baufi")}
                />
                <ProductButton
                  selected={product === "konsum"}
                  title="Privatkredit"
                  subtitle="Live-Einstieg für Privatkredit"
                  onClick={() => setProduct("konsum")}
                />
              </div>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail für die Live-Beratung"
                className="h-12 w-full rounded-2xl border border-white/20 bg-white/95 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
              />

              <button
                type="submit"
                disabled={busy || !canStart}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Starte..." : canStart ? "Live-Beratung starten" : inLiveHours ? "Alle Berater im Gespräch" : "Außerhalb der Live-Zeit"}
              </button>
            </form>

            {error ? <div className="mt-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

            {!canStart ? (
              <a
                href="/kreditanfrage"
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Stattdessen Kreditanfrage starten
              </a>
            ) : (
              <div className="mt-2 text-xs text-slate-200/85">
                Nach dem Start werden Sie in den Warteraum weitergeleitet. Dort startet die Session automatisch, sobald ein Berater annimmt.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
