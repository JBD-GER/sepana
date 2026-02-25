import type { Metadata } from "next"
import LiveBeratungStart from "./ui/LiveBeratungStart"

export const metadata: Metadata = {
  title: "Live-Beratung | SEPANA",
  description:
    "Direkt im Browser mit SEPANA sprechen. Produkt wählen, E-Mail eingeben und bei Verfügbarkeit sofort in die Live-Warteschlange starten.",
  alternates: { canonical: "/live-beratung" },
}

export default function LiveBeratungPage() {
  return <LiveBeratungStart />
}
