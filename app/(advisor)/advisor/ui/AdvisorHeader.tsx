"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import LogoutButton from "@/components/LogoutButton"

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

const NAV = [
  { href: "/advisor", label: "Dashboard" },
  { href: "/advisor/faelle", label: "Faelle" },
  { href: "/advisor/leads", label: "Leads" },
  { href: "/advisor/faelle/bestaetigt", label: "Bestaetigt" },
  { href: "/advisor/termine", label: "Termine" },
]

function isActive(pathname: string, href: string) {
  if (href === "/advisor") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export default function AdvisorHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    function onPointerDown(e: PointerEvent) {
      if (!open) return
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (btnRef.current?.contains(target)) return
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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <Link href="/advisor" className="inline-flex items-center rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
          <Image src="/og.png" alt="SEPANA" width={170} height={48} className="h-8 w-auto" priority />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200/80 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <LogoutButton
            label="Logout"
            nextPath="/login"
            className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          />
        </nav>

        <button
          ref={btnRef}
          type="button"
          aria-expanded={open}
          aria-label={open ? "Menue schliessen" : "Menue oeffnen"}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 md:hidden"
        >
          {open ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      <div
        ref={panelRef}
        className={cn(
          "overflow-hidden border-t border-slate-200/70 bg-white/95 backdrop-blur transition-[max-height,opacity] duration-200 md:hidden",
          open ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto w-full max-w-7xl space-y-2 px-3 py-3 sm:px-6">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-2xl px-3 py-3 text-sm font-medium transition",
                  active ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <LogoutButton
            label="Logout"
            nextPath="/login"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
          />
        </div>
      </div>
    </header>
  )
}
