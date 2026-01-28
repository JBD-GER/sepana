// app/(website)/baufinanzierung/page.tsx
import type { Metadata } from "next"
import Link from "next/link"
import BaufiStart from "./ui/BaufiStart"

export const metadata: Metadata = {
  title: "Baufinanzierung Vergleich – Konditionen prüfen & 350 € Bonus sichern",
  description:
    "Baufinanzierung vergleichen: Starten Sie mit 3 Eckdaten, ergänzen Sie Haushalt & Kreditnehmer – Ergebnis im Portal. 350 € Bonus bei erfolgreichem Abschluss.",
  alternates: { canonical: "/baufinanzierung" },
  openGraph: {
    title: "Baufinanzierung Vergleich – schnell, strukturiert, ohne Chaos",
    description:
      "Starten Sie mit Vorhaben, Immobilienart und Kaufpreis – danach ergänzen Sie Haushalt & Kreditnehmer. Ergebnis im Portal. 350 € Bonus bei erfolgreichem Abschluss.",
    type: "website",
    url: "/baufinanzierung",
  },
  robots: { index: true, follow: true },
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)] sm:p-7">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function FAQItem({
  q,
  a,
}: {
  q: string
  a: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="text-sm font-semibold text-slate-900">{q}</div>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">{a}</div>
    </div>
  )
}

export default function Page() {
  return (
    <div className="space-y-6">
      {/* Page Headline (SEO + Nutzer) */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Vergleich für Baufinanzierung
        </h1>
        <p className="text-slate-600">
          Bitte geben Sie die Eckdaten ein – anschließend können Sie weitere Kreditnehmer hinzufügen.
        </p>
      </div>

      {/* Start (Hero + Formular + Wizard) */}
      <BaufiStart />

      {/* SEO / Trust / Content Sections */}
      <div className="space-y-6">
        <Section
          title="So funktioniert der Baufinanzierungs-Vergleich"
          subtitle="Schnell starten – strukturiert ergänzen – Ergebnis im Portal sichern."
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-600">Schritt 1</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Eckdaten eingeben</div>
              <div className="mt-2 text-sm text-slate-700">Vorhaben · Immobilienart · Kaufpreis</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-600">Schritt 2</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Haushalt ergänzen</div>
              <div className="mt-2 text-sm text-slate-700">Einnahmen · Fixkosten · laufende Verpflichtungen</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-600">Schritt 3</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Im Portal gespeichert</div>
              <div className="mt-2 text-sm text-slate-700">Abrufbar via Invite/Login · sauber dokumentiert</div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/40 p-4 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Bonus:</span> Bei erfolgreichem Abschluss erhalten Sie{" "}
            <span className="font-semibold text-slate-900">350 €</span> gemäß Bedingungen gutgeschrieben.
          </div>
        </Section>

        <Section
          title="Welche Angaben werden benötigt?"
          subtitle="Damit Banken Konditionen sauber einschätzen können – ohne unnötigen Papierkram."
        >
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <li className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Objekt & Vorhaben</div>
              <div className="mt-2 text-sm text-slate-700">
                Immobilienart, Kaufpreis, Zweck (Kauf/Bau/Modernisierung/Refinanzierung).
              </div>
            </li>
            <li className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Haushaltsrechnung</div>
              <div className="mt-2 text-sm text-slate-700">
                Nettoeinkommen, weitere Einnahmen, Fixkosten, bestehende Kreditraten.
              </div>
            </li>
            <li className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Kreditnehmer</div>
              <div className="mt-2 text-sm text-slate-700">
                Weitere Kreditnehmer optional – Einkommen wird automatisch addiert.
              </div>
            </li>
            <li className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Kontakt & Portal</div>
              <div className="mt-2 text-sm text-slate-700">
                E-Mail für den Portalzugang und Status-Updates (Invite/Login).
              </div>
            </li>
          </ul>
        </Section>

        <Section
          title="FAQ zur Baufinanzierung"
          subtitle="Kurz & verständlich – ohne Fachchinesisch."
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <FAQItem
              q="Ist der Vergleich kostenlos?"
              a={
                <>
                  Der Start ist kostenlos. Sie geben Ihre Eckdaten ein und erhalten eine strukturierte
                  Einordnung im Portal. (Abschluss/Bonus gemäß Bedingungen.)
                </>
              }
            />
            <FAQItem
              q="Warum fragt ihr Haushalt & Einnahmen ab?"
              a={
                <>
                  Banken bewerten die Finanzierbarkeit über die Haushaltsrechnung. Je sauberer die Angaben,
                  desto schneller und besser können Konditionen eingeschätzt werden.
                </>
              }
            />
            <FAQItem
              q="Kann ich weitere Kreditnehmer hinzufügen?"
              a={
                <>
                  Ja. Weitere Kreditnehmer sind optional. Das Einkommen wird automatisch in der Haushaltsrechnung
                  berücksichtigt.
                </>
              }
            />
            <FAQItem
              q="Wie funktioniert der 350 € Bonus?"
              a={
                <>
                  Der Bonus wird nach erfolgreicher Finanzierung/Abschluss gemäß Bedingungen gutgeschrieben.
                  Details finden Sie in den Bedingungen/Informationen im Prozess.
                </>
              }
            />
          </div>
        </Section>

        <Section
          title="Mehr Themen"
          subtitle="Interne Verlinkung für SEO – und hilfreiche Next Steps für Nutzer."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/konsumentenkredit"
              className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
            >
              Konsumentenkredit vergleichen →
              <div className="mt-1 text-xs font-normal text-slate-600">Schnell & strukturiert</div>
            </Link>
            <Link
              href="/ratgeber/baufinanzierung"
              className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
            >
              Ratgeber Baufinanzierung →
              <div className="mt-1 text-xs font-normal text-slate-600">Begriffe, Tipps, Checklisten</div>
            </Link>
            <Link
              href="/kontakt"
              className="rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
            >
              Rückfrage stellen →
              <div className="mt-1 text-xs font-normal text-slate-600">Antwort meist innerhalb kurzer Zeit</div>
            </Link>
          </div>
        </Section>

        {/* JSON-LD (FAQ) */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Ist der Vergleich kostenlos?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Der Start ist kostenlos. Sie geben Ihre Eckdaten ein und erhalten eine strukturierte Einordnung im Portal. Abschluss/Bonus gemäß Bedingungen.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Warum fragt ihr Haushalt & Einnahmen ab?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Banken bewerten die Finanzierbarkeit über die Haushaltsrechnung. Je sauberer die Angaben, desto schneller und besser können Konditionen eingeschätzt werden.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Kann ich weitere Kreditnehmer hinzufügen?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Ja. Weitere Kreditnehmer sind optional. Das Einkommen wird automatisch in der Haushaltsrechnung berücksichtigt.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Wie funktioniert der 350 € Bonus?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Der Bonus wird nach erfolgreicher Finanzierung/Abschluss gemäß Bedingungen gutgeschrieben. Details finden Sie in den Bedingungen/Informationen im Prozess.",
                  },
                },
              ],
            }),
          }}
        />
      </div>
    </div>
  )
}
