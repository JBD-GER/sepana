import styles from "./strom.module.css"

export default function SavingsExample() {
  return <aside className={styles.savingsCard} aria-label="Beispiel für deine mögliche Stromersparnis">
    <details className={styles.savingsDetails}>
      <summary>
        <span className={styles.savingsSummary}>
          <span className={styles.savingsEyebrow}>MEHR SPIELRAUM FÜR DEIN ZUHAUSE</span>
          <span className={styles.savingsHeadline}>Bis zu <strong>850 €</strong> sparen</span>
          <span className={styles.savingsHint}>Im ersten Jahr · Beispielrechnung ansehen</span>
        </span>
        <span className={styles.savingsToggle} aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </summary>
      <div className={styles.savingsContent}>
        <h2>So viel lässt sich im Beispiel sparen.</h2>
        <p className={styles.savingsLocation}>07546 Gera · 6.600 kWh pro Jahr</p>
        <div className={styles.priceComparison} aria-label="Jahreskosten im Vergleich">
          <div><span>Grundversorgung</span><strong>2.833,15 €</strong></div>
          <div className={styles.basePriceBar} aria-hidden="true" />
          <div><span>Günstigster Tarif</span><strong>1.974,59 €</strong></div>
          <div className={styles.lowerPriceBar} aria-hidden="true" />
        </div>
        <div className={styles.savingsResult}><div><strong>858,56 €</strong><span>Ersparnis im ersten Jahr</span></div><div><strong>71,55 €</strong><span>Ø pro Monat</span></div></div>
        <dl className={styles.savingsTariffs}>
          <div><dt>Vergleichstarif</dt><dd>Süwag · Süwag Strom Garant 100</dd></div>
          <div><dt>Grundversorgung</dt><dd>EV Gera · Grundversorgung HH</dd></div>
        </dl>
        <p className={styles.savingsDisclaimer}>Beispielrechnung vom 06.10.2026: Verglichen werden die angegebenen Gesamtkosten im ersten Jahr. Deine tatsächliche Ersparnis hängt von Wohnort, Verbrauch, bisherigem Vertrag und dem gewählten Tarif ab. Prüfe auch Bonusbedingungen und die Kosten im Folgejahr. Preise und Angebote können sich ändern.</p>
      </div>
    </details>
    <p className={styles.savingsSource}>Quelle: CHECK24 Vergleichsrechner für Strom · Beispiel vom 06.10.2026</p>
  </aside>
}
