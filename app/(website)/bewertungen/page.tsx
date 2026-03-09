import type { Metadata } from "next"
import WebsiteReviewsSection from "../components/WebsiteReviewsSection"

export const metadata: Metadata = {
  title: "Bewertungen | SEPANA",
  description:
    "Alle veröffentlichten Kundenbewertungen zu SEPANA im Überblick: Gesamtbewertung sowie Stimmen aus Baufinanzierung und Privatkredit.",
  alternates: { canonical: "/bewertungen" },
}

export default function BewertungenPage() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <WebsiteReviewsSection
        initialTab="overall"
        expandAllTabsByDefault
        eyebrow="Bewertungen"
        title="Alle veröffentlichten Bewertungen"
        description="Hier finden Sie alle veröffentlichten Kundenstimmen zu SEPANA. Sie können zwischen Gesamtansicht, Baufinanzierung und Privatkredit wechseln."
        ctaHref="/kreditanfrage"
        ctaLabel="Kreditanfrage starten"
      />
    </div>
  )
}


