"use client"

import { useEffect, useRef, useState } from "react"

type AccountCheckInfoDialogProps = {
  open: boolean
  onClose: () => void
  providerName?: string | null
  productName?: string | null
  onStart?: (() => void | Promise<void>) | null
  startStatus?: "idle" | "starting" | "activated"
  errorText?: string | null
  wizardSessionKey?: string | null
  onWizardFinished?: (() => void) | null
  onWizardAborted?: (() => void) | null
}

type Xs2aApi = {
  useBaseStyles?: () => void
  finish?: (handler: () => void) => void
  abort?: (handler: () => void) => void
  init?: () => void
}

declare global {
  interface Window {
    xs2a?: Xs2aApi
  }
}

let xs2aScriptPromise: Promise<void> | null = null

function trimOrNull(value: unknown) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function formatXs2aContainer(container: HTMLDivElement) {
  container.style.display = "block"
  container.style.width = "100%"
  container.style.maxWidth = "100%"
  container.style.marginInline = "auto"

  const root = container.firstElementChild
  if (root instanceof HTMLElement) {
    root.style.display = "block"
    root.style.marginInline = "auto"
    root.style.width = "100%"
    root.style.maxWidth = "100%"
    root.style.minWidth = "0"
  }

  const iframes = container.querySelectorAll("iframe")
  for (const iframe of iframes) {
    iframe.style.display = "block"
    iframe.style.width = "100%"
    iframe.style.maxWidth = "100%"
    iframe.style.minWidth = "0"
    iframe.style.minHeight = "540px"
    iframe.style.border = "0"
    iframe.style.borderRadius = "18px"
    iframe.style.background = "#ffffff"
  }
}

function loadXs2aScript() {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  if (window.xs2a?.init) {
    return Promise.resolve()
  }

  if (xs2aScriptPromise) {
    return xs2aScriptPromise
  }

  xs2aScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-xs2a-script="true"]')
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener(
        "error",
        () => {
          xs2aScriptPromise = null
          reject(new Error("XS2A-Skript konnte nicht geladen werden."))
        },
        { once: true }
      )
      return
    }

    const script = document.createElement("script")
    script.src = "https://api.xs2a.com/xs2a.js"
    script.async = true
    script.dataset.xs2aScript = "true"
    script.onload = () => resolve()
    script.onerror = () => {
      xs2aScriptPromise = null
      reject(new Error("XS2A-Skript konnte nicht geladen werden."))
    }
    document.head.appendChild(script)
  })

  return xs2aScriptPromise
}

