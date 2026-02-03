import Footer from "./components/Footer"
import Header from "./components/Header"
import ConsentBanner from "./components/ConsentBanner"
import InviteHashRedirect from "./components/InviteHashRedirect"

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(10,35,66,0.12),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(18,98,130,0.1),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%)] text-slate-900">
      <InviteHashRedirect />
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">{children}</main>
      <Footer />
      <ConsentBanner />
    </div>
  )
}
