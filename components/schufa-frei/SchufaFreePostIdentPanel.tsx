"use client"

import { startTransition, useState } from "react"
import { useRouter } from "next/navigation"

type FeedbackState =
  | { type: "success" | "warning" | "error"; text: string }
  | null

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function formatDateTime(value: string | null | undefined) {
  const raw = trimOrNull(value)
  if (!raw) return "-"
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(raw))
}

function parseExternalUrl(value: string | null | undefined) {
  const raw = trimOrNull(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url
  } catch {
    return null
  }
}

function linkHostLabel(value: string | null | undefined) {
  const parsed = parseExternalUrl(value)
  if (!parsed) return "Externer Link"
  return parsed.hostname.replace(/^www\./i, "")
}

export default function SchufaFreePostIdentPanel({
  mode,
  caseId,
  postidentUrl,
  postidentAddedAt,
  postidentNotifiedAt,
  statusAlias,
}: {
  mode: "advisor" | "customer"
  caseId?: string
  postidentUrl?: string | null
  postidentAddedAt?: string | null
  postidentNotifiedAt?: string | null
  statusAlias?: string | null
}) {
  const router = useRouter()
  const [draftUrl, setDraftUrl] = useState(postidentUrl ?? "")
  const [savedUrl, setSavedUrl] = useState(postidentUrl ?? null)
  const [savedAt, setSavedAt] = useState(postidentAddedAt ?? null)
  const [notifiedAt, setNotifiedAt] = useState(postidentNotifiedAt ?? null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const normalizedStatus = String(statusAlias ?? "").trim().toLowerCase()
  const currentUrl = trimOrNull(savedUrl)
  const postidentCompleted =
    normalizedStatus === "postident_successfully_completed" || normalizedStatus === "credit_payout"
  const payoutReached = normalizedStatus === "credit_payout"

  const shellClass = payoutReached
    ? "border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(180deg,#ffffff,#f0fdf4)]"
    : postidentCompleted
      ? "border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_34%),linear-gradient(180deg,#ffffff,#f8fffb)]"
      : currentUrl
        ? "border-cyan-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,#ffffff,#f8fcff)]"
        : "border-slate-200/70 bg-white"

  const statusLabel = payoutReached
    ? "Ausgezahlt"
    : postidentCompleted
      ? "Abgeschlossen"
      : currentUrl
        ? "Bereitgestellt"
        : "Ausstehend"

  async function submit() {
    if (mode !== "advisor") return
    const trimmedUrl = trimOrNull(draftUrl)
    if (!caseId) {
      setFeedback({ type: "error", text: "Fall-ID fehlt." })
      return
    }
    if (!trimmedUrl) {
      setFeedback({ type: "error", text: "Bitte zuerst einen PostIdent-Link einfügen." })
      return
    }

    setBusy(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/postident", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          postidentUrl: trimmedUrl,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "PostIdent-Link konnte nicht gespeichert werden.")
      }

      setSavedUrl(json?.postident_url ?? trimmedUrl)
      setDraftUrl(json?.postident_url ?? trimmedUrl)
      setSavedAt(json?.postident_added_at ?? new Date().toISOString())
      setNotifiedAt(json?.postident_notified_at ?? null)
      setFeedback({
        type: json?.emailSent ? "success" : "warning",
        text: json?.emailSent
          ? "PostIdent-Link gespeichert und Kunde per E-Mail benachrichtigt."
          : "PostIdent-Link gespeichert. Die E-Mail konnte nicht versendet werden.",
      })
      startTransition(() => router.refresh())
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "PostIdent-Link konnte nicht gespeichert werden.",
      })
    } finally {
      setBusy(false)
    }
  }

  async function markCompleted() {
    if (mode !== "advisor") return
    if (!caseId) {
      setFeedback({ type: "error", text: "Fall-ID fehlt." })
      return
    }

    setBusy(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/app/cases/schufa-frei/postident-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "PostIdent-Abschluss konnte nicht gespeichert werden.")
      }

      setFeedback({
        type: json?.emailSent ? "success" : "warning",
        text: json?.emailSent
          ? "PostIdent als erfolgreich abgeschlossen markiert und Kunde per E-Mail informiert."
          : "PostIdent als erfolgreich abgeschlossen markiert. Die E-Mail konnte nicht versendet werden.",
      })
      startTransition(() => router.refresh())
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "PostIdent-Abschluss konnte nicht gespeichert werden.",
      })
    } finally {
      setBusy(false)
    }
  }

  if (mode === "advisor") {
    return (
      <div className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${shellClass}`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">PostIdent-Link aus dem SKAG-Partnerbereich eintragen</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Hinterlegen Sie hier den finalen Link aus dem Partnerbereich. Beim Übermitteln wird der Link direkt im
                Kundendashboard gespeichert und der Kunde zusätzlich per E-Mail benachrichtigt.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                PostIdent-Link
                <input
                  type="url"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  placeholder="https://..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {busy ? "Übermittle..." : "PostIdent übermitteln"}
                </button>
                {!postidentCompleted ? (
                  <button
                    type="button"
                    onClick={markCompleted}
                    disabled={busy || !currentUrl}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    PostIdent erfolgreich abgeschlossen
                  </button>
                ) : (
                  <div className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm sm:w-auto">
                    PostIdent abgeschlossen
                  </div>
                )}
                {currentUrl ? (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 sm:w-auto"
                  >
                    Aktuellen Link öffnen
                  </a>
                ) : null}
              </div>
            </div>

            {feedback ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : feedback.type === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                }`}
              >
                {feedback.text}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel}</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">
                {currentUrl ? `Link hinterlegt (${linkHostLabel(currentUrl)})` : "Noch kein Link im Fall gespeichert"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Zuletzt übermittelt</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(savedAt)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">E-Mail versendet</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(notifiedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const customerTitle = payoutReached
    ? "PostIdent abgeschlossen"
    : postidentCompleted
      ? "PostIdent erfolgreich abgeschlossen"
      : currentUrl
        ? "PostIdent jetzt abschließen"
        : "PostIdent wird vorbereitet"

  const customerText = payoutReached
    ? "Die Legitimation ist abgeschlossen. Der nächste Schritt ist jetzt die Auszahlung beziehungsweise deren Bestätigung."
    : postidentCompleted
      ? "Die Legitimation wurde erfolgreich abgeschlossen. Als Nächstes folgt die Auszahlung."
      : currentUrl
        ? "Dein Vertrag ist unterschrieben. Bitte öffne jetzt den bereitgestellten PostIdent-Link und schließe die Legitimation vollständig ab. Der Ablauf läuft über unseren Partner SKAG Vertriebs GmbH."
        : "Sobald dein Berater den PostIdent-Link aus dem SKAG-Partnerbereich hinterlegt, erscheint er hier automatisch. Die Legitimation läuft über unseren Partner SKAG Vertriebs GmbH. Danach folgt die Auszahlung."

  return (
    <div className={`rounded-[28px] border p-5 shadow-sm sm:p-6 ${shellClass}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-slate-900">{customerTitle}</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{customerText}</p>
          {!postidentCompleted ? (
            <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm leading-relaxed text-cyan-900">
              Transparenzhinweis: Der PostIdent-Schritt wird über unseren Partner <span className="font-semibold">SKAG Vertriebs GmbH</span> abgewickelt.
            </div>
          ) : null}
          {currentUrl ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition sm:w-auto"
              >
                PostIdent öffnen
              </a>
              <div className="text-xs text-slate-500">Der Link öffnet in einem neuen Tab.</div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-[290px] lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</div>
            <div className="mt-2 text-base font-semibold text-slate-900">{statusLabel}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bereitgestellt</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateTime(notifiedAt || savedAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
