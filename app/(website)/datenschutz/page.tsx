import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzhinweise zur Nutzung der SEPANA Plattform.",
  alternates: { canonical: "/datenschutz" },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rechtliches</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Datenschutzerklärung</h1>
        <p className="mt-3 text-sm text-slate-600">
          Diese Hinweise informieren Sie über Art, Umfang und Zweck der Verarbeitung personenbezogener Daten auf
          unserer Website und in unseren digitalen Baufinanzierungsprozessen.
        </p>
      </section>

      <Section title="1. Verantwortlicher">
        <p>Flaaq Holding GmbH, Dammstr. 6G, 30890 Barsinghausen</p>
        <p>E-Mail: info@sepana.de</p>
        <p>Telefon: 05035 3169996</p>
      </Section>

      <Section title="2. Verarbeitete Daten">
        <p>
          Wir verarbeiten insbesondere Stammdaten (z. B. Name, E-Mail, Telefonnummer), Finanzierungsdaten,
          Nutzungsdaten (z. B. Zeitpunkte, Interaktionen), Termin- und Kommunikationsdaten sowie technisch
          erforderliche Protokolldaten.
        </p>
      </Section>

      <Section title="3. Zwecke und Rechtsgrundlagen">
        <p>
          Die Verarbeitung erfolgt zur Bereitstellung der Website und Plattformfunktionen, zur Durchführung von
          Baufinanzierungsanfragen, zur Kommunikation mit Ihnen sowie zur IT-Sicherheit.
        </p>
        <p>
          Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag/vertragsähnliche Maßnahmen),
          Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)
          sowie – bei optionalen Cookies/Tracking – Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
        </p>
      </Section>

      <Section title="4. Empfänger und Dienstleister">
        <p>
          Daten können an technische Dienstleister (Hosting, Authentifizierung, Kommunikations- und Analysedienste)
          sowie an eingebundene Partner weitergegeben werden, soweit dies für den jeweiligen Zweck erforderlich ist.
        </p>
      </Section>

      <Section title="5. Speicherdauer">
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder
          gesetzliche Aufbewahrungsfristen bestehen.
        </p>
      </Section>

      <Section title="6. Cookies und Consent Mode v2">
        <p>
          Wir verwenden technisch notwendige Cookies sowie – nach Ihrer ausdrücklichen Entscheidung im Consent-Banner –
          optionale Cookies für Analyse, Marketing und Personalisierung.
        </p>
        <p>
          Ihre Entscheidung kann jederzeit mit Wirkung für die Zukunft angepasst werden. Bis zu einer Entscheidung
          bleiben optionale Zwecke deaktiviert.
        </p>
      </Section>

      <Section title="7. Ihre Rechte">
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
          sowie Widerspruch gegen bestimmte Verarbeitungen. Erteilte Einwilligungen können Sie jederzeit widerrufen.
        </p>
        <p>
          Zudem haben Sie ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.
        </p>
      </Section>

      <Section title="8. Hinweis">
        <p>
          Diese Datenschutzerklärung ist als praxisnahe Basisfassung hinterlegt und sollte regelmäßig rechtlich geprüft
          sowie auf konkrete Prozesse und Dienstleister abgestimmt werden.
        </p>
      </Section>
    </div>
  )
}
