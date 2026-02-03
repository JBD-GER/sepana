import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import AdminHeader from "./ui/AdminHeader"

export const metadata: Metadata = {
  title: "Admin – SEPANA",
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <AdminHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-4 text-xs text-slate-600 sm:px-6">
          <span>SEPANA Admin</span>
          <Link href="/" className="font-medium text-slate-800 hover:underline">
            Startseite
          </Link>
        </div>
      </footer>
    </div>
  )
}
