import Link from "next/link"

const PRIMARY = "#07183d"

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white"
    >
      {label}
    </Link>
  )
}

export default function AdminHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-2xl shadow-sm"
            style={{ background: PRIMARY }}
            aria-hidden
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">SEPANA</div>
            <div className="text-xs text-slate-500">Admin Dashboard</div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <NavItem href="/admin" label="Übersicht" />
          <NavItem href="/admin/berater" label="Berater" />
          <NavItem href="/admin/faelle" label="Fälle & Unterlagen" />
        </nav>
      </div>
    </header>
  )
}
