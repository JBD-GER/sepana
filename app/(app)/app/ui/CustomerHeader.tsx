"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/faelle", label: "Fälle" },
  { href: "/app/termine", label: "Termine" },
  { href: "/app/feedback", label: "Feedback" },
  { href: "/app/profil", label: "Profil" },
]

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

export default function CustomerHeader({ initialEmail }: { initialEmail?: string | null }) {
  const pathname = usePathname()
  const email = initialEmail ?? null

  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)

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

  function logout() {
    window.location.assign(`/api/auth/logout?next=/login&_ts=${Date.now()}`)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/app"
          className="group inline-flex items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label="Zum Kundenportal"
          onClick={() => setOpen(false)}
        >
          <span className="inline-flex items-center rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur transition group-hover:border-slate-300/70 group-hover:shadow-md">
            <Image src="/og.png" alt="SEPANA" width={210} height={64} priority className="h-8 w-auto sm:h-9" />
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Portal Navigation">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:bg-white/70 hover:shadow-sm hover:ring-1 hover:ring-slate-200/70"
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <Link
            href="/baufinanzierung"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Vergleich starten
          </Link>

          <div className="mx-1 h-6 w-px bg-slate-200/70" aria-hidden />

          <div
            className="hidden items-center rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm lg:flex"
            title={email ?? ""}
          >
            {email ?? "-"}
          </div>

          <button
            onClick={logout}
            className="rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white/70 hover:shadow-sm hover:ring-1 hover:ring-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Logout
          </button>
        </nav>

        <button
          ref={btnRef}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
        >
          {open ? <IconX className="h-5 w-5 text-slate-900" /> : <IconMenu className="h-5 w-5 text-slate-900" />}
        </button>
      </div>

      <div
        ref={panelRef}
        className={cn(
          "overflow-hidden border-t border-slate-200/70 bg-white/90 backdrop-blur-xl transition-[max-height,opacity] duration-200 md:hidden",
          open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="grid gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-2xl px-3 py-3 text-sm transition",
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-900 hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200/70"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}

            <Link
              href="/baufinanzierung"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Vergleich starten
            </Link>

            <div className="mt-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
              <div className="text-xs text-slate-500">Eingeloggt als</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{email ?? "-"}</div>
            </div>

            <button
              onClick={logout}
              className="mt-2 inline-flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Logout
            </button>

            <p className="pt-2 text-xs text-slate-500">
              Alles mobil optimiert – klar und übersichtlich.
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
