import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Baufinanzierung – Bankenauswahl",
  robots: { index: false, follow: false },
}

const ACCENT = "#091840"

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

type Bank = {
  id: string
  name: string
  subtitle: string
  bullets: string[]
  badge?: string
  href: (q: { caseId: string; caseRef: string; existing?: boolean }) => string
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

function BankCard({ bank, caseId, caseRef, existing }: { bank: Bank; caseId: string; caseRef: string; existing: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:bg-white/80 hover:shadow-md">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: ACCENT }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{bank.name}</div>
          <div className="mt-1 text-sm text-slate-600">{bank.subtitle}</div>
        </div>

        {bank.badge ? (
          <div
            className="shrink-0 rounded-2xl px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            style={{ background: ACCENT }}
          >
            {bank.badge}
          </div>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {bank.bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
            <span className="min-w-0">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={bank.href({ caseId, caseRef, existing })}
          className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
          style={{ background: ACCENT }}
        >
          Weiter zur Bank
        </Link>

        <div className="text-xs text-slate-500">
          Sie können später jederzeit wechseln.
        </div>
      </div>
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

  // ✅ Hier ist DEINE Bankliste (später kannst du das aus DB/API kommen lassen)
  // Wichtig: Wir verlinken schon auf /baufinanzierung/auswahl/abschluss als nächster Schritt.
  const banks: Bank[] = [
    {
      id: "interhyp",
      name: "Interhyp",
      subtitle: "Großer Vergleich, viele Partnerbanken, oft sehr gute Konditionen.",
      badge: "Beliebt",
      bullets: ["Schneller Prozess", "Viele Banken im Vergleich", "Transparente Next Steps"],
      href: ({ caseId, caseRef, existing }) =>
        `/baufinanzierung/auswahl/abschluss?bank=interhyp&caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${existing ? "&existing=1" : ""}`,
    },
    {
      id: "drklein",
      name: "Dr. Klein",
      subtitle: "Starker Vermittler, gute Beratung & Vergleich.",
      bullets: ["Gute Kombi aus Vergleich + Unterstützung", "Geeignet für viele Fälle", "Dokumentenprozess später"],
      href: ({ caseId, caseRef, existing }) =>
        `/baufinanzierung/auswahl/abschluss?bank=drklein&caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${existing ? "&existing=1" : ""}`,
    },
    {
      id: "check24",
      name: "CHECK24",
      subtitle: "Sehr schnell, digital, gut wenn es unkompliziert ist.",
      bullets: ["Sehr digital", "Schnell startklar", "Ideal bei solidem Puffer"],
      href: ({ caseId, caseRef, existing }) =>
        `/baufinanzierung/auswahl/abschluss?bank=check24&caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${existing ? "&existing=1" : ""}`,
    },
    {
      id: "sparkasse",
      name: "Sparkasse (regional)",
      subtitle: "Für manche Objekte/Regionen stark – abhängig von Standort & Konstellation.",
      bullets: ["Regional oft gute Optionen", "Kann bei Sonderfällen helfen", "Abhängig von Gebiet/Objekt"],
      href: ({ caseId, caseRef, existing }) =>
        `/baufinanzierung/auswahl/abschluss?bank=sparkasse&caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${existing ? "&existing=1" : ""}`,
    },
  ]

  const liveHref = `/baufinanzierung/auswahl/live?caseId=${encodeURIComponent(caseId)}&caseRef=${encodeURIComponent(caseRef)}${existing ? "&existing=1" : ""}`

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Pill>DSGVO-konform</Pill>
          <Pill>Banken übersichtlich</Pill>
          <Pill>Start im Portal</Pill>
          {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              Wählen Sie jetzt Ihre Bank –<br className="hidden sm:block" />
              dann starten Sie den Abschluss.
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Ihre Angaben sind gespeichert. Sie können direkt eine Bank auswählen und später
              den Abschluss starten. Wenn es knapp/komplex ist, wechseln Sie zur Live-Beratung.
            </p>

            <div className="mt-4 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
              <div className="text-xs text-slate-600">Fall-Referenz</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{caseRef || "—"}</div>
              <div className="mt-1 text-xs text-slate-500 break-all">Case-ID: {caseId || "—"}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: ACCENT }}
              >
                ☎
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">Live-Beratung</div>
                <div className="mt-1 text-xs text-slate-600">
                  Wenn es knapp/komplex ist: lieber einmal sauber prüfen als Ablehnungen sammeln.
                </div>
              </div>
            </div>

            <Link
              href={liveHref}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur-xl transition hover:bg-white/90 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
            >
              Zur Live-Beratung
            </Link>
          </div>
        </div>
      </div>

      {/* BANKS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {banks.map((b) => (
          <BankCard key={b.id} bank={b} caseId={caseId} caseRef={caseRef} existing={existing} />
        ))}
      </div>

      {/* MINI FOOTER */}
      <div className="rounded-3xl border border-white/60 bg-white/55 p-4 text-sm text-slate-600 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Fall-Referenz: <span className="font-medium text-slate-900">{caseRef || "—"}</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-slate-900 underline underline-offset-4">
            Ich habe schon ein Konto → anmelden
          </Link>
        </div>
      </div>
    </div>
  )
}
