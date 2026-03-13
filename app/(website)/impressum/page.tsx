import type { Metadata } from "next"
import { ImpressumContent } from "@/app/(website)/components/legal/LegalContent"

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum der SEPANA Plattform (Flaaq Holding GmbH).",
  alternates: { canonical: "/impressum" },
  robots: { index: false, follow: false },
}

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <ImpressumContent />
    </div>
  )
}
