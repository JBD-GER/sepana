import type { Metadata } from "next"
import CustomerQueue from "@/components/live/CustomerQueue"

export const metadata: Metadata = {
  title: "Live-Beratung - Privatkredit",
  robots: { index: false, follow: false },
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 shadow-sm backdrop-blur-xl">
      {children}
    </div>
  )
}

const PRIVATE_CREDIT_FACTS = [
  "Kurze Laufzeit bedeutet meist hoehere Monatsrate, aber geringere Gesamtkosten.",
  "Eine stabile Haushaltsrechnung verbessert oft den angebotenen Zinssatz.",
  "Bereits laufende Kredite beeinflussen die neue Finanzierung direkt.",
  "Eine klare Kreditsumme beschleunigt die Vorpruefung erheblich.",
  "Saubere Unterlagen sind oft wichtiger als ein langes Erklaerungsschreiben.",
  "Kleine Zinsunterschiede wirken sich ueber die Laufzeit deutlich aus.",
  "Sondertilgungen koennen die Restschuld schneller reduzieren.",
  "Eine realistische Monatsrate senkt das Risiko spaeterer Engpaesse.",
  "Bei Umschuldungen lohnt der Blick auf Vorfaelligkeitskosten.",
  "Ein zweiter Antragsteller kann je nach Einkommen helfen.",
  "Digitale Pruefung spart Zeit, ersetzt aber nicht die finale Bonitaetspruefung.",
  "Vollstaendige Angaben bringen schneller eine belastbare Rueckmeldung.",
] as const

export default async function PrivatkreditLivePage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string; caseRef?: string; existing?: string }>
}) {
  const sp = await searchParams
  const caseId = sp.caseId || ""
  const caseRef = sp.caseRef || ""
  const existing = sp.existing === "1"

  return (
    <div className="w-full overflow-x-clip space-y-4">
      <div className="rounded-[2rem] border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Pill>DSGVO-konform</Pill>
          <Pill>Privatkredit Live</Pill>
          {existing ? <Pill>Bestehendes Konto erkannt</Pill> : null}
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">Live-Beratung Privatkredit</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Sie werden in die Warteschlange aufgenommen. Bitte lassen Sie das Fenster geoeffnet. Sobald ein Berater annimmt,
          startet die Session automatisch.
        </p>

        <div className="mt-4 rounded-3xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
          <CustomerQueue
            caseId={caseId}
            caseRef={caseRef}
            backHref="/privatkredit"
            backLabel="Zurueck zu Privatkredit"
            backActionLabel="Warteschlange verlassen und zur Privatkredit-Seite"
            caseLabel="Anfrage-Referenz"
            factsTitle="12 kurze Hinweise zum Privatkredit"
            facts={PRIVATE_CREDIT_FACTS}
          />
        </div>
      </div>
    </div>
  )
}
