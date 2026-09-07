"use client"

import { useRef, type PointerEvent } from "react"
import type { SignatureStroke } from "@/lib/tippgeber/partnershipAgreement"

export default function PartnershipSignaturePad({ value, onChange, disabled }: {
  value: SignatureStroke[]
  onChange: (value: SignatureStroke[]) => void
  disabled: boolean
}) {
  const active = useRef<{ pointerId: number; points: SignatureStroke } | null>(null)
  const baseStrokes = useRef<SignatureStroke[]>([])
  function point(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (active.current?.pointerId !== event.pointerId) return
    const points = active.current.points
    active.current = null
    if (points.length >= 2) onChange([...baseStrokes.current, points])
    else onChange(baseStrokes.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span id="partnership-signature-label" className="text-sm font-semibold text-slate-900">Ihre Unterschrift</span>
        <button type="button" disabled={disabled} onClick={() => { active.current = null; onChange([]) }} className="text-sm font-medium text-slate-600 underline underline-offset-4 disabled:opacity-50">Unterschrift löschen</button>
      </div>
      <svg
        role="img"
        aria-labelledby="partnership-signature-label"
        aria-describedby="partnership-signature-help"
        viewBox="0 0 600 180"
        className={`w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 ${disabled ? "opacity-50" : "cursor-crosshair"}`}
        onPointerDown={(event) => {
          if (disabled || active.current || event.button !== 0 || value.length >= 100) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          baseStrokes.current = value
          const points = [point(event)]
          active.current = { pointerId: event.pointerId, points }
          onChange([...baseStrokes.current, points])
        }}
        onPointerMove={(event) => {
          if (disabled || active.current?.pointerId !== event.pointerId || active.current.points.length >= 2000) return
          const next = point(event)
          const previous = active.current.points.at(-1)!
          if (Math.hypot(next.x - previous.x, next.y - previous.y) < 0.001) return
          active.current.points = [...active.current.points, next]
          onChange([...baseStrokes.current, active.current.points])
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <line x1="24" y1="145" x2="576" y2="145" stroke="#cbd5e1" strokeWidth="1" />
        {value.map((stroke, index) => <polyline key={index} points={stroke.map((p) => `${p.x * 600},${p.y * 180}`).join(" ")} fill="none" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <p id="partnership-signature-help" className="mt-2 text-xs text-slate-500">Mit Maus, Finger oder Stift unterschreiben. Bei Schwierigkeiten unterstützt Sie SEPANA unter info@sepana.de.</p>
    </div>
  )
}
