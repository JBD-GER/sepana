"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

const TABS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/faelle", label: "Fälle" },
  { href: "/app/online-filiale", label: "Online Filiale" },
  { href: "/app/termine", label: "Termine" },
  { href: "/app/feedback", label: "Feedback" },
  { href: "/app/profil", label: "Profil" },
]

export default function CustomerTabs() {
  const pathname = usePathname()

  return (
    <div className="sticky top-[72px] z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <div className="flex gap-2 overflow-x-auto py-2 [-webkit-overflow-scrolling:touch]">
          {TABS.map((t) => {
            const active = pathname === t.href
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "whitespace-nowrap rounded-2xl border px-3 py-2 text-sm shadow-sm transition",
                  active
                    ? "border-slate-300 bg-slate-900 text-white"
                    : "border-slate-200/70 bg-white text-slate-700 hover:border-slate-300 hover:bg-white"
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
