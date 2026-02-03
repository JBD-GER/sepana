import AdvisorHeader from "./ui/AdvisorHeader"

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-slate-50 via-white to-cyan-50 font-sans text-slate-900">
      <AdvisorHeader />
      <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
