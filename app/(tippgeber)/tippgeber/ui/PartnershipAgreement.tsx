"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  isValidSignerName, normalizeSignerName, validateSignature,
  type AgreementDocument, type AgreementStatus, type SignatureStroke,
} from "@/lib/tippgeber/partnershipAgreement"
import PartnershipSignaturePad from "./PartnershipSignaturePad"

const primary = "inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
const secondary = "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"

function signedDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))
}

export default function PartnershipAgreement({ initialStatus, companyName, autoOpen = false }: {
  initialStatus: AgreementStatus
  companyName: string
  autoOpen?: boolean
}) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const busyRef = useRef(false)
  const [status, setStatus] = useState(initialStatus)
  const [open, setOpen] = useState(autoOpen && initialStatus.state === "unsigned")
  const [step, setStep] = useState<"intro" | "review" | "success">("intro")
  const [name, setName] = useState("")
  const [preview, setPreview] = useState<{ document: AgreementDocument; documentHash: string } | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState<SignatureStroke[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (!open) { element.close(); return }
    element.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow; element.close() }
  }, [open])

  useEffect(() => {
    if (open) {
      heading.current?.focus()
      dialog.current?.querySelector("[data-contract-scroll]")?.scrollTo(0, 0)
    }
  }, [step, open])

  // Recheck after switching tabs, including when another tab completed signing.
  useEffect(() => {
    async function sync() {
      if (document.visibilityState !== "visible" || busyRef.current) return
      try {
        const response = await fetch("/api/tippgeber/agreement", { cache: "no-store" })
        if (!response.ok) return
        const next: AgreementStatus = await response.json()
        if (next.state === "signed") { setStatus(next); setOpen(false); router.refresh() }
      } catch { /* Retain the current state when offline. */ }
    }
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [router])

  async function reloadStatus() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/tippgeber/agreement", { cache: "no-store" })
      if (!response.ok) throw new Error("Der Vertragsstatus konnte nicht geladen werden. Bitte versuchen Sie es erneut.")
      const next: AgreementStatus = await response.json()
      setStatus(next)
      if (next.state === "unsigned") { setStep("intro"); setOpen(true) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Vertragsstatus nicht verfügbar.") }
    finally { setBusy(false) }
  }

  async function submit(action: "preview" | "sign") {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/tippgeber/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, signerName: name, documentHash: preview?.documentHash, accepted, signature }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 409) { setStep("intro"); setPreview(null); setAccepted(false); setSignature([]) }
        throw new Error(result.error || "Der Vertrag konnte nicht gespeichert werden.")
      }
      if (result.status?.state === "signed") {
        setStatus(result.status)
        setStep("success")
        setSignature([])
        router.refresh()
      } else if (action === "preview" && result.document && result.documentHash) {
        setPreview(result)
        setAccepted(false)
        setSignature([])
        setStep("review")
      } else throw new Error("Die Antwort konnte nicht bestätigt werden. Bitte laden Sie den Vertragsstatus erneut.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Vertrag konnte nicht verarbeitet werden.") }
    finally { busyRef.current = false; setBusy(false) }
  }

  return (
    <>
      <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Unsere Zusammenarbeit</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Partnerschaftsvertrag Baufinanzierung</h2>
            <p className="mt-2 text-sm text-slate-600">
              {status.state === "signed"
                ? `Unterzeichnet von ${status.signerName} am ${signedDate(status.signedAt)}.`
                : status.state === "unavailable"
                  ? "Ihr Vertragsstatus ist gerade nicht verfügbar. Bitte laden Sie ihn erneut."
                  : "Ihre Vereinbarung für gemeinsame Leads: 25 % der erhaltenen Provision inklusive gegebenenfalls anfallender MwSt."}
            </p>
          </div>
          {status.state === "signed" ? (
            <a className={secondary} href="/api/tippgeber/agreement/pdf?download=1">Vertrag herunterladen (PDF)</a>
          ) : status.state === "unavailable" ? (
            <button type="button" className={secondary} onClick={reloadStatus} disabled={busy}>Status erneut laden</button>
          ) : (
            <button type="button" className={primary} onClick={() => { setError(null); setOpen(true) }}>Vertrag {preview ? "fortsetzen" : "starten"}</button>
          )}
        </div>
        {status.state === "signed" ? <p className="mt-3 text-xs font-medium text-emerald-700">Unterzeichnet · Fassung {status.version}</p> : null}
        {error && !open ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      <dialog ref={dialog} aria-labelledby="partnership-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) setOpen(false) }}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60">
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">SEPANA Partner · Baufinanzierung</p>
              <h2 ref={heading} tabIndex={-1} id="partnership-dialog-title" className="mt-2 text-xl font-semibold outline-none sm:text-2xl">
                {step === "success" ? "Vielen Dank für Ihre Unterschrift" : step === "review" ? "Ihr Partnerschaftsvertrag" : "Gemeinsam erfolgreich zusammenarbeiten"}
              </h2>
            </div>
            <button type="button" disabled={busy} aria-label="Vertragsfenster schließen" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
          </div>

          <div data-contract-scroll className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
            {step === "intro" ? (
              <form id="partnership-preview" onSubmit={(event) => { event.preventDefault(); void submit("preview") }} className="space-y-5">
                <p className="text-sm leading-7 text-slate-600">Willkommen, {companyName}. Für unsere Zusammenarbeit bei Baufinanzierungs-Leads fehlt noch Ihr Partnerschaftsvertrag. Prüfen Sie die Vereinbarung und unterzeichnen Sie anschließend direkt hier.</p>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-3xl font-semibold text-emerald-900">25 % <span className="text-sm font-medium">inkl. gegebenenfalls anfallender MwSt.</span></p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">Ihr Anteil an der Provision, die SEPANA für Ihre zugeordneten und ausgezahlten Baufinanzierungen tatsächlich erhält.</p>
                </div>
                <label className="block text-sm font-medium">Vor- und Nachname der unterschreibenden Person
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} disabled={busy} placeholder="Vorname Nachname" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <p className="text-xs leading-5 text-slate-500">Sie unterzeichnen als Inhaber oder vertretungsberechtigte Person für {companyName}. Firma und Geschäftsanschrift werden aus Ihren Partnerdaten übernommen. Mit „Dokument ansehen“ wird noch kein Vertrag abgeschlossen.</p>
              </form>
            ) : step === "review" && preview ? (
              <div className="space-y-7">
                <article aria-label="Vollständiger Partnerschaftsvertrag" className="space-y-6 text-sm leading-7">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <Image src="/og.png" alt="SEPANA" width={160} height={40} className="mb-5 h-10 w-auto" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vertragsfassung {preview.document.version}</p>
                    <h3 className="mt-2 text-lg font-semibold">{preview.document.title}</h3>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div><p className="font-semibold">{preview.document.provider.name}</p><p>{preview.document.provider.street}</p><p>{preview.document.provider.city}</p><p className="break-words">{preview.document.provider.email}</p></div>
                      <div><p className="font-semibold break-words">{preview.document.partner.companyName}</p><p>{preview.document.partner.street} {preview.document.partner.houseNumber}</p><p>{preview.document.partner.zip} {preview.document.partner.city}</p><p>Vertreten durch: {preview.document.partner.signerName}</p><p className="break-words">{preview.document.partner.email}</p></div>
                    </div>
                  </div>
                  {preview.document.sections.map((section) => <section key={section.title}><h3 className="font-semibold text-slate-900">{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 text-slate-700">{paragraph}</p>)}</section>)}
                </article>
                <form id="partnership-sign" onSubmit={(event) => { event.preventDefault(); void submit("sign") }} className="space-y-6 border-t border-slate-200 pt-6">
                  <label className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm leading-6">
                    <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-emerald-700" />
                    <span>{preview.document.acceptanceText}</span>
                  </label>
                  <PartnershipSignaturePad value={signature} onChange={setSignature} disabled={busy} />
                  <p className="text-xs leading-5 text-slate-500">Mit „Verbindlich unterzeichnen“ nehmen Sie den angezeigten Vertrag für {preview.document.partner.companyName} an. Die Vertragskopie mit Ihrer Unterschrift wird unter Einstellungen gespeichert.</p>
                </form>
              </div>
            ) : step === "success" && status.state === "signed" ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-900">Ihr Partnerschaftsvertrag ist unterzeichnet.</p><p className="mt-2 text-sm text-emerald-800">{status.signerName} · {signedDate(status.signedAt)}</p></div>
                <p className="text-sm leading-7 text-slate-600">Die Erinnerung erscheint jetzt nicht mehr. Ihren unterschriebenen Vertrag können Sie jederzeit unter <Link href="/tippgeber/einstellungen" onClick={() => setOpen(false)} className="font-semibold underline underline-offset-4">Einstellungen</Link> herunterladen.</p>
                <a href="/api/tippgeber/agreement/pdf?download=1" className={primary}>Vertrag herunterladen (PDF)</a>
              </div>
            ) : null}
            {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8">
            {step === "intro" ? <><button type="button" className={secondary} disabled={busy} onClick={() => setOpen(false)}>Später</button><button type="submit" form="partnership-preview" className={primary} disabled={busy || !isValidSignerName(normalizeSignerName(name))}>{busy ? "Dokument wird geladen …" : "Dokument ansehen"}</button></>
              : step === "review" ? <><button type="button" className={secondary} disabled={busy} onClick={() => { setStep("intro"); setPreview(null); setAccepted(false); setSignature([]); setError(null) }}>Angaben ändern</button><button type="submit" form="partnership-sign" className={primary} disabled={busy || !accepted || !validateSignature(signature)}>{busy ? "Vertrag wird gespeichert …" : "Verbindlich unterzeichnen"}</button></>
                : <button type="button" className={secondary} onClick={() => setOpen(false)}>Zum Partnerbereich</button>}
          </div>
        </div>
      </dialog>
    </>
  )
}
