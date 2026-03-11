"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

const PRIMARY = "#0a2342"
const PORTAL_HREF = "/app"

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

type MobileSectionId = "baufi" | "privatkredit"

const BAUFINANZIERUNG_NAV: PortalNavItem[] = [
  {
    href: "/baufinanzierung",
    label: "Übersicht Baufinanzierung",
    description: "Kauf, Neubau und strukturierter Einstieg",
  },
  {
    href: "/baufinanzierung/anschlussfinanzierung",
    label: "Anschlussfinanzierung",
    description: "Forward-Darlehen und Restschuld strategisch planen",
  },
]

const PRIVATEKREDIT_NAV: PortalNavItem[] = [
  {
    href: "/privatkredit",
    label: "Allgemeine Kreditwünsche",
    description: "Übersicht und Anfragewege",
  },
  {
    href: "/privatkredit/hochzeitskredit",
    label: "Hochzeitskredit",
    description: "Budgetrechner und Finanzierung für die Hochzeit",
  },
  {
    href: "/privatkredit/kredit-pv-anlage",
    label: "Kredit PV Anlage",
    description: "PV-Anlage 100 % finanzieren",
  },
  {
    href: "/privatkredit/umschulden",
    label: "Umschulden",
    description: "Rate reduzieren und Kredite neu ordnen",
  },
]

const RATGEBER_NAV: PortalNavItem[] = [
  {
    href: "/ratgeber",
    label: "Ratgeber Übersicht",
    description: "Alle Themencluster für Baufinanzierung und Privatkredit",
  },
  {
    href: "/ratgeber/baufinanzierung",
    label: "Ratgeber Baufinanzierung",
    description: "Hauskauf, Wohnungskauf, Anschlussfinanzierung und mehr",
  },
  {
    href: "/ratgeber/privatkredit",
    label: "Ratgeber Privatkredit",
    description: "Umschuldung, Bonität, Zinsen und Voraussetzungen",
  },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function activeHrefForGroup(pathname: string, items: Array<{ href: string }>) {
  const matches = items
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)
  return matches[0]?.href ?? null
}

function formatReviewScore(value: number | null) {
  if (value == null) return "-"
  return value.toFixed(1).replace(".", ",")
}

