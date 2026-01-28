import Header from "./components/Header"
import Footer from "./components/Footer"

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  )
}
