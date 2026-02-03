import Link from "next/link"
import Image from "next/image"
import LogoutButton from "@/components/LogoutButton"

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900"
    >
      {label}
    </Link>
  )
}

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
            <Image src="/og.png" alt="SEPANA" width={120} height={36} className="h-8 w-auto" priority />
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin</div>
            <div className="text-sm font-semibold text-slate-900">Dashboard</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <NavItem href="/admin" label="Uebersicht" />
          <NavItem href="/admin/berater" label="Berater" />
          <NavItem href="/admin/faelle" label="Faelle & Unterlagen" />
          <NavItem href="/admin/termine" label="Termine" />
          <NavItem href="/admin/logs" label="Logs" />
          <LogoutButton
            label="Logout"
            nextPath="/login"
            className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
          />
        </nav>
      </div>
    </header>
  )
}
