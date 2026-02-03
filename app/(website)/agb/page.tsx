import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen der SEPANA Plattform.",
  alternates: { canonical: "/agb" },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

export default function AgbPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rechtliches</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Allgemeine Geschäftsbedingungen</h1>
        <p className="mt-3 text-sm text-slate-600">
          Diese AGB gelten für die Nutzung der SEPANA Website und der digitalen Baufinanzierungsstrecke.
        </p>
      </section>

      <Section title="1. Anbieter">
        <p>Flaaq Holding GmbH, Dammstr. 6G, 30890 Barsinghausen</p>
        <p>E-Mail: info@serpana.de</p>
        <p>Telefon: 05035 3169996</p>
      </Section>

      <Section title="2. Geltungsbereich">
        <p>
          Diese Bedingungen regeln die Nutzung der bereitgestellten Online-Funktionen, insbesondere Erfassung,
          Vergleich, Terminierung, Dokumentenübermittlung und Kommunikationsmodule.
        </p>
      </Section>

      <Section title="3. Leistungen">
        <p>
          SEPANA stellt eine digitale Prozessplattform für Baufinanzierung bereit. Ein konkreter Vertragsabschluss mit
          Finanzierungspartnern erfolgt ausschließlich auf Basis gesonderter Vereinbarungen.
        </p>
      </Section>

      <Section title="4. Mitwirkungspflichten des Nutzers">
        <p>
          Nutzer sind verpflichtet, Angaben vollständig und wahrheitsgemäß zu machen, Zugangsdaten vertraulich zu
          behandeln und Änderungen relevanter Daten unverzüglich zu aktualisieren.
        </p>
      </Section>

      <Section title="5. Verfügbarkeit und Änderungen">
        <p>
          Wir bemühen uns um eine hohe Verfügbarkeit der Plattform. Temporäre Einschränkungen, Wartungsfenster oder
          funktionale Weiterentwicklungen bleiben vorbehalten.
        </p>
      </Section>

      <Section title="6. Haftung">
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder
          Gesundheit. Im Übrigen haften wir bei einfacher Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten
          und beschränkt auf den typischerweise vorhersehbaren Schaden.
        </p>
      </Section>

      <Section title="7. Datenschutz">
        <p>
          Es gilt ergänzend die <a href="/datenschutz" className="font-medium text-slate-900 underline underline-offset-4">Datenschutzerklärung</a> in der jeweils aktuellen Fassung.
        </p>
      </Section>

      <Section title="8. Schlussbestimmungen">
        <p>
          Es gilt deutsches Recht. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die
          Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </Section>

      <Section title="9. Hinweis">
        <p>
          Diese AGB sind als sinngemäße Basisfassung hinterlegt und sollten vor Live-Betrieb durch eine rechtliche
          Prüfung final abgestimmt werden.
        </p>
      </Section>
    </div>
  )
}
