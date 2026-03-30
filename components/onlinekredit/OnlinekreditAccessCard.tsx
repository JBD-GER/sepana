"use client"

import Link from "next/link"
import { useState } from "react"

type Msg = { type: "ok" | "err"; text: string } | null

export default function OnlinekreditAccessCard({
  caseId,
  loginHref,
  primaryEmail,
  existingAccount,
  hasAcceptedOffer,
  hasApplication,
  hasRunningApplicationJob,
  acceptedOfferIsOnline,
  directOnlineBankCompletionFlow,
}: {
  caseId: string
  loginHref: string
  primaryEmail?: string | null
  existingAccount: boolean
  hasAcceptedOffer: boolean
  hasApplication: boolean
  hasRunningApplicationJob: boolean
  acceptedOfferIsOnline: boolean
  directOnlineBankCompletionFlow: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const portalReady = hasAcceptedOffer || hasApplication || hasRunningApplicationJob

  async function resendInvite() {
    const email = String(primaryEmail ?? "").trim().toLowerCase()
    if (!email) {
      setMsg({ type: "err", text: "Es ist keine E-Mail-Adresse für den Einladungslink hinterlegt." })
      return
    }

    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, forcePasswordSetup: !existingAccount }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Einladungslink konnte nicht versendet werden."))
      }

      if (json?.reason === "already_active") {
        setMsg({ type: "ok", text: "Das Konto ist bereits aktiv. Du kannst dich direkt einloggen." })
      } else if (json?.sent) {
        setMsg({ type: "ok", text: "Der Einladungslink wurde erneut per E-Mail versendet." })
      } else {
        setMsg({ type: "ok", text: "Wenn ein passender Zugang existiert, wurde ein neuer Link versendet." })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Einladungslink konnte nicht versendet werden."
      setMsg({ type: "err", text: message })
    } finally {
      setBusy(false)
    }
  }

  let title = "SEPANA-Portal für den weiteren Verlauf"
  let description =
    "Du kannst Unterlagen und Status jederzeit auch im SEPANA-Portal verfolgen. Auf dieser Seite musst du aber nicht abbrechen."

  if (hasRunningApplicationJob) {
    title = "Portalzugang steht parallel bereit"
    description = existingAccount
      ? "Deine finale Anfrage wurde übernommen. Sobald der Antrag angelegt ist, kannst du hier weitermachen oder dich parallel im Portal anmelden."
      : "Deine finale Anfrage wurde übernommen. Sobald der Antrag angelegt ist, kannst du hier weitermachen oder später über deinen Einladungslink ins Portal wechseln."
  } else if (hasApplication) {
    title = directOnlineBankCompletionFlow ? "Portalzugang nur noch parallel nötig" : "Portalzugang optional direkt bereit"
    description = directOnlineBankCompletionFlow
      ? existingAccount
        ? "Dein Antrag ist angelegt. Der letzte Schritt läuft jetzt direkt bei der Bank. Das Portal bleibt nur als paralleler Zugriff verfügbar."
        : "Dein Antrag ist angelegt. Der letzte Schritt läuft jetzt direkt bei der Bank. Den SEPANA-Zugang kannst du parallel weiter nutzen."
      : existingAccount
        ? "Dein Antrag ist angelegt. Du kannst die Unterlagen direkt hier hochladen oder später denselben Vorgang im Portal weiterführen."
        : "Dein Antrag ist angelegt. Du kannst die Unterlagen direkt hier hochladen und dir parallel deinen Portalzugang per Einladungslink sichern."
  } else if (hasAcceptedOffer) {
    title = "Portalzugang jetzt verfügbar"
    description = existingAccount
      ? "Deine finale Anfrage läuft bereits. Du kannst den Vorgang später auch im Portal weiterverfolgen."
      : "Deine finale Anfrage läuft bereits. Nach dem Einladungslink kannst du denselben Vorgang zusätzlich im Portal weiterverfolgen."
  }

  const featureItems = directOnlineBankCompletionFlow
    ? [
        "Bank-Fortsetzung, Status und spätere Bankdokumente bleiben hier und im Portal sichtbar.",
        "Falls doch noch Unterlagen angefordert werden, tauchen sie weiterhin sauber im SEPANA-Flow auf.",
        "Der Portalzugang ist parallel praktisch, aber nicht mehr der Flaschenhals für den Abschluss.",
      ]
    : acceptedOfferIsOnline
      ? [
          "Digitaler Abschluss und Portal laufen sauber zusammen, ohne dass dein Fall auseinanderfällt.",
          "Status, Uploads und nächste Schritte bleiben unter derselben Fall-ID gebündelt.",
          "Du kannst jederzeit zwischen dieser Seite und dem Portal wechseln, ohne etwas zu verlieren.",
        ]
      : [
          "Das Portal hält Unterlagen, Status und weitere Schritte an einem Ort zusammen.",
          "SEPANA führt den begleiteten Abschluss dort nahtlos mit demselben Fall weiter.",
          "Auch später bleibt alles auf derselben Strecke nachvollziehbar und vollständig.",
        ]

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(135deg,#020617,#0f172a_46%,#083344)] p-4 text-white shadow-[0_30px_90px_rgba(15,23,42,0.34)] sm:rounded-[36px] sm:p-8">
      <div className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">SEPANA Portal</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-200/90 sm:text-[15px]">{description}</p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {featureItems.map((item, index) => (
              <div
                key={`${index}:${item}`}
                className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-sm leading-6 text-slate-200 backdrop-blur"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/70">Pluspunkt {index + 1}</div>
                <div className="mt-2">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-lg rounded-[24px] border border-white/12 bg-white/10 p-4 shadow-[0_18px_50px_rgba(2,6,23,0.18)] backdrop-blur sm:rounded-[30px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/80">Zugang</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {existingAccount ? "Bestehendes Konto erkannt" : "Einladungslink per E-Mail"}
              </div>
            </div>
            <span className="break-all rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
              Fall-ID: {caseId}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-200/90">
            {existingAccount
              ? "Du kannst dich jederzeit direkt in dein SEPANA-Portal einloggen."
              : "Falls du den Einladungslink nicht mehr findest, kannst du ihn hier erneut anfordern."}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={loginHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 sm:w-auto"
            >
              Zum Login
            </Link>
            {!existingAccount ? (
              <button
                type="button"
                onClick={() => void resendInvite()}
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/6 px-5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {busy ? "Versende…" : "Einladungslink neu senden"}
              </button>
            ) : null}
          </div>

          {msg ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                msg.type === "ok"
                  ? "border-emerald-300/30 bg-emerald-200/10 text-emerald-50"
                  : "border-amber-300/30 bg-amber-200/10 text-amber-50"
              }`}
            >
              {msg.text}
            </div>
          ) : null}

          {!portalReady ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-slate-200">
              Zuerst Angaben vervollständigen, dann ein Live-Angebot auswählen und anschließend die finale Anfrage
              bestätigen. Danach kannst du hier bleiben oder später ins Portal wechseln.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
