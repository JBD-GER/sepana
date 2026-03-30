"use client"

import { useEffect, useRef, useState } from "react"

type Message = { type: "ok" | "err"; text: string } | null

export default function OnlinekreditDocumentPinCard({
  caseId,
  caseRef,
  accessToken,
  existingAccount,
  pin,
  revealPin = true,
  showCopyButton = true,
  autoSendOnMount = false,
}: {
  caseId: string
  caseRef: string
  accessToken: string
  existingAccount: boolean
  pin: string
  revealPin?: boolean
  showCopyButton?: boolean
  autoSendOnMount?: boolean
}) {
  const [mailBusy, setMailBusy] = useState(false)
  const [copyBusy, setCopyBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const autoTriggeredRef = useRef(false)

  async function sendPinMail(auto = false) {
    if (!auto) {
      setMailBusy(true)
      setMessage(null)
    }

    try {
      const response = await fetch("/api/onlinekredit/abschluss/pin-notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          caseRef,
          access: accessToken,
          existing: existingAccount ? "1" : "",
          auto: auto ? "1" : "",
        }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(String(json?.error ?? "Die PIN konnte nicht per E-Mail gesendet werden."))
      }

      if (auto) {
        if (json?.sent) {
          setMessage({ type: "ok", text: "Die PIN wurde dir zusätzlich separat per E-Mail geschickt." })
        }
        return
      }

      if (json?.sent) {
        setMessage({ type: "ok", text: "Die PIN wurde dir separat per E-Mail geschickt." })
      } else {
        setMessage({ type: "ok", text: "Wenn für diesen Vorgang bereits eine PIN-Mail versendet wurde, bleibt sie gültig." })
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Die PIN konnte nicht per E-Mail gesendet werden."
      setMessage({ type: "err", text })
    } finally {
      if (!auto) {
        setMailBusy(false)
      }
    }
  }

  async function copyPin() {
    setCopyBusy(true)
    try {
      await navigator.clipboard.writeText(pin)
      setMessage({ type: "ok", text: "Die PIN wurde in deine Zwischenablage kopiert." })
    } catch {
      setMessage({ type: "err", text: "Die PIN konnte nicht automatisch kopiert werden. Bitte kopiere sie manuell." })
    } finally {
      setCopyBusy(false)
    }
  }

  useEffect(() => {
    if (!autoSendOnMount) return
    if (autoTriggeredRef.current) return
    autoTriggeredRef.current = true
    void sendPinMail(true)
  }, [accessToken, autoSendOnMount, caseId, caseRef, existingAccount, pin])

  return (
    <div className="rounded-[28px] border border-cyan-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Dokumenten-PIN</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            {revealPin
              ? "Diese PIN brauchst du beim Öffnen geschützter Bankdokumente"
              : "Die PIN für geschützte Bankdokumente senden wir dir separat per E-Mail"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {revealPin ? (
              <>
                Falls die Bank beim Öffnen von Kreditvertrag oder Datenschutzhinweisen nach einer PIN fragt, nutze bitte genau
                diesen Code. Die PIN entspricht deiner Vorgangsnummer ohne Zusatz wie{" "}
                <span className="font-semibold text-slate-900">/1</span>.
              </>
            ) : (
              <>
                Aus Sicherheitsgründen zeigen wir die PIN auf dieser öffentlichen Seite nicht offen an. Wenn die Bank beim Öffnen
                eines Dokuments nach der PIN fragt, kannst du sie dir hier separat per E-Mail schicken lassen.
              </>
            )}
          </p>
        </div>

        {revealPin ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-950 px-5 py-4 text-center text-white shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">Aktuelle PIN</div>
            <div className="mt-2 text-2xl font-semibold tracking-[0.28em]">{pin}</div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sicherheit</div>
            <div className="mt-2 max-w-[16rem] leading-relaxed">
              Die PIN bleibt hier verborgen und wird nur separat per E-Mail versendet.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {showCopyButton ? (
          <button
            type="button"
            onClick={() => void copyPin()}
            disabled={copyBusy}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copyBusy ? "Kopiere..." : "PIN kopieren"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void sendPinMail(false)}
          disabled={mailBusy}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mailBusy ? "Versende..." : "PIN per E-Mail senden"}
        </button>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}
    </div>
  )
}
