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

Die aufklappbare Sparkarte zeigt die vom Auftraggeber bereitgestellte CHECK24-Beispielrechnung vom 06.10.2026 (07546 Gera, 6.600 kWh): 2.833,15 € Grundversorgung minus 1.974,59 € Vergleichstarif = 858,56 € im ersten Jahr. „Bis zu 850 €“ ist als Beispiel gekennzeichnet; die Quelle wird ohne Link angezeigt. Nach dem ersten Laden scrollt jeder weitere iframe-Seitenwechsel zum Anfang des Rechners, entsprechend dem offiziellen CHECK24-Widget. Größenmeldungen allein lösen kein Scrollen aus.

Der CHECK24-Parameter `ref` enthält ausdrücklich `https://www.sepana.de/stromvergleich`. Außerhalb von `www.sepana.de` und `sepana.de` erhalten Aufrufe die Tracking-ID `sepana_strom_funnel_test`, keine GCLID und keine Google-Ads-Funnel-Ereignisse. Bereits erfasste CHECK24-Sales werden dadurch nicht nachträglich verändert.

- Partner-ID: `1164717`, Tracking-ID: `sepana_strom_funnel`.
- Generierter Referenzcode: `<div style="width: 100%" id="sepana-strom-rechner" data-tid="sepana_strom_funnel" data-scrollto="iframe"></div><script src="https://files.check24.net/widgets/auto/1164717/sepana-strom-rechner/power-iframe.js"></script>`.
- Die Integration verwendet die Iframe- und Pixel-Parameter dieses offiziellen Widgets direkt. Damit wird dessen automatische Speicherung der GCLID ohne Marketing-Einwilligung vermieden. Resize- und Abschlussnachrichten werden nur vom aktuellen Iframe und von `https://koop.energie.check24.de` angenommen.
- `strom_vergleich_start` ist ein getrenntes Ereignis und löst keine Google-Ads-Abschlussconversion aus. Nur CHECK24s Nachricht `funnel=conversion` löst `strom_antrag_abgeschlossen` und die Ads-Conversion aus, mit Marketing-Einwilligung und einer zufälligen Deduplizierungs-ID ohne Kundendaten. Die Rückmeldung bestätigt den abgesendeten Antrag, nicht dessen spätere Annahme oder Provisionsfreigabe.
- Conversion im **SEPANA-Konto** (`ocid=7998331857`): **SEPANA Strom – Antrag abgeschlossen**, `AW-17928656455/ceDECKums5MdEMeshuVC`. Primäre Lead-Conversion, eine Zählung pro Klick, Wert 0, datengetriebene Attribution. Das alte CHECK24-AFF-Konto wurde nicht verändert.
- Optionale Build-Overrides: `NEXT_PUBLIC_ENERGY_GOOGLE_ADS_ID` und `NEXT_PUBLIC_ENERGY_CONVERSION_SEND_TO`. Die verifizierten SEPANA-Werte sind bereits als Standard enthalten.

Die Marketing-Einwilligung steuert das Laden des Google-Tags, Google-Ereignisse und die Übergabe einer GCLID. Der Vergleich bleibt ohne Einwilligung nutzbar. CHECK24-Partnerhinweis und Datenschutzhinweise stehen auf den bestehenden rechtlichen Seiten. Die Vertrauenszahl „10.000+“ bezieht sich auf SEPANA insgesamt und übernimmt die bestehende Website-Angabe; sie ist keine Zahl von Stromwechseln.

Verifikation: `node --experimental-strip-types --test tests/energy.test.mjs tests/consent.test.mjs` prüft Eingaben, Affiliate-Zuordnung, mobile/Ökostrom-Parameter, Consent und Absenderprüfung der Nachrichten. Browserprüfung mit Beispielangaben bestätigt echte Tarifergebnisse. Ein echter Wechselvertrag wurde nicht für Testzwecke abgeschlossen; die erste reale, eingewilligte Abschlussconversion sollte nach Veröffentlichung in Google Ads kontrolliert werden.

Der Cookie-Dialog fordert Erstbesucher zu einer expliziten Auswahl auf. Der Hauptbutton akzeptiert alle optionalen Kategorien; Ablehnen und individuelle Einstellungen sind auf derselben Ebene erreichbar. Rechtliche Detailverweise werden beim Öffnen der Einstellungen angezeigt. Der Default-Status wird einmal im Root vor den Google-Tags gesetzt; gespeicherte Entscheidungen, Änderungen und Widerruf werden per v2-Update synchron übernommen, bevor Tags konfiguriert oder Ereignisse versendet werden. Auf der Strom-Landingpage bleibt die Google-Messung im Basic Consent Mode.


