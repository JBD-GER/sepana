"use client"

import { useState } from "react"

type FeedbackState = "idle" | "success" | "error"

export default function SchufaFreeApplicationLinkCopyButton({
  url,
  disabled = false,
}: {
  url: string | null
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>("idle")

  async function copyLink() {
    if (!url || busy || disabled) return
    setBusy(true)
    setFeedback("idle")

    try {
      await navigator.clipboard.writeText(url)
      setFeedback("success")
    } catch {
      setFeedback("error")
    } finally {
      setBusy(false)
    }
  }

  if (!url || disabled) {
    return <span className="text-xs text-slate-400">Kein Link verfuegbar</span>
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void copyLink()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Kopiere..." : "Link kopieren"}
      </button>

      {feedback === "success" ? <div className="text-[11px] text-emerald-700">Link kopiert.</div> : null}
      {feedback === "error" ? <div className="text-[11px] text-amber-700">Kopieren fehlgeschlagen.</div> : null}
    </div>
  )
}
