This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Stromvergleich mit CHECK24

Die Landingpage liegt unter `/stromvergleich`. Sie wird statisch erstellt. CHECK24 wird erst nach dem aktiven Start des Vergleichs geladen; PLZ, Verbrauch und Ökostrom-Auswahl gelangen direkt an den Partnerrechner. Es gibt keine zusätzliche SEPANA-Datenbank und keine Vorab-Abfrage von Kontaktdaten. Das lokale Familienmotiv wird als 86-KB-WebP geladen.

- Partner-ID: `1164717`, Tracking-ID: `sepana_strom_funnel`.
- Generierter Referenzcode: `<div style="width: 100%" id="sepana-strom-rechner" data-tid="sepana_strom_funnel" data-scrollto="iframe"></div><script src="https://files.check24.net/widgets/auto/1164717/sepana-strom-rechner/power-iframe.js"></script>`.
- Die Integration verwendet die Iframe- und Pixel-Parameter dieses offiziellen Widgets direkt. Damit wird dessen automatische Speicherung der GCLID ohne Marketing-Einwilligung vermieden. Resize- und Abschlussnachrichten werden nur vom aktuellen Iframe und von `https://koop.energie.check24.de` angenommen.
- `strom_vergleich_start` ist ein getrenntes Ereignis und löst keine Google-Ads-Abschlussconversion aus. Nur CHECK24s Nachricht `funnel=conversion` löst `strom_antrag_abgeschlossen` und die Ads-Conversion aus, mit Marketing-Einwilligung und einer zufälligen Deduplizierungs-ID ohne Kundendaten. Die Rückmeldung bestätigt den abgesendeten Antrag, nicht dessen spätere Annahme oder Provisionsfreigabe.
- Conversion im **SEPANA-Konto** (`ocid=7998331857`): **SEPANA Strom – Antrag abgeschlossen**, `AW-17928656455/ceDECKums5MdEMeshuVC`. Primäre Lead-Conversion, eine Zählung pro Klick, Wert 0, datengetriebene Attribution. Das alte CHECK24-AFF-Konto wurde nicht verändert.
- Optionale Build-Overrides: `NEXT_PUBLIC_ENERGY_GOOGLE_ADS_ID` und `NEXT_PUBLIC_ENERGY_CONVERSION_SEND_TO`. Die verifizierten SEPANA-Werte sind bereits als Standard enthalten.

Die Marketing-Einwilligung steuert das Laden des Google-Tags, Google-Ereignisse und die Übergabe einer GCLID. Der Vergleich bleibt ohne Einwilligung nutzbar. CHECK24-Partnerhinweis und Datenschutzhinweise stehen auf den bestehenden rechtlichen Seiten. Die Vertrauenszahl „10.000+“ bezieht sich auf SEPANA insgesamt und übernimmt die bestehende Website-Angabe; sie ist keine Zahl von Stromwechseln.

Verifikation: `node --experimental-strip-types --test tests/energy.test.mjs tests/consent.test.mjs` prüft Eingaben, Affiliate-Zuordnung, mobile/Ökostrom-Parameter, Consent und Absenderprüfung der Nachrichten. Browserprüfung mit Beispielangaben bestätigt echte Tarifergebnisse. Ein echter Wechselvertrag wurde nicht für Testzwecke abgeschlossen; die erste reale, eingewilligte Abschlussconversion sollte nach Veröffentlichung in Google Ads kontrolliert werden.

Der Cookie-Dialog fordert Erstbesucher zu einer expliziten Auswahl auf. Der Hauptbutton akzeptiert alle optionalen Kategorien; Ablehnen und individuelle Einstellungen sind auf derselben Ebene erreichbar. Rechtliche Detailverweise werden beim Öffnen der Einstellungen angezeigt. Der Default-Status wird einmal im Root vor den Google-Tags gesetzt; gespeicherte Entscheidungen, Änderungen und Widerruf werden per v2-Update synchron übernommen, bevor Tags konfiguriert oder Ereignisse versendet werden. Auf der Strom-Landingpage bleibt die Google-Messung im Basic Consent Mode.
