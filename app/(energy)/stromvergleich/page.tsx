import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import OpenConsentButton from "@/app/(website)/components/OpenConsentButton"
import PowerFunnel from "./PowerFunnel"
import styles from "./strom.module.css"

export const metadata: Metadata = {
  title: "Stromvergleich – einfach vergleichen & online wechseln",
  description: "Vergleiche Stromtarife mit SEPANA und CHECK24. Mit Postleitzahl und Verbrauch kostenlos starten, passenden Tarif finden und zu 100 % online beantragen.",
  alternates: { canonical: "/stromvergleich" },
  openGraph: { title: "Stromtarife vergleichen. Einfach weniger zahlen. | SEPANA", description: "Dein Stromvergleich mit CHECK24: kostenlos vergleichen und 100 % online beantragen.", url: "/stromvergleich" },
}

const FAQ = [
  ["Ist der Stromvergleich wirklich kostenlos?", "Ja. Du kannst Tarife kostenlos und unverbindlich vergleichen. Kosten entstehen erst durch einen von dir abgeschlossenen Stromvertrag zu den Konditionen des gewählten Anbieters. SEPANA nimmt am CHECK24.net Partnerprogramm teil und kann für vermittelte Anträge eine Vergütung erhalten."],
  ["Was brauche ich für den Vergleich?", "Zum Start reichen deine Postleitzahl und dein jährlicher Stromverbrauch. Den Verbrauch findest du auf deiner letzten Jahresabrechnung. Die Personenauswahl liefert nur eine grobe Orientierung; eine elektrische Heizung, ein Elektroauto oder die Warmwasserbereitung können den Verbrauch deutlich verändern."],
  ["Kann ich den Wechsel komplett online beantragen?", "Ja. Nach der Tarifauswahl kannst du den Antrag direkt im CHECK24-Rechner online stellen. Halte dafür deine letzte Stromrechnung mit den Vertrags- und Zählerdaten bereit. Der neue Anbieter prüft und bestätigt deinen Antrag."],
  ["Worauf sollte ich beim Tarif achten?", "Vergleiche Grundpreis, Arbeitspreis, Vertragslaufzeit, Kündigungsfrist und Preisgarantie. Prüfe bei einem Bonus die Voraussetzungen und die Kosten nach dem ersten Jahr. Dein Vorteil hängt von deinem bisherigen Tarif und dem gewählten Angebot ab."],
  ["Ist SEPANA mein neuer Stromanbieter?", "SEPANA bietet dir den Einstieg in den Vergleich. Die Vergleichstechnologie und Antragsstrecke stellt CHECK24 bereit. Deinen Stromliefervertrag schließt du mit dem ausgewählten Energieversorger ab."],
]

function Check() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> }