export default function AccountCheckInfoDialog({
  open,
  onClose,
  providerName,
  productName,
  onStart,
  startStatus = "idle",
  errorText,
  wizardSessionKey,
  onWizardFinished,
  onWizardAborted,
}: AccountCheckInfoDialogProps) {
  const [wizardLoading, setWizardLoading] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)
  const [demoPrefillBusy, setDemoPrefillBusy] = useState(false)
  const wizardContainerRef = useRef<HTMLDivElement | null>(null)
  const initializedKeyRef = useRef<string | null>(null)

  const provider = trimOrNull(providerName)
  const product = trimOrNull(productName)
  const canStart = typeof onStart === "function"
  const activated = startStatus === "activated"
  const starting = startStatus === "starting"
  const wizardKey = trimOrNull(wizardSessionKey)
  const wizardActive = activated && Boolean(wizardKey)
  const combinedError = wizardError ?? errorText
  const dialogWidthClass = wizardActive ? "max-w-[1040px]" : "max-w-[740px]"

  const steps = [
    {
      title: "Bank auswählen",
      body: "Suche nach Bankname, BIC, BLZ oder IBAN und öffne die passende Verbindung.",
    },
    {
      title: "Online-Banking bestätigen",
      body: "Melde dich mit deinen Banking-Zugangsdaten an und bestätige den Kontocheck vollständig.",
    },
    {
      title: "Zu SEPANA zurückkehren",
      body: "Rufe danach die Live-Angebote erneut ab, damit die freigegebenen Angebote erscheinen.",
    },
  ]

  useEffect(() => {
    if (!open) {
      setWizardLoading(false)
      setWizardError(null)
      setDemoPrefillBusy(false)
      initializedKeyRef.current = null
      return
    }

    if (!wizardKey) {
      setWizardLoading(false)
      setWizardError(null)
      initializedKeyRef.current = null
    }
  }, [open, wizardKey])

  useEffect(() => {
    if (!wizardActive) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [wizardActive])

  useEffect(() => {
    if (!open || !wizardActive || !wizardKey || !wizardContainerRef.current) return
    if (initializedKeyRef.current === wizardKey) return

    let cancelled = false
    let observer: MutationObserver | null = null
    const layoutTimeouts: number[] = []
    setWizardLoading(true)
    setWizardError(null)
    initializedKeyRef.current = wizardKey

    loadXs2aScript()
      .then(() => {
        if (cancelled) return

        const xs2a = window.xs2a
        const container = wizardContainerRef.current
        if (!xs2a?.init || !container) {
          throw new Error("Kontocheck-Fenster konnte nicht gestartet werden.")
        }

        container.replaceChildren()
        container.setAttribute("data-xs2a", wizardKey)
        formatXs2aContainer(container)

        xs2a.useBaseStyles?.()
        xs2a.finish?.(() => onWizardFinished?.())
        xs2a.abort?.(() => onWizardAborted?.())
        xs2a.init()

        const applyLayout = () => formatXs2aContainer(container)
        observer = new MutationObserver(() => applyLayout())
        observer.observe(container, { childList: true, subtree: true, attributes: true })

        window.requestAnimationFrame(() => {
          applyLayout()
          layoutTimeouts.push(window.setTimeout(applyLayout, 150))
          layoutTimeouts.push(window.setTimeout(applyLayout, 500))
        })

        setWizardLoading(false)
      })
      .catch((wizardInitError) => {
        if (cancelled) return

        initializedKeyRef.current = null
        setWizardLoading(false)
        setWizardError(
          wizardInitError instanceof Error
            ? wizardInitError.message
            : "Kontocheck-Fenster konnte nicht gestartet werden."
        )
      })

    return () => {
      cancelled = true
      observer?.disconnect()
      layoutTimeouts.forEach((timeout) => window.clearTimeout(timeout))
    }
  }, [open, wizardActive, wizardKey, onWizardAborted, onWizardFinished])

  function prefillSandboxBankCode() {
    const container = wizardContainerRef.current
    if (!container) {
      setWizardError("Das Kontocheck-Fenster ist noch nicht bereit. Versuche es in ein paar Sekunden erneut.")
      return
    }

    const input = container.querySelector("input")
    if (!(input instanceof HTMLInputElement)) {
      setWizardError(
        "Das Eingabefeld der Testbank ist noch nicht sichtbar. Versuche es erneut, sobald der Kontocheck geladen ist."
      )
      return
    }

    setDemoPrefillBusy(true)
    setWizardError(null)

    input.focus()
    input.value = "88888888"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "8" }))

    window.setTimeout(() => setDemoPrefillBusy(false), 350)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:items-center sm:p-4"
      onClick={wizardActive ? undefined : onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div
        className={`relative z-10 flex h-dvh max-h-dvh w-full ${dialogWidthClass} flex-col overflow-hidden rounded-none border-0 bg-white shadow-none sm:h-auto sm:max-h-[92vh] sm:rounded-[26px] sm:border sm:border-slate-200/80 sm:shadow-[0_28px_90px_rgba(15,23,42,0.20)]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-check-title"
      >
        <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(16,185,129,0.08),rgba(255,255,255,0.96))] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Kontocheck</div>
              <h3 id="account-check-title" className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
                {wizardActive
                  ? "Kontocheck jetzt online abschließen"
                  : activated
                    ? "Kontocheck aktiviert"
                    : "Kontocheck durchführen"}
              </h3>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                {provider ? `${provider}${product ? ` · ${product}` : ""}` : "Dieses Angebot"} braucht vor der finalen
                Annahme zuerst einen Kontocheck.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                Sicherer Online-Prozess
              </span>
              {wizardActive ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                  Fenster geöffnet lassen
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-2.5 py-2.5 sm:px-4 sm:py-4">
          {wizardActive ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <div className="flex items-start gap-3">
                  <div className="relative mt-0.5 flex h-7 w-7 items-center justify-center">
                    <span className="absolute inline-flex h-7 w-7 rounded-full bg-emerald-300/50 animate-ping" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold">Kontocheck läuft</div>
                    <div className="mt-1 text-[13px] leading-relaxed text-emerald-900">
                      Führe den Kontocheck jetzt direkt hier im Browser vollständig durch.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-[20px] border border-slate-200 bg-white p-2.5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:p-4">
                  <div className="mb-2.5 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Gesicherte Banking-Strecke
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">Online-Banking-Verbindung</div>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                      Nicht schließen
                    </span>
                  </div>

                  {wizardLoading ? (
                    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <span className="inline-flex h-4 w-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
                      Kontocheck-Fenster wird geladen ...
                    </div>
                  ) : null}

                  <div className="w-full overflow-x-auto rounded-[16px] border border-slate-200 bg-slate-50/70">
                    <div
                      id="XS2A-Form"
                      ref={wizardContainerRef}
                      data-xs2a={wizardKey ?? undefined}
                      className="min-h-[480px] min-w-0 rounded-[16px] bg-white p-2.5 sm:p-3"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-950">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Ablauf</div>
                    <div className="mt-3 space-y-2.5">
                      {steps.map((step, index) => (
                        <div key={step.title} className="flex items-start gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-semibold text-white">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                            <div className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{step.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <div className="font-semibold">Wichtig</div>
                    <div className="mt-1.5 text-[13px] leading-relaxed">
                      Das Fenster darf während des Kontochecks nicht geschlossen oder neu geladen werden.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <div className="font-semibold">Testmodus</div>
                    <div className="mt-1.5 text-[13px] leading-relaxed">
                      Bei Bedarf kannst du im Widget die Test-BLZ <span className="font-semibold">88888888</span>{" "}
                      verwenden.
                    </div>
                    <button
                      type="button"
                      onClick={prefillSandboxBankCode}
                      disabled={wizardLoading || demoPrefillBusy}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-sky-200 bg-white px-3.5 text-sm font-semibold text-sky-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {demoPrefillBusy ? "Testbank wird eingetragen ..." : "Testbank 88888888 eintragen"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-[13px] leading-relaxed">
                      Nach dem Kontocheck die Live-Angebote erneut abrufen. Erst dann ist das Angebot final auswählbar.
                    </div>
                  </div>
                </div>
              </div>

              {combinedError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {combinedError}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {activated ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 items-center justify-center">
                      <span className="absolute inline-flex h-9 w-9 rounded-full bg-emerald-300/50 animate-ping" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Kontocheck wurde gestartet</div>
                      <div className="mt-1 text-[13px] text-emerald-900">
                        Der Kontocheck ist vorbereitet. Starte ihn jetzt direkt im Browser.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-4 text-sm text-cyan-950">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-800">Ablauf</div>
                <div className="mt-3 space-y-3">
                  {steps.map((step, index) => (
                    <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-cyan-200/70 bg-white/80 px-3 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{step.title}</div>
                        <div className="mt-1 text-[13px] leading-relaxed text-slate-600">{step.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                  <div className="font-semibold">Wichtig</div>
                  <div className="mt-2 text-[13px] leading-relaxed">
                    Das Fenster darf während des Kontochecks nicht geschlossen oder neu geladen werden, bis der Ablauf
                    vollständig beendet ist.
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                  <div className="font-semibold">Testmodus</div>
                  <div className="mt-2 text-[13px] leading-relaxed">
                    Wenn du im Formular die Demo-IBAN <span className="font-semibold">DE00 0000 0000 0000 0000 00</span>{" "}
                    verwendest, stellen wir sie vor dem Kontocheck intern automatisch auf die gültige Sandbox-IBAN um.
                    Falls das Widget trotzdem eine manuelle Suche braucht, nutze als Fallback die Test-BLZ{" "}
                    <span className="font-semibold">88888888</span>.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                Sobald der Kontocheck abgeschlossen ist, rufe in SEPANA die Live-Angebote erneut ab. Erst dann wird das
                Angebot als final vollständig auswählbar.
              </div>

              {activated && !wizardActive && canStart ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                  Falls das Kontocheck-Fenster nicht mehr offen ist, kannst du hier jederzeit einen neuen Kontocheck
                  direkt starten.
                </div>
              ) : null}

              {combinedError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                  {combinedError}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 bg-slate-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {wizardActive ? (
            <button
              type="button"
              disabled
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm opacity-80"
            >
              Kontocheck läuft im Browser
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm"
            >
              {activated ? "Schließen" : "Abbrechen"}
            </button>
          )}
          {activated && !wizardActive ? (
            <button
              type="button"
              onClick={() => void onStart?.()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
            >
              Kontocheck erneut starten
            </button>
          ) : canStart ? (
            <button
              type="button"
              onClick={() => void onStart?.()}
              disabled={starting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? "Kontocheck wird vorbereitet ..." : "Kontocheck jetzt starten"}
            </button>
          ) : !wizardActive ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm"
            >
              Verstanden
            </button>
          ) : null}
        </div>

        <style jsx global>{`
          #XS2A-Form {
            width: 100%;
          }

          #XS2A-Form > * {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0;
            margin-inline: auto !important;
            box-sizing: border-box !important;
            padding-inline: 12px;
          }

          #XS2A-Form iframe {
            display: block;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0;
            min-height: 540px;
            border: 0 !important;
            border-radius: 18px;
            background: #ffffff;
          }

          #XS2A-Form input,
          #XS2A-Form select,
          #XS2A-Form button {
            max-width: 100%;
            box-sizing: border-box;
            overflow: visible !important;
          }

          #XS2A-Form input:not([type="checkbox"]),
          #XS2A-Form select {
            display: block !important;
            width: min(100%, 320px) !important;
            border-radius: 12px !important;
            padding-right: 14px !important;
          }

          #XS2A-Form input,
          #XS2A-Form select {
            min-height: 42px;
          }

          #XS2A-Form button {
            min-height: 40px;
            border-radius: 12px;
          }

          #XS2A-Form input[type="checkbox"] {
            appearance: auto !important;
            accent-color: #0f766e;
            display: inline-block !important;
            width: 18px !important;
            height: 18px !important;
            min-width: 18px !important;
            min-height: 18px !important;
            margin-right: 8px !important;
            margin-top: 2px !important;
            vertical-align: top !important;
            flex: 0 0 auto !important;
          }

          #XS2A-Form label:has(input[type="checkbox"]),
          #XS2A-Form div:has(> input[type="checkbox"]),
          #XS2A-Form p:has(> input[type="checkbox"]) {
            display: flex !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          #XS2A-Form img,
          #XS2A-Form svg {
            display: inline-block;
            max-width: 100%;
            height: auto !important;
            flex-shrink: 0;
          }

          #XS2A-Form img:not([width="16"]):not([width="20"]):not([width="24"]),
          #XS2A-Form svg:not([width="16"]):not([width="20"]):not([width="24"]) {
            max-width: 140px !important;
            max-height: 56px !important;
          }

          #XS2A-Form a,
          #XS2A-Form p,
          #XS2A-Form span,
          #XS2A-Form label {
            word-break: normal !important;
            overflow-wrap: break-word !important;
          }

          #XS2A-Form div {
            word-break: normal !important;
            overflow-wrap: normal !important;
          }

          @media (max-width: 768px) {
            #XS2A-Form > * {
              padding-inline: 16px;
            }

            #XS2A-Form iframe {
              min-height: 500px;
            }

            #XS2A-Form input,
            #XS2A-Form select {
              min-height: 40px;
            }

            #XS2A-Form button {
              min-height: 38px;
            }

            #XS2A-Form > *,
            #XS2A-Form iframe {
              min-width: 0;
            }
          }

          @media (max-width: 520px) {
            #XS2A-Form > * {
              padding-inline: 18px;
            }

            #XS2A-Form iframe {
              min-height: 460px;
            }

            #XS2A-Form img:not([width="16"]):not([width="20"]):not([width="24"]),
            #XS2A-Form svg:not([width="16"]):not([width="20"]):not([width="24"]) {
              max-width: 112px !important;
              max-height: 42px !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
