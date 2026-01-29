import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/requireAdmin"
import AdminHeader from "./ui/AdminHeader"

export const metadata: Metadata = {
  title: "Admin – SEPANA",
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-[calc(100dvh-72px)] bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
