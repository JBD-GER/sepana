export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.1),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ffffff_55%,#eff6ff_100%)] text-slate-900">
      <main className="w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  )
}
