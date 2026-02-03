import type { Metadata } from "next"
import CustomerQueue from "@/components/live/CustomerQueue"

export const metadata: Metadata = {
  title: "Live-Beratung – Baufinanzierung",
  robots: { index: false, follow: false },
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; caseRef?: string; existing?: string }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  const backToAuswahl = `/baufinanzierung/auswahl?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(
    caseRef
  )}${existing ? "&existing=1" : ""}`

  return (
    <div className="w-full overflow-x-clip space-y-4">
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Pill>DSGVO-konform</Pill>
          <Pill>Live-Beratung</Pill>
          {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">Live-Beratung</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Sie werden in die Warteschlange aufgenommen. Sobald ein Berater annimmt, startet die Live-Beratung.
        </p>

        <div className="mt-4 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
          <CustomerQueue caseId={caseId} caseRef={caseRef} backHref={backToAuswahl} />
        </div>
      </div>
    </div>
  )
}
