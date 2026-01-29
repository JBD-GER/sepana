"use client"

import { useEffect, useRef } from "react"

type Props = {
  accent?: string
  burst?: number
}

function ensureConfettiStyle() {
  const id = "confetti-style-v2"
  if (document.getElementById(id)) return
  const style = document.createElement("style")
  style.id = id
  style.textContent = `
    @keyframes confetti-fall {
      0%   { transform: translate3d(var(--x, 0px), -20px, 0) rotate(var(--r0, 0deg)); opacity: 0; }
      8%   { opacity: 1; }
      100% { transform: translate3d(var(--x2, 0px), var(--y, 900px), 0) rotate(var(--r1, 520deg)); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

export default function SuccessConfetti({ accent = "#091840", burst = 90 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    ensureConfettiStyle()
    const host = hostRef.current
    if (!host) return

    host.innerHTML = ""

    const colors = [
      accent,
      "#0F172A", // slate-900
      "#334155", // slate-700
      "#E2E8F0", // slate-200
      "#F59E0B", // amber
      "#10B981", // emerald
      "#3B82F6", // blue
      "#EC4899", // pink
    ]

    const rect = host.getBoundingClientRect()
    const w = rect.width || 900
    const h = rect.height || 900

    const count = Math.max(40, Math.min(180, burst))

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div")
      const size = 6 + Math.random() * 8
      const left = Math.random() * w
      const drift1 = (Math.random() - 0.5) * 140
      const drift2 = (Math.random() - 0.5) * 260
      const dur = 1900 + Math.random() * 1100
      const delay = Math.random() * 220

      p.style.position = "absolute"
      p.style.left = `${left}px`
      p.style.top = `0px`
      p.style.width = `${size}px`
      p.style.height = `${size * 1.25}px`
      p.style.borderRadius = "999px"
      p.style.background = colors[Math.floor(Math.random() * colors.length)]
      p.style.opacity = "0"

      p.style.setProperty("--x", `${drift1}px`)
      p.style.setProperty("--x2", `${drift2}px`)
      // ✅ bis ganz unten (volle Container-Höhe)
      p.style.setProperty("--y", `${h + 120 + Math.random() * 120}px`)
      p.style.setProperty("--r0", `${Math.random() * 140}deg`)
      p.style.setProperty("--r1", `${320 + Math.random() * 620}deg`)

      p.style.animation = `confetti-fall ${dur}ms ease-out ${delay}ms forwards`
      host.appendChild(p)
    }

    const t = window.setTimeout(() => {
      if (hostRef.current) hostRef.current.innerHTML = ""
    }, 3600)

    return () => window.clearTimeout(t)
  }, [accent, burst])

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
  )
}
