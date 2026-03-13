import type { Metadata } from "next"
import { DatenschutzContent } from "@/app/(website)/components/legal/LegalContent"

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzhinweise zur Nutzung der SEPANA Plattform.",
  alternates: { canonical: "/datenschutz" },
  robots: { index: false, follow: false },
}

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <DatenschutzContent />
    </div>
  )
}
