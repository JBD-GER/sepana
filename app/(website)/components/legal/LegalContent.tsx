function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export function ImpressumContent() {
  return (
    <div className="space-y-4">
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
        <p>Telefon: +49 5761 8429660</p>
      </Section>

      <Section title="Umsatzsteuer-Identifikationsnummer">
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: DE352217621</p>
      </Section>

      <Section title="Zusammenarbeit mit Kreditvermittlern">
        <p>
          Wir arbeiten eng mit anderen Kreditvermittlern zusammen, die über eine entsprechende IHK-Erlaubnis verfügen.
        </p>
      </Section>

      <Section title="Haftungshinweis">
        <p>
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für
          den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </Section>

      <Section title="CHECK24.net Partnerprogramm">
        <p><strong>CHECK24.net Partnerprogramm</strong></p>
        <p>
          Wir nehmen am CHECK24.net Partnerprogramm teil. Auf unseren Seiten werden iFrame-Buchungsmasken und andere
          Werbemittel eingebunden, an denen wir über Transaktionen, zum Beispiel durch Leads und Sales, eine
          Werbekostenerstattung erhalten können.
        </p>
        <p>
          Weitere Informationen zur Datennutzung durch CHECK24.net erhalten Sie in der Datenschutzerklärung von{" "}
          <a href="https://www.check24.net" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">CHECK24.net</a>.
        </p>
      </Section>
    </div>
  )
}

export function DatenschutzContent() {
  return (
    <div className="space-y-4">
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
        <p>Telefon: +49 5761 8429660</p>
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
          Rechtsgrundlagen sind insbesondere Art. 6 Abs. 1 lit. b DSGVO (Vertrag/vertragsähnliche Maßnahmen), Art. 6
          Abs. 1 lit. c DSGVO (rechtliche Verpflichtung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) sowie
          bei optionalen Cookies oder Tracking Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
        </p>
      </Section>

      <Section title="4. Empfänger und Dienstleister">
        <p>
          Daten können an technische Dienstleister (Hosting, Authentifizierung, Kommunikations- und Analysedienste)
          sowie an eingebundene Partner weitergegeben werden, soweit dies für den jeweiligen Zweck erforderlich ist.
        </p>
        <p>
          Bei Anfragen im Bereich <span className="font-medium text-slate-900">Kredit ohne Schufa</span> übermitteln
          wir die von Ihnen bereitgestellten Daten im erforderlichen Umfang auch an unseren Partner{" "}
          <span className="font-medium text-slate-900">SKAG Vertriebs GmbH</span> sowie an die{" "}
          <span className="font-medium text-slate-900">SIGMA Kreditbank AG</span>, soweit dies für Vorprüfung,
          weitere Bearbeitung, Vertragsprozess, Legitimation und Auszahlung notwendig ist.
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
          Wir verwenden technisch notwendige Cookies sowie nach Ihrer ausdrücklichen Entscheidung im Consent-Banner
          optionale Cookies für Analyse, Marketing und Personalisierung.
        </p>
        <p>
          Ihre Entscheidung kann jederzeit mit Wirkung für die Zukunft angepasst werden. Bis zu einer Entscheidung
          bleiben optionale Zwecke deaktiviert.
        </p>
      </Section>

      <Section title="7. Ihre Rechte">
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit sowie Widerspruch gegen bestimmte Verarbeitungen. Erteilte Einwilligungen können Sie
          jederzeit widerrufen.
        </p>
        <p>Zudem haben Sie ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.</p>
      </Section>

      <Section title="Stromvergleich und CHECK24.net Partnerprogramm">
        <p>
          Der Stromvergleich wird durch CHECK24 in einem eingebundenen Rechner bereitgestellt. Erst wenn Sie den
          Vergleich starten, wird eine Verbindung zu CHECK24 hergestellt. Dabei werden Ihre Postleitzahl, Ihr
          angegebener Jahresverbrauch und Ihre Ökostrom-Auswahl sowie technisch erforderliche Verbindungsdaten
          (insbesondere die IP-Adresse und Browserinformationen) an CHECK24 übermittelt.
        </p>
        <p>
          Die Partner- und Tracking-ID ordnen den Vergleich SEPANA zu. Nach Ihrer Einwilligung in Marketing kann
          zusätzlich die Google-Ads-Klick-ID zur Zuordnung eines Anzeigenklicks übermittelt werden. Ein von CHECK24
          gemeldeter abgeschlossener Antrag kann nach Ihrer Marketing-Einwilligung an Google Ads als Conversion
          gemeldet werden. Der Start des Vergleichs wird dabei getrennt vom Abschluss erfasst. Namen,
          E-Mail-Adressen, Telefonnummern, Postleitzahlen und Stromverbrauch übermitteln wir nicht in diesen
          Conversion-Ereignissen an Google.
        </p>
        <p>
          Die Google-Messung im Stromvergleich wird erst nach Ihrer Marketing-Einwilligung geladen. Sie können
          Ihre Einwilligung jederzeit über die Cookie-Einstellungen widerrufen. Die im CHECK24-Rechner
          eingegebenen Antragsdaten verarbeitet CHECK24 nach seinen eigenen Datenschutzhinweisen. Weitere
          Informationen finden Sie unter{" "}
          <a href="https://www.check24.net/datenschutz/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Datenschutz bei CHECK24.net</a>{" "}
          und unter{" "}
          <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Datenschutz bei Google</a>.
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
