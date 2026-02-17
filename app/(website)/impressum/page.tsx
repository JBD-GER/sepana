import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum der SEPANA Plattform (Flaaq Holding GmbH).",
  alternates: { canonical: "/impressum" },
  robots: { index: false, follow: false },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rechtliches</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Impressum</h1>
        <p className="mt-3 text-sm text-slate-600">
          Angaben gemäß § 5 TMG sowie berufsrechtliche Pflichtinformationen.
        </p>
      </section>

      <Section title="Anbieter">
        <p>Flaaq Holding GmbH</p>
        <p>Dammstr. 6G</p>
        <p>30890 Barsinghausen</p>
      </Section>

      <Section title="Kontakt">
        <p>E-Mail: info@sepana.de</p>
        <p>Telefon: 05035 3169996</p>
      </Section>

      <Section title="Register- und Erlaubnisangaben">
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: DE352217621</p>
        <p>Registrierungsnummer: D-W-133-TNSL-07</p>
        <p>Registrierung gemäß § 34i Abs. 1 Satz 1 GewO</p>
        <p>Erlaubnis gemäß § 34c Abs. 1 GewO</p>
        <p>Erlaubnis gemäß § 34i Abs. 1 GewO</p>
      </Section>

      <Section title="Aufsichtsbehörde">
        <p>IHK Hannover</p>
        <p>Bischofsholer Damm 91</p>
        <p>30173 Hannover</p>
        <p>
          <a
            href="https://www.ihk.de/hannover/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline underline-offset-4"
          >
            https://www.ihk.de/hannover/
          </a>
        </p>
      </Section>

      <Section title="Vermittlerregister">
        <p>
          Registerstelle: Deutscher Industrie- und Handelskammertag (DIHK) e. V., Breite Straße 29, 10178 Berlin
        </p>
        <p>
          <a
            href="https://www.vermittlerregister.info/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline underline-offset-4"
          >
            www.vermittlerregister.info
          </a>
        </p>
        <p>
          <a
            href="https://www.vermittlerregister.info/recherche?a=suche&unternehmensname=Flaaq%20Holding%20GmbH"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 underline underline-offset-4"
          >
            Unser Eintrag im Vermittlerregister
          </a>
        </p>
      </Section>

      <Section title="Haftungshinweis">
        <p>
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links.
          Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </Section>
    </div>
  )
}
