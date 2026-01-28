"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const ACCENT = "#091840"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

const NAV = [
  { href: "/baufinanzierung", label: "Baufinanzierung" },
  { href: "/privatkredit", label: "Privatkredit" },
]

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  // ESC + outside click (mobile friendly)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    function onPointerDown(e: PointerEvent) {
      if (!open) return
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }

    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* LOGO */}
        <Link
          href="/"
          className="group inline-flex items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="Zur Startseite"
          onClick={() => setOpen(false)}
        >
          <span className="inline-flex items-center rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur px-3 py-2 transition group-hover:shadow-md group-hover:border-slate-300/70">
            <Image
              src="/og.png"
              alt="SEPANA"
              width={210}
              height={64}
              priority
              className="h-11 w-auto md:h-8"
            />
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-2 md:flex" aria-label="Hauptnavigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white/70 hover:shadow-sm hover:ring-1 hover:ring-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {item.label}
            </Link>
          ))}

          <div className="mx-1 h-6 w-px bg-slate-200/70" aria-hidden />

          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white/70 hover:shadow-sm hover:ring-1 hover:ring-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Login
          </Link>

          {/* ✅ Vergleich starten -> /baufinanzierung */}
          <Link
            href="/baufinanzierung"
            className="ml-2 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            style={{ backgroundColor: ACCENT }}
          >
            Vergleich starten
          </Link>
        </nav>

        {/* Mobile Toggle (Hamburger <-> X) */}
        <button
          ref={btnRef}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
        >
          {open ? <IconX className="h-5 w-5 text-slate-900" /> : <IconMenu className="h-5 w-5 text-slate-900" />}
        </button>
      </div>

      {/* Mobile Dropdown Panel (normal, modern) */}
      <div
        ref={panelRef}
        className={cn(
          "md:hidden overflow-hidden border-t border-slate-200/70 bg-white/90 backdrop-blur-xl",
          "transition-[max-height,opacity] duration-200",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="grid gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-3 py-3 text-sm text-slate-900 transition hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200/70"
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-2xl px-3 py-3 text-sm text-slate-900 transition hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200/70"
            >
              Login
            </Link>

            {/* ✅ Vergleich starten -> /baufinanzierung */}
            <Link
              href="/baufinanzierung"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
              style={{ backgroundColor: ACCENT }}
            >
              Vergleich starten
            </Link>

            <p className="pt-2 text-xs text-slate-500">
              Schnell & kostenlos – dauert nur 2 Minuten.
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
