"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

const PRIMARY = "#0a2342"
const PORTAL_HREF = "/app"

type NavItem = {
  href: string
  label: string
  isNew?: boolean
}

const NAV: NavItem[] = [
  { href: "/baufinanzierung", label: "Baufinanzierung" },
  { href: "/privatkredit", label: "Privatkredit", isNew: true },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function IconClose(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function NewBadge() {
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
      Neu
    </span>
  )
}

export default function Header() {
  const pathname = usePathname()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [menuOpen, setMenuOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuOpen) return
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setMenuOpen(false)
    }

    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (pathname.startsWith("/einladung")) {
      setIsAuthed(false)
      setAuthChecked(true)
      return
    }

    let alive = true

    const refreshAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!alive) return
        if (error && error.name !== "AuthSessionMissingError") {
          console.error("Header auth check failed:", error)
        }
        setIsAuthed(Boolean(data.user))
      } catch (error: unknown) {
        if (!alive) return
        if (!(error instanceof Error) || (error.name !== "AbortError" && error.name !== "AuthSessionMissingError")) {
          console.error("Header auth check failed:", error)
        }
        setIsAuthed(false)
      } finally {
        if (!alive) return
        setAuthChecked(true)
      }
    }

    void refreshAuth()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth()
    })

    return () => {
      alive = false
      subscription.subscription.unsubscribe()
    }
  }, [pathname, supabase])

  const authLink = isAuthed ? { href: PORTAL_HREF, label: "Portal" } : { href: "/login", label: "Login" }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Zur Startseite"
          onClick={() => setMenuOpen(false)}
          className="inline-flex max-w-[200px] items-center rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 sm:max-w-none"
        >
          <Image src="/og.png" alt="SEPANA" width={220} height={66} priority className="h-7 w-auto sm:h-9" />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex" aria-label="Hauptnavigation">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span>{item.label}</span>
                {item.isNew ? <NewBadge /> : null}
              </Link>
            )
          })}

          <div className="mx-1 h-6 w-px bg-slate-200" aria-hidden />

          <Link
            href={authLink.href}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900",
              !authChecked && "pointer-events-none opacity-60"
            )}
          >
            {authChecked ? authLink.label : "..."}
          </Link>

          <Link
            href="/baufinanzierung"
            className="ml-2 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            style={{ backgroundColor: PRIMARY }}
          >
            Jetzt starten
          </Link>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "MenÃ¼ schlieÃŸen" : "MenÃ¼ Ã¶ffnen"}
          onClick={() => setMenuOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 lg:hidden"
        >
          {menuOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      <div
        ref={panelRef}
        className={cn(
          "overflow-hidden border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden",
          "transition-[max-height,opacity] duration-200",
          menuOpen ? "max-h-[460px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-3 sm:px-6 lg:px-8">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium transition",
                  active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                )}
              >
                <span>{item.label}</span>
                {item.isNew ? <NewBadge /> : null}
              </Link>
            )
          })}

          <Link
            href={authLink.href}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100",
              !authChecked && "pointer-events-none opacity-60"
            )}
          >
            {authChecked ? authLink.label : "..."}
          </Link>

          <Link
            href="/baufinanzierung"
            onClick={() => setMenuOpen(false)}
            className="mt-1 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: PRIMARY }}
          >
            Baufinanzierung starten
          </Link>

          <p className="pt-1 text-xs text-emerald-700">Privatkredit ist jetzt neu verfuegbar.</p>
        </div>
      </div>
    </header>
  )
}