## Creditolo-Weiterleitung

Neue vollständige Privatkreditanfragen (einschließlich PV/Solar, Hochzeit, Auto, Umschuldung und sonstiger Zwecke) werden nach ausdrücklicher Einwilligung direkt an Creditolo eingeliefert. Die interne Variante `schufa_frei` verwendet den dafür bereitgestellten Creditolo-Endpunkt; die Kundenoberfläche verwendet neutrale Produktbezeichnungen. Creditolos eigene Systemmails werden von Creditolo gestaltet.

- Servervariablen: `CREDITOLO_API_KEY` (Secret), `CREDITOLO_PARTNER_ID`, `PRIVATKREDIT_PROVIDER=creditolo`, `CRON_SECRET` (Secret). Der API-Key gehört niemals in `NEXT_PUBLIC_*`, Quellcode oder Browserdaten.
- Die zwei Migrationen `creditolo_delivery_outbox` und `creditolo_confirmation_email` müssen vor dem Release angewendet werden. Die Tabelle ist ausschließlich für `service_role` zugänglich.
- Kredit-Einstiege (allgemeine Anfrage, Umschuldung, Hochzeit, PV, Rechner und Scheidung) führen mit ihren Eingaben in den vollständigen Antrag. Die Übergabe erfolgt ausschließlich im aktuellen Tab über kurzlebigen Session-Speicher, nicht über personenbezogene URL-Parameter. Erst nach allen Creditolo-Pflichtangaben und ausdrücklicher Einwilligung kann abgesendet werden. Explizite Rückrufbitten bleiben Kontaktanfragen. Vorprüfungen der zweiten Strecke sind als Entwurf vom abgesendeten Vollantrag getrennt. Creditolo verlangt bei direkter Einlieferung insbesondere Kontakt- und Personendaten, Adresse, Beschäftigung, Einkommen und eine deutsche IBAN. Mindestbetrag: 3.000 EUR.
- `POST /api/privatkredit/request` weist unvollständige Kredit-Anfragen vor der Lead-Anlage zurück. Ein vollständiger Antrag wird innerhalb derselben Serveranfrage gespeichert und an Creditolo übermittelt. Browser und Server teilen die Pflichtfeldprüfung; es gibt keinen separaten Browseraufruf mehr, der die erstmalige Übermittlung auslösen muss.
- `creditolo_deliveries` erfasst Einwilligung, Übermittlungsstatus und Antwortcode. Erfolgreiche Übermittlungen werden nicht erneut gesendet; die zusätzliche Payload-Kopie wird nach Erfolg entfernt. Unklare Ergebnisse werden zur Prüfung markiert, weil Creditolo keinen dokumentierten Idempotenzschlüssel anbietet. Vor erneutem Versand im Partnerkonto abgleichen.
- `/admin/creditolo` zeigt die aktuellen Weiterleitungen. Der geschützte Cron `/api/system/creditolo` bearbeitet offene Sendungen alle zehn Minuten. Alte Europace-Vorgänge bleiben lesbar; für neue Vorgänge wird kein Europace-Import angelegt.
- Formulare und Kundenbestätigungen informieren darüber, dass Creditolo SEPANA ergänzt, insbesondere bei Ressourcenengpässen, und jede vollständige Anfrage nach Einwilligung automatisch weitergeleitet wird. Bestätigungsmails verwenden eine fallbezogene Resend-Idempotenzkennung.

Prüfung:

```sh
node --require ./scripts/creditolo-test-loader.cjs --test scripts/creditolo.test.cjs scripts/creditolo-required-submission.test.cjs
npx tsc --noEmit
npm run build
```

`node scripts/creditolo-smoke.cjs` verwendet ausschließlich Creditolos offiziellen Testmodus mit Vor- und Nachname `Test`. Creditolo versendet dabei eine eigene Testbestätigung an den Partner. `node scripts/creditolo-e2e.cjs` ist ausschließlich für einen lokalen Preview-Testserver gedacht und entfernt die von ihm angelegten Testfälle und den Testbenutzer anschließend wieder. `.env.local` benötigt für diese lokale Prüfung die Serverkonfiguration; niemals Testskripte mit echten Kundendaten verwenden.
