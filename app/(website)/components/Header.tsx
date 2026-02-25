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

type PortalNavItem = {
  href: string
  label: string
  description: string
}

type HeaderProps = {
  reviewStats?: {
    average: number | null
    count: number
  } | null
}

type LiveHeaderStatus = {
  onlineCount: number
  availableCount: number
}

const NAV: NavItem[] = [
  { href: "/baufinanzierung", label: "Baufinanzierung" },
  { href: "/privatkredit", label: "Privatkredit" },
]

const PORTAL_NAV: PortalNavItem[] = [
  {
    href: "/baufinanzierung/auswahl",
    label: "Baufinanzierung",
    description: "Vergleich starten und Bankenübersicht",
  },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function formatReviewScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
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

function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function LiveStatusIndicator({
  online,
  available,
  withLabel = false,
  inverted = false,
}: {
  online: boolean
  available: boolean
  withLabel?: boolean
  inverted?: boolean
}) {
  const textClass = inverted ? "text-white/90" : "text-slate-500"

  return (
    <span className="inline-flex items-center gap-1.5">
      {online ? (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className={cn("absolute inline-flex h-4 w-4 rounded-full animate-ping", available ? "bg-emerald-400/30" : "bg-amber-400/30")} />
          <span className={cn("relative h-2.5 w-2.5 rounded-full", available ? "bg-emerald-500" : "bg-amber-500")} />
        </span>
      ) : (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          <span className={cn("absolute h-[1.5px] w-4 rotate-45", inverted ? "bg-white/80" : "bg-slate-600")} />
        </span>
      )}
      {withLabel ? <span className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", textClass)}>{online ? "Live" : "Offline"}</span> : null}
    </span>
  )
}

export default function Header({ reviewStats = null }: HeaderProps) {
  const pathname = usePathname()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [menuOpen, setMenuOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [liveHeaderStatus, setLiveHeaderStatus] = useState<LiveHeaderStatus | null>(null)

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

  useEffect(() => {
    let alive = true
    let intervalId: number | null = null

    const loadLiveStatus = async () => {
      try {
        const res = await fetch("/api/live/status", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok && json?.ok) {
          setLiveHeaderStatus({
            onlineCount: Number(json.onlineCount || 0),
            availableCount: Number(json.availableCount || 0),
          })
        } else {
          setLiveHeaderStatus(null)
        }
      } catch {
        if (alive) setLiveHeaderStatus(null)
      }
    }

    void loadLiveStatus()
    intervalId = window.setInterval(() => {
      void loadLiveStatus()
    }, 25000)

    return () => {
      alive = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [])

  const authLink = isAuthed ? { href: PORTAL_HREF, label: "Portal" } : { href: "/login", label: "Login" }
  const portalActive = PORTAL_NAV.some((item) => isActive(pathname, item.href))
  const liveActive = isActive(pathname, "/live-beratung")
  const liveOnline = (liveHeaderStatus?.onlineCount ?? 0) > 0
  const liveAvailable = (liveHeaderStatus?.availableCount ?? 0) > 0

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="Zur Startseite"
            onClick={() => setMenuOpen(false)}
            className="inline-flex max-w-[200px] items-center rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300 sm:max-w-none"
          >
            <Image src="/og.png" alt="SEPANA" width={220} height={66} priority className="h-7 w-auto sm:h-9" />
          </Link>

          {reviewStats?.count ? (
            <Link
              href="/bewertungen"
              onClick={() => setMenuOpen(false)}
              className="hidden items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm transition hover:border-slate-300 sm:inline-flex"
              aria-label={`${formatReviewScore(reviewStats.average)} von 5 aus ${reviewStats.count} Bewertungen`}
            >
              <div className="text-sm leading-none text-[#0b1f5e]">★★★★★</div>
              <div className="h-5 w-px bg-slate-200" aria-hidden />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-900">{formatReviewScore(reviewStats.average)}</span>
                <span className="text-xs text-slate-500">({reviewStats.count})</span>
              </div>
            </Link>
          ) : null}
        </div>

        <nav className="hidden items-center gap-2 lg:flex" aria-label="Hauptnavigation">
          {NAV.map((item) => {
            const active =
              item.href === "/baufinanzierung" && pathname.startsWith("/baufinanzierung/auswahl")
                ? false
                : isActive(pathname, item.href)
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

          <div className="relative group">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                portalActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
              aria-haspopup="menu"
              aria-expanded={portalActive || undefined}
            >
              <span>Vergleichsportal</span>
              <IconChevronDown className="h-4 w-4 opacity-80 transition group-hover:rotate-180 group-focus-within:rotate-180" />
            </button>

            <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-[320px] translate-y-1 pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {PORTAL_NAV.map((item) => {
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "block rounded-xl border px-3 py-3 transition",
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-transparent bg-white text-slate-800 hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className={cn("mt-0.5 text-xs", active ? "text-slate-200" : "text-slate-500")}>{item.description}</div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          <Link
            href="/live-beratung"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
              liveActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
            aria-label={`Live-Beratung ${liveOnline ? "online" : "offline"}`}
          >
            <LiveStatusIndicator online={liveOnline} available={liveAvailable} inverted={liveActive} />
            <span>Live-Beratung</span>
          </Link>

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
            href="/kreditanfrage"
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
          aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
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
          menuOpen ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-3 sm:px-6 lg:px-8">
          {reviewStats?.count ? (
            <Link
              href="/bewertungen"
              onClick={() => setMenuOpen(false)}
              className="mb-1 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm"
            >
              <span className="font-semibold text-[#0b1f5e]">★★★★★ {formatReviewScore(reviewStats.average)}</span>
              <span className="text-xs text-slate-600">{reviewStats.count} Bewertungen</span>
            </Link>
          ) : null}

          {NAV.map((item) => {
            const active =
              item.href === "/baufinanzierung" && pathname.startsWith("/baufinanzierung/auswahl")
                ? false
                : isActive(pathname, item.href)
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
            href="/live-beratung"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium transition",
              liveActive ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
            )}
            aria-label={`Live-Beratung ${liveOnline ? "online" : "offline"}`}
          >
            <span className="inline-flex items-center gap-2">
              <LiveStatusIndicator online={liveOnline} available={liveAvailable} inverted={liveActive} />
              <span>Live-Beratung</span>
            </span>
            <span className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", liveActive ? "text-white/90" : "text-slate-500")}>
              {liveOnline ? "Live" : "Offline"}
            </span>
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vergleichsportal</div>
            <div className="mt-2 grid gap-2">
              {PORTAL_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "rounded-xl px-3 py-3 text-sm transition",
                      active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                    )}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div className={cn("mt-0.5 text-xs", active ? "text-slate-200" : "text-slate-500")}>{item.description}</div>
                  </Link>
                )
              })}
            </div>
          </div>

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
            href="/kreditanfrage"
            onClick={() => setMenuOpen(false)}
            className="mt-1 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: PRIMARY }}
          >
            Kreditanfrage starten
          </Link>

        </div>
      </div>
    </header>
  )
}

