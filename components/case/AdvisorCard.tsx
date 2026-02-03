"use client"

import { useEffect, useState } from "react"

type AdvisorCardProps = {
  displayName?: string | null
  bio?: string | null
  phone?: string | null
  email?: string | null
  languages?: string[]
  avatarUrl?: string | null
}

export default function AdvisorCard({
  displayName,
  bio,
  phone,
  email,
  languages = [],
  avatarUrl,
}: AdvisorCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!previewOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [previewOpen])

  useEffect(() => {
    if (!previewOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [previewOpen])

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="block h-full w-full cursor-zoom-in"
                aria-label="Beraterbild gross anzeigen"
              >
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </button>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="text-xs text-slate-500">Dein Berater</div>
            <div className="text-lg font-semibold text-slate-900">{displayName ?? "-"}</div>
            <div className="mt-1 text-sm text-slate-700">{bio ?? "-"}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
              {phone ? <span>Tel: {phone}</span> : null}
              {email ? <span>E-Mail: {email}</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(languages ?? []).map((language) => (
                <span
                  key={language}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                >
                  {language}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewOpen && avatarUrl ? (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/75 p-4 sm:p-6"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="relative max-h-full max-w-[92vw] overflow-hidden rounded-2xl border border-white/20 bg-black/30 p-2 shadow-2xl sm:max-w-[760px]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="absolute right-2 top-2 rounded-full border border-white/30 bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"
              >
                Schliessen
              </button>
              <img
                src={avatarUrl}
                alt={`Berater ${displayName || ""}`}
                className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