export default function PowerPage() {
  return <div className={styles.page}>
    <a className={styles.skipLink} href="#strom-start">Direkt zum Stromvergleich</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.logo} aria-label="SEPANA Startseite">SEPANA<span>Einfach. Mehr möglich.</span></Link>
      <nav aria-label="Stromvergleich"><a href="#so-gehts">So funktioniert’s</a><a href="#fragen">Fragen & Antworten</a></nav>
      <a href="#strom-start" className={styles.headerCta}>Tarife vergleichen</a>
    </div></header>
    <main>
      <section className={styles.hero} aria-labelledby="strom-title"><div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <div className={styles.partnerPill}><span>SEPANA</span><i aria-hidden="true" />Stromvergleich mit <strong>CHECK24</strong></div>
          <p className={styles.eyebrow}>DEIN ZUHAUSE. DEIN STROM. DEINE WAHL.</p>
          <h1 id="strom-title">Stromtarife vergleichen.<br /><span>Einfach weniger zahlen.</span></h1>
          <p className={styles.heroText}>Mach mehr aus deinem Haushaltsbudget. Vergleiche Stromtarife für dein Zuhause und beantrage deinen Wechsel bequem online.</p>
          <ul className={styles.heroChecks}><li><Check />Kostenlos & unverbindlich vergleichen</li><li><Check />100 % online beantragen</li><li><Check />Mit der Vergleichstechnologie von CHECK24</li></ul>
          <div className={styles.heroTrust}><div className={styles.trustNumber}>10.000<span>+</span></div><div>vertrauen SEPANA<small>über unsere Angebote hinweg</small></div></div>
        </div>
        <PowerFunnel />
      </div><div className={styles.heroBottom}><span>Ein kleiner Tarif-Check. Eine gute Entscheidung für dein Zuhause.</span><span>STROM EINFACH WEITERDENKEN</span></div></section>
      <section className={styles.proofStrip} aria-label="Deine Vorteile"><div><strong>0 €</strong><span>für deinen Vergleich</span></div><div><strong>100 %</strong><span>online beantragen</span></div><div><strong>Deine Wahl</strong><span>Tarife in Ruhe vergleichen</span></div><div><strong>CHECK24</strong><span>unser Vergleichspartner</span></div></section>
      <section className={`${styles.section} ${styles.stepsSection}`} id="so-gehts"><div className={styles.sectionHeading}><p className={styles.eyebrow}>WENIG AUFWAND. KLARER ÜBERBLICK.</p><h2>Dein neuer Tarif.<br />In drei einfachen Schritten.</h2><p>Du entscheidest, welcher Stromtarif zu deinem Alltag passt.</p></div><div className={styles.steps}>
        {[['01', 'Kurz deinen Bedarf angeben.', 'Postleitzahl und Jahresverbrauch eingeben. Deine letzte Stromrechnung hilft dir beim genauen Verbrauch.'], ['02', 'Tarife miteinander vergleichen.', 'Preise, Laufzeiten und Tarifdetails im CHECK24-Vergleich prüfen. Auf Wunsch auch nur Ökostrom.'], ['03', 'Online deinen Wechsel beantragen.', 'Passenden Tarif auswählen und den Antrag direkt bei CHECK24 ausfüllen. Ganz bequem von zuhause.']].map(([number, title, text]) => <article key={number}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
      </div></section>
      <section className={styles.lifeSection}><div className={styles.lifeImage}><Image src="/strom-zuhause.webp" alt="Eine Familie verbringt gemeinsam Zeit in ihrer Küche" fill sizes="(max-width: 760px) 100vw, 50vw" /></div><div className={styles.lifeCopy}><p className={styles.eyebrow}>FÜR ALLES, WAS DIR WICHTIG IST.</p><h2>Dein Strom bleibt Strom.<br /><span>Dein Tarif kann mehr.</span></h2><p>Beim Strom zählt, was bei dir ankommt: ein Tarif, der zu deinem Verbrauch, deinem Zuhause und deinem Budget passt.</p><p>SEPANA macht dir den Einstieg leicht. CHECK24 liefert den Vergleich. Und du behältst die Entscheidung.</p><a href="#strom-start" className={styles.darkButton}>Meinen Stromtarif prüfen</a><small>Deine mögliche Ersparnis hängt von deinem aktuellen Vertrag und dem neuen Tarif ab.</small></div></section>
      <section className={`${styles.section} ${styles.partnerSection}`}><div><p className={styles.eyebrow}>GEMEINSAM EINFACHER.</p><h2>SEPANA × CHECK24</h2><p>Dein vertrauter Einstieg. Eine bewährte Vergleichstechnologie. Wir nehmen am CHECK24.net Partnerprogramm teil und bringen den Stromvergleich direkt zu dir.</p><a href="/impressum">Mehr zur Partnerschaft</a></div><div className={styles.partnerFacts}><div><Check /><span><strong>Tarife transparent vergleichen</strong><small>Konditionen und Vertragsdetails direkt im Rechner</small></span></div><div><Check /><span><strong>Bequem online beantragen</strong><small>Vom Tarifvergleich bis zum Wechselantrag</small></span></div><div><Check /><span><strong>Du entscheidest selbst</strong><small>Der Vergleich verpflichtet dich zu keinem Abschluss</small></span></div></div></section>
      <section className={`${styles.section} ${styles.faqSection}`} id="fragen"><div className={styles.sectionHeading}><p className={styles.eyebrow}>GUT ZU WISSEN.</p><h2>Deine Fragen.<br />Klare Antworten.</h2><p>Alles Wichtige vor deinem ersten Vergleich.</p></div><div className={styles.faqList}>{FAQ.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
      <section className={styles.finalCta}><p className={styles.eyebrow}>DEIN NÄCHSTER SCHRITT IST KLEIN.</p><h2>Gib deinem Stromtarif<br />einen frischen Vergleich.</h2><a href="#strom-start" className={styles.primaryButton}>Jetzt kostenlos vergleichen</a><p>Postleitzahl. Verbrauch. Los geht’s.</p></section>
    </main>
    <footer className={styles.footer}><div className={styles.footerMain}><Link className={styles.logo} href="/">SEPANA<span>Einfach. Mehr möglich.</span></Link><p>Stromvergleich mit CHECK24.<br />Mehr Überblick für dein Zuhause.</p><nav aria-label="Rechtliche Informationen"><Link href="/impressum">Impressum</Link><Link href="/datenschutz">Datenschutz</Link><OpenConsentButton /></nav></div><p className={styles.affiliateNotice}><strong>CHECK24.net Partnerprogramm:</strong> Wir erhalten möglicherweise eine Werbekostenerstattung für vermittelte Leads und Sales. Vergleich und Antrag stellt CHECK24 bereit. Dein Vertragspartner ist der gewählte Stromanbieter.</p><div className={styles.footerBottom}><span>© {new Date().getFullYear()} SEPANA · Flaaq Holding GmbH</span><a href="https://www.check24.net/datenschutz/" target="_blank" rel="noopener noreferrer">Datenschutzhinweise CHECK24</a></div></footer>
  </div>
}