function blurActiveElement() {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
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
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState<Record<MobileSectionId, boolean>>({
    baufi: false,
    privatkredit: false,
  })
  const [isAuthed, setIsAuthed] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [liveHeaderStatus, setLiveHeaderStatus] = useState<LiveHeaderStatus | null>(null)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMenuOpen(false)
    setMobileSectionsOpen({
      baufi: pathname.startsWith("/baufinanzierung"),
      privatkredit: pathname.startsWith("/privatkredit"),
    })
    blurActiveElement()
  }, [pathname])

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
  const baufinanzierungActiveHref = pathname.startsWith("/baufinanzierung/auswahl")
    ? null
    : activeHrefForGroup(pathname, BAUFINANZIERUNG_NAV)
  const baufinanzierungActive = Boolean(baufinanzierungActiveHref)
  const ratgeberActiveHref = activeHrefForGroup(pathname, RATGEBER_NAV)
  const ratgeberActive = Boolean(ratgeberActiveHref)
  const privatkreditActiveHref = activeHrefForGroup(pathname, PRIVATEKREDIT_NAV)
  const privatkreditActive = Boolean(privatkreditActiveHref)
  const liveActive = isActive(pathname, "/live-beratung")
  const liveOnline = (liveHeaderStatus?.onlineCount ?? 0) > 0
  const liveAvailable = (liveHeaderStatus?.availableCount ?? 0) > 0

  function handleNavLinkClick() {
    setMenuOpen(false)
    requestAnimationFrame(() => {
      blurActiveElement()
    })
  }

  function handleDesktopDropdownLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.blur()
    handleNavLinkClick()
  }

  function toggleMobileSection(section: MobileSectionId) {
    setMobileSectionsOpen((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

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
          <div className="relative group">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                baufinanzierungActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
              aria-haspopup="menu"
              aria-expanded={baufinanzierungActive || undefined}
            >
              <span>Baufinanzierung</span>
              <IconChevronDown className="h-4 w-4 opacity-80 transition group-hover:rotate-180 group-focus-within:rotate-180" />
            </button>

            <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-[340px] translate-y-1 pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {BAUFINANZIERUNG_NAV.map((item) => {
                  const active = item.href === baufinanzierungActiveHref
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleDesktopDropdownLinkClick}
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

          <div className="relative group">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                privatkreditActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
              aria-haspopup="menu"
              aria-expanded={privatkreditActive || undefined}
            >
              <span>Privatkredit</span>
              <IconChevronDown className="h-4 w-4 opacity-80 transition group-hover:rotate-180 group-focus-within:rotate-180" />
            </button>

            <div className="pointer-events-none invisible absolute left-0 top-full z-50 w-[320px] translate-y-1 pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {PRIVATEKREDIT_NAV.map((item) => {
                  const active = item.href === privatkreditActiveHref
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleDesktopDropdownLinkClick}
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
            href="/ratgeber"
            onClick={handleNavLinkClick}
            className={cn(
              "inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium transition",
              ratgeberActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            Ratgeber
          </Link>

          <Link
            href="/live-beratung"
            onClick={handleNavLinkClick}
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
            onClick={handleNavLinkClick}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900",
              !authChecked && "pointer-events-none opacity-60"
            )}
          >
            {authChecked ? authLink.label : "..."}
          </Link>

          <Link
            href="/kreditanfrage"
            onClick={handleNavLinkClick}
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
          "border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden",
          "overflow-hidden transition-[max-height,opacity] duration-200",
          menuOpen ? "max-h-[calc(100dvh-72px)] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-h-[calc(100dvh-72px)] max-w-7xl space-y-2 overflow-y-auto px-4 py-3 sm:px-6 lg:px-8">
          {reviewStats?.count ? (
            <Link
              href="/bewertungen"
              onClick={handleNavLinkClick}
              className="mb-1 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm"
            >
              <span className="font-semibold text-[#0b1f5e]">★★★★★ {formatReviewScore(reviewStats.average)}</span>
              <span className="text-xs text-slate-600">{reviewStats.count} Bewertungen</span>
            </Link>
          ) : null}

          <Link
            href="/kreditanfrage"
            onClick={handleNavLinkClick}
            className="inline-flex w-full items-center justify-between rounded-2xl border border-[#0b1f5e]/15 bg-[linear-gradient(145deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-3 text-slate-900 shadow-sm transition hover:border-[#0b1f5e]/25 hover:bg-[linear-gradient(145deg,#f4f8ff_0%,#e8f0ff_100%)]"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0b1f5e]/70">Schnellstart</div>
              <div className="mt-1 text-base font-semibold tracking-tight">Kreditanfrage starten</div>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b1f5e] text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M7 12h10M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggleMobileSection("baufi")}
              aria-expanded={mobileSectionsOpen.baufi}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Baufinanzierung</div>
                <div className="mt-1 text-base font-semibold text-slate-900">Kauf, Neubau, Anschlussfinanzierung</div>
              </div>
              <IconChevronDown
                className={cn("h-5 w-5 text-slate-500 transition", mobileSectionsOpen.baufi && "rotate-180")}
              />
            </button>
            {mobileSectionsOpen.baufi ? (
              <div className="grid gap-2 border-t border-slate-100 px-3 py-3">
                {BAUFINANZIERUNG_NAV.map((item) => {
                  const active = item.href === baufinanzierungActiveHref
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavLinkClick}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm transition",
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50/80 text-slate-800 hover:bg-slate-100"
                      )}
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className={cn("mt-0.5 text-xs", active ? "text-slate-200" : "text-slate-500")}>{item.description}</div>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toggleMobileSection("privatkredit")}
              aria-expanded={mobileSectionsOpen.privatkredit}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Privatkredit</div>
                <div className="mt-1 text-base font-semibold text-slate-900">Ratenkredit, Freie Verwendung und mehr</div>
              </div>
              <IconChevronDown
                className={cn("h-5 w-5 text-slate-500 transition", mobileSectionsOpen.privatkredit && "rotate-180")}
              />
            </button>
            {mobileSectionsOpen.privatkredit ? (
              <div className="grid gap-2 border-t border-slate-100 px-3 py-3">
                {PRIVATEKREDIT_NAV.map((item) => {
                  const active = item.href === privatkreditActiveHref
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavLinkClick}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm transition",
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50/80 text-slate-800 hover:bg-slate-100"
                      )}
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className={cn("mt-0.5 text-xs", active ? "text-slate-200" : "text-slate-500")}>{item.description}</div>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>

          <Link
            href="/ratgeber"
            onClick={handleNavLinkClick}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-4 text-sm font-medium shadow-sm transition",
              ratgeberActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            )}
          >
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Ratgeber</span>
              <span className="mt-1 block text-base font-semibold">Wissen für Privatkredit und Baufinanzierung</span>
            </span>
          </Link>

          <Link
            href="/live-beratung"
            onClick={handleNavLinkClick}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-4 text-sm font-medium shadow-sm transition",
              liveActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
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

          <Link
            href={authLink.href}
            onClick={handleNavLinkClick}
            className={cn(
              "flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50",
              !authChecked && "pointer-events-none opacity-60"
            )}
          >
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Portal</span>
              <span className="mt-1 block text-base font-semibold text-slate-900">{authChecked ? authLink.label : "..."}</span>
            </span>
          </Link>

        </div>
      </div>
    </header>
  )
}

